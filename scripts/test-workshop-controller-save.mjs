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
  const frames=new Map(),timers=new Map(),events=[],notices=[];let id=0,writes=0,fail=false;
  const top={innerWidth:mobile?390:1280,innerHeight:mobile?844:800,navigator:{maxTouchPoints:mobile?5:0},PointerEvent:class{},
    localStorage:{getItem:key=>storage.get(key),setItem(key,value){if(fail)throw Error('quota');writes++;storage.set(key,value);}},
    dispatchEvent:event=>events.push(event.type),__PMM_FLOATING_STORE__:{update(){}},
    __PMM_FLOATING_CONTROLLER__:{setBannerWidth:value=>notices.push(['width',value]),setBannerFont:value=>notices.push(['font',value])},
    requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:key=>frames.delete(key),
    setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:key=>timers.delete(key),
  };top.top=top;
  const code=between('  const DEFAULTS = Object.freeze({','  let state = loadState();')
    +between('  function clamp(key, value)','  function isMobile()')
    +between('  function floatingDocuments()','  function updateOutputs(')
    +between('  function applyState(save = false)','  function cardViewportBounds(')
    +between('  function showCardStatus(','  function openCard()');
  const api=vm.runInNewContext(`(()=>{let card=panel,root=main,state,cardSnapshot,saveTimer=0,cardStatusTimer=0,lastFloatingGlyph=null,activeCardDragCleanup=null,trigger=null;${code}
    function currentState(){return state[isMobile()?'mobile':'desktop'];}
    function isControlLocked(key){return state.lockedControls?.[key]===true;}
    function updateOutputs(){for(const c of CONTROLS){const input=card?.querySelector('[data-pmm-layout-input="'+c.key+'"]');if(input)input.value=String(currentState().values[c.key]);}}
    state=loadState();cardSnapshot=JSON.parse(JSON.stringify(state));
    for(const key of ['floatingWidth','floatingHeight','floatingFont'])card.appendChild(makeControl(CONTROLS.find(c=>c.key===key)));
    return{save:saveCard,reset:resetCardDefaults,close:closeCard,state:()=>state,snapshot:()=>cardSnapshot,defaults:()=>makeLayoutState({}, {}, false, !isMobile()),isOpen:()=>card===panel};})()`,{
    panel,main,DOC:doc,TOP:top,VIEW:top,window:top,document:doc,IS_ANDROID:mobile,LEGACY_PRESET_WIDTH_BASE:108,STORAGE_KEY:'pmm_mobile_layout_shared_v2',Date,
    isMobile:()=>mobile,clearTimeout:top.clearTimeout,setTimeout:top.setTimeout,setDragCompatEnabled(){},setTopNotificationsEnabled(){},keepCardInBounds(){},refreshHeaderWrapping(){},
    CustomEvent:class{constructor(type){this.type=type;}},console:{error(){}},
  });
  const flush=()=>{const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn());};
  return{...api,panel,main,doc,frames,timers,events,notices,flush,writes:()=>writes,fail:value=>fail=value,top};
}
for(const mobile of [false,true])for(const withMain of [false,true]){
  const key='pmm_mobile_layout_shared_v2',profile=mobile?'mobile':'desktop';
  const storage=new Map([[key,JSON.stringify({headerMode:'single',[profile]:{values:{floatingWidth:350,floatingHeight:650,floatingFont:8,controllerWidth:350},customized:{floatingWidth:true,floatingHeight:true,floatingFont:true,controllerWidth:true}},lockedControls:{floatingWidth:false,floatingHeight:false,floatingFont:false}})]]);
  const e=boot(mobile,withMain,storage),row=e.panel.querySelector('[data-pmm-layout-input="floatingWidth"]'),rowHost=e.panel.children[0];
  const value=e.panel.querySelector('[data-pmm-layout-output="floatingWidth"]');
  // A queued slider value must not resurrect old dimensions after reset, even with the native touch guard active.
  row.dispatch('pointerdown',{pointerId:1,pointerType:'touch',clientX:10,clientY:10});row.value='300';row.dispatch('input');
  row.dispatch('pointermove',{pointerId:1,clientX:60,clientY:10});
  e.reset();row.dispatch('pointerup',{pointerId:1});e.flush();
  assert.deepEqual(JSON.parse(JSON.stringify(e.state()[profile])),JSON.parse(JSON.stringify(e.defaults())));
  assert(e.notices.some(([kind,n])=>kind==='width'&&n===(mobile?195:640)),'Reset immediately updates a standalone banner');
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
  assert.equal((row.events.get('pointerdown')?.size||0)>0,mobile);assert(rowHost.__pmmControlFlush);
  const committed=storage.get(key);
  row.value=mobile?'320':'760';row.dispatch('input');e.flush();
  e.fail(true);assert.equal(e.save(),false);assert(e.isOpen());assert.equal(storage.get(key),committed);
  assert.equal(e.panel.querySelector('.pmm-layout-save-status').dataset.failed,'true');
  e.close(false);assert(!e.isOpen());assert.equal(e.state()[profile].values.floatingWidth,mobile?280:700,'Cancel only discards changes after the successful save');assert.equal(e.timers.size,0);
  const reopened=boot(mobile,withMain,storage);assert.equal(reopened.state()[profile].values.floatingWidth,mobile?280:700,'A new runtime loads the successfully saved value');reopened.close(false);
}
assert(source.includes("querySelector('[data-pmm-layout-done]').addEventListener('click', saveCard)"));
assert(source.includes("querySelector('[data-pmm-layout-reset]').addEventListener('click', resetCardDefaults)"));
console.log('中控保存回归通过：独立/主界面下重置即时同步、保存不关闭、数字草稿提交、滑杆继续可用、保存提示、失败保护及保存后取消/重载。');
