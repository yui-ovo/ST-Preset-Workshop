import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../dist/worldbook-stitch-test3.js',import.meta.url),'utf8');
const workshop=await readFile(new URL('../dist/workshop-v3.02.js',import.meta.url),'utf8');
const store={currentPresetName:'preset',prompts:[{id:'original',name:'original'}]};
let serial=0;
const start=workshop.indexOf('function _pmmResolveWorldbookPresetDropTarget');
const end=workshop.indexOf(';try{globalThis.__PMM_WORLDBOOK_PRESET_DROP_BRIDGE__',start);
const bridge=new Function('a','t','E',workshop.slice(start,end)+';return _pmmWorldbookPresetDropBridge;')(store,structuredClone,async(entries,id,position)=>{
  const index=id?store.prompts.findIndex(p=>p.id===id):store.prompts.length;
  store.prompts.splice(index+(id&&position==='after'?1:0),0,...entries.map(p=>({...p,id:'new'+ ++serial})));
});
await bridge.drop({entries:[{name:'user'},{name:'user'}],targetId:'original',position:'before'});
const fresh=bridge.snapshot().prompts;
assert.equal(fresh.length,3);
const panel={isConnected:true,__vueParentComponent:{props:{prompts:[{id:'original',name:'original'}]}},querySelector:()=>({value:'preset'}),querySelectorAll:()=>[]};
const state={nativeTop:{isConnected:false}};
const code=source.slice(source.indexOf('function currentNativePresetPanel()'),source.indexOf('async function emitNativePresetDrop('));
const snapshot=new Function('DOC','state','componentArray','componentSet','nativePresetDropDispatcher','clone','getLoadedPresetNameSafe','SELF','TOP',code+';return nativePresetSnapshot;')(
  {querySelector:()=>panel},state,v=>Array.isArray(v)?v:null,()=>new Set(),()=>null,structuredClone,()=>'',{__PMM_WORLDBOOK_PRESET_DROP_BRIDGE__:bridge},{});
assert.deepEqual(snapshot().prompts,fresh,'Latest unsaved draft wins over stale component props');
assert.equal(state.nativeTop,panel,'Detached panel is replaced');
// A second book can target either newly inserted ID despite duplicate names.
await bridge.drop({entries:[{name:'book B'}],targetId:snapshot().prompts[1].id,position:'before'});
assert.deepEqual(store.prompts.map(p=>p.name),['user','book B','user','original']);
await bridge.drop({entries:[{name:'book C'}],targetId:store.prompts[1].id,position:'after'});
assert.deepEqual(store.prompts.map(p=>p.name),['user','book B','book C','user','original']);
const before=structuredClone(store.prompts);
assert.equal((await bridge.drop({entries:[{name:'bad'}],targetId:'missing',targetName:'user'})).ok,false);
assert.deepEqual(store.prompts,before,'Ambiguous target must not insert');
console.log('Unsaved targets passed: live draft, panel replacement, repeated book additions, duplicate names and before/after order.');
