import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const shared = await readFile(new URL('../dist/shared-favorites.js', import.meta.url), 'utf8');
const world = await readFile(new URL('../dist/worldbook-stitch-test3.js', import.meta.url), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
const document = { addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; } };
let items = [], serial = 0, writes = 0, loads = 0, failed = false;
const books = { Target: { extraBookSetting: 'keep', entries: { 0: { uid: 0, content: 'existing', order: 17 }, 2: { uid: 2, content: 'existing 2', order: 26 } } } };
const host = { document, navigator: {}, SillyTavern: { getContext: () => ({
  getWorldInfoNames: async () => Object.keys(books),
  loadWorldInfo: async name => { loads++; return books[name]; },
  saveWorldInfo: async (name, data) => { if (failed) throw Error('offline'); writes++; books[name] = copy(data); },
}) }, __PMM_FAVORITE_STORE__: {
  read: () => ({ items: copy(items) }),
  add: async item => { await Promise.resolve(); items.push({ ...copy(item), id: `f${++serial}` }); },
  update: async (id, patch) => Object.assign(items.find(item => item.id === id), copy(patch)),
  remove: async id => { items = items.filter(item => item.id !== id); },
} };
host.parent = host;
const context = vm.createContext({ window: host, console: { info() {} }, structuredClone, Set, Map });
vm.runInContext(shared, context); vm.runInContext(world, context);
const api = host.__PMM_SHARED_FAVORITES__, worldApi = host.__PMM_WORLDBOOK_STITCH_TEST3__;
const raw = { uid: 0, comment: '同名条目', content: '<test>世界书原文', key: ['key'], keysecondary: ['secondary'], constant: false, vectorized: true, position: 4, depth: 7, role: 2, order: 35, probability: 68, disable: true, triggers: ['normal'], unknownFutureSetting: { arr: [1, 2] } };
const original = copy(raw);
await api.saveWorld('Source', raw);
raw.key.push('changed'); raw.content = 'unsaved new content';
assert.deepEqual(copy(api.asWorld(items[0])), original, 'Favorite is an independent full snapshot');
items[0].categoryId = 'folder'; items[0].sortIndex = 12;
await api.saveWorld('Source', raw, true);
assert.equal(items.length, 1); assert.equal(items[0].categoryId, 'folder'); assert.equal(items[0].sortIndex, 12);
assert.equal(api.asWorld(items[0]).content, raw.content, 'Manual update captures unsaved edits');
items[0].name = 'Edited favorite'; items[0].content = 'edited copy'; items[0].enabled = true;
assert.equal(api.asWorld(items[0]).comment, 'Edited favorite'); assert.equal(api.asWorld(items[0]).disable, false);
assert.equal(raw.content, 'unsaved new content', 'Editing the favorite leaves source unchanged');
const converted = copy(api.asPrompt(items[0]));
assert.deepEqual(converted, { name: 'Edited favorite', content: 'edited copy', enabled: true, role: 'system', position: { type: 'relative' } });
assert.equal(api.metadata({ extra: { pmmWorldbookFavorite: { version: 1, entry: [] } } }), null);
const blankTitle = { uid: 42, comment: '', key: ['keyword'], content: 'body' };
assert.deepEqual(copy(api.asWorld(api.fromWorld('Book', blankTitle))), blankTitle, 'Unedited original fields survive even when title uses a fallback');
await api.saveWorld('Other book', { ...original, uid: 0 });
assert.equal(items.length, 2, 'Same names and UIDs in different books remain separate');
await api.saveWorld('Other book', { ...original, uid: 0 }); assert.equal(items.length, 1);
await Promise.all([api.saveWorld('A', original), api.saveWorld('B', original)]);
assert.equal(items.length, 3, 'Queued independent writes are not lost');


const side = worldApi.state.top;
side.name = 'Target'; side.data = copy(books.Target); side.savedData = copy(books.Target);
side.data.entries[0].content = 'unsaved draft'; side.dirty = true;
Object.assign(worldApi.state, { open: true, favoriteMode: true, topType: 'world' });
const legacyPrompt = { name: 'Prompt', content: 'prompt body', enabled: false, role: 'assistant', position: { type: 'in_chat', depth: 3 } };
await worldApi.dropFavorites('top', [items[0], legacyPrompt], { targetKey:'2', position:'before' });
assert.equal(writes, 0); assert.equal(loads, 0, 'Drops use the current draft without reading or saving files');
assert.deepEqual(copy(side.entries.map(e=>e.uid)), [0,1,3,2]);
assert.equal(side.entries[1].depth, 7); assert.equal(side.entries[1].probability, 68);
assert.deepEqual(side.entries[1].unknownFutureSetting, original.unknownFutureSetting);
assert.equal(side.entries[2].disable, true); assert.equal(side.entries[2].position, 0); assert.deepEqual(copy(side.entries[2].key), []);
assert.equal(side.data.entries[0].content, 'unsaved draft'); assert.equal(side.history.length, 1);
assert.equal(books.Target.entries[0].content, 'existing');
assert.equal(items.length, 3, 'Dragging never removes favorites');
await worldApi.dropFavorites('top', [legacyPrompt], { targetKey:'0', position:'after' });
assert.deepEqual(copy(side.entries.map(e=>e.uid)), [0,4,1,3,2]);
assert.equal(new Set(side.entries.map(e=>e.uid)).size, 5);
await worldApi.dropFavorites('top', [legacyPrompt]);
assert.equal(side.entries.at(-1).uid, 5, 'Empty-list/background placement appends');
worldApi.state.open = false;
await assert.rejects(worldApi.dropFavorites('top', [legacyPrompt]), /目标世界书已切换/);
worldApi.state.open = true;
await worldApi.dropFavorites('top', [legacyPrompt]);
assert.equal(side.entries.length, 7, 'Queue recovers after a rejected stale drop');
console.log('Shared favorites: full snapshots, manual updates, mixed multi-drop order, UID allocation and unsaved drafts passed.');

const workshop = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
let favoriteReads = 0;
const matching = vm.runInNewContext(`(() => {
  let _pmmFavoriteLookupData = null;
  ${workshop.slice(workshop.indexOf('function pmmWorldFavoriteMeta'), workshop.indexOf('function pmmFavoriteAsPreset'))}
  ${workshop.slice(workshop.indexOf('function ln(e,n)'), workshop.indexOf('const pn=n('))}
  return { cn, dn };
})()`, { Re: () => { favoriteReads++; return { items: [api.fromWorld('Source', original), { id: 'legacy', name: 'Legacy', content: 'legacy text' }] }; } });
for (let i = 0; i < 1000; i++) assert.equal(matching.dn({ name: original.comment, content: original.content }), false);
assert.equal(favoriteReads, 1, 'Rendering many prompt stars reads/parses the library once');
assert.equal(matching.cn({ name: 'Legacy' }).id, 'legacy');
assert.ok(matching.cn(api.fromWorld('Source', original)));
assert.equal(matching.cn(api.fromWorld('Other', original)), null);
console.log('Favorite matching: source/type isolation and one library read for 1,000 prompt lookups passed.');
