import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const entry=fs.readFileSync(new URL('../dist/index.js',import.meta.url),'utf8');
const source=entry.slice(entry.indexOf('function canAutoReloadAfterUpdate()'),entry.indexOf('function scheduleNativeSingleUpdateReload()'));
function boot(context,editing=false){
  let reloads=0,notices=0,marks=0;
  const api=vm.runInNewContext(`(()=>{let nativeUpdateReloadTimer=1,updateReloadDeferred=false;${source};return{reload:markExtensionUpdateReload};})()`,{
    SillyTavern:{getContext:()=>{if(context instanceof Error)throw context;return context;}},
    document:{activeElement:{matches:()=>editing}},location:{reload:()=>reloads++},notify:()=>notices++,
    __PMM_PERFORMANCE_GUARD_V275__:{markReloadReason:()=>marks++},
  });
  return{...api,counts:()=>({reloads,notices,marks})};
}
const fail=()=>{throw Error('Update handling must never save, clear or serialize chat data');};
// Character zero, groups, loading/empty chats, neutral messages and in-flight generation all block reload.
for(const value of [null,{},new Error('host unavailable'),{chat:[],characterId:0},{chat:[],chatId:'loading'},
  {chat:[],groupId:'group'},{chat:[{mes:'unsaved'}]},{chat:[],streamingProcessor:{}},
  {chat:[{get mes(){throw Error('Do not inspect message contents');}}],chatId:'chat'}]){
  const context=value&&!(value instanceof Error)?Object.freeze({...value,saveChat:fail,saveMetadata:fail,clearChat:fail,toJSON:fail}):value;
  const api=boot(context);assert.equal(api.reload(),false);assert.equal(api.reload(),false);
  assert.deepEqual(api.counts(),{reloads:0,notices:1,marks:0},'Defer with one notification and no chat writes');
}
const neutral={chat:[],chatId:undefined,characterId:undefined,groupId:null};
assert.equal(boot(neutral,true).reload(),false,'Editing blocks an automatic reload');
const idle=boot(neutral);assert.equal(idle.reload(),true);assert.deepEqual(idle.counts(),{reloads:1,notices:0,marks:1});
// Check fresh context when the delayed update callback runs, not only when the update is detected.
const changing={...neutral};const api=boot(changing);changing.characterId=0;assert.equal(api.reload(),false);
assert.equal((entry.match(/globalThis\.location\.reload\(\)/g)||[]).length,1,'All update reload paths use the same guard');
const versionCheck=entry.slice(entry.indexOf('async function checkForInstalledUpdate()'),entry.indexOf('function handleVisibilityChange()'));
assert(versionCheck.includes('markExtensionUpdateReload();'));
const nativeUpdate=entry.slice(entry.indexOf('function scheduleNativeSingleUpdateReload()'),entry.indexOf('function handleNativeExtensionManagerClick('));
assert(nativeUpdate.includes('markExtensionUpdateReload,'));
console.log('聊天刷新保护通过：有聊天/正在载入/输入/生成及宿主未知时不自动刷新，不调用聊天保存或清空，延迟回调重新检查。');
