import assert from 'node:assert/strict';
import { planSwitchTransfer, transferSwitches, saveDirtyDrafts } from '../dist/workshop-editing-core.js';
const old = [
  { id:'stable',name:'旧名称',enabled:false,content:'old text' },
  { id:'old-id',name:'同名条目',enabled:true,content:'old body' },
  { id:'rename',name:'旧文风',enabled:false,content:'identical body' },
  { id:'d1',name:'重名',enabled:false }, { id:'d2',name:'重名',enabled:true },
];
const fresh = [
  { id:'new-only',name:'新条目',enabled:true,content:'new',extra:{keep:true} },
  { id:'stable',name:'新名称',enabled:true,content:'NEW BODY',role:'system',position:{depth:5} },
  { id:'new-id',name:'同名条目',enabled:false,content:'NEW CONTENT' },
  { id:'new-rename',name:'新文风',enabled:true,content:'identical body' },
  { id:'duplicate',name:'重名',enabled:true },
];
const plan = planSwitchTransfer(old,fresh);
assert.deepEqual([...plan.matches],[[1,0],[2,1]]);
assert.deepEqual(plan.unresolved.map(x=>x.candidates),[[],[2],[3,4]]);
const originals = structuredClone([old,fresh]);
const result = transferSwitches(old,fresh,plan.matches);
assert.equal(result.changed,2);
assert.deepEqual(result.prompts.map(x=>x.enabled),[true,false,true,true,true]);
assert.deepEqual([old,fresh],originals,'Planning/application must not mutate source or target');
assert.deepEqual(result.prompts.map(({enabled,...rest})=>rest),fresh.map(({enabled,...rest})=>rest),'Only enabled may change');
const manual = new Map(plan.matches); manual.set(3,2);
assert.equal(transferSwitches(old,fresh,manual).prompts[3].enabled,false);
manual.set(4,2); assert.throws(()=>transferSwitches(old,fresh,manual),/重复/);
const many = Array.from({length:2000},(_,i)=>({id:String(i),name:'重名',enabled:i%2===0}));
assert.equal(planSwitchTransfer(many,[...many].reverse()).matches.size,2000);
const calls = [];
function entry(name,value){ let dirty=true; return {name,label:name,destination:name,read:()=>value,dirty:()=>dirty,
  save:async()=>{calls.push(name);dirty=false},discard:()=>{dirty=false}}; }
const first=entry('first',{}),second=entry('second',{}); second.save=async()=>{throw Error('offline')};
await assert.rejects(saveDirtyDrafts([first,second]),/offline/);
assert.equal(first.dirty(),false); assert.equal(second.dirty(),true);
second.save=async()=>false;await assert.rejects(saveDirtyDrafts([second]),/保存失败/);
const conflict=[entry('same',{enabled:true}),entry('same',{enabled:false})];
await assert.rejects(saveDirtyDrafts(conflict),/两侧有不同修改/);
assert.deepEqual(calls,['first'],'Conflict must be detected before any save');
const concurrent=entry('concurrent',{}); concurrent.save=async()=>{};
await assert.rejects(saveDirtyDrafts([concurrent]),/仍有未保存/);
console.log('Workshop editing passed: stable IDs, unique names, ambiguous/manual mapping, unchanged additions, fields/order isolation, large lists, partial-save failure and conflicting drafts.');
