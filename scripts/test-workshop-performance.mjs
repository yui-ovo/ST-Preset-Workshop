import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const workshop=fs.readFileSync(process.argv[2]||new URL('../dist/workshop-v3.02.js',import.meta.url),'utf8');
const from=workshop.indexOf('/* ===== PMM_GROUP_SELECT_NESTING_TEST24：');
const source=workshop.slice(from,workshop.indexOf('/* ===== PMM_TAURI_EDITOR_OVERFLOW_TEST28',from));
assert(from>0);

// Simulate the DOM mutation contract, including same-value classList.remove writes.
// https://dom.spec.whatwg.org/#dom-domtokenlist-remove
function boot(count){
  const frames=new Map(),observers=[],listeners=new Map();let next=0,writes=0,scans=0;
  const groups=[];
  const emit=(target,oldValue)=>{writes++;for(const observer of observers)if(observer.connected&&observer.options?.attributes)observer.records.push({type:'attributes',attributeName:'class',target,oldValue});};
  const element=(className='')=>{
    const classes=new Set(className.split(' ').filter(Boolean));
    const node={nodeType:1,dataset:{},children:[],style:{removeProperty(){},setProperty(){}},querySelector:()=>null,querySelectorAll:()=>[],remove(){},addEventListener(){},get className(){return [...classes].join(' ');},
      matches:selector=>selector.includes('.section-group')&&classes.has('section-group')};
    const mutate=fn=>{const before=node.className;fn();emit(node,before);};
    node.classList={contains:name=>classes.has(name),add:(...names)=>mutate(()=>names.forEach(name=>classes.add(name))),remove:(...names)=>mutate(()=>names.forEach(name=>classes.delete(name))),toggle(name,enabled){const next=enabled??!classes.has(name);if(next!==classes.has(name))mutate(()=>next?classes.add(name):classes.delete(name));return next;}};
    return node;
  };
  const host=element('prompt-panel__list'),panel=element(),body=element(),style=element();
  panel.querySelectorAll=()=>{scans++;return groups;};
  for(let i=0;i<count;i++){const group=element('section-group');group.dataset.sectionId=`group_${i}`;group.parentElement=host;groups.push(group);}
  const doc={body,documentElement:element(),head:{appendChild(){}},getElementById:()=>null,createElement:()=>style,querySelector:selector=>selector==='#preset-manager-main-panel'?panel:null,querySelectorAll:()=>[]};
  class Observer{constructor(callback){this.callback=callback;this.records=[];observers.push(this);}observe(_target,options){this.connected=true;this.options=options;}disconnect(){this.connected=false;this.records=[];}}
  const top={document:doc,MutationObserver:Observer,requestAnimationFrame:fn=>{frames.set(++next,fn);return next;},cancelAnimationFrame:id=>frames.delete(id),clearTimeout(){},addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:(type)=>listeners.delete(type),console};
  top.top=top;doc.defaultView=top;
  vm.runInNewContext(source,{window:top,document:doc,console:{info(){}}});
  const deliver=()=>{for(const observer of observers){const records=observer.records.splice(0);if(observer.connected&&records.length)observer.callback(records);}};
  const settle=()=>{let turns=0;while(frames.size&&turns++<12){const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn());deliver();}return turns;};
  return{top,groups,frames,observers,settle,deliver,metrics:()=>({writes,scans})};
}
for(const size of [1,250]){
  const env=boot(size);const turns=env.settle();
  assert.equal(env.frames.size,0,`${size} groups still schedule themselves after ${turns} idle frames (${JSON.stringify(env.metrics())})`);
  assert.equal(env.metrics().scans,1,'One initial pass must settle with no user activity');
  const group=env.groups[0];
  group.classList.add('section-group--collapsed');env.deliver();env.settle();
  assert.equal(env.metrics().scans,2,'Real collapse changes still refresh nesting and group actions');
  group.classList.add('pmm-nested-section--visual');env.deliver();env.settle();
  assert.equal(env.metrics().scans,2,'Positioning classes cannot wake their own observer');
  const dataObserver=env.observers.find(observer=>observer.options?.attributes);
  dataObserver.callback([{type:'attributes',attributeName:'data-item-count',target:group,oldValue:'1'}]);env.settle();
  assert.equal(env.metrics().scans,3,'Count changes must still schedule a refresh');
  env.top.__PMM_GROUP_SELECT_NESTING_TEST24__.schedule();env.top.__PMM_GROUP_SELECT_NESTING_TEST24__.cleanup();
  assert.equal(env.frames.size,0);assert(env.observers.every(observer=>!observer.connected));
}


function between(start,end){
  const a=workshop.indexOf(start),b=workshop.indexOf(end,a+start.length);
  assert(a>=0&&b>a,`Missing performance fixture: ${start}`);
  return workshop.slice(a,b);
}

// Reopening/synchronizing controls must not invalidate every descendant's inherited styles.
{
  let writes=0,events=0;
  const node=()=>{const values=new Map();return{style:{getPropertyValue:key=>values.get(key)||'',setProperty(key,value){writes++;values.set(key,value);}},classList:{toggle(){}}};};
  const html=node(),root=node(),floating=node(),doc={documentElement:html,querySelectorAll:()=>[floating]};
  const state={glyph:'☰'},current={values:{},customized:{}};
  const constants=between('  const DEFAULTS = Object.freeze({','  const CUSTOM_CLASSES = Object.freeze({');
  const viewport=between('  function layoutViewport()', '  function valueRange(');
  const floatingWrites=between('  function setLayoutVariable(','  function setVariables(');
  const layoutWrites=between('  function setVariables(','  function ');
  const api=vm.runInNewContext(`(()=>{let lastFloatingGlyph=null;${constants};Object.assign(current.values,DEFAULTS);${viewport}${floatingWrites}${layoutWrites};return{setFloatingVariables,setVariables};})()`,{
    current,state,card:null,currentState:()=>current,VIEW:{innerWidth:360,innerHeight:780},DOC:doc,floatingDocuments:()=>[doc],CUSTOM_CLASSES:{},TOP:{dispatchEvent(){events++;}},CustomEvent:class{},
  });
  api.setFloatingVariables();api.setVariables(root);
  const initial=writes;assert(initial>20);assert.equal(events,1);
  for(let i=0;i<100;i++){api.setFloatingVariables();api.setVariables(root);}
  assert.equal(writes,initial,'Unchanged settings cannot write inherited CSS again');
  assert.equal(events,1,'Unchanged glyphs cannot wake the floating renderer');
  current.values.controllerWidth++;api.setFloatingVariables();assert.equal(writes,initial+1);
  state.glyph='☆';api.setFloatingVariables();assert.equal(events,2);
}

// Keyboard and visualViewport scrolling must not cause full controller layout synchronization.
{
  const view={innerWidth:360,innerHeight:780},doc={activeElement:null},card={},store={keyboardEditing:false};let work=0;
  const change=vm.runInNewContext(`(()=>{let lastViewportWidth=360,lastViewportHeight=780;${between('  function onCardViewportChange() {',"  TOP.addEventListener('resize',onCardViewportChange")};return onCardViewportChange;})()`,{
    VIEW:view,DOC:doc,card,TOP:{__PMM_FLOATING_STORE__:{getState:()=>store}},activeResizeCleanup:null,activeCardDragCleanup:null,refreshDeviceValues:()=>work++,setFloatingVariables:()=>work++,scheduleSync:()=>work++,keepCardInBounds:()=>work++,
  });
  for(let i=0;i<100;i++)change();assert.equal(work,0);
  view.innerHeight=480;store.keyboardEditing=true;change();assert.equal(work,0);
  store.keyboardEditing=false;doc.activeElement={matches:()=>true};change();assert.equal(work,0);
  doc.activeElement=null;card.__pmmScrolling=true;change();assert.equal(work,0);
  card.__pmmScrolling=false;view.innerWidth=780;view.innerHeight=360;change();assert.equal(work,4,'An actual rotation must still update bounds and defaults');
  change();assert.equal(work,4,'Paired window/visualViewport events must coalesce');
}

// The legacy batch module watches title controls, not every progressively loaded prompt.
{
  let scheduled=0,initial=0;const observers=[];
  const node=parentElement=>({nodeType:1,parentElement,matches:()=>false});
  const body=node(null),mount=node(body),root=node(mount),panel=node(root),header=node(panel),list=node(panel);
  let mounted=false,currentHeader=header;
  const doc={body,querySelector:()=>mounted?mount:null};
  mount.querySelector=()=>root;root.querySelector=()=>panel;panel.querySelector=()=>currentHeader;
  class Observer{
    constructor(callback){this.callback=callback;this.targets=[];observers.push(this);}
    observe(target,options){this.targets.push({target,options});}
    disconnect(){this.targets=[];}
    deliver(record){if(this.targets.some(({target,options})=>{if(target===record.target)return true;if(!options.subtree)return false;for(let n=record.target.parentElement;n;n=n.parentElement)if(n===target)return true;return false;}))this.callback([record]);}
  }
  vm.runInNewContext(`(()=>{let observers=[];${between('  function install() {\n    for (const currentDocument of documents()) installStyle(currentDocument);','  SELF[CLEANUP_KEY] = () => {')};install();})()`,{
    documents:()=>[doc],installStyle(){},MutationObserverCtor:Observer,scheduleSync:()=>scheduled++,sync:()=>initial++,MEDIA:null,SELF:{addEventListener(){}},
  });
  const observer=observers[0];assert.equal(initial,1);assert.equal(observer.targets.length,1);
  mounted=true;observer.deliver({target:body,addedNodes:[mount]});assert.equal(scheduled,1);
  assert.equal(observer.targets.length,5);assert.deepEqual(observer.targets.filter(({options})=>options.subtree).map(({target})=>target),[header]);
  for(let i=0;i<250;i++)observer.deliver({target:list,addedNodes:[node(list)]});
  observer.deliver({target:header,addedNodes:[node(header)]});
  assert.equal(scheduled,1,'Prompt batches and our own glyph cannot enumerate presets again');
  const control={...node(header),matches:()=>true};observer.deliver({target:header,addedNodes:[control]});assert.equal(scheduled,2);
  currentHeader=node(panel);observer.deliver({target:panel,addedNodes:[currentHeader]});assert.equal(scheduled,3,'Replaced native title controls must be rebound');
  assert(observer.targets.some(({target})=>target===currentHeader));assert(!observer.targets.some(({target})=>target===header));

  // With the unified owner installed, old mobile CSS may never hide its banner.
  let enabled;
  root.isConnected=true;doc.querySelectorAll=()=>[root];doc.documentElement={classList:{toggle:(_name,value)=>enabled=value}};
  const batch=workshop.slice(workshop.indexOf('/* ===== PMM_FLOATING_PANEL_BATCH_V1'));
  const a=batch.indexOf('  function sync() {'),b=batch.indexOf('  function scheduleSync()',a);
  const top={__PMM_FLOATING_CONTROLLER__:{}};
  vm.runInNewContext(`${batch.slice(a,b)};sync();`,{scheduled:0,documents:()=>[doc],ROOT_SELECTOR:'root',syncRoot(){},TOP:top,isMobile:()=>true,floatingEntryEnabled:()=>true});
  assert.equal(enabled,false);
}
console.log('性能回归通过：250 分组空闲停止扫描；重复布局零样式写入；条幅续载不扫描预设；键盘/滚动不触发全量布局；真实变更正常更新。');
