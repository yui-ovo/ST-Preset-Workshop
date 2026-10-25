// Resource ownership is explicit at workshop call sites. No host prototypes,
// timers or jQuery methods are monkey-patched, so other extensions are unaffected.
export function runtimeResource(value) {
  return globalThis.__PMM_RUNTIME_SCOPE__?.own(value) || value;
}

export function createRuntimeScope(self) {
  const host = self.parent, proxies = new WeakMap(), listeners = [], emitters = [], observers = new Set(), nodes = new Set(), timers = new Map();
  const originalGlobals = new Map(Object.keys(host).filter(k=>/^__PMM_|^JESSICA_DEBUG$/.test(k)).map(k=>[k,host[k]]));
  let active = true;
  const capture = options => typeof options === 'boolean' ? options : !!options?.capture;
  const timerKey = (name, id) => `${name.includes('Animation')?'frame':name.includes('Idle')?'idle':'timer'}:${id}`;
  const keepNode = node => { if (node?.nodeType === 1) nodes.add(new WeakRef(node)); return node; };
  const cancelFor = name => name === 'setInterval' ? 'clearInterval' : name === 'requestAnimationFrame' ? 'cancelAnimationFrame' : name === 'requestIdleCallback' ? 'cancelIdleCallback' : 'clearTimeout';
  function own(target) {
    if (!target || !['object','function'].includes(typeof target)) return target;
    if (proxies.has(target)) return proxies.get(target);
    const proxy = new Proxy(target, { get(object, name) {
      const fn = Reflect.get(object, name, object);
      if (typeof fn !== 'function') return fn;
      if (name === 'addEventListener') return (type, handler, options) => {
        if (!active) return;
        const result=fn.call(object,type,handler,options);
        if (!handler || !['function','object'].includes(typeof handler)) return result;
        // Never keep an old row or closed panel alive just to remember teardown.
        if (!listeners.some(v=>v[0].deref()===object && v[1]===type && v[2].deref()===handler && capture(v[3])===capture(options))) listeners.push([new WeakRef(object),type,new WeakRef(handler),options]);
        if(listeners.length%256===0)for(let n=listeners.length-1;n>=0;n--)if(!listeners[n][0].deref()||!listeners[n][2].deref())listeners.splice(n,1);
        return result;
      };
      if (name === 'removeEventListener') return (type, handler, options) => {
        for(let n=listeners.length-1;n>=0;n--) if(listeners[n][0].deref()===object && listeners[n][1]===type && listeners[n][2].deref()===handler && capture(listeners[n][3])===capture(options)) listeners.splice(n,1);
        return fn.call(object,type,handler,options);
      };
      if (['setTimeout','setInterval','requestAnimationFrame','requestIdleCallback'].includes(name)) return (callback,...args) => {
        if (!active) return 0;
        let id;
        const run = (...values) => { if(name!=='setInterval')timers.get(object)?.delete(timerKey(name,id)); if(active)callback(...values); };
        id=fn.call(object,run,...args);
        if(!timers.has(object))timers.set(object,new Map()); timers.get(object).set(timerKey(name,id),[id,cancelFor(name)]); return id;
      };
      if (['clearTimeout','clearInterval','cancelAnimationFrame','cancelIdleCallback'].includes(name)) return id => { timers.get(object)?.delete(timerKey(name,id)); return fn.call(object,id); };
      if (name === 'observe' && typeof object.disconnect === 'function') return (...args) => { if(!active)return; observers.add(object); return fn.apply(object,args); };
      if (name === 'disconnect') return (...args) => { observers.delete(object); return fn.apply(object,args); };
      if (['createElement','createElementNS'].includes(name)) return (...args) => keepNode(fn.apply(object,args));
      if (name === 'on' && (object.jquery || typeof object.off === 'function' || typeof object.removeListener === 'function')) return (...args) => {
        if(!active)return object;
        if(object.jquery) {
          // Namespace only our registration, including delegated handlers.
          const [events,...rest]=args;
          if(typeof events==='string') {
            const scoped=events.split(/\s+/).map(e=>e+'.pmmRuntime').join(' ');
            emitters.push(()=>object.off(scoped,...rest)); return fn.call(object,scoped,...rest);
          }
        }
        emitters.push(()=>{const off=object.off || object.removeListener;off?.apply(object,args);});
        return fn.apply(object,args);
      };
      // Prevent a suspended async task from attaching UI after its runtime stops.
      if (['append','prepend','appendChild','insertBefore','replaceChildren','after','before','appendTo'].includes(name)) return (...args) => {
        if(!active)return object;
        if(name==='appendTo' && object.jquery) object.each((_n,node)=>keepNode(node));
        return fn.apply(object,args);
      };
      return fn.bind(object);
    }});
    proxies.set(target,proxy); return proxy;
  }
  function dispose() {
    if(!active)return;
    // Existing teardown hooks release Vue apps, stores and context subscriptions.
    // The mode guard has already resolved all unsaved editor choices.
    self.dispatchEvent(new self.Event('pagehide'));
    for(const key of Object.keys(host).filter(k=>/^__PMM_/.test(k))) {
      if(host[key]===originalGlobals.get(key))continue;
      try { if(typeof host[key]?.cleanup==='function')host[key].cleanup(); else if(/CLEANUP/.test(key)&&typeof host[key]==='function')host[key](); } catch(error) { console.warn('[预设工坊] 释放模块',key,error); }
    }
    active=false;
    for(const [target,type,handler,options] of listeners) {const cb=handler.deref();if(cb)target.deref()?.removeEventListener(type,cb,options);}
    listeners.length=0;
    for(const cancel of emitters) {try{cancel();}catch{}} emitters.length=0;
    for(const observer of observers)observer.disconnect(); observers.clear();
    for(const [target,ids] of timers) for(const [id,cancel] of ids.values())target[cancel]?.(id); timers.clear();
    for(const ref of nodes) {const node=ref.deref();if(node?.isConnected)node.remove();} nodes.clear();
    for(const key of Object.keys(host).filter(k=>/^__PMM_|^JESSICA_DEBUG$/.test(k))) {
      if(host[key]===originalGlobals.get(key))continue;
      if(originalGlobals.has(key))host[key]=originalGlobals.get(key);else delete host[key];
    }
  }
  return {own,dispose,get active(){return active;},stats:()=>({listeners:listeners.length,observers:observers.size,timers:[...timers.values()].reduce((n,m)=>n+m.size,0),emitters:emitters.length})};
}
