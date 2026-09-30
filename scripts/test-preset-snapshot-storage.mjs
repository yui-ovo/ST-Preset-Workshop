import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { FIELD, SYNC_KEY, ARCHIVE_KEY, installPresetSnapshotStorage, snapshotRows } from '../dist/preset-snapshot-storage.js';
import { PRESET_KEY, WORLD_KEY, planPresetRelink, commitPresetRelink } from '../dist/snapshot-backup-core.js';
const clone = value => structuredClone(value);
const memory = () => { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) }; };
const row = (id = 'default', isDefault = true, presetName = 'A') => ({ id, name: id, presetName, isDefault,
  states: [{ id: 'p', name: 'Prompt', enabled: true }], groupStates: [{ id: 'g', name: 'Group', enabled: false }],
  characters: isDefault ? [] : [{ key: 'avatar:a.png', name: '角色' }], chats: [], createdAt: 1, updatedAt: 1 });
const raw = () => ({ temperature: 0.8, prompts: [{ identifier: 'p', content: 'SAVED BODY' }],
  prompt_order: [{ character_id: 100001, order: [{ identifier: 'p', enabled: false }] }],
  extensions: { other: { keep: 'unchanged' } } });
const embedded = (rows, revision = randomUUID()) => ({ version: 1, revision, snapshots: snapshotRows(rows, 'A') });

function fixture({ storage = memory(), files = new Map([['A', raw()]]), mode = 'ST', seed, delay = 60000 } = {}) {
  if (seed) storage.setItem(PRESET_KEY, JSON.stringify({ version: 1, snapshots: clone(seed) }));
  storage.setItem(WORLD_KEY, '{"world":"untouched"}');
  const cached = new Map([...files].map(([n, p]) => [n, clone(p)]));
  const live = { ...raw(), temperature: 1.7, prompts: [{ identifier: 'p', content: 'UNSAVED BODY' }] };
  const calls = [], toasts = [], listeners = new Map();
  const f = { files, cached, storage, live, calls, selected: 'A', failSave: false, failRead: false, loseReply: false, changes: 0 };
  const manager = { getSelectedPresetName: () => f.selected, getCompletionPresetByName: n => cached.get(n), getPresetList: () => ({ settings: live }) };
  const host = { localStorage: storage, setTimeout, clearTimeout, crypto: { randomUUID },
    toastr: { warning: v => toasts.push(v), info: v => toasts.push(v) },
    SillyTavern: { getContext: () => ({ getRequestHeaders: () => ({ 'Content-Type': 'application/json', 'X-CSRF-Token': 'fixture' }),
      getPresetManager: () => manager, eventTypes: { PRESET_CHANGED: 'changed' },
      eventSource: { on: (t, fn) => listeners.set(t, fn), off: t => listeners.delete(t) } }) },
    async fetch(path, options) {
      calls.push({ path, options: clone(options) });
      assert.equal(options.headers['X-CSRF-Token'], 'fixture');
      assert.equal(options.method, 'POST');
      const data = JSON.parse(options.body);
      if (path === '/api/settings/get') {
        if (f.failRead) throw new Error('offline');
        // TT's route delegates to get_sillytavern_settings; ST reads JSON files.
        const presets = [...files.values()].map(p => mode === 'TT' ? JSON.stringify(p) : JSON.stringify(p));
        return { ok: true, json: async () => ({ openai_setting_names: [...files.keys()], openai_settings: presets }) };
      }
      assert.equal(path, '/api/presets/save', 'Must never call settings/save or a full live preset save');
      assert.equal(data.apiId, 'openai');
      if (f.failSave) return { ok: false, status: 500 };
      await f.beforeSave?.(data);
      files.set(data.name, clone(data.preset));
      if (f.loseReply) { f.loseReply = false; throw new Error('response lost'); }
      return { ok: true, json: async () => ({ name: data.name }) };
    },
  };
  f.host = host; f.toasts = toasts; f.listeners = listeners;
  f.install = () => f.api = installPresetSnapshotStorage(host, { delay, onChange: () => f.changes++ });
  f.read = () => JSON.parse(storage.getItem(PRESET_KEY) || '{"version":1,"snapshots":[]}');
  f.edit = edit => { const store = f.read(); edit(store); storage.setItem(PRESET_KEY, JSON.stringify(store)); f.api.observe(store); };
  f.saves = () => calls.filter(v => v.path === '/api/presets/save');
  f.install(); return f;
}

for (const mode of ['ST', 'TT']) {
  const originals = [row(), row('role', false)];
  const f = fixture({ seed: originals, mode });
  await f.api.ensure();
  assert.equal(f.api.state('A').state, 'saved');
  assert.equal(f.saves().length, 1, 'Legacy local data migrates once');
  assert.deepEqual(JSON.parse(f.storage.getItem(ARCHIVE_KEY)).snapshots, originals);
  const persisted = f.files.get('A');
  const withoutOwnField = clone(persisted); delete withoutOwnField.extensions[FIELD];
  assert.deepEqual(withoutOwnField, raw(), 'Only our own extension field changed in saved file');
  assert.equal(f.live.temperature, 1.7); assert.equal(f.live.prompts[0].content, 'UNSAVED BODY');
  assert.deepEqual(f.live.extensions[FIELD], persisted.extensions[FIELD]);
  assert.deepEqual(f.cached.get('A').extensions[FIELD], persisted.extensions[FIELD], 'Normal export includes snapshot metadata');
  assert.equal(f.storage.getItem(WORLD_KEY), '{"world":"untouched"}');
  const calls = f.calls.length;
  f.edit(s => { s.activeSnapshots = { A: 'role' }; s.manualSnapshots = { A: 'role' }; });
  f.live.prompt_order[0].order[0].enabled = true;
  f.listeners.get('changed')({ apiId: 'openai', name: 'A' });
  assert.equal(f.calls.length, calls, 'Runtime flags / unsaved toggles cause no IO');
  f.edit(s => { s.snapshots.find(r => r.id === 'role').states[0].enabled = false; });
  f.edit(s => { s.snapshots.find(r => r.id === 'role').name = 'Updated'; });
  await f.api.refresh();
  assert.equal(f.saves().length, 2, 'Rapid durable edits coalesce');
  assert.equal(f.files.get('A').extensions[FIELD].snapshots.find(r => r.id === 'role').name, 'Updated');
  assert.equal(f.files.get('A').prompt_order[0].order[0].enabled, false, 'Unsaved native toggle not persisted');
  const fresh = fixture({ files: f.files, mode }); await fresh.api.ensure();
  assert.equal(fresh.read().snapshots.length, 2, 'Empty browser loads embedded data');
  assert.equal(fresh.saves().length, 0, 'Hydration does not rewrite a file');
  assert.equal(fresh.read().snapshots.find(s => s.id === 'role').characters.length, 1);
  // Stale browser must adopt remote deletions, not recreate its cached rows.
  f.edit(s => { s.snapshots = []; }); await f.api.refresh();
  assert.equal(f.files.get('A').extensions[FIELD].snapshots.length, 0, 'Empty tombstone is persisted');
  await fresh.api.refresh(); assert.equal(fresh.read().snapshots.length, 0);
  const stale = fixture({ files: f.files, seed: originals, mode }); await stale.api.ensure();
  assert.equal(stale.read().snapshots.length, 0, 'Unmigrated browser respects embedded tombstone');
  assert.equal(JSON.parse(stale.storage.getItem(ARCHIVE_KEY)).snapshots.length, 2, 'Stale data remains recoverable');
  for (const x of [f, fresh, stale]) { x.api.cleanup(); assert.equal(x.listeners.size, 0); }
}

// Bulk migration shares its reads; an unused preset is immediately ready for first snapshot.
{
  const rows = Array.from({ length: 12 }, (_, i) => row(`row${i}`, true, `Preset${i}`));
  const f = fixture({ seed: rows, files: new Map([...rows.map(r => [r.presetName, raw()]), ['Unused', raw()]]) });
  await f.api.ensure();
  assert.equal(f.saves().length, 12);
  assert.equal(f.calls.filter(c => c.path === '/api/settings/get').length, 2);
  assert.equal(f.api.state('Unused').state, 'saved');
  f.api.cleanup();
}

// Genuine timed coalescing, idle state, same-preset repaint, and cleanup cancellation.
{
  const f = fixture({ seed: [row()], delay: 10 }); await f.api.ensure();
  const initialCalls = f.calls.length;
  f.listeners.get('changed')({ apiId: 'openai', name: 'A' });
  await new Promise(resolve => setTimeout(resolve, 35));
  assert.equal(f.calls.length, initialCalls, 'Native repaint does not reload settings');
  f.edit(s => { s.snapshots[0].name = 'one'; });
  f.edit(s => { s.snapshots[0].name = 'two'; });
  await new Promise(resolve => setTimeout(resolve, 35));
  assert.equal(f.saves().length, 2); assert.equal(f.files.get('A').extensions[FIELD].snapshots[0].name, 'two');
  const idleCalls = f.calls.length;
  await new Promise(resolve => setTimeout(resolve, 35)); assert.equal(f.calls.length, idleCalls);
  f.edit(s => { s.snapshots[0].name = 'pending on stop'; }); f.api.cleanup();
  await new Promise(resolve => setTimeout(resolve, 35)); assert.equal(f.calls.length, idleCalls);
  f.install(); await f.api.ensure(); assert.equal(f.files.get('A').extensions[FIELD].snapshots[0].name, 'pending on stop'); f.api.cleanup();
}

// Failed write survives reload; lost response recognizes its prior revision on retry.
{
  const f = fixture({ seed: [row()] }); f.failSave = true; await f.api.ensure();
  assert.equal(f.api.state('A').state, 'error'); assert.equal(f.read().snapshots.length, 1);
  assert.equal(f.files.get('A').extensions[FIELD], undefined);
  assert.equal(JSON.parse(f.storage.getItem(SYNC_KEY)).presets.A.pending, true);
  f.api.cleanup(); f.failSave = false; f.loseReply = true; f.install(); await f.api.ensure();
  assert.equal(f.api.state('A').state, 'error');
  await f.api.retry();
  assert.equal(f.api.state('A').state, 'saved'); assert.equal(f.files.get('A').extensions[FIELD].snapshots.length, 1);
  assert.equal(f.saves().length, 2, 'Retry confirms already saved revision without duplicate write');
  f.api.cleanup();
}
// Concurrent edits preserve both configurations; unrelated edits merge; old deletion is safe.
{
  const f = fixture({ seed: [row(), row('role', false)] }); await f.api.ensure();
  const g = fixture({ files: f.files }); await g.api.ensure();
  g.edit(s => { s.snapshots.find(r => r.id === 'role').name = 'Remote'; }); await g.api.refresh();
  f.edit(s => { s.snapshots.find(r => r.id === 'role').name = 'Local'; }); await f.api.refresh();
  const rows = f.files.get('A').extensions[FIELD].snapshots;
  assert.equal(rows.length, 3); assert(rows.some(r => r.name === 'Remote'));
  const conflict = rows.find(r => r.name.includes('本地冲突副本')); assert(conflict); assert.deepEqual(conflict.characters, []);
  await g.api.refresh();
  f.edit(s => { s.snapshots = s.snapshots.filter(r => r.id !== 'role'); });
  g.edit(s => { s.snapshots.find(r => r.id === 'role').name = 'Keep remote'; }); await g.api.refresh(); await f.api.refresh();
  assert(f.files.get('A').extensions[FIELD].snapshots.some(s => s.name === 'Keep remote'));
  f.api.cleanup(); g.api.cleanup();
}
// Editing while a save is in flight preserves the newer local change for a second save.
{
  const a = row('a', false), z = row('z', false); a.characters = [];
  z.chats = [{ key: 'chat', name: 'chat' }];
  const f = fixture({ seed: [row(), a, z] }); await f.api.ensure();
  f.edit(s => {
    const from = s.snapshots.find(r => r.id === 'z'), to = s.snapshots.find(r => r.id === 'a');
    to.characters = from.characters; from.characters = []; to.chats = from.chats; from.chats = [];
  });
  await f.api.refresh();
  const rows = f.files.get('A').extensions[FIELD].snapshots;
  assert.equal(rows.find(r => r.id === 'a').characters.length, 1);
  assert.equal(rows.find(r => r.id === 'a').chats.length, 1);
  assert.equal(rows.find(r => r.id === 'z').characters.length, 0);
  f.api.cleanup();
}
{
  const f = fixture({ seed: [row()] }); await f.api.ensure();
  f.edit(s => { s.snapshots[0].name = 'First'; });
  f.beforeSave = () => { f.beforeSave = null; f.edit(s => { s.snapshots[0].name = 'Second'; }); };
  await f.api.refresh(); assert.equal(f.read().snapshots[0].name, 'Second');
  await f.api.refresh(); assert.equal(f.files.get('A').extensions[FIELD].snapshots[0].name, 'Second');
  f.api.cleanup();
}
// Native rename and duplicate-import IDs remain associated with the correct preset.
{
  const a = raw(); a.extensions[FIELD] = embedded([row()]);
  const f = fixture({ files: new Map([['A', a], ['Copy', clone(a)]]) }); await f.api.ensure();
  assert.equal(new Set(f.read().snapshots.map(s => s.id)).size, 2);
  f.edit(s => { s.snapshots.find(r => r.presetName === 'Copy').name = 'Copy only'; }); await f.api.refresh();
  assert.equal(f.files.get('A').extensions[FIELD].snapshots[0].name, 'default');
  assert.equal(f.files.get('Copy').extensions[FIELD].snapshots[0].name, 'Copy only');
  const duplicateRecovery = planPresetRelink(f.read(), 'A', 'Copy', { copySnapshots: true });
  assert.equal(duplicateRecovery.changed, 0, 'Do not reimport identical embedded identity from another cached preset');
  f.files.set('Empty', raw());
  const recovery = planPresetRelink(f.read(), 'A', 'Empty', { copySnapshots: true });
  commitPresetRelink(f.storage, recovery); f.api.observe(); await f.api.refresh();
  assert.equal(f.files.get('Empty').extensions[FIELD].snapshots.length, 1);
  assert.notEqual(f.files.get('Empty').extensions[FIELD].snapshots[0].id, 'default', 'Recovery copy owns a new embedded identity');
  f.files.set('Renamed', f.files.get('A')); f.files.delete('A'); f.selected = 'Renamed';
  const store = f.read(); store.snapshots.filter(s => s.presetName === 'A').forEach(s => s.presetName = 'Renamed');
  f.storage.setItem(PRESET_KEY, JSON.stringify(store)); f.api.renamed('A', 'Renamed'); await f.api.refresh();
  assert.equal(f.api.state('Renamed').state, 'saved'); assert(!f.files.has('A'));
  assert.equal(f.read().snapshots.filter(s => s.presetName === 'Renamed').length, 1);
  f.api.cleanup();
}
// Unknown future format and failed reads are never silently replaced by local data.
{
  const a = raw(); a.extensions[FIELD] = embedded([row()]);
  const f = fixture({ files: new Map([['A', a], ['Old copy name', clone(a)]]) }); await f.api.ensure();
  f.files.delete('Old copy name'); f.files.set('Old copy name', f.files.get('A')); f.files.delete('A');
  const plan = planPresetRelink(f.read(), 'A', 'Old copy name'); commitPresetRelink(f.storage, plan);
  f.selected = 'Old copy name'; f.api.renamed('A', 'Old copy name'); await f.api.refresh();
  assert.equal(f.api.state('Old copy name').state, 'saved');
  const saved = f.files.get('Old copy name').extensions[FIELD].snapshots;
  assert.equal(saved.length, 2); assert.equal(new Set(saved.map(s => s.id)).size, 2);
  assert.equal(saved.filter(s => s.isDefault).length, 1); f.api.cleanup();
}
{
  const p = raw(); p.extensions[FIELD] = { version: 999 };
  const f = fixture({ seed: [row()], files: new Map([['A', p]]) }); await f.api.ensure();
  assert.equal(f.api.state('A').state, 'error'); assert.equal(f.saves().length, 0); assert.equal(f.read().snapshots.length, 1);
  f.api.cleanup();
}
const source = await readFile(new URL('../dist/preset-snapshot-storage.js', import.meta.url), 'utf8');
assert(!source.includes('setInterval('), 'No background polling');
console.log('Preset snapshot storage passed: ST/TT contract, migration, isolated field saves, new browser, deletion, conflicts, retries, rename, duplicate IDs, cleanup.');
