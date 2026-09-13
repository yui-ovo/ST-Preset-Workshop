import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../dist/workshop-v3.02.js',import.meta.url),'utf8');
function section(a,b){return source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));}
let binding=null,active=null,home=null,chat='a';const calls=[];
const baseline={id:'default',presetName:'current',states:[{id:'p',enabled:true}],groupStates:[],isDefault:true};
const run=Function('readStore','boundSnapshotForContext','activeSnapshotForPreset','homeSnapshotForPreset','fallbackSnapshotForPreset','applySnapshot',`
let autoApplySerial=0,lastAutoContextKey='';const isBranchMode=()=>false,activeBranchName=()=>'',loadedPresetName=()=>'current';
${section('  async function autoApplyBoundSnapshot(', '  function scheduleBoundSnapshotAutoApply(')}
return autoApplyBoundSnapshot;
`)(()=>({snapshots:[baseline,{id:'other',presetName:'other',chats:[{key:'a'}]}]}),()=>({snapshot:binding,chat:{key:chat}}),()=>active,()=>home,()=>home||baseline,async(id)=>{calls.push(id);active=id==='default'?null:{id};return true;});
await run();chat='';await run();chat='b';await run();assert.deepEqual(calls,[],'Other preset bindings must not restore this preset');
binding={id:'bound'};await run();assert.deepEqual(calls,['bound']);
binding=null;chat='';await run();assert.deepEqual(calls,['bound','default'],'Leaving a bound snapshot restores its baseline');
chat='c';await run();assert.equal(calls.length,2,'Once restored, unbound chats do nothing');
home={id:'home'};binding={id:'bound'};chat='bound-chat';await run();binding=null;chat='';await run();assert.equal(calls.at(-1),'home','Return to a manually selected home snapshot');

// Execute the production apply function: unchanged automatic targets must not save or notify.
let recorded='';const enabled=true;
const apply=Function('findSnapshot','getPrompts','mergeSnapshotStates','makeGroupStates','matchGroupStates','setActiveSnapshot',`
const overlayContext=null,isBranchMode=()=>false,blockWhileBranchActive=()=>false,text=x=>String(x||''),currentPresetName=()=>'current';
const notify=()=>{throw Error('Unexpected toast')},isDefaultSnapshot=s=>s.isDefault;
${section('  async function applySnapshot(id)', '  function renameSnapshot(')}
return applySnapshot;
`)(()=>baseline,()=>[{id:'p',enabled}],(prompts)=>({nextPrompts:prompts,applied:1,changed:0}),()=>[],()=>[],(_,id)=>{recorded=id;});
assert.equal(await apply('default',{automatic:true}),true);assert.equal(recorded,'');
console.log('test.99 passed: unrelated bindings, untouched presets, bound exit recovery, home recovery and silent unchanged automatic application.');
