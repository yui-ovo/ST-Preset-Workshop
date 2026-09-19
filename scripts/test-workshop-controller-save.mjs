import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../dist/workshop-v3.02.js',import.meta.url),'utf8');
function between(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert(start>=0&&end>start,a);return source.slice(start,end);}
class Node {
  constructor(tag='div'){this.tagName=tag;this.dataset={};this.children=[];this.attrs={};this.events=new Map();this.value='';this.textContent='';this.isConnected=true;const props=new Map(),classes=new Set();
    this.style={getPropertyValue:k=>props.get(k)||'',setProperty:(k,v)=>props.set(k,String(v)),removeProperty:k=>props.delete(k)};
    this.classList={toggle:(k,v)=>v?classes.add(k):classes.delete(k),add:(...keys)=>keys.forEach(k=>classes.add(k)),remove:(...keys)=>keys.forEach(k=>classes.delete(k)),contains:k=>classes.has(k)};
  }
  setAttribute(k,v){this.attrs[k]=String(v);}
  getAttribute(k){return this.attrs[k]??null;}
  appendChild(n){this.children.push(n);return n;}
  remove(){this.isConnected=false;}
  replaceChildren(...next){this.children=next;}
  focus(){}select(){}
  matches(selector){
    const tag=selector.match(/^[a-z]+/)?.[0];if(tag&&tag!==this.tagName)return false;
    const cls=selector.match(/^\.([\w-]+)/)?.[1];if(cls&&!String(this.className||'').split(' ').includes(cls))return false;
    for(const [,key,value] of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g))if(!(key in this.attrs)||value!==undefined&&this.attrs[key]!==value)return false;
    return true;
  }
  querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  addEventListener(k,fn){const set=this.events.get(k)||new Set();set.add(fn);this.events.set(k,set);}
  removeEventListener(k,fn){this.events.get(k)?.delete(fn);}
  dispatch(type,extra={}){for(const fn of [...this.events.get(type)||[]])fn({type,target:this,currentTarget:this,preventDefault(){},stopPropagation(){},...extra});}
  set innerHTML(html){
    // Native DOM fixture for the actual makeControl function, including independent locks and editor.
    const key=html.match(/data-pmm-layout-input="([^"]+)"/)?.[1];assert(key);
    const label=this.appendChild(new Node('span'));label.className='pmm-layout-row__label';
    for(const [kind,tag] of [['lock','button'],['output','button'],['input','input']]){const n=this.appendChild(new Node(tag));n.setAttribute('data-pmm-layout-'+kind,key);if(kind==='input')n.value=html.match(/ value="([^"]+)"/)?.[1]||'';}
    for(const direction of [-1,1]){const n=this.appendChild(new Node('button'));n.setAttribute('data-pmm-layout-step',key);n.setAttribute('data-direction',direction);n.dataset.direction=String(direction);}
  }
}
function boot(mobile,withMain,storage){
  const panel=new Node('section'),main=withMain?new Node():null,doc={documentElement:new Node('html'),createElement:tag=>new Node(tag),querySelectorAll:()=>[]};
  const frames=new Map(),timers=new Map(),events=[],notices=[],globalListeners=new Map(),interactions=new Set();let id=0,writes=0,fail=false,boundsChecks=0;
  const top={innerWidth:mobile?390:1280,innerHeight:mobile?844:800,navigator:{maxTouchPoints:mobile?5:0},PointerEvent:class{},
    localStorage:{getItem:key=>storage.get(key),setItem(key,value){if(fail)throw Error('quota');writes++;storage.set(key,value);}},
    addEventListener(type,fn){const listeners=globalListeners.get(type)||new Set();listeners.add(fn);globalListeners.set(type,listeners);},
    removeEventListener(type,fn){globalListeners.get(type)?.delete(fn);},
    dispatchEvent(event){events.push(event.type);for(const fn of [...globalListeners.get(event.type)||[]])fn(event);},__PMM_FLOATING_STORE__:{update(){}},
    __PMM_THEME_SYSTEM__:{beginInteraction:owner=>interactions.add(owner),endInteraction:owner=>interactions.delete(owner)},
    __PMM_FLOATING_CONTROLLER__:{setBannerWidth:value=>notices.push(['width',value]),setBannerFont:value=>notices.push(['font',value])},
    requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:key=>frames.delete(key),
    setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:key=>timers.delete(key),
  };top.top=top;
  const code=between('  const DEFAULTS = Object.freeze({','  let state = loadState();')
    +between('  function clamp(key, value)','  function isMobile()')
    +between('  function floatingDocuments()','  function capturePresetViewportWidths()')
    +between('  function applyState(save = false)','  function cardViewportBounds(')
    +between('  function showCardStatus(','  function openCard()')
    +between('  function onBannerDefaultWidth(',"  TOP.addEventListener('resize',onCardViewportChange");
  const api=vm.runInNewContext(`(()=>{let card=panel,root=main,state,cardSnapshot,saveTimer=0,cardStatusTimer=0,lastFloatingGlyph=null,activeCardDragCleanup=null,trigger=null;${code}
    function currentState(){return state[isMobile()?'mobile':'desktop'];}
    function isControlLocked(key){return state.lockedControls?.[key]===true;}
    function currentControls(){return CONTROLS;}
    function updateDragCompatButton(){}
    function updateTopNotificationButton(){}
    state=loadState();cardSnapshot=JSON.parse(JSON.stringify(state));
    card.__pmmControls=new Map();
    for(const control of CONTROLS){const row=makeControl(control);card.appendChild(row);card.__pmmControls.set(control.key,row.__pmmControlNodes);}
    updateOutputs();
    return{syncDefault:(width,profile=isMobile()?'mobile':'desktop',extra={})=>onBannerDefaultWidth({detail:{width,profile,...extra}}),save:saveCard,reset:resetCardDefaults,close:closeCard,state:()=>state,snapshot:()=>cardSnapshot,defaults:()=>makeLayoutState({}, {}, false, !isMobile()),isOpen:()=>card===panel};})()`,{
    panel,main,DOC:doc,TOP:top,VIEW:top,window:top,document:doc,IS_ANDROID:mobile,LEGACY_PRESET_WIDTH_BASE:108,STORAGE_KEY:'pmm_mobile_layout_shared_v2',Date,
    isMobile:()=>mobile,clearTimeout:top.clearTimeout,setTimeout:top.setTimeout,setDragCompatEnabled(){},setTopNotificationsEnabled(){},keepCardInBounds(){boundsChecks++;},refreshHeaderWrapping(){},
    CustomEvent:class{constructor(type){this.type=type;}},console:{error(){}},
  });
  const flush=()=>{const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn());};
  return{...api,panel,main,doc,frames,timers,events,notices,interactions,globalListeners,flush,writes:()=>writes,boundsChecks:()=>boundsChecks,fail:value=>fail=value,top};
}
for(const mobile of [false,true])for(const withMain of [false,true]){
  const key='pmm_mobile_layout_shared_v2',profile=mobile?'mobile':'desktop';
  const storage=new Map([[key,JSON.stringify({headerMode:'single',[profile]:{values:{floatingWidth:350,floatingHeight:650,floatingFont:8,controllerWidth:350},customized:{floatingWidth:true,floatingHeight:true,floatingFont:true,controllerWidth:true}},lockedControls:{floatingWidth:false,floatingHeight:false,floatingFont:false}})]]);
  const e=boot(mobile,withMain,storage),row=e.panel.querySelector('[data-pmm-layout-input="floatingWidth"]'),rowHost=e.panel.children.find(host=>host.__pmmControlNodes?.input===row);
  const value=e.panel.querySelector('[data-pmm-layout-output="floatingWidth"]');
  // A queued slider value must not resurrect old dimensions after reset, even with the native touch guard active.
  row.dispatch('pointerdown',{pointerId:1,pointerType:'touch',clientX:10,clientY:10});row.value='300';row.dispatch('input');
  row.dispatch('pointermove',{pointerId:1,clientX:60,clientY:10});
  e.reset();row.dispatch('pointerup',{pointerId:1});e.flush();
  assert.deepEqual(JSON.parse(JSON.stringify(e.state()[profile])),JSON.parse(JSON.stringify(e.defaults())));
  assert(e.notices.some(([kind,n])=>kind==='width'&&n===0),'Reset immediately updates a standalone banner');
  assert(e.notices.some(([kind,n])=>kind==='font'&&n===11));
  assert.equal(e.panel.style.getPropertyValue('--pmm-controller-width'),e.state()[profile].values.controllerWidth+'px');
  assert.equal(e.events.filter(type=>type==='pmm:floating-metrics-change').length,1);
  assert.equal(e.writes(),0,'Reset remains an unsaved draft until Save is clicked');
  const previousPanel=e.panel;assert.equal(e.save(),true);assert.equal(e.writes(),1);assert(e.isOpen());assert(e.panel.isConnected);assert.equal(e.panel,previousPanel);
  assert.equal(e.panel.querySelector('.pmm-layout-save-status').textContent,'保存成功');
  assert.deepEqual(JSON.parse(storage.get(key))[profile],JSON.parse(JSON.stringify(e.defaults())));
  // Saving must retain the actual slider guard and numeric editor; save flushes an unfinished numeric edit.
  value.dispatch('click');const editor=value.children[0];editor.value=mobile?'280':'700';editor.dispatch('input');
  assert.equal(e.save(),true);assert.equal(e.state()[profile].values.floatingWidth,mobile?280:700);
  assert.equal(value.querySelector('input'),null);assert.equal(e.panel.querySelectorAll('.pmm-layout-save-status').length,1);
  assert((row.events.get('pointerdown')?.size||0)>0);assert.equal(row.dataset.pmmAndroidRangeGuard==='1',mobile);assert(rowHost.__pmmControlFlush);
  const committed=storage.get(key);
  row.value=mobile?'320':'760';row.dispatch('input');e.flush();
  e.fail(true);assert.equal(e.save(),false);assert(e.isOpen());assert.equal(storage.get(key),committed);
  assert.equal(e.panel.querySelector('.pmm-layout-save-status').dataset.failed,'true');
  e.close(false);assert(!e.isOpen());assert.equal(e.state()[profile].values.floatingWidth,mobile?280:700,'Cancel only discards changes after the successful save');assert.equal(e.timers.size,0);
  const reopened=boot(mobile,withMain,storage);assert.equal(reopened.state()[profile].values.floatingWidth,mobile?280:700,'A new runtime loads the successfully saved value');reopened.close(false);
}
// Save is a display barrier, even before blur/input delivery or the pending slider frame.
for(const mobile of [false,true])for(const withMain of [false,true])for(const inputMode of ['no-event','input','composing']){
  const profile=mobile?'mobile':'desktop',storage=new Map(),e=boot(mobile,withMain,storage);
  e.reset();e.syncDefault(300);
  const input=key=>e.panel.querySelector('[data-pmm-layout-input="'+key+'"]');
  const output=key=>e.panel.querySelector('[data-pmm-layout-output="'+key+'"]');
  for(const key of ['controllerWidth','controllerFont','floatingWidth','floatingBall','itemFont','splitRatio']){
    e.state().lockedControls[key]=false;
    const before=e.state()[profile].values[key],wanted=before+1;
    // A slider sample queued before entering a numeric value must not overwrite the newer edit.
    input(key).value=String(before+.5);input(key).dispatch('input');
    output(key).dispatch('click');const editor=output(key).children[0];
    if(inputMode==='composing')editor.dispatch('compositionstart');
    editor.value=String(wanted); // Save must read the visible editor, without relying on another event.
    if(inputMode!=='no-event')editor.dispatch('input');
    assert.equal(e.save(),true);
    assert.equal(e.state()[profile].values[key],wanted,key+' saved latest visible number');
    assert.equal(input(key).value,String(wanted));
    assert.equal(output(key).textContent,wanted+(key==='splitRatio'?'%':'px'));
    assert.equal(JSON.parse(storage.get('pmm_mobile_layout_shared_v2'))[profile].values[key],wanted);
    e.flush();assert.equal(e.state()[profile].values[key],wanted,'No stale preview after Save');
  }
  // Restore the mounted surfaces as part of Save, not only after close/reopen or a later mutation.
  e.doc.documentElement.style.setProperty('--pmm-controller-width','1px');
  if(e.main)e.main.style.setProperty('--pmm-user-item-font','1px');
  assert.equal(e.save(),true);
  assert.equal(e.doc.documentElement.style.getPropertyValue('--pmm-controller-width'),e.state()[profile].values.controllerWidth+'px');
  assert.equal(e.panel.style.getPropertyValue('--pmm-controller-width'),e.state()[profile].values.controllerWidth+'px');
  if(e.main)assert.equal(e.main.style.getPropertyValue('--pmm-user-item-font'),e.state()[profile].values.itemFont+'px');
  assert.equal(e.notices.at(-2)[1],e.state()[profile].values.floatingWidth);
  assert.equal(e.notices.at(-1)[1],e.state()[profile].values.floatingFont);
  // A failed save followed by Cancel also restores the inherited controller dimensions.
  const committedWidth=e.state()[profile].values.controllerWidth;
  input('controllerWidth').value=String(committedWidth+1);input('controllerWidth').dispatch('input');
  e.fail(true);assert.equal(e.save(),false);e.close(false);
  assert.equal(e.state()[profile].values.controllerWidth,committedWidth);
  assert.equal(e.doc.documentElement.style.getPropertyValue('--pmm-controller-width'),committedWidth+'px');
}
// Measured defaults immediately update the controller; explicit saved values remain authoritative.
for(const mobile of [false,true]){
  const storage=new Map(),e=boot(mobile,true,storage),profile=mobile?'mobile':'desktop';
  const input=e.panel.querySelector('[data-pmm-layout-input="floatingWidth"]');
  e.syncDefault(300);assert.equal(e.state()[profile].values.floatingWidth,300);assert.equal(input.value,'300');assert.equal(e.writes(),0);
  assert.notEqual(e.state()[profile].customized.floatingWidth,true,'A measured default is not a user edit');
  e.state().lockedControls.floatingWidth=false;input.value='275';input.dispatch('input');e.flush();input.dispatch('change');
  e.syncDefault(340);assert.equal(e.state()[profile].values.floatingWidth,275);assert.equal(input.value,'275','Preset changes cannot replace a customized width');
  assert(e.save());e.close(false);const reopened=boot(mobile,true,storage);reopened.syncDefault(360);
  assert.equal(reopened.state()[profile].values.floatingWidth,275,'Saved custom widths survive update/reload and default measurement');reopened.close(false);
}

// Every floating control must still save and reload through the previous release's variable path.
for(const mobile of [false,true]){
  const storage=new Map(),e=boot(mobile,true,storage),profile=mobile?'mobile':'desktop';
  const metrics={floatingHeight:['max-height',370],floatingGroupFont:['group-font',15],floatingNameFont:['name-font',16],floatingBodyFont:['body-font',17],floatingGap:['item-gap',-1],floatingItemHeight:['item-height',38],floatingButton:['button-size',30],floatingBall:['ball-size',52],floatingHandleWidth:['handle-width',32],floatingHandleHeight:['handle-height',72],floatingHandleFont:['handle-font',18]};
  for(const [key,[suffix,value]] of Object.entries(metrics)){
    e.state().lockedControls[key]=false;
    const input=e.panel.querySelector('[data-pmm-layout-input="'+key+'"]');
    input.value=String(value);input.dispatch('input');e.flush();input.dispatch('change');
    assert.equal(e.state()[profile].values[key],value,key+' accepts unlocked drag changes');
    assert.equal(e.doc.documentElement.style.getPropertyValue('--pmm-floating-'+suffix),value+'px',key+' updates the inherited banner variable immediately');
  }
  assert.equal(e.save(),true);e.close(false);
  const reopened=boot(mobile,true,storage);assert.equal(reopened.save(),true);
  for(const [key,[suffix,value]] of Object.entries(metrics)){
    assert.equal(reopened.state()[profile].values[key],value,key+' cannot fall back to defaults after reload');
    assert.equal(reopened.doc.documentElement.style.getPropertyValue('--pmm-floating-'+suffix),value+'px',key+' reapplies its saved banner variable');
  }
  reopened.close(false);
}

// Editing different rows shares one keyboard-settle check and suspends it during a new draft.
for(const mobile of [false,true]){
  const e=boot(mobile,true,new Map()),profile=mobile?'mobile':'desktop';
  const keys=['controllerWidth','controllerHeight','controllerFont','floatingWidth','floatingNameFont'];
  for(const key of keys)e.state().lockedControls[key]=false;
  for(let i=0;i<240;i++){
    const key=keys[i%keys.length],output=e.panel.querySelector('[data-pmm-layout-output="'+key+'"]');
    output.dispatch('click');const editor=output.children[0];
    assert.equal(e.timers.size,0,"A new numeric draft cancels the preceding row's pending reposition");
    editor.value=String(e.state()[profile].values[key]);
    editor.dispatch('keydown',{key:'Enter'});
    assert.equal(e.timers.size,1,'Different rows must share a single pending bounds check');
  }
  assert.equal(e.boundsChecks(),0,'Typing and committing numeric drafts do not synchronously measure the window');
  const pending=[...e.timers.values()];e.timers.clear();pending.forEach(fn=>fn());
  assert.equal(e.boundsChecks(),1,'The settled keyboard needs only one bounds check');
  const output=e.panel.querySelector('[data-pmm-layout-output="controllerFont"]');
  output.dispatch('click');output.children[0].dispatch('keydown',{key:'Enter'});
  assert.equal(e.timers.size,1);e.close(false);assert.equal(e.timers.size,0,'Close releases the card-level pending check');
}

// Hundreds of separate adjustments must leave no retained gesture, frame or window listener.
for(const mobile of [false,true]){
  const e=boot(mobile,true,new Map()),profile=mobile?'mobile':'desktop';
  e.state().lockedControls.floatingNameFont=false;
  const input=e.panel.querySelector('[data-pmm-layout-input="floatingNameFont"]');
  const query=e.panel.querySelector;
  e.panel.querySelector=()=>{throw Error('Single-control adjustments must use cached controls without searching the card or unrelated footer buttons');};
  for(let i=0;i<240;i++){
    input.dispatch('pointerdown',{pointerId:1,pointerType:mobile?'touch':'mouse',clientX:10,clientY:10});
    input.value=String(10+i%10);input.dispatch('input');
    input.dispatch('pointermove',{pointerId:1,clientX:50,clientY:10});e.flush();
    assert.equal(e.interactions.size,1,'Live adjustments defer background theme/list work');
    const end=i%3===0?'pointercancel':'pointerup';
    input.dispatch(end,{pointerId:1});e.top.dispatchEvent({type:end,pointerId:1});
    e.flush();assert.equal(e.interactions.size,0);assert.equal(e.frames.size,0);
    assert([...e.globalListeners.values()].every(set=>set.size===0),'Every adjustment releases window listeners');
    assert.equal(e.writes(),0,'Draft adjustment does not synchronously write storage');
  }
  e.panel.querySelector=query;
  input.dispatch('pointerdown',{pointerId:1,clientX:10,clientY:10});input.value='16';input.dispatch('input');input.dispatch('pointermove',{pointerId:1,clientX:50,clientY:10});
  assert.equal(e.save(),true);assert.equal(e.state()[profile].values.floatingNameFont,16);assert.equal(e.interactions.size,0);assert.equal(e.frames.size,1,'Save schedules only header wrapping');e.flush();
  e.close(false);assert.equal(e.interactions.size,0);assert.equal(e.timers.size,0);assert([...e.globalListeners.values()].every(set=>set.size===0));
}
assert(source.includes("querySelector('[data-pmm-layout-done]').addEventListener('click', saveCard)"));
assert(source.includes("querySelector('[data-pmm-layout-reset]').addEventListener('click', resetCardDefaults)"));
console.log('中控保存回归通过：独立/主界面下重置即时同步、保存不关闭、数值/界面即时同步、输入法草稿提交、旧滑杆帧不能覆盖新数值、滑杆继续可用、保存提示、失败保护及保存后取消/重载。');

// Legacy migration keeps large saved widths; only the two existing width profiles own values.
{
  const key='pmm_mobile_layout_shared_v2';
  const storage=new Map([[key,JSON.stringify({mobile:{values:{floatingWidth:920},customized:{floatingWidth:true}},desktop:{values:{floatingWidth:1180},customized:{floatingWidth:true}}})]]);
  for(const mobile of [true,false]){
    const profile=mobile?'mobile':'desktop',other=mobile?'desktop':'mobile',e=boot(mobile,false,storage);
    assert.equal(e.state()[profile].values.floatingWidth,mobile?920:1180);
    e.syncDefault(200,other);e.syncDefault(200,profile);
    assert.equal(e.state()[profile].values.floatingWidth,mobile?920:1180,'Late defaults never overwrite a manual saved request');
    assert(e.save());
    assert.equal(JSON.parse(storage.get(key)).mobile.values.floatingWidth,920);
    assert.equal(JSON.parse(storage.get(key)).desktop.values.floatingWidth,1180);
    e.reset();e.syncDefault(312,profile);assert(e.save());
    assert.equal(e.state()[profile].customized.floatingWidth,false);
    e.close(false);
    const reopened=boot(mobile,false,storage);assert.equal(reopened.state()[profile].values.floatingWidth,312);
    reopened.syncDefault(350,profile);assert.equal(reopened.state()[profile].values.floatingWidth,312,'An established default is stable across reopening');
    reopened.close(false);
    // Restore independent manual values for the next profile scenario.
    storage.set(key,JSON.stringify({mobile:{values:{floatingWidth:920},customized:{floatingWidth:true}},desktop:{values:{floatingWidth:1180},customized:{floatingWidth:true}}}));
  }
  const legacy=new Map([[key,JSON.stringify({values:{floatingWidth:640},customized:{floatingWidth:true}})]]);
  const migrated=boot(true,false,legacy);assert.equal(migrated.state().mobile.values.floatingWidth,640);migrated.close(false);
  const obsolete=new Map([[key,JSON.stringify({mobile:{values:{floatingWidth:195},customized:{floatingWidth:false}}})]]);
  const fresh=boot(true,false,obsolete);assert.equal(fresh.state().mobile.values.floatingWidth,0,'Unmarked old proportional defaults are discarded');fresh.close(false);
}
// A content event updates only the matching automatic request; stale callbacks and manual ownership win.
{
  const storage=new Map(),e=boot(true,false,storage);
  const autoContent={name:'诸神黄昏2.17',scale:1};
  e.syncDefault(300,'mobile',{previousWidth:0,autoContent});
  e.syncDefault(360,'mobile',{previousWidth:300,autoContent:{name:'更长的预设名称',scale:1}});
  assert.equal(e.state().mobile.values.floatingWidth,360);
  e.syncDefault(390,'mobile',{previousWidth:300,autoContent});
  assert.equal(e.state().mobile.values.floatingWidth,360,'An old measurement cannot rewrite a newer automatic width');
  assert(e.save());e.close(false);
  const reopened=boot(true,false,storage);
  assert.equal(reopened.state().mobile.bannerAutoContent.name,'更长的预设名称');
  assert.equal(reopened.state().mobile.bannerAutoContent.scale,1);
  reopened.state().mobile.customized.floatingWidth=true;
  reopened.syncDefault(390,'mobile',{previousWidth:360,autoContent});
  assert.equal(reopened.state().mobile.values.floatingWidth,360,'Even a matching event cannot overwrite manual width');
  reopened.reset();assert.equal(reopened.state().mobile.bannerAutoContent,null);
  reopened.close(false);
}
// Typing a valid width previews next frame. Escape/invalid input restore mode and value; Save commits.
{
  const storage=new Map(),e=boot(true,false,storage),current=e.state().mobile;
  e.syncDefault(300);e.state().lockedControls.floatingWidth=false;
  const output=e.panel.querySelector('[data-pmm-layout-output="floatingWidth"]');
  output.dispatch('click');let editor=output.children[0];
  editor.dispatch('blur');assert.equal(current.customized.floatingWidth,false,'Opening and leaving the editor is not a manual resize');
  output.dispatch('click');editor=output.children[0];
  for(let value=200;value<=320;value++){editor.value=String(value);editor.dispatch('input');}
  assert.equal(e.frames.size,1);assert.equal(current.values.floatingWidth,300);e.flush();
  assert.equal(current.values.floatingWidth,320);assert.equal(e.notices.at(-1)[1],320);assert.equal(e.writes(),0);
  editor.dispatch('keydown',{key:'Escape'});assert.equal(current.values.floatingWidth,300);assert.equal(current.customized.floatingWidth,false);
  output.dispatch('click');editor=output.children[0];editor.value='260';editor.dispatch('input');e.flush();
  assert.equal(current.values.floatingWidth,260);assert(e.save());e.close(false);
  const reopened=boot(true,false,storage);assert.equal(reopened.state().mobile.values.floatingWidth,260);assert(reopened.state().mobile.customized.floatingWidth);reopened.close(false);
}
console.log('条幅宽度契约通过：旧保存值迁移、首次内容默认、独立 profile、默认持久化、数值逐帧预览及取消/保存。');
