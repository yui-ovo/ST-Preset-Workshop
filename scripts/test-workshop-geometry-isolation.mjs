import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../dist/workshop-v3.02.js',import.meta.url),'utf8');
function between(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert(start>=0&&end>start);return source.slice(start,end);}
function node(){
 const props=new Map(),classes=new Set(),listeners=new Map();let writes=0;
 const style={setProperty(k,v){props.set(k,v);writes++;},getPropertyValue:k=>props.get(k)||'',removeProperty:k=>props.delete(k)};
 for(const key of ['left','top'])Object.defineProperty(style,key,{get:()=>props.get(key)||''});
 return{style,listeners,classList:{add:(...v)=>v.forEach(k=>classes.add(k)),remove:(...v)=>v.forEach(k=>classes.delete(k)),contains:k=>classes.has(k),toggle(k,v){v?classes.add(k):classes.delete(k);}},querySelector:()=>null,
 addEventListener:(k,v)=>listeners.set(k,v),removeEventListener(k,v){if(listeners.get(k)===v)listeners.delete(k);},get writes(){return writes;}};
}
// Exercise each dimension through the real control dispatch, with immutable typography values.
{
 const root=node(),card=node(),doc={documentElement:node()},calls=[];
 const values={floatingFont:8,floatingGroupFont:11,floatingNameFont:13,floatingBodyFont:12,controllerFont:12};
 const current={values,customized:{}};
 const code=between('  function applyControlValue(', '  function _pmmBindAndroidRangeGestureGuard(');
 const apply=vm.runInNewContext(`(()=>{${code};return applyControlValue;})()`,{root,card,DOC:doc,TOP:{},CUSTOM_CLASSES:{},currentState:()=>current,
  applyFloatingWidth:value=>calls.push(['width',value]),applyFloatingFont:value=>calls.push(['font',value])});
 const fonts=JSON.stringify(values);
 for(const key of ['floatingWidth','floatingHeight','controllerWidth','controllerHeight','mainWidth','mainHeight','presetWidth','branchWidth','groupHeight','itemHeight','floatingItemHeight','floatingHandleWidth','floatingHandleHeight','rowButton','headerButton','floatingButton','floatingBall','splitRatio']){
  const n=calls.length;values[key]=180;current.customized[key]=true;apply({key,unit:'px'});
  assert.deepEqual(calls.slice(n),key==='floatingWidth'?[['width',180]]:[],key+' cannot scale content');
  delete values[key];assert.equal(JSON.stringify(values),fonts);
  for(const target of [root,card,doc.documentElement])for(const prop of ['zoom','scale','transform','--pmm-banner-content-scale'])assert.equal(target.style.getPropertyValue(prop),'');
 }
 apply({key:'floatingFont',unit:'px'});assert.deepEqual(calls.at(-1),['font',8]);
}
// A resize while the grip is held must not move/reflow the panel; release processes the latest viewport once.
{
 let reads=0,updates=0;
 const card=node();card.classList.add('pmm-layout-card--positioned');card.style.setProperty('left','100px');card.style.setProperty('top','100px');
 const VIEW={get innerWidth(){reads++;return 1280;},get innerHeight(){reads++;return 800;}};
 const code=between('  function keepCardInBounds()', '  function beginCardDrag(')+between('  function flushDeferredLayout()', "  TOP.addEventListener('resize',onCardViewportChange");
 const api=vm.runInNewContext(`(()=>{let activeCardDragCleanup=()=>{},activeResizeCleanup=null,deferredViewportChange=false,deferredSync=false,lastViewportWidth=800,lastViewportHeight=1280;${code};return{resize:onCardViewportChange,clamp:keepCardInBounds,release(){activeCardDragCleanup=null;flushDeferredLayout();}};})()`,{
  card,VIEW,TOP:{},DOC:{},fitCardToViewport:()=>({originX:0,originY:0,scaleX:1,scaleY:1}),writeCardPosition:point=>{card.style.setProperty('left',point.left+'px');card.style.setProperty('top',point.top+'px');},clampCardPosition:()=>{reads++;return{left:100,top:100};},refreshDeviceValues:()=>updates++,setFloatingVariables(){},scheduleSync(){},
 });
 for(let i=0;i<100;i++){api.resize();api.clamp();}
 assert.equal(reads,0);assert.equal(updates,0);assert.equal(card.writes,2);
 api.release();assert.equal(updates,1);assert.equal(card.style.top,'100px');
}
// Tablet long presses and capture loss cannot turn zero/invalid end coordinates into a jump to the top.
for(const endType of ['pointerup','pointercancel','lostpointercapture','blur'])for(const move of [false,true]){
 const card=node(),doc=node(),grip=node(),view=node(),frames=new Map(),state={};let next=0,reads=0,saves=0;
 card.getBoundingClientRect=()=>{reads++;return{left:120,top:160,width:600,height:650};};
 Object.assign(view,{requestAnimationFrame:fn=>{frames.set(++next,fn);return next;},cancelAnimationFrame:id=>frames.delete(id)});
 const code=between('  function writeCardPosition(', '  function fitCardToViewport(')+between('  function beginCardDrag(', '  function parseLayoutThemeColor(');
 const begin=vm.runInNewContext(`(()=>{let activeCardDragCleanup=null;${code};return beginCardDrag;})()`,{card,DOC:doc,VIEW:view,state,
 cardViewportBounds:()=>({originX:0,originY:0,scaleX:1,scaleY:1}),clampCardPosition:(left,top)=>({left,top}),STORE_PROFILE:()=> 'tablet-landscape',persistSoon:()=>saves++,flushDeferredLayout(){}});
 const event=(type,x=120,y=160)=>({type,pointerId:5,clientX:x,clientY:y,target:{closest:()=>null},currentTarget:grip,preventDefault(){},stopPropagation(){}});
 begin(event('pointerdown'));
 assert.equal(card.writes,0,'Holding a grip does not restyle the card');
 if(move)for(let i=1;i<=240;i++)doc.listeners.get('pointermove')(event('pointermove',120+i,160+i));
 assert.equal(reads,1);assert.equal(saves,0);assert.equal(frames.size,move?1:0);
 const end=endType==='blur'?view.listeners.get('blur'):endType==='lostpointercapture'?grip.listeners.get(endType):doc.listeners.get(endType);
 end(event(endType,0,0));
 assert.equal(saves,move&&endType==='pointerup'?1:0);assert.equal(frames.size,0);assert.equal(doc.listeners.size,0);assert.equal(grip.listeners.size,0);assert.equal(view.listeners.size,0);
 assert.equal(card.style.getPropertyValue('transform'),'');
 if(move&&endType!=='pointerup'){assert.equal(card.style.left,'120px');assert.equal(card.style.top,'160px');assert.equal(state.cardPositions,undefined);}
 if(!move){assert.equal(card.writes,0);assert.equal(state.cardPositions,undefined);}
}
console.log('几何隔离回归通过：所有宽高独立于字号；长按/取消/捕获丢失不改位置；拖动期间视口变化延后且每帧只绘制一次。');

// Model layout coordinates separately from screen coordinates. The old implementation
// placed CSS left/top using screen pixels, so a zoomed or translated body moved the card offscreen.
for(const scale of [.75,1,1.5,2])for(const offset of [0,140]){
 const card=node(),doc=node(),grip=node(),view=node(),frames=new Map(),state={};let id=0,reads=0,saves=0;
 const vv={offsetLeft:offset,offsetTop:offset/2,width:820,height:540};
 const origin={x:-80,y:75};
 const width=()=>Math.min(620,parseFloat(card.style.getPropertyValue('--pmm-controller-visible-width'))||Infinity);
 const height=()=>Math.min(640,parseFloat(card.style.getPropertyValue('--pmm-controller-visible-height'))||Infinity);
 Object.defineProperty(card,'offsetWidth',{get:width});Object.defineProperty(card,'offsetHeight',{get:height});
 card.getBoundingClientRect=()=>{reads++;return{left:origin.x+(parseFloat(card.style.left)||0)*scale,top:origin.y+(parseFloat(card.style.top)||0)*scale,width:width()*scale,height:height()*scale};};
 Object.assign(view,{innerWidth:1280,innerHeight:800,visualViewport:vv,requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:n=>frames.delete(n)});
 const code=between('  function cardViewportBounds(', '  function STORE_PROFILE()')+between('  function keepCardInBounds()', '  function parseLayoutThemeColor(');
 const api=vm.runInNewContext(`(()=>{let activeCardDragCleanup=null;${code};return{place:placeCardForViewport,keep:keepCardInBounds,begin:beginCardDrag};})()`,{card,VIEW:view,TOP:{},DOC:doc,state,
  setLayoutVariable:(n,k,v)=>{if(n.style.getPropertyValue(k)!==v)n.style.setProperty(k,v);},STORE_PROFILE:()=> 'tablet',persistSoon:()=>saves++,flushDeferredLayout(){}});
 api.place(true);let rect=card.getBoundingClientRect();
 const near=(a,b)=>assert(Math.abs(a-b)<.01,`${a} != ${b}`);
 near(rect.left,vv.offsetLeft+(vv.width-rect.width)/2);near(rect.top,vv.offsetTop+(vv.height-rect.height)/2);
 assert(rect.width<=vv.width+.01&&rect.height<=vv.height+.01);
 const event=(type,x,y)=>({type,pointerId:1,clientX:x,clientY:y,currentTarget:grip,target:{closest:()=>null},preventDefault(){},stopPropagation(){}});
 const start={x:rect.left+12,y:rect.top+12};api.begin(event('pointerdown',start.x,start.y));const before=reads;
 for(let n=1;n<=240;n++)doc.listeners.get('pointermove')(event('pointermove',start.x+n/4,start.y+n/4));
 assert.equal(reads,before,'The coordinate map must be cached for the entire gesture');assert.equal(frames.size,1);assert.equal(saves,0);
 doc.listeners.get('pointerup')(event('pointerup',start.x+60,start.y+60));assert.equal(saves,1);assert.equal(frames.size,0);
 rect=card.getBoundingClientRect();assert(rect.left>=vv.offsetLeft-.01&&rect.left+rect.width<=vv.offsetLeft+vv.width+.01);assert(rect.top>=vv.offsetTop-.01&&rect.top+rect.height<=vv.offsetTop+vv.height+.01);
 // Browser chrome / zoom can change the visual viewport without changing innerWidth.
 vv.offsetLeft+=35;vv.offsetTop+=20;vv.width=600;vv.height=360;api.keep();rect=card.getBoundingClientRect();
 assert(rect.left>=vv.offsetLeft-.01&&rect.left+rect.width<=vv.offsetLeft+vv.width+.01);assert(rect.top>=vv.offsetTop-.01&&rect.top+rect.height<=vv.offsetTop+vv.height+.01);
 // Recover an existing offscreen card as well as a newly opened one.
 card.style.setProperty('left','5000px');card.style.setProperty('top','-2000px');api.keep();rect=card.getBoundingClientRect();
 assert(rect.left>=vv.offsetLeft-.01&&rect.left+rect.width<=vv.offsetLeft+vv.width+.01);assert(rect.top>=vv.offsetTop-.01&&rect.top+rect.height<=vv.offsetTop+vv.height+.01);
 api.place(true);rect=card.getBoundingClientRect();near(rect.left,vv.offsetLeft+(vv.width-rect.width)/2);near(rect.top,vv.offsetTop+(vv.height-rect.height)/2);
}
