import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Run complete shipped modules with browser boundaries supplied by this small DOM.
// Internal gesture helpers must never be extracted or replaced: that hid a missing
// cancelPendingTap definition in the previous fragment-only regression tests.
function browser(width=360,height=800) {
  let now=10000,nextId=0;
  const timers=new Map(),frames=new Map(),microtasks=[],observers=[],nodes=[];
  const metrics={layoutReads:0,computedReads:0,storageWrites:0},storage=new Map();
  class EventTarget {
    listeners=new Map();
    addEventListener(type,fn){let set=this.listeners.get(type);if(!set)this.listeners.set(type,set=new Set());set.add(fn);}
    removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
    dispatchEvent(event){event.target??=this;event.currentTarget=this;for(const fn of [...this.listeners.get(event.type)||[]]){fn(event);if(event.immediateStopped)break;}return !event.defaultPrevented;}
  }
  function matches(node,selector,scope) {
    return selector.split(',').some(part=>{
      const tokens=part.trim().replaceAll('>',' > ').split(/\s+/);
      const simple=(target,token)=>{
        if(!target)return false;if(token===':scope')return target===scope;
        const tag=token.match(/^[a-z]+/i)?.[0];if(tag&&tag.toLowerCase()!==target.tagName?.toLowerCase())return false;
        for(const id of token.matchAll(/#([\w-]+)/g))if(target.id!==id[1])return false;
        for(const name of token.matchAll(/\.([\w-]+)/g))if(!target.classList.contains(name[1]))return false;
        for(const attr of token.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)){
          const value=target.getAttribute(attr[1]);if(value==null||attr[2]!=null&&attr[2]!==value)return false;
        }
        return true;
      };
      function walk(target,index){
        if(!simple(target,tokens[index]))return false;
        if(index===0)return true;
        if(tokens[index-1]==='>')return walk(target.parentElement,index-2);
        for(let parent=target.parentElement;parent;parent=parent.parentElement)if(walk(parent,index-1))return true;
        return false;
      }
      return walk(node,tokens.length-1);
    });
  }
  class Element extends EventTarget {
    constructor(tag='div'){
      super();this.tagName=tag;this.nodeType=1;this.dataset={};this.children=[];this.attributes=new Map();this.hidden=false;
      const values=new Map(),priorities=new Map(),classes=new Set();
      this.transformWrites=0;this.styleWrites=0;const owner=this;
      this.style={getPropertyValue:key=>values.get(key)||'',getPropertyPriority:key=>priorities.get(key)||'',setProperty(key,value,priority=''){owner.styleWrites++;if(key==='transform')owner.transformWrites++;values.set(key,String(value));priorities.set(key,priority);},removeProperty(key){values.delete(key);priorities.delete(key);},get cssText(){return [...values].map(([k,v])=>`${k}:${v}${priorities.get(k)?' !important':''}`).join(';');},set cssText(text){owner.styleWrites++;values.clear();priorities.clear();for(const item of text.split(';')){const colon=item.indexOf(':');if(colon<0)continue;const key=item.slice(0,colon).trim(),raw=item.slice(colon+1).trim(),priority=/!important$/.test(raw)?'important':'';if(priorities.get(key)&&!priority)continue;values.set(key,raw.replace(/\s*!important$/,''));priorities.set(key,priority);}}};
      Object.defineProperty(this.style,'display',{get(){return values.get('display')||'';},set(value){values.set('display',value);}});
      this.classList={add:(...names)=>names.forEach(name=>classes.add(name)),remove:(...names)=>names.forEach(name=>classes.delete(name)),contains:name=>classes.has(name),toggle(name,force){const value=force??!classes.has(name);if(value)classes.add(name);else classes.delete(name);return value;}};
      Object.defineProperty(this,'className',{get:()=>[...classes].join(' '),set:value=>{classes.clear();String(value).split(/\s+/).filter(Boolean).forEach(name=>classes.add(name));}});
      nodes.push(this);
    }
    get ownerDocument(){return doc;}
    get isConnected(){return this===doc.documentElement||Boolean(this.parentElement?.isConnected);}
    setAttribute(name,value){this.attributes.set(name,String(value));if(name==='class')this.className=value;if(name==='id')this.id=value;}
    getAttribute(name){if(name==='class')return this.className;if(name==='id')return this.id??null;if(name==='hidden')return this.hidden?'':null;return this.attributes.get(name)??null;}
    appendChild(child){child.remove();child.parentElement=this;this.children.push(child);return child;}
    remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=null;}}
    querySelectorAll(selector){const result=[];const visit=node=>{for(const child of node.children){if(matches(child,selector,this))result.push(child);visit(child);}};visit(this);return result;}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    matches(selector){return matches(this,selector);}
    closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
    set innerHTML(html){assert(!this.children.length);for(const match of html.matchAll(/<span class="([^"]+)"[^>]*>([^<]*)<\/span>/g)){const node=new Element('span');node.className=match[1];node.textContent=match[2];this.appendChild(node);}}
    getBoundingClientRect(){metrics.layoutReads++;return this.rect||{left:0,top:0,width:width/2,height:240};}
    setPointerCapture(id){this.pointerCapture=id;}
    releasePointerCapture(id){if(this.pointerCapture===id)this.pointerCapture=null;}
    blur(){if(doc.activeElement===this)doc.activeElement=null;}
  }
  const doc=new EventTarget();doc.documentElement=new Element('html');doc.head=new Element('head');doc.body=new Element('body');doc.documentElement.appendChild(doc.head);doc.documentElement.appendChild(doc.body);
  doc.visibilityState='visible';doc.createElement=tag=>new Element(tag);doc.querySelectorAll=selector=>doc.documentElement.querySelectorAll(selector);doc.querySelector=selector=>doc.querySelectorAll(selector)[0]||null;doc.getElementById=id=>doc.querySelector(`#${id}`);
  doc.startViewTransition=()=>{throw Error('Theme switching must never wait for a document capture');};
  class Observer {constructor(callback){this.callback=callback;this.targets=[];observers.push(this);}observe(node,options){this.targets.push({node,options});}disconnect(){this.targets=[];}}
  const top=new EventTarget();Object.assign(top,{document:doc,innerWidth:width,innerHeight:height,navigator:{maxTouchPoints:5},MutationObserver:Observer,ResizeObserver:Observer,
    localStorage:{getItem:key=>storage.get(key)??null,setItem(key,value){metrics.storageWrites++;storage.set(key,String(value));}},
    matchMedia:query=>({matches:query.includes('pointer: coarse'),addEventListener(){},removeEventListener(){}}),
    getComputedStyle(node){metrics.computedReads++;return {getPropertyValue:key=>node.style.getPropertyValue(key)||({'--SmartThemeBlurTintColor':'rgba(46,84,112,.7)','--SmartThemeBodyColor':'#e3eff9','--SmartThemeQuoteColor':'#8ad5ed'}[key]||'')};},
    setTimeout(fn,delay=0){const id=++nextId;timers.set(id,{fn,at:now+delay});return id;},clearTimeout:id=>timers.delete(id),
    requestAnimationFrame(fn){const id=++nextId;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),queueMicrotask:fn=>microtasks.push(fn),
  });top.top=top;doc.defaultView=top;
  const flush=()=>{let count=0;while(microtasks.length){assert(++count<100,'Microtasks must settle');microtasks.shift()();}if(frames.size){const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(now));}};
  const advance=ms=>{const until=now+ms;let count=0;for(;;){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>until)break;assert(++count<100);now=next[1].at;timers.delete(next[0]);next[1].fn();flush();}now=until;flush();};
  const event=(target,type,x=100,y=100,id=1)=>{const value={type,clientX:x,clientY:y,pointerId:id,isPrimary:true,button:0,preventDefault(){this.defaultPrevented=true;},stopPropagation(){},stopImmediatePropagation(){this.immediateStopped=true;}};target.dispatchEvent(value);return value;};
  const add=(parent,tag,className='',id='')=>{const node=doc.createElement(tag);node.className=className;node.id=id;parent.appendChild(node);return node;};
  const mount=add(doc.body,'div','','preset-manager-floating-panel'),root=add(mount,'div','floating-panel-root'),panel=add(root,'div','panel-wrapper');panel.style.display='none';
  const header=add(panel,'div','panel-header'),section=add(header,'div','panel-section'),icon=add(section,'span','section-icon');
  add(panel,'div','quick-edit-dropdown').style.display='none';
  const main=add(doc.body,'div','','preset-manager-main-panel');add(add(main,'div','preset-panel'),'div','pm-header');add(doc.body,'div','','pmm-mobile-layout-card');
  const integration={main:0,controller:0,entries:0,stack:[]};
  doc.__pmmWorkshopOpenBridge={open(){integration.main++;return true;}};
  top.__PMM_LAYOUT_CONTROLLER__={open(){integration.controller++;return true;}};
  top.__PMM_WINDOW_STACK__={open(name){integration.stack.push(name);},close(){}};
  root.__pmmQuickEntries={toggle(){integration.entries++;},open(){integration.entries++;}};
  const context=vm.createContext({window:top,document:doc,MutationObserver:Observer,CustomEvent:class {constructor(type,init){this.type=type;this.detail=init?.detail;}},Date:class extends Date {static now(){return now;}},console});
  const load=(file,override)=>{const source=fs.readFileSync(override||new URL(`../dist/${file}`,import.meta.url),'utf8').replace(/export default [^;]+;/g,'');vm.runInContext(`(() => {${source}\n})()`,context,{filename:file});};
  const workshop=fs.readFileSync(new URL('../dist/workshop-v3.02.js',import.meta.url),'utf8');
  const between=(a,b)=>workshop.slice(workshop.indexOf(a),workshop.indexOf(b,workshop.indexOf(a)+a.length));
  const applyWidth=vm.runInContext(`(()=>{const TOP=window,VIEW=window,DOC=document,card=null,root=null,current={values:{},customized:{}};const currentState=()=>current;const isMobile=()=>TOP.innerWidth<=768||(TOP.navigator.maxTouchPoints>0&&Math.min(TOP.innerWidth,TOP.innerHeight)<=900);TOP.__PMM_LAYOUT_CARD_API__={getBannerWidth:()=>({width:current.values.floatingWidth||0,automatic:!current.customized.floatingWidth,profile:isMobile()?'mobile':'desktop'})};${between('  function layoutViewport()', '  function valueRange(')}${between('  function floatingDocuments()', '  function setFloatingVariables()')}${between('  function applyControlValue(', '  function _pmmBindAndroidRangeGestureGuard(')};return {width(width,automatic=false){current.values.floatingWidth=width;current.customized.floatingWidth=!automatic;applyFloatingWidth(width,automatic);},font:applyFloatingFont,metric(key,value){current.values[key]=value;current.customized[key]=true;applyControlValue({key,unit:'px'});}};})()`,context);
  storage.set('pmm_visual_theme_v1','aqua');storage.set('preset-manager-theme-mode','light');
  load('workshop-floating-store.js');load('workshop-theme-system.js');load('workshop-floating-controller.js',process.argv[2]);flush();advance(200);
  return {top,doc,root,panel,header,icon,integration,metrics,timers,frames,observers,nodes,load,event,flush,advance,applyWidth:applyWidth.width,applyFont:applyWidth.font,applyMetric:applyWidth.metric};
}
for(const [width,height] of [[360,800],[800,360],[800,1100],[1100,800]]){
  const env=browser(width,height),{top,doc,panel,header,icon,integration,event,flush,advance,metrics}=env;
  const theme=top.__PMM_THEME_SYSTEM__,store=top.__PMM_FLOATING_STORE__;
  let api=top.__PMM_FLOATING_CONTROLLER__,handle=doc.getElementById('pmm-unified-floating-handle');
  flush();const settledMetrics={...metrics};
  for(let i=0;i<100;i++)store.update({keyboardEditing:i%2===0},'number-focus',false);
  assert.equal(env.frames.size,0,'Keyboard state alone cannot queue floating paints');assert.deepEqual(metrics,settledMetrics);
  const tap=(x=120,y=80)=>{event(handle,'pointerdown',x,y);event(top,'pointerup',x,y);};
  tap();advance(300);assert(api.getState().expanded,'A complete native pointer tap must open the banner');assert.equal(panel.style.display,'flex');
  assert.equal(integration.stack.at(-1),'floating');
  theme.toggleFollow();flush();tap();advance(300);assert(!api.getState().expanded,'The Tavern wand cannot disable floating input');
  tap();advance(300);assert(api.getState().expanded);
  event(header,'pointerdown');event(top,'pointerup');assert.equal(integration.entries,1,'Header blank space opens quick entries');
  header.dispatchEvent({type:'click',target:header,preventDefault(){},stopImmediatePropagation(){this.immediateStopped=true;}});
  assert.equal(integration.entries,1,'The pointer follow-up click cannot toggle entries twice');
  const click={type:'click',target:icon,preventDefault(){},stopImmediatePropagation(){this.immediateStopped=true;}};header.dispatchEvent(click);assert.equal(integration.entries,1,'Preset/branch icons are not extra list entries');assert(!click.immediateStopped,'Native preset tools keep their own click');
  assert.equal(header.querySelector('.pmm-entries-toggle'),null,'No duplicate entry button occupies name space');
  api.setExpanded(false);advance(200);
  tap();advance(100);tap();advance(320);assert.equal(integration.main,1);assert(!api.getState().expanded,'A double tap only opens the main window');
  event(handle,'pointerdown');advance(360);assert.equal(integration.controller,1);const afterLong=JSON.stringify(store.getState().position);event(top,'pointermove',width-10,height-10);flush();assert.equal(handle.style.getPropertyValue('transform'),'','A long press belongs to the opened controller, not another floating drag');assert.equal(JSON.stringify(store.getState().position),afterLong);event(top,'pointerup');advance(400);assert(!api.getState().expanded,'A long press cannot also toggle the banner');

  theme.setTone('dark');flush();assert.equal(doc.querySelectorAll('.pmm-theme-surface-motion').length,0,'Touch themes avoid extra compositing layers');
  event(handle,'pointerdown',width/2,100);event(top,'pointermove',width/2+20,110);assert.equal(handle.style.getPropertyValue('transform'),'translate3d(20px,10px,0)','First motion is visible immediately');
  assert.equal(doc.querySelectorAll('.pmm-theme-surface-motion').length,0,'Dragging cancels surface effects immediately');
  advance(150);const before={...metrics},position=JSON.stringify(store.getState().position);
  const paintCount=handle.transformWrites;
  for(let i=0;i<240;i++)event(top,'pointermove',width/2+20+i/3,110+i/4);
  assert.equal(handle.transformWrites,paintCount,'No DOM writes between display frames');flush();assert.equal(handle.transformWrites,paintCount+1,'240 samples need only one transform paint');
  assert.equal(JSON.stringify(store.getState().position),position,'Pointer moves never commit or serialize state');
  assert.deepEqual(metrics,before,'Pointer moves cannot measure DOM, read computed styles or write storage');
  theme.setTone('light');flush();assert.equal(doc.documentElement.dataset.pmmThemeTone,'dark','Theme writes wait until the gesture releases');
  event(top,'pointerup',width+100,200);flush();
  assert.equal(doc.documentElement.dataset.pmmThemeTone,'light');assert.equal(api.getState().position.dock,'right');assert.equal(api.getState().position.x,width-28);assert(handle.classList.contains('is-docked'));
  tap(width-10,200);assert(api.getState().expanded,'Docked taps open immediately, without a double-tap delay');
  tap(width-10,200);assert(!api.getState().expanded);

  // Edge movement keeps its x coordinate; pointer cancellation discards the preview.
  const docked=JSON.stringify(api.getState().position);
  event(handle,'pointerdown',width-10,200);event(top,'pointermove',width-10,230);flush();assert.equal(handle.style.getPropertyValue('transform'),'translate3d(0px,30px,0)');
  theme.setTone('dark');flush();event(top,'pointercancel',width-10,230);flush();
  assert.equal(JSON.stringify(api.getState().position),docked);assert.equal(handle.style.getPropertyValue('transform'),'');assert.equal(doc.documentElement.dataset.pmmThemeTone,'dark');
  event(handle,'pointerdown');event(top,'pointerup',100,100,99);assert.equal(handle.pointerCapture,1,'Unrelated pointers cannot finish this gesture');event(top,'pointercancel');

  // Real settings writes + ResizeObserver updates carry custom dimensions through the full controller.
  const resize=env.observers.find(observer=>observer.targets.some(({node,options})=>node===panel&&options===undefined));
  const quick=panel.querySelector('.quick-edit-dropdown');
  for(const [bannerWidth,bannerHeight] of [[width*.3,height/2],[width*.9,height*.9],[width,height]]){
    env.applyWidth(bannerWidth);doc.documentElement.style.setProperty('--pmm-floating-max-height',String(bannerHeight));
    quick.style.display='';panel.rect={left:0,top:0,width:bannerWidth,height:bannerHeight};
    api.setExpanded(true);resize.callback();flush();advance(200);
    assert.equal(Number(env.root.style.getPropertyValue('--pmm-banner-content-scale')),1);
    const x=Number.parseFloat(env.root.style.getPropertyValue('--pmm-banner-x')),y=Number.parseFloat(env.root.style.getPropertyValue('--pmm-banner-y'));
    assert(x>=0&&x+bannerWidth<=width);assert(y>=0&&y+bannerHeight<=height);
    if(bannerWidth===width){assert.equal(x,0);assert.equal(y,0);assert.notEqual(env.root.dataset.handleOverlap,'none');}
    event(header,'pointerdown',100,100);const before={...metrics};
    event(top,'pointermove',width+500,height+500);flush();
    assert.deepEqual(metrics,before,'Scaled/full-width banner movement reuses cached geometry');
    assert.equal(handle.style.getPropertyValue('transform'),panel.style.getPropertyValue('transform'));
    const [dx,dy]=panel.style.getPropertyValue('transform').match(/[-\d.]+(?=px)/g).map(Number);
    assert(x+dx>=0&&x+dx+bannerWidth<=width);assert(y+dy>=0&&y+dy+bannerHeight<=height);
    event(top,'pointercancel');flush();api.setExpanded(false);advance(200);
  }
  quick.style.display='none';env.applyWidth(width/2);panel.rect={left:0,top:0,width:width/2,height:240};resize.callback();flush();

  // Explicit overall font sizes change all internal density without changing the outer width.
  for(const font of [8,22,11]){
    env.applyFont(font);
    assert.equal(Number(env.root.style.getPropertyValue('--pmm-banner-content-scale')),font/11);
    assert.equal(env.root.style.getPropertyValue('--pmm-mobile-floating-width'),width/2+'px');
    assert.equal(doc.documentElement.style.getPropertyValue('--pmm-banner-content-scale'),'');
  }

  // A reload destroys the old module, including pending tap/long-press callbacks.
  env.applyFont(8);api.resetPosition();flush();tap();env.load('workshop-floating-controller.js');flush();advance(500);
  assert.equal(Number(env.root.style.getPropertyValue('--pmm-banner-content-scale')),8/11,'Reload must retain typography applied by the native tuner before module startup');
  api=top.__PMM_FLOATING_CONTROLLER__;handle=doc.getElementById('pmm-unified-floating-handle');
  assert.equal(doc.querySelectorAll('#pmm-unified-floating-handle').length,1);assert.equal(top.listeners.get('pointerup').size,1);assert(!api.getState().expanded);
  advance(200);event(handle,'pointerdown');event(top,'orientationchange');api.destroy();const afterDestroy={...metrics};advance(500);assert.deepEqual(metrics,afterDestroy,'A retired orientation timer cannot update the replacement runtime');assert.equal(integration.controller,1);assert(!doc.getElementById('pmm-unified-floating-handle'));assert.equal(top.listeners.get('pointerup').size,0);assert(!header.querySelector('.pmm-entries-toggle'));
  assert.equal(panel.style.display,'none','Teardown restores the native display owner');
  assert.equal(env.root.dataset.handleOverlap,undefined);assert.equal(env.root.style.getPropertyValue('--pmm-banner-handle-gutter'),'');
  theme.destroy();store.destroy();flush();assert.equal(env.timers.size,0);assert.equal(env.frames.size,0);assert(env.observers.every(observer=>observer.targets.length===0));
}
// Only the original area to the pencil's upper left toggles entries; the rest is drag space.
{
  const e=browser(),{doc,header,top,integration,event}=e;
  const source=fs.readFileSync(new URL('../dist/workshop-v3.02.js',import.meta.url),'utf8');
  const start=source.indexOf('  function bindBatchTrigger(root)'),end=source.indexOf('  function ',start+20);
  let batches=0;e.icon.classList.add('fa-sliders');
  vm.runInNewContext(source.slice(start,end)+';bindBatchTrigger(root);',{root:e.root,openBatchDialog:()=>batches++});
  const click={type:'click',target:e.icon,clientX:20,clientY:12,preventDefault(){},stopPropagation(){},stopImmediatePropagation(){this.immediateStopped=true;}};
  header.dispatchEvent(click);assert(!click.immediateStopped);e.icon.dispatchEvent(click);assert.equal(batches,1);assert.equal(integration.entries,0);
  const edit=doc.createElement('button');edit.className='panel-action';edit.setAttribute('title','打开编辑面板');
  edit.rect={left:260,top:10,width:26,height:28};header.appendChild(edit);
  event(header,'pointerdown',220,12);event(top,'pointerup',220,12);assert.equal(integration.entries,1);
  header.dispatchEvent({type:'click',target:header,clientX:220,clientY:12,preventDefault(){},stopImmediatePropagation(){this.immediateStopped=true;}});
  assert.equal(integration.entries,1);
  for(const [x,y] of [[290,12],[220,38]]){event(header,'pointerdown',x,y);event(top,'pointerup',x,y);}
  assert.equal(integration.entries,1,'Right/below the pencil is not another list entry');
  event(header,'pointerdown',220,12);event(top,'pointerup',220,12);assert.equal(integration.entries,2,'The same area toggles closed');
  top.__PMM_FLOATING_CONTROLLER__.destroy();top.__PMM_THEME_SYSTEM__.destroy();top.__PMM_FLOATING_STORE__.destroy();e.flush();
}
// Width and font settings survive a replacement root; metric inheritance uses the previous version's path.
{
  const env=browser(390,844),{top,doc,root,observers}=env,api=top.__PMM_FLOATING_CONTROLLER__;
  const mount=root.parentElement;
  env.applyFont(8);root.remove();env.applyWidth(117);env.applyMetric('floatingNameFont',17);
  assert.equal(doc.documentElement.style.getPropertyValue('--pmm-mobile-floating-width'),'');
  assert.equal(doc.documentElement.style.getPropertyValue('--pmm-banner-content-scale'),'');
  const replacement=doc.createElement('div');replacement.className='floating-panel-root';
  const panel=doc.createElement('div');panel.className='panel-wrapper';panel.style.display='none';replacement.appendChild(panel);
  const header=doc.createElement('div');header.className='panel-header';panel.appendChild(header);mount.appendChild(replacement);
  const observer=observers.find(observer=>observer.targets.some(({node,options})=>node===mount&&options?.childList));
  observer.callback([{addedNodes:[replacement],removedNodes:[root]}]);env.flush();
  assert.equal(replacement.style.getPropertyValue('--pmm-mobile-floating-width'),'117px');
  assert.equal(replacement.dataset.pmmBannerWidthMode,'manual','A replaced root retains the saved explicit width mode');
  assert.equal(Number(replacement.style.getPropertyValue('--pmm-banner-content-scale')),8/11);
  assert.equal(doc.documentElement.style.getPropertyValue('--pmm-floating-name-font'),'17px');
  assert.equal(replacement.style.getPropertyValue('--pmm-floating-name-font'),'','A replacement root inherits the current metric without a stale local override');
  api.destroy();top.__PMM_THEME_SYSTEM__.destroy();top.__PMM_FLOATING_STORE__.destroy();env.flush();
  assert.equal(env.timers.size,0);assert.equal(env.frames.size,0);assert(observers.every(observer=>observer.targets.length===0));
}

// Native unmount/remount preserves width even when no banner exists for an intervening frame.
for(const [width,height] of [[390,844],[844,390],[800,1100],[1100,800],[1440,1024]]){
  for(const automatic of [false,true]){
    const e=browser(width,height),{top,doc,root,observers,flush}=e,api=top.__PMM_FLOATING_CONTROLLER__;
    const requested=automatic?312:width+100,mode=automatic?'auto':'manual';
    e.applyWidth(requested,automatic);api.setExpanded(true);flush();
    const profile=api.getBannerSizing().profile,mount=root.parentElement;
    const observer=observers.find(item=>item.targets.some(({node,options})=>node===mount&&options?.childList));
    root.remove();observer.callback([{addedNodes:[],removedNodes:[root]}]);flush();
    assert.equal(api.getBannerSizing().width,requested,'An absent native node cannot clear the width model');
    assert(!api.getState().expanded,'No expanded banner remains visible while its node is absent');
    e.advance(500);
    const replacement=doc.createElement('div');replacement.className='floating-panel-root';
    // A native node may carry obsolete width data; only the current profile owns the request.
    replacement.style.setProperty('--pmm-mobile-floating-width','91px');
    replacement.dataset.pmmBannerWidthMode=automatic?'manual':'auto';
    const panel=doc.createElement('div');panel.className='panel-wrapper';panel.style.display='none';replacement.appendChild(panel);
    const header=doc.createElement('div');header.className='panel-header';panel.appendChild(header);
    mount.appendChild(replacement);observer.callback([{addedNodes:[replacement],removedNodes:[]}]);flush();
    assert.equal(replacement.style.getPropertyValue('--pmm-mobile-floating-width'),requested+'px','Remount projects the retained request, never stale DOM width');
    assert.equal(replacement.dataset.pmmBannerWidthMode,mode);
    assert.equal(replacement.dataset.pmmBannerWidthProfile,profile);
    api.setExpanded(true);flush();
    assert.equal(panel.style.display,'flex');
    assert.equal(api.getBannerSizing().width,requested,'Opening the remounted native banner keeps the requested width');
    assert.equal(replacement.style.getPropertyValue('--pmm-mobile-floating-width'),requested+'px');
    api.destroy();top.__PMM_THEME_SYSTEM__.destroy();top.__PMM_FLOATING_STORE__.destroy();flush();
    assert.equal(e.timers.size,0);assert.equal(e.frames.size,0);assert(observers.every(item=>item.targets.length===0));
  }
}

// Restored control writes reach the variables consumed by the banner and its geometry.
{
  const env=browser(390,844),{top,doc,root,metrics,flush}=env;
  let api=top.__PMM_FLOATING_CONTROLLER__;
  const before={...metrics};
  for(let i=0;i<240;i++){
    env.applyMetric('floatingNameFont',10+i%10);
    env.applyMetric('floatingBall',36+i%28);
    env.applyMetric('floatingHeight',300+i);
  }
  assert.deepEqual(metrics,before,'Repeated control changes never measure layout or persist on the hot path');
  assert.equal(doc.documentElement.style.getPropertyValue('--pmm-floating-name-font'),'19px');
  assert.equal(doc.documentElement.style.getPropertyValue('--pmm-floating-ball-size'),'51px');
  assert.equal(doc.documentElement.style.getPropertyValue('--pmm-floating-max-height'),'539px');
  assert.equal(root.style.getPropertyValue('--pmm-floating-name-font'),'','No local font overrides can mask the restored control settings');
  top.dispatchEvent({type:'pmm:floating-metrics-change'});flush();
  assert.equal(env.frames.size,0,'Final geometry settles without polling');
  env.load('workshop-floating-controller.js');flush();api=top.__PMM_FLOATING_CONTROLLER__;
  assert.equal(doc.documentElement.style.getPropertyValue('--pmm-floating-ball-size'),'51px','Module replacement cannot reset custom metrics');
  env.applyMetric('floatingBall',46);assert.equal(doc.documentElement.style.getPropertyValue('--pmm-floating-ball-size'),'46px','Reset replaces a draft immediately');
  api.destroy();top.__PMM_THEME_SYSTEM__.destroy();top.__PMM_FLOATING_STORE__.destroy();flush();
  assert.equal(env.frames.size,0);assert.equal(env.timers.size,0);
}
// Actual name display + one-shot automatic width, across orientations, zoom and desktop.
for(const [width,height] of [[360,800],[800,360],[800,1100],[1100,800],[1440,900]])for(const scale of [1,1.5]){
  const e=browser(width,height),{top,doc,root,panel,header,flush}=e;
  const field=doc.createElement('span');field.className='pmm-preset-name-field';header.querySelector('.panel-section').appendChild(field);
  const select=doc.createElement('select');select.className='panel-select panel-select--preset';field.appendChild(select);
  const label=doc.createElement('span');label.className='pmm-preset-name-text';field.appendChild(label);
  select.value='诸神黄昏2.17';select.selectedOptions=[{textContent:select.value}];
  const measured=text=>Array.from(text).reduce((sum,c)=>sum+(c.charCodeAt(0)>127?14:7),0);
  let textReads=0;
  const create=doc.createElement;
  doc.createElement=tag=>tag==='canvas'?{getContext:()=>({font:'',measureText(text){textReads++;return{width:measured(text)};}})}:create(tag);
  const computed=top.getComputedStyle;
  top.getComputedStyle=node=>node===select?{font:'11px Arial',getPropertyValue:key=>({font:'11px Arial','padding-left':'4','padding-right':'4','border-left-width':'1','border-right-width':'1'}[key]||'0')}:computed(node);
  // Fixed controls consume 160 CSS px at scale 1; this fixture models their visible width.
  const requestedWidth=()=>Number.parseFloat(root.style.getPropertyValue('--pmm-mobile-floating-width'))||160*scale;
  const actualWidth=()=>Math.min(requestedWidth(),top.visualViewport?.width||top.innerWidth);
  Object.defineProperty(panel,'offsetWidth',{get:actualWidth});
  panel.getBoundingClientRect=()=>({left:0,top:0,width:actualWidth(),height:240});
  Object.defineProperty(header,'clientWidth',{get:()=>actualWidth()/scale});
  Object.defineProperty(header,'offsetWidth',{get:()=>actualWidth()/scale});
  Object.defineProperty(header,'scrollWidth',{get:()=>Math.max(160,actualWidth()/scale)});
  header.getBoundingClientRect=()=>({left:0,top:0,width:actualWidth(),height:44*scale});
  field.getBoundingClientRect=()=>({left:0,top:0,width:Math.max(0,actualWidth()-160*scale),height:28*scale});
  let api=top.__PMM_FLOATING_CONTROLLER__;
  e.applyWidth(0,true);api.refreshHeader();api.setExpanded(true);flush();
  const defaultWidth=Math.min(width,256*scale);
  assert.equal(actualWidth(),defaultWidth,'Full name plus actual remaining controls, with zoom accounted for');
  assert.equal(label.textContent,'诸神黄昏2.17');
  assert.equal(api.getBannerSizing().width,defaultWidth);
  e.applyWidth(defaultWidth,true); // The layout model accepts and retains the computed default.
  const afterDefault=textReads;
  for(let i=0;i<3;i++){api.setExpanded(false);flush();api.setExpanded(true);flush();}
  assert.equal(requestedWidth(),defaultWidth,'Closing and reopening retains the established automatic width');
  assert.equal(textReads,afterDefault,'Reopening never remeasures an established default');
  select.value='很长的预设名称'.repeat(40);select.selectedOptions=[{textContent:select.value}];api.refreshHeader();flush();
  assert.equal(actualWidth(),width,'A changed name recalculates exactly once while still automatic');
  assert.equal(textReads,afterDefault+1);
  for(let i=0;i<120;i++){api.refreshHeader();flush();}
  assert.equal(textReads,afterDefault+1,'Unchanged name refreshes never measure again');
  assert.equal(label.textContent,select.value,'Full text is retained for CSS hard clipping');
  e.applyWidth(0,true);flush();assert.equal(actualWidth(),width,'Reset recalculates and caps a long title to the screen');
  assert.equal(root.style.getPropertyValue('--pmm-banner-x'),'0px');
  const manual=width+100;e.applyWidth(manual);flush();const beforeReads=textReads;
  e.applyFont(16.5);flush();assert.equal(requestedWidth(),manual,'Font changes never override a manual width');
  e.applyFont(11*scale);flush();assert.equal(textReads,beforeReads);
  select.value='诸神黄昏2.17';select.selectedOptions=[{textContent:select.value}];
  for(let i=0;i<120;i++)api.refreshHeader();flush();
  assert.equal(requestedWidth(),manual);assert.equal(actualWidth(),width);assert.equal(textReads,beforeReads);
  for(let i=0;i<3;i++){api.setExpanded(false);flush();api.setExpanded(true);flush();}
  assert.equal(requestedWidth(),manual,'Closing and reopening retains the manual width before viewport capping');
  assert.equal(textReads,beforeReads,'Manual width never triggers automatic measurement on reopen');
  top.innerWidth=Math.max(320,width-100);top.dispatchEvent({type:'resize'});flush();flush();
  assert.equal(requestedWidth(),manual,'Viewport capping is never written into the manual request');
  api.setExpanded(false);flush();
  e.load('workshop-floating-controller.js');flush();api=top.__PMM_FLOATING_CONTROLLER__;
  api.setExpanded(true);flush();
  assert.equal(requestedWidth(),manual,'Reloading while closed then reopening restores the manual width from the layout model');
  assert.equal(root.dataset.pmmBannerWidthMode,'manual');
  top.innerWidth=width;top.dispatchEvent({type:'resize'});flush();flush();
  const beforeDragReads=textReads;top.__PMM_THEME_SYSTEM__.beginInteraction('test-drag');
  e.applyWidth(0,true);
  for(let i=0;i<240;i++){api.refreshHeader();flush();}
  assert.equal(textReads,beforeDragReads,'Measurement waits for drag completion');
  top.__PMM_THEME_SYSTEM__.endInteraction('test-drag');flush();flush();
  assert.equal(textReads,beforeDragReads+1);assert.equal(actualWidth(),defaultWidth);
  for(const title of ['诸神黄昏...', '诸神黄昏…']){
    select.value=title;select.selectedOptions=[{textContent:title}];api.refreshHeader();flush();
    assert.equal(label.textContent,'诸神黄昏');assert.equal(select.value,title,'Display rules never rename the real preset');
  }
  api.destroy();top.__PMM_THEME_SYSTEM__.destroy();top.__PMM_FLOATING_STORE__.destroy();flush();assert.equal(e.frames.size,0);assert.equal(e.timers.size,0);
}

// Skin cycling and toolbar tone reads reuse the unchanged Tavern palette.
{
  const env=browser(390,844),{top,doc,metrics,flush,observers}=env,theme=top.__PMM_THEME_SYSTEM__;
  const before=metrics.computedReads;
  theme.setTone('dark');assert.equal(theme.getTone(),'dark');theme.setTone('light');assert.equal(theme.getTone(),'light');flush();
  for(let i=0;i<120;i++){
    const skin=['aqua','glass','violet','theme'][i%4];theme.setTheme(skin);flush();
    assert.equal(doc.documentElement.dataset.pmmVisualTheme,skin);
    for(let n=0;n<10;n++)assert.equal(theme.getTone(),'light');
  }
  assert.equal(metrics.computedReads,before,'Own skin changes cannot repeatedly measure a stable host palette');
  theme.setTone('dark');flush();assert.equal(doc.getElementById('pmm-mobile-layout-card').dataset.pmmLayoutTheme,'dark','Controller tone updates with the same skin commit');theme.setTone('light');flush();
  assert.equal(env.frames.size,0);assert.equal(env.timers.size,0);
  const observer=observers.find(o=>o.targets.some(({node,options})=>node===doc.body&&options?.attributeFilter?.includes('style')));
  doc.body.style.setProperty('--SmartThemeBlurTintColor','rgb(30,40,50)');observer.callback([{target:doc.body}]);
  theme.toggleFollow();flush();assert(metrics.computedReads>before,'A real Tavern appearance change invalidates the cached palette');assert.equal(theme.getTone(),'dark');
  top.__PMM_FLOATING_CONTROLLER__.destroy();theme.destroy();top.__PMM_FLOATING_STORE__.destroy();flush();assert.equal(env.frames.size,0);assert.equal(env.timers.size,0);
}

console.log('完整悬浮模块回归通过：触屏手势、尺寸隔离、晚挂载和重载、240 次调节沿用上一版尺寸传递、120 次切皮肤复用颜色测量、宿主变更刷新与任务回收。');
