import assert from 'node:assert/strict';
import {createWorldbookSnapshots,copy,switches,emptyStore} from '../dist/worldbook-snapshot-core.js';
function fixture(){
  let store=emptyStore(),c=null,chat='',globals=['manual'],seq=0,fail='',quota=false;
  const world=()=>({entries:{1:{uid:1,disable:false,content:'keep'},2:{uid:2,disable:true,order:7}}});
  const data={role:world(),extra:world(),x:world(),y:world(),manual:world()},links={role:['a'],extra:['a']};
  const host={readStore:()=>copy(store),writeStore:s=>{if(quota){quota=false;throw Error('quota');}store=copy(s);},id:()=>String(++seq),character:()=>c?{key:c}:null,chat:()=>chat,
    catalog:async()=>Object.keys(data).map(name=>({name,characters:(links[name]||[]).map(key=>({key})),global:globals.includes(name)})),load:async n=>copy(data[n]),
    save:async(n,d)=>{if(fail===n)throw Error('failed');data[n]=copy(d);},exists:async n=>!!data[n],globals:async()=>globals,setGlobals:async n=>{globals=[...n];}};
  let e=createWorldbookSnapshots(host);
  return {get e(){return e;},data,links,get store(){return copy(store);},get globals(){return globals;},select:(key,id='one')=>{c=key;chat=key?id:'';},reload:()=>{e=createWorldbookSnapshots(host);},fail:n=>{fail=n;},quota:()=>{quota=true;}};
}
async function create(f,scope,owner,name,flip=true){const d=await f.e.captureBundle(scope,owner);if(flip)for(const b of Object.values(d.data))b.entries[1].disable=true;return f.e.createBundle({...d,scope,owner,name});}
{
  const f=fixture();
  await assert.rejects(f.e.captureBundle('character','a'),/进入/);
  f.select('a'); const item=await create(f,'character','a','B');
  assert.deepEqual(Object.keys(item.books),['role','extra']);
  assert.equal(f.store.defaults[0].books.role[1],false);
  assert.equal(f.data.role.entries[1].disable,false,'Creating a character snapshot must not apply it');
  assert.equal(f.store.session,null,'Creating a character snapshot must not mark it current');
  await f.e.bindChat(item.id);
  assert.equal(f.data.role.entries[1].disable,true,'Chat binding applies the snapshot immediately');
  assert.equal(f.store.session.before.role[1],false);
  f.select('a','two');await f.e.transition();
  assert.equal(f.data.role.entries[1].disable,false,'Other chat restores A');
  f.select('a','one');await f.e.transition();
  assert.equal(f.data.role.entries[1].disable,true,'Bound chat applies B');
  f.data.role.entries[1].disable=false;
  await f.e.transition();assert.equal(f.data.role.entries[1].disable,false,'Repeat event must not overwrite');
  await f.e.applyBundle(item.id);
  await create(f,'character','a','C',false);
  assert.equal(f.store.defaults[0].books.role[1],false,'Repeated new does not overwrite default');
  f.reload();f.select(null);await f.e.transition();
  assert.equal(f.data.role.entries[1].disable,false,'Reload then home restores A');
  assert.equal(f.data.extra.entries[1].disable,false);
  assert.equal(f.data.role.entries[1].content,'keep');
  f.select('b');await assert.rejects(f.e.applyBundle(item.id),/当前角色/);
  f.select('a');const d=await f.e.captureBundle('character','a');f.select('a','two');
  await assert.rejects(f.e.createBundle({...d,scope:'character',owner:'a',name:'stale'}),/聊天已切换/);
}
{
  const f=fixture();f.select('a');
  await create(f,'character','a','B');await create(f,'character','a','C',false);
  const removed=await f.e.resetBundle('character','a');
  assert.equal(removed,2,'Reset reports removed character snapshots');
  assert.equal(f.store.snapshots.filter(s=>s.bundle&&s.owner==='a').length,0,'Reset removes current character snapshots');
  assert.equal(f.store.defaults.filter(s=>s.scope==='character'&&s.owner==='a').length,0,'Reset removes current character default');
  assert.equal(f.data.role.entries[1].disable,false,'Reset restores default switches first');
  assert.equal(f.store.session,null,'Reset clears current bundle session');
}
{
  const f=fixture();f.select('a');
  const d=await f.e.captureBundle('character','a');for(const b of Object.values(d.data))b.entries[1].disable=true;
  f.fail('extra');const item=await f.e.createBundle({...d,scope:'character',owner:'a',name:'saved'});
  assert.equal(f.data.role.entries[1].disable,false,'Saving does not write worldbook switches');
  assert.equal(f.store.snapshots.length,1);
  await assert.rejects(f.e.applyBundle(item.id),/failed/);
  assert.equal(f.data.role.entries[1].disable,false,'Failed explicit apply rolls earlier writes back');
  assert.equal(f.store.session,null);
  f.fail('');f.select(null);await f.e.transition();
}
{
  const f=fixture();
  await f.e.saveGroup({name:'G',books:['x','manual']});const g=f.store.groups[0].id;
  await f.e.selectGroupPlan(g,'');
  assert.deepEqual(f.globals,['manual'],'Fresh default selection must not mount books');
  const s=await create(f,'group',g,'剧情');
  assert.equal(f.data.x.entries[1].disable,false,'Group draft saves without applying');
  assert.deepEqual(f.globals,['manual']);
  await f.e.selectGroupPlan(g,s.id);assert.equal(f.data.x.entries[1].disable,false);
  await f.e.toggleGroup(g);assert.equal(f.data.x.entries[1].disable,true);
  assert.ok(f.globals.includes('x'));
  await f.e.selectGroupPlan(g,'');assert.equal(f.data.x.entries[1].disable,false,'Live default selection applies');
  await f.e.toggleGroup(g);assert.deepEqual(f.globals,['manual']);
  await f.e.selectGroupPlan(g,s.id);
  await assert.rejects(f.e.remove(s.id),/默认/);
  await f.e.saveGroup({name:'H',books:['x','y']});const h=f.store.groups[1].id;
  await create(f,'group',h,'原始',false);
  await f.e.toggleGroup(h);
  await assert.rejects(f.e.toggleGroup(g),e=>e.code==='GROUP_CONFLICT');
  assert.equal(f.store.groups[0].enabled,false);assert.equal(f.data.x.entries[1].disable,false);
  await f.e.toggleGroup(g,true);assert.equal(f.data.x.entries[1].disable,true);
  await f.e.toggleGroup(g);assert.ok(f.globals.includes('x'),'Other group retains shared book');
  f.data.manual.entries[1].disable=false;
  f.fail('manual');await assert.rejects(f.e.toggleGroup(g,true),/failed/);
  assert.equal(f.store.groups[0].enabled,false);
  f.fail('');
  await f.e.saveGroup({id:g,name:'G',books:['manual']});
  assert.equal(f.store.groups[0].snapshot,'','Member change resets selection');
  await assert.rejects(f.e.selectGroupPlan(g,s.id),/成员已变化/);
  f.links.manual=['a'];await assert.rejects(f.e.captureBundle('group',g),/绑定角色/);
}
{
  const f=fixture();await f.e.saveGroup({name:'Cleanup',books:['x','y']});const g=f.store.groups[0].id;
  await create(f,'group',g,'saved');
  const before=copy(f.data);
  await f.e.removeDefault('group',g);
  assert.equal(f.store.defaults.filter(item=>item.scope==='group'&&item.owner===g).length,0,'Deleting group default removes only its saved baseline');
  assert.equal(f.store.snapshots.filter(item=>item.scope==='group'&&item.owner===g).length,1,'Deleting default keeps named snapshots');
  assert.deepEqual(f.data,before,'Deleting group default never writes worldbook switches');
  await f.e.captureBundle('group',g);
  assert.equal(f.store.defaults.filter(item=>item.scope==='group'&&item.owner===g).length,1,'Next capture recreates the group default');
  await f.e.toggleGroup(g);
  await assert.rejects(f.e.removeDefault('group',g),/先关闭分组/);
  await f.e.toggleGroup(g);
  await f.e.removeGroup(g);
  assert.equal(f.store.groups.length,0);
  assert.equal(f.store.defaults.filter(item=>item.scope==='group'&&item.owner===g).length,0,'Removing group cleans its default');
  assert.equal(f.store.snapshots.filter(item=>item.scope==='group'&&item.owner===g).length,0,'Removing group cleans its snapshots');
}
{
  const f=fixture();await f.e.saveGroup({name:'Prune',books:['x','y']});const g=f.store.groups[0].id;
  const s=await create(f,'group',g,'saved');await f.e.toggleGroup(g);
  const result=await f.e.reconcileBooks(['role','extra','y','manual']);
  assert.equal(result.changed,true,'Missing worldbooks trigger reconciliation');
  assert.deepEqual(f.store.groups[0].books,['y'],'Missing member is removed from its group');
  assert.deepEqual(Object.keys(f.store.defaults.find(item=>item.scope==='group'&&item.owner===g).books),['y'],'Missing member is removed from group default');
  assert.deepEqual(Object.keys(f.store.snapshots.find(item=>item.id===s.id).books),['y'],'Missing member is removed from named group snapshots');
  assert.equal(f.store.groups[0].enabled,true,'A group with remaining books stays enabled');
  await f.e.reconcileBooks(['role','extra','manual']);
  assert.deepEqual(f.store.groups[0].books,[],'Last missing member leaves the group in place');
  assert.equal(f.store.groups[0].enabled,false,'An empty group is switched off');
  assert.equal(f.store.groups.length,1,'Empty groups are retained for editing');
  assert.deepEqual(Object.keys(f.store.snapshots.find(item=>item.id===s.id).books),[],'Named group snapshot no longer keeps orphan book keys');
}
{
  const f=fixture();await f.e.saveGroup({name:'Q',books:['x','y']});const g=f.store.groups[0].id;
  const s=await create(f,'group',g,'on');await f.e.selectGroupPlan(g,s.id);
  f.quota();await assert.rejects(f.e.toggleGroup(g),/quota/);
  assert.equal(f.store.groups[0].enabled,false);assert.deepEqual(f.globals,['manual']);
  assert.equal(f.data.x.entries[1].disable,false);assert.equal(f.data.y.entries[1].disable,false);
}
{
  const f=fixture();await f.e.saveGroup({name:'Edit',books:['x','y']});const g=f.store.groups[0].id;
  const s=await create(f,'group',g,'original');
  const d=await f.e.editBundle(s.id);
  assert.equal(d.data.x.entries[1].disable,true,'Editor reads saved snapshot, not live switches');
  assert.equal(f.data.x.entries[1].disable,false,'Opening editor does not apply');
  d.data.x.entries[2].disable=false;
  await f.e.updateBundle({...d,name:'edited'});
  assert.equal(f.store.snapshots.length,1);assert.equal(f.store.snapshots[0].id,s.id);
  assert.equal(f.data.x.entries[2].disable,true,'Save-only leaves worldbook unchanged');
  await f.e.selectGroupPlan(g,s.id);await f.e.toggleGroup(g);
  const e=await f.e.editBundle(s.id);e.data.x.entries[1].disable=false;
  await f.e.updateBundle(e,true);
  assert.equal(f.data.x.entries[1].disable,false,'Explicit sync applies active group');
  assert.equal(f.store.groups[0].snapshot,s.id);
  assert.equal(f.store.defaults[0].books.x[2],true,'Default untouched');
  const stale=await f.e.editBundle(s.id);f.select('a');
  await assert.rejects(f.e.updateBundle(stale),/聊天已切换/);
}
console.log('Worldbook bundles passed: defaults, chat locks, editing, rollback, group plans, conflicts and stale drafts.');
