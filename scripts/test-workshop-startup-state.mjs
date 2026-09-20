import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createDraftSession } from '../dist/workshop-session-state.js';
const workshop=fs.readFileSync(new URL('../dist/workshop-v3.02.js',import.meta.url),'utf8');
const entry=fs.readFileSync(new URL('../dist/index.js',import.meta.url),'utf8');
function between(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,start);return source.slice(a,b);}
function clock(){const queue=new Map();let id=0;return {queue,setTimeout:fn=>{queue.set(++id,fn);return id;},clearTimeout:key=>queue.delete(key),async flush(){const batch=[...queue.values()];queue.clear();for(const fn of batch)await fn();}};}
const clone=value=>JSON.parse(JSON.stringify(value));
const baseline=[{id:'p1',name:'One',content:'saved',enabled:true,role:'system'}];
function bootMain(session,host){
  const body=between(workshop,"const Je=n('preset',()=>{",",je=n('branch'");
  const context={n:(_name,setup)=>setup,t:clone,_pmmDrafts:session,
    i:{ref:value=>({value}),computed:read=>({get value(){return read();}}),toRaw:value=>value,onScopeDispose(){},watch(){}},
    s:()=>host.selected,d:name=>clone(name==='in_use'?host.live:host.saved[name]),Pe:()=>null,
    getLoadedPresetName:()=>host.selected,l:()=>Object.keys(host.saved),Ue:()=>[],
    setPreset:async()=>{host.writes++;},console,
  };
  return vm.runInNewContext(`(() => {${body};return Je();})()`,context);
}

// Restart with edits, then restart while a different preset is selected externally.
{
  const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)},timer=clock();
  const host={selected:'A',saved:{A:baseline,B:[{...baseline[0],content:'other preset'}]},live:clone(baseline),writes:0};
  let session=createDraftSession(storage,timer),store=bootMain(session,host);
  await store.initialize();await store.updatePrompt('p1',{content:'unsaved draft',enabled:false});
  await store.initialize();assert.equal(store.prompts.value[0].content,'unsaved draft','Reopening the main window must not reload its saved copy');
  session.dispose();assert.equal(timer.queue.size,0,'Shutdown must flush and cancel pending draft writes');
  session=createDraftSession(storage,timer);store=bootMain(session,host);await store.initialize();
  assert.equal(store.prompts.value[0].content,'unsaved draft');assert.equal(store.prompts.value[0].enabled,false);assert.equal(store.isDirty.value,true);
  session.dispose();host.selected='B';host.live=clone(host.saved.B);
  session=createDraftSession(storage,timer);store=bootMain(session,host);await store.initialize();
  assert.equal(store.currentPresetName.value,'B');assert.equal(store.prompts.value[0].content,'other preset');assert.equal(host.selected,'B');
  store.switchPreset('A');assert.equal(store.prompts.value[0].content,'unsaved draft');assert.equal(host.selected,'B','Restoring an editor draft never selects its preset in Tavern');
  await store.deletePrompt('p1');session.dispose();
  host.selected='A';host.live=clone(host.saved.A);session=createDraftSession(storage,timer);store=bootMain(session,host);await store.initialize();
  assert.equal(store.prompts.value.length,0,'An intentionally empty draft must survive restart');
  assert.equal(host.writes,0,'Startup and draft capture must never save or apply a preset');session.dispose();
}
// Preserve Tavern's unsaved live state, including an empty list, when no editor draft exists.
for(const live of [[{...baseline[0],content:'Tavern unsaved'}],[]]){
  const session=createDraftSession(null,clock()),host={selected:'A',saved:{A:baseline},live,writes:0};
  const store=bootMain(session,host);await store.initialize();assert.deepEqual(clone(store.prompts.value),live);assert.equal(host.writes,0);session.dispose();
}
// An external save wins over a conflicting old editor draft; its cache is not silently destroyed.
{
  const session=createDraftSession(null,clock());session.remember('A',[{...baseline[0],content:'old draft'}],baseline);
  const newer=[{...baseline[0],content:'externally saved'}];assert.equal(session.read('A',newer),null);assert(session.snapshot().presets['preset:A']);session.dispose();
}
// The actual host selector is authoritative even when a helper still reports an old name.
{
  const source=between(workshop,'function s(){try{const host=','function l(){');
  const host={SillyTavern:{getContext:()=>({getPresetManager:()=>({getSelectedPresetName:()=> 'B'})})}};
  const selected=vm.runInNewContext(`(() => {${source};return s();})()`,{window:{top:host},getLoadedPresetName:()=> 'A'});
  assert.equal(selected,'B');
}
// Startup only recognizes branch metadata; saved branch content is never reapplied.
for(const kind of ['saved','unsaved','external','stale']){
  const timer=clock(),session=createDraftSession(null,timer),live=clone(baseline),u={value:null};let cleared=0;
  if(kind==='unsaved'){live[0].content='unsaved branch';session.rememberBranch('A','Branch',live);}
  if(kind==='external')live[0].content='external live edit';
  const source=between(workshop,'async function U(name){','async function M(e)');
  const initialize=vm.runInNewContext(`(() => {${source};return U;})()`,{x:{value:0},u,s:()=>kind==='stale'?'B':'A',Pe:()=> 'Branch',$e:()=>({prompts:baseline}),c:{value:false},d:{value:{x:100,y:5}},getPreset:()=>({prompts:live}),_pmmDrafts:session,pe:async()=>cleared++});
  await initialize('A');assert.equal(u.value,kind==='saved'||kind==='unsaved'?'Branch':null);assert.equal(cleared,kind==='external'?1:0);
  assert.equal(live[0].content,kind==='unsaved'?'unsaved branch':kind==='external'?'external live edit':'saved');session.dispose();
}
// Imported group initialization must call the outer persistence function, never a state object.
for(const imported of [false,true]){
  const states=new Map(),active={value:''};let saved=0,synced=0,deferred=0;
  const state=()=>({prompts:clone(baseline),sections:[{id:'group',displayName:'Group',itemIds:['p1']}],isInitialized:true,hasAutoClassified:true,isLoading:false});
  const initialize=vm.runInNewContext(`(() => {${between(workshop,'async function c(n,t){if(!n)return;','async function d(e){')};return c;})()`,{
    e:{value:states},A:active,o:name=>{if(!states.has(name))states.set(name,state());return states.get(name);},
    s:(_name,prompts)=>({...state(),prompts}),r:(name,value)=>states.set(name,value),a:name=>states.get(name),
    l:async()=>saved++,d:async()=>synced++,_pmmImportBaiBaiGroups:async()=>imported,_pmmScheduleDeferredRender:()=>deferred++,
    h:{info(){},warn(){}},
  });
  for(const name of ['A','A','B'])await initialize(name,clone(baseline));
  assert.equal(active.value,'B');assert.equal(states.get('A').isLoading,false);assert.equal(states.get('B').sections.length,1);
  assert.equal(saved,imported?3:0);assert.equal(synced,imported?0:3);assert.equal(deferred,imported?3:0);
}
// The actual App setup and render path retains content and each secondary panel after mount.
for(const mode of ['single','merge','branch','favorite'])for(const tone of ['light','dark']){
  const frames=[],mounted=[],unmounted=[];let starts=0,stops=0;
  const main={currentPresetName:'',presetNames:['A'],prompts:[],selectedIds:new Set(),expandedIds:new Set(),async initialize(){this.currentPresetName='A';this.prompts=clone(baseline);}};
  const vnode=(type,props,children)=>({type,props,children:children?.default?children.default():children});
  const vue={ref:value=>({value}),computed:read=>({get value(){return read();}}),onMounted:fn=>mounted.push(fn),onUnmounted:fn=>unmounted.push(fn),
    nextTick:async()=>{},unref:value=>value,openBlock(){},createElementBlock:vnode,createElementVNode:vnode,createVNode:vnode,createBlock:vnode,
    createCommentVNode:()=>null,withModifiers:fn=>fn,withCtx:fn=>fn,normalizeStyle:value=>value,normalizeClass:value=>value,Fragment:'Fragment',Transition:'Transition'};
  const source=between(workshop,"__name:'App'",';o(470);').slice(0,-1);
  const app=vm.runInNewContext(`({${source})`,{i:vue,Je:()=>main,mn:()=>({isMergeMode:mode==='merge'}),je:()=>({isBranchMode:mode==='branch'}),pn:()=>({isFavoriteMode:mode==='favorite'}),ze:()=>({}),
    vn:()=>({cssVars:{tone},updateThemeColors(){},startObserving(){starts++;},stopObserving(){stops++;}}),
    requestAnimationFrame:fn=>frames.push(fn),ta:{class:'pm-main-wrapper'},DA:'PresetPanel',na:'Sidebar',QA:'MergePanel',RA:'BranchPanel',LA:'FavoritePanel',console});
  const render=app.setup({}, {emit(){}});mounted.forEach(fn=>fn());
  const pending=frames.shift()();for(let tick=0;!frames.length&&tick<20;tick++)await Promise.resolve();assert.equal(frames.length,1);frames.shift()();await pending;
  const tree=render({},[]),nodes=[];const collect=node=>{if(!node)return;if(Array.isArray(node)){node.forEach(collect);return;}nodes.push(node);collect(node.children);};collect(tree);
  const panel=nodes.find(node=>node.type==='PresetPanel');assert(panel);assert.equal(panel.props.prompts[0].content,'saved');assert.equal(panel.props['current-preset-name'],'A');
  if(mode!=='single')assert(nodes.some(node=>node.type==={merge:'MergePanel',branch:'BranchPanel',favorite:'FavoritePanel'}[mode]));
  unmounted.forEach(fn=>fn());assert.equal(starts,1);assert.equal(stops,1);
}
// Deferred quick entries load as the real scroll container approaches the bottom.
{
  const frame=clock(),A={visible:true},node={scrollTop:0,clientHeight:200,scrollHeight:300};let revealed=0;
  const source=between(workshop,'let _pmmRevealFrame=0;','(0,i.onBeforeUnmount)(()=>{if(_pmmRevealFrame)');
  const reveal=vm.runInNewContext(`(() => {${source};return _pmmRevealMore;})()`,{A,l:{value:node},B:{groupedData:{value:{hasDeferredItems:true}},revealDeferredItems(){revealed++;node.scrollHeight+=500;return true;}},requestAnimationFrame:frame.setTimeout,i:{nextTick:async()=>{}}});
  for(let i=0;i<100;i++)reveal();assert.equal(frame.queue.size,1);await frame.flush();assert.equal(revealed,1);
  reveal();await frame.flush();assert.equal(revealed,1,'No extra batch while away from the bottom');
  node.scrollTop=600;reveal();await frame.flush();assert.equal(revealed,2,'The next batch is reachable by scrolling');
  node.scrollTop=1100;reveal();A.visible=false;await frame.flush();assert.equal(revealed,2,'Closing the list cancels delayed rendering work');
  assert(workshop.includes("class:'dropdown-content',onScroll:_pmmRevealMore}"));
}
// Repeated opens share one native theme observer; closing one view keeps the other alive.
{
  const native=between(workshop,"vn=n('preset_manager_theme'",'function yn()');
  const start=between(native,'startObserving:function(){','stopObserving:function(){');
  const stop=between(native,'stopObserving:function(){','applyToElement:function(');
  const timers=clock(),observers=[];let updates=0;
  const node=()=>({nodeType:1,className:'',style:{cssText:''},closest:()=>null});
  const doc={head:node(),body:node(),documentElement:node(),querySelector:()=>null};
  class Observer {constructor(fn){this.fn=fn;this.targets=[];observers.push(this);}observe(node,options){this.targets.push({node,options});}disconnect(){this.disconnected=true;}}
  const debounce=fn=>{let key=0;const wrapped=()=>{timers.clearTimeout(key);key=timers.setTimeout(fn);};wrapped.cancel=()=>timers.clearTimeout(key);return wrapped;};
  const host={document:doc,localStorage:{getItem:()=> 'auto',setItem(){}}};host.parent=host;host.top=host;
  const api=vm.runInNewContext(`(() => {let A=null,_pmmThemeUsers=0,_pmmThemeUpdate=null;const e={value:'auto'};return{${start}${stop}};})()`,{window:host,ne:()=>({}),o:()=>updates++,v:{debounce},MutationObserver:Observer,console:{log(){},error(){}}});
  api.startObserving();api.startObserving();assert.equal(observers.length,1);api.stopObserving();assert(!observers[0].disconnected);
  doc.documentElement.style.cssText='--pmm-floating-x: 100px';observers[0].fn([{type:'attributes',attributeName:'style',target:doc.documentElement}]);assert.equal(timers.queue.size,0,'Floating movement cannot trigger native theme recomputation');
  doc.body.style.cssText='--SmartThemeBodyColor: #aabbcc';observers[0].fn([{type:'attributes',attributeName:'style',target:doc.body}]);assert.equal(timers.queue.size,1);
  api.stopObserving();assert(observers[0].disconnected);assert.equal(timers.queue.size,0,'Final close cancels the pending theme update');assert.equal(updates,1);
  assert(!observers[0].targets.some(({node,options})=>node===doc.body&&options.childList));
}
// A late shutdown cannot tear down replacement services installed by a newer runtime.
{
  const listeners=new Map();let retired=0,replacement=0;
  const host={__PMM_PERFORMANCE_GUARD_V275__:{cleanup(){retired++;}},__pmmThemeButtonsCleanup:()=>retired++};
  const source=workshop.slice(workshop.indexOf('/* ===== PMM_RUNTIME_TEARDOWN:'));
  vm.runInNewContext(source,{window:{top:host,addEventListener:(type,fn)=>listeners.set(type,fn)},console});
  host.__pmmThemeButtonsCleanup=()=>replacement++;
  listeners.get('pagehide')();assert.equal(retired,1);assert.equal(replacement,0);assert.equal(host.__PMM_PERFORMANCE_GUARD_V275__,undefined);assert(host.__pmmThemeButtonsCleanup);
}
assert(workshop.includes("import { workshopDrafts as _pmmDrafts } from './workshop-session-state.js'"));
assert(entry.includes("runtime.contentWindow.dispatchEvent(new runtime.contentWindow.Event('pagehide'))"));
console.log('启动与条幅回归通过：草稿跨重启、当前预设优先、分支只读识别、快捷条目续载与主题监听器回收。');
