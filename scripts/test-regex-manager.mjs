import assert from 'node:assert/strict';
import { clone, createTransactions, planTransfer, createHostAdapter, duplicateInPlace } from '../dist/regex-manager-core.js';

const raw = { id: 'a', scriptName: '完整正则', findRegex: '/(x)/g', replaceString: '$1', placement: [1, 5], trimStrings: ['x'], substituteRegex: 2, minDepth: 1, maxDepth: 9, markdownOnly: false, promptOnly: true, runOnEdit: true, disabled: false, unknown: { preserved: [4] } };
const records = [raw, { ...raw, id: 'b' }, { ...raw, id: 'c' }, { ...raw, id: 'd' }];
const duplicated = duplicateInPlace(records, [2, 0]);
assert.deepEqual(duplicated.filter(x => records.some(r => r.id === x.id)), records, 'Copy leaves originals in their original order');
assert.equal(duplicated[0].id, 'a'); assert.equal(duplicated[2].id, 'b'); assert.equal(duplicated[3].id, 'c');
assert.deepEqual({ ...duplicated[1], id: 'a' }, raw, 'Adjacent copy preserves all raw fields');
assert.deepEqual({ ...duplicated[4], id: 'c' }, records[2]);
assert.equal(new Set(duplicated.map(x => x.id)).size, 6);
const reorder = planTransfer(records, records, [2, 0], 4, true, false);
assert.deepEqual(reorder.target.map(x => x.id), ['b', 'd', 'a', 'c']);
assert.deepEqual(planTransfer(records, records, [0, 1], 1, true).target, records, 'Drop inside own block does not reorder');
const copied = planTransfer(records, [records[3]], [2, 0], 0, false, false);
assert.deepEqual(copied.target.map(x => x.id === 'd'), [false, false, true]);
assert.deepEqual({ ...copied.target[0], id: 'a' }, raw, 'All raw/unknown fields survive');
assert.deepEqual(copied.source, records);
assert.equal(new Set(copied.target.map(x => x.id)).size, 3);
// Selection is by position; malformed old IDs must not collapse two rows.
assert.equal(planTransfer([{ ...raw, id: undefined }, { ...raw, id: undefined }], [], [0, 1], 0, false).target.length, 2);

const from = { type: 'preset', name: 'A', apiId: 'openai' }, to = { type: 'global' };
let values = { preset: clone(records), global: [] }, writes = [], fail = '';
const adapter = {
  read: source => clone(values[source.type]),
  async write(source, data) { writes.push(source.type); if (source.type === fail) throw new Error('save failed'); values[source.type] = clone(data); },
};
const tx = createTransactions(adapter);
await tx.transfer(from, to, values.preset, [], [0, 2], 0, true);
assert.deepEqual(writes, ['global', 'preset'], 'Destination is saved before source removal');
assert.deepEqual(values.preset.map(x => x.id), ['b', 'd']);
await tx.undo();
assert.deepEqual(values, { preset: records, global: [] });
fail = 'global'; writes = [];
await assert.rejects(tx.transfer(from, to, records, [], [0], 0, true), /save failed/);
assert.deepEqual(writes, ['global']); assert.deepEqual(values.preset, records);
fail = 'preset';
await assert.rejects(tx.transfer(from, to, records, [], [0], 0, true), /副本保留/);
assert.equal(values.global.length, 1); assert.deepEqual(values.preset, records);
fail = ''; await tx.undo(); assert.equal(values.global.length, 0);
await tx.transfer(from, to, records, [], [0], 0, true);
fail = 'global'; await assert.rejects(tx.undo(), /重试撤销/);
assert.deepEqual(values.preset, records, 'Partial undo restores source first');
fail = ''; await tx.undo(); assert.equal(values.global.length, 0, 'Retry continues remaining undo without clobbering source');
await tx.transfer(from, to, records, [], [0], 0);
values.global.push({ ...raw, id: 'external' });
await assert.rejects(tx.undo(), /其他地方更新/);
assert.equal(values.global.length, 2, 'Undo refuses to clobber external edits');
await assert.rejects(tx.transfer(from, to, records.slice(1), values.global, [0], 0), /来源已变化/);

let character = { name: 'Alice', avatar: 'alice.png', data: { extensions: { regex_scripts: [] } }, json_data: JSON.stringify({ data: { extensions: { keep: 3 } } }) };
let ctx = { characterId: 0, characters: [character], extensionSettings: {}, getRequestHeaders: () => ({}), getPresetManager: () => ({ apiId: 'openai', getAllPresets: () => ['A'], getSelectedPresetName: () => 'A', readPresetExtensionField: () => records }) };
let ok = false, body;
const host = { SillyTavern: { getContext: () => ctx }, fetch: async (_url, options) => { body = JSON.parse(options.body); return { ok, status: ok ? 200 : 500 }; } };
const api = createHostAdapter(host, async () => ({ saveSettings: async () => ok }));
const charSource = api.currentCharacter();
await assert.rejects(api.write(charSource, [raw]), /保存失败/); assert.deepEqual(api.read(charSource), []);
ok = true; await api.write(charSource, [raw]); assert.equal(body.avatar, 'alice.png'); assert.deepEqual(api.read(charSource), [raw]);
assert.equal(JSON.parse(character.json_data).data.extensions.keep, 3);
ctx.characterId = undefined;
assert.equal(api.currentCharacter(), null); assert.throws(() => api.read(charSource), /角色已切换/);
ctx.characterId = 0; ctx.groupId = 'group'; assert.equal(api.currentCharacter(), null); ctx.groupId = '';
await api.write({ type: 'favorites' }, [raw]); assert.deepEqual(ctx.extensionSettings.pmm_regex_favorites_v1, [raw]);
assert.equal(ctx.extensionSettings.regex, undefined, 'Favorites do not enable or overwrite global regex');
ok = false; await assert.rejects(api.write({ type: 'favorites' }, []), /未能保存/); assert.deepEqual(api.read({ type: 'favorites' }), [raw]);
console.log('Regex manager: raw fields, batch ordering, move failure, conflict-safe undo, character identity and persistence passed');
