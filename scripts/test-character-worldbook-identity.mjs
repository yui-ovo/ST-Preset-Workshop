import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWorldbookSnapshots, copy, emptyStore } from '../dist/worldbook-snapshot-core.js';

const source=await readFile(new URL('../dist/worldbook-snapshots.js',import.meta.url),'utf8');
const characterSource=source.slice(source.indexOf('function characters()'),source.indexOf('function chat()'));
const catalogSource=source.slice(source.indexOf('const CATALOG_BINDING_CONCURRENCY=4;'),source.indexOf('\nconst engine ='));
assert.ok(characterSource && catalogSource);
const cards=[
  {name:'同名角色',avatar:'old-card.png',data:{extensions:{world:'共同正文'}}},
  {name:'同名角色',avatar:'new-card.png',data:{extensions:{world:'共同正文'}}},
  {name:'独立角色',avatar:'unique.png',data:{extensions:{world:'独立正文'}}},
];
const extras={'old-card.png':['【user人设补充】'],'new-card.png':[],'unique.png':[]};
let selected=1,chat='one',store=emptyStore(),seq=0,hook=null;
const world=()=>({entries:{1:{uid:1,disable:false,content:'正文不变'}}});
const data=Object.fromEntries(['共同正文','【user人设补充】','独立正文','仅全局'].map(n=>[n,world()]));
let calls=[],saved=[];
const helperApis={
  getWorldbookNames:()=>Object.keys(data),getGlobalWorldbookNames:()=>['仅全局'],
  getCharWorldbookNames:async name=>{
    calls.push(name);
    // TavernHelper resolves non-current arguments by the first name/avatar match.
    const card=name==='current'?cards[selected]:cards.find(c=>c.name.toLowerCase()===name.toLowerCase()||c.avatar?.toLowerCase()===name.toLowerCase());
    assert.ok(card,'Identity must resolve a real card');
    const result={primary:card.data.extensions.world,additional:extras[card.avatar]||[]};
    if(hook){const run=hook;hook=null;run();}
    return copy(result);
  },
};
const {catalog,character}=Function('ctx','helper',characterSource+catalogSource+'\nreturn {catalog,character};')(
  ()=>({characters:cards,characterId:selected}),name=>helperApis[name]);
const listed=async()=> (await catalog('character',character().key)).filter(b=>b.characters.some(c=>c.key===character().key)).map(b=>b.name);
assert.deepEqual(await listed(),['共同正文'],'Second same-name card must not inherit the first card’s extra book');
assert.deepEqual(calls,['current'],'Current-page lookup uses one call regardless of total cards');
selected=0;assert.deepEqual(await listed(),['共同正文','【user人设补充】']);
selected=2;assert.deepEqual(await listed(),['独立正文']);
calls=[];const all=await catalog();
assert.deepEqual(calls,cards.map(c=>c.avatar),'Full scan uses filenames, not ambiguous names');
assert.deepEqual(all.find(b=>b.name==='【user人设补充】').characters.map(c=>c.key),['old-card.png']);
assert.deepEqual(all.find(b=>b.name==='仅全局').characters,[]);
calls=[];await catalog('names');assert.deepEqual(calls,[],'Homepage does not scan bindings');
selected=1;hook=()=>{selected=0;};await assert.rejects(catalog('character','new-card.png'),/角色已切换/);
selected=0;await assert.rejects(catalog('character','new-card.png'),/角色已切换/);

const engine=createWorldbookSnapshots({readStore:()=>copy(store),writeStore:s=>{store=copy(s);},id:()=>String(++seq),
  character,chat:()=>selected===undefined?'':chat,catalog,globals:async()=>['仅全局'],setGlobals:async()=>{throw Error('Must not change globals');},
  load:async name=>copy(data[name]),save:async(name,value)=>{saved.push(name);data[name]=copy(value);},exists:async name=>!!data[name]});
selected=1;
const draft=await engine.captureBundle('character','new-card.png');
assert.deepEqual(Object.keys(draft.data),['共同正文']);
draft.data['共同正文'].entries[1].disable=true;
const snapshot=await engine.createBundle({...draft,scope:'character',owner:'new-card.png',name:'当前卡方案'});
await engine.bindChat(snapshot.id);
assert.equal(data['共同正文'].entries[1].disable,true);
assert.equal(store.snapshots[0].owner,'new-card.png','Snapshot ownership format is unchanged');
assert.ok(!saved.includes('【user人设补充】'),'Unrelated book is never written');
selected=0;await engine.transition();assert.equal(data['共同正文'].entries[1].disable,false,'Switching to first same-name card restores switches');
selected=1;await engine.transition();assert.equal(data['共同正文'].entries[1].disable,true,'Returning reapplies the correct chat binding');
selected=undefined;await engine.transition();assert.equal(data['共同正文'].entries[1].disable,false);
assert.equal(data['共同正文'].entries[1].content,'正文不变');
selected=1;
const legacy=copy(snapshot);legacy.id='legacy-wrong-members';legacy.chat=null;legacy.books['【user人设补充】']={1:true};store.snapshots.push(legacy);
saved=[];await assert.rejects(engine.applyBundle(legacy.id),/世界书成员已变化/);
assert.deepEqual(saved,[],'An old contaminated snapshot fails validation before writing');
assert.ok(store.snapshots.some(s=>s.id===legacy.id),'Old snapshots are retained, not silently modified');
const avatar=cards[0].avatar;delete cards[0].avatar;
await assert.rejects(catalog(),/同名角色缺少文件标识/);
cards[0].avatar=avatar;
console.log('Character worldbook identity passed: duplicate names, current/avatar lookup, one-call reads, stale context, snapshot binding/restore and old snapshot safety.');
