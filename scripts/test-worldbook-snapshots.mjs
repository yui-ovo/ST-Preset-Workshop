import assert from 'node:assert/strict';
import { createWorldbookSnapshots, copy, switches, mergeSwitches, emptyStore } from '../dist/worldbook-snapshot-core.js';

function fixture() {
  let store = emptyStore(), selected = null, globals = ['manual'], seq = 0, unsaved = false, failSave = '', failStore = false;
  const saves = [];
  const chars = [{ key: 'alice.png', name: 'Alice' }, { key: 'bob.png', name: 'Bob' }];
  const world = () => ({ entries: { 1: { uid: 1, disable: false, content: 'unchanged', order: 12 }, 2: { uid: 2, disable: true, key: ['unchanged'] } }, extra: { preserved: true } });
  const data = { shared: world(), manual: world(), x: world(), y: world(), z: world() };
  const bindings = { shared: chars };
  const host = {
    id: () => `s${++seq}`,
    readStore: () => copy(store),
    writeStore: value => { if (failStore) { failStore = false; throw Error('quota'); } store = copy(value); },
    character: () => selected,
    catalog: async () => Object.keys(data).map(name => ({ name, characters: bindings[name] || [], global: globals.includes(name) })),
    globals: async () => [...globals], setGlobals: async value => { globals = [...value]; },
    load: async name => copy(data[name]),
    exists: async name => Object.hasOwn(data, name),
    save: async (name, value) => { if (failSave === name) throw Error('save failed'); data[name] = copy(value); saves.push(name); },
    hasUnsaved: () => unsaved,
  };
  let engine = createWorldbookSnapshots(host);
  return { get engine() { return engine; }, host, chars, data, bindings, saves,
    get store() { return copy(store); }, get globals() { return [...globals]; },
    select: value => { selected = value; }, mount: value => { globals = value; }, dirty: value => { unsaved = value; },
    fail: value => { failSave = value; }, quota: () => { failStore = true; },
    reload: () => { engine = createWorldbookSnapshots(host); },
  };
}
async function snap(f, scope, book, name, states) {
  return f.engine.create({ scope, book, name, states, contextKey: f.host.character()?.key || '' });
}

// Partial matching preserves new entries, text, trigger keys, ordering and metadata.
{
  const data = { entries: { 1: { uid: 1, disable: false, content: 'body', key: ['trigger'] }, 3: { uid: 3, disable: false } }, meta: 9 };
  const result = mergeSwitches(data, { 1: true, 2: false });
  assert.equal(result.matched, 1);
  assert.equal(data.entries[1].disable, false);
  assert.equal(result.data.entries[3].disable, false);
  assert.equal(result.data.entries[1].content, 'body');
  assert.deepEqual(result.data.entries[1].key, ['trigger']);
  assert.equal(result.data.meta, 9);
}

// Binding now immediately applies, then restores exact A on home (including after reload).
{
  const f = fixture(), A = switches(f.data.shared), B = { 1: true, 2: false };
  const item = await snap(f, 'character', 'shared', 'B', B);
  assert.deepEqual(item.characters, []);
  f.data.shared.entries[1].disable = false; f.data.shared.entries[2].disable = true;
  f.select(f.chars[0]);
  await f.engine.bind(item.id);
  assert.deepEqual(switches(f.data.shared), B);
  assert.deepEqual(f.store.session.before.shared, A);
  const count = f.saves.length;
  await f.engine.transition(); await f.engine.transition();
  assert.equal(f.saves.length, count, 'Repeated chat events must not overwrite manual edits or write again');
  f.reload(); f.select(null); await f.engine.transition();
  assert.deepEqual(switches(f.data.shared), A);
  assert.equal(f.store.session, null);
  f.select(f.chars[0]); await f.engine.transition();
  assert.deepEqual(switches(f.data.shared), B);
  f.select(f.chars[1]); await f.engine.transition();
  assert.deepEqual(switches(f.data.shared), A, 'Unbound next character must not inherit B');
}

// Two characters sharing a book and rapid queued transitions keep the original return state.
{
  const f = fixture(), A = switches(f.data.shared), B = { 1: true, 2: true }, C = { 1: false, 2: false };
  const b = await snap(f, 'character', 'shared', 'B', B);
  const c = await snap(f, 'character', 'shared', 'C', C);
  Object.values(f.data.shared.entries).forEach(e => { e.disable = A[e.uid]; });
  f.select(f.chars[0]); await f.engine.bind(b.id);
  f.select(f.chars[1]); await f.engine.bind(c.id);
  assert.deepEqual(switches(f.data.shared), C);
  f.select(f.chars[0]); await f.engine.transition();
  assert.deepEqual(switches(f.data.shared), B);
  f.select(null); await Promise.all([f.engine.transition(), f.engine.transition()]);
  assert.deepEqual(switches(f.data.shared), A);
}

// Drafts are read-only until saved; context changes defer auto-apply, then stale save is rejected.
{
  const f = fixture(), A = copy(f.data.shared);
  f.select(f.chars[0]); f.engine.setCapturing(true);
  const draft = await f.engine.capture('shared', 'character'); draft.entries[1].disable = true;
  assert.deepEqual(f.data.shared, A);
  f.select(f.chars[1]);
  assert.deepEqual(await f.engine.transition(), { deferred: true });
  await assert.rejects(() => f.engine.create({ book:'shared', scope:'character', name:'stale', states:switches(draft), contextKey:'alice.png' }), /角色已切换/);
  f.engine.setCapturing(false); await f.engine.transition();
  assert.deepEqual(f.data.shared, A);
  f.dirty(true);
  await assert.rejects(() => f.engine.capture('shared', 'character'), /未保存/);
}

// Eligibility is checked on every write, including binding changes outside the workshop.
{
  const f = fixture();
  await assert.rejects(() => f.engine.capture('x', 'global'), /挂载已变化/);
  await assert.rejects(() => f.engine.capture('shared', 'global'), /挂载已变化/);
  const item = await snap(f, 'global', 'manual', 'global', { 1:true, 2:false });
  f.bindings.manual = [f.chars[0]];
  await assert.rejects(() => f.engine.apply(item.id), /绑定或全局挂载/);
  await assert.rejects(() => f.engine.saveGroup({ name:'invalid', books:['shared'] }), /没有绑定角色/);
}

// Group union, overlap and manual mounts survive group shutdown. Disabled groups can be edited.
{
  const f = fixture();
  await f.engine.saveGroup({ name:'One', books:['manual', 'x', 'y'] });
  await f.engine.saveGroup({ name:'Two', books:['y', 'z'] });
  const [one, two] = f.store.groups;
  await f.engine.toggleGroup(one.id); await f.engine.toggleGroup(two.id);
  assert.deepEqual(new Set(f.globals), new Set(['manual','x','y','z']));
  await assert.rejects(() => f.engine.removeGroup(one.id), /先关闭/);
  await f.engine.toggleGroup(one.id);
  assert.deepEqual(new Set(f.globals), new Set(['manual','y','z']));
  f.reload(); await f.engine.toggleGroup(two.id);
  assert.deepEqual(f.globals, ['manual']);
  await f.engine.saveGroup({ id:one.id, name:'New', books:['z'] });
  await f.engine.toggleGroup(one.id);
  assert.deepEqual(new Set(f.globals), new Set(['manual','z']));
  f.bindings.z = [f.chars[0]]; await f.engine.toggleGroup(one.id);
  assert.ok(f.globals.includes('z'), 'Do not unmount a book newly bound to a character');
}

// Failed save leaves a retryable return journal; storage failure rolls writes back.
{
  const f = fixture(), A = switches(f.data.shared);
  const item = await snap(f, 'character', 'shared', 'B', { 1:true, 2:false });
  Object.values(f.data.shared.entries).forEach(e => { e.disable = A[e.uid]; });
  f.select(f.chars[0]); await f.engine.bind(item.id);
  f.select(null); f.fail('shared');
  await assert.rejects(() => f.engine.transition(), /save failed/);
  assert.deepEqual(f.store.session.before.shared, A);
  f.fail(''); await f.engine.transition(); assert.deepEqual(switches(f.data.shared), A);
  f.quota(); await assert.rejects(() => snap(f, 'global', 'manual', 'fail', {1:true}), /quota/);
  assert.equal(f.data.manual.entries[1].disable, false);
  await f.engine.saveGroup({ name:'quota', books:['x'] });
  f.quota(); await assert.rejects(() => f.engine.toggleGroup(f.store.groups[0].id), /quota/);
  assert.deepEqual(f.globals, ['manual']);
}
// Deleted books/entries must not strand the return journal or recreate removed content.
for (const removeBook of [false, true]) {
  const f = fixture();
  const item = await snap(f, 'character', 'shared', 'B', {1:true});
  f.data.shared.entries[1].disable = false;
  f.select(f.chars[0]); await f.engine.bind(item.id);
  if (removeBook) delete f.data.shared;
  else f.data.shared.entries = {9:{uid:9, disable:false, content:'new'}};
  f.select(null); await f.engine.transition();
  assert.equal(f.store.session, null);
  if (!removeBook) assert.deepEqual(f.data.shared.entries, {9:{uid:9,disable:false,content:'new'}});
}
console.log('Worldbook snapshots: transitions, drafts, shared books, eligibility, groups and recovery passed.');
