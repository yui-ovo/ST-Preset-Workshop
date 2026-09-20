// Connect to a separately launched Chromium. No browser dependency is installed in the extension.
export async function browserPage(endpoint=process.env.PMM_CDP_URL||'http://127.0.0.1:9222'){
  const target=await (await fetch(endpoint+'/json/new?about:blank',{method:'PUT'})).json();
  const socket=new WebSocket(target.webSocketDebuggerUrl),pending=new Map(),listeners=new Map();let id=0;
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',event=>{const value=JSON.parse(event.data);if(value.id){const p=pending.get(value.id);if(!p)return;pending.delete(value.id);clearTimeout(p.timer);value.error?p.reject(Error(JSON.stringify(value.error))):p.resolve(value.result);}else for(const fn of listeners.get(value.method)||[])fn(value.params);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>{pending.delete(key);reject(Error('CDP timeout: '+method));},30000);pending.set(key,{resolve,reject,timer});socket.send(JSON.stringify({id:key,method,params}));});
  await send('Page.enable');await send('Runtime.enable');
  return {send,on(method,fn){const set=listeners.get(method)||new Set();set.add(fn);listeners.set(method,set);return()=>set.delete(fn);},
    async evaluate(fn,arg){const result=await send('Runtime.evaluate',{expression:`(${fn.toString()})(${JSON.stringify(arg)??'undefined'})`,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;},
    async goto(url){let remove;const loaded=new Promise(resolve=>{remove=this.on('Page.loadEventFired',resolve)});try{await send('Page.navigate',{url});await loaded;}finally{remove();}},
    async viewport(width,height,mobile=false){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await send('Emulation.setTouchEmulationEnabled',{enabled:mobile,maxTouchPoints:mobile?5:1});},
    async close(){socket.close();await fetch(endpoint+'/json/close/'+target.id);}
  };
}
