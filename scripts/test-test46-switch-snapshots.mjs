import assert from 'node:assert/strict';
import { clone, snapshotFixture } from './lib/snapshot-test-fixture.mjs';

// Application/matching routes are covered by test-snapshot-unrecorded-entries.
// This former capture-mode test now verifies the current named snapshot writer.
const f = snapshotFixture();
const draft = {
  presetName: 'A', name: ' First ',
  promptStates: [{ id: 'one', name: 'One', enabled: true, content: 'Do not persist', key: 'ui-key' }],
  groupStates: [{ id: 'g', name: 'Group', enabled: false }, { id: '', enabled: true }],
};
assert.equal(f.editor.saveDraft(draft), true);
const first = f.stored.snapshots[0];
assert.equal(first.name, 'First');
assert.deepEqual(first.states, [{ id: 'one', name: 'One', enabled: true }]);
assert.deepEqual(first.groupStates, [{ id: 'g', name: 'Group', enabled: false }]);
assert.deepEqual(first.characters, []);
assert.deepEqual(first.chats, []);
assert.equal(first.presetName, 'A');
assert.equal(first.createdAt, first.updatedAt);
assert.ok(Number.isFinite(first.createdAt));
draft.promptStates[0].enabled = false;
assert.deepEqual(f.stored.snapshots[0], first, 'Saved switches must be detached from the editor');
assert.equal(f.editor.saveDraft({ ...draft, name: 'Second' }), true);
assert.equal(f.stored.snapshots.length, 3, 'Named snapshots must coexist with the preset default');
assert.notEqual(f.stored.snapshots[0].id, first.id);
assert.deepEqual(f.stored.snapshots[1], first);

const saved = clone(f.stored), writes = f.writes.length;
for (const invalid of [{ presetName: '' }, { name: '  ' }, { promptStates: [] }]) {
  assert.equal(f.editor.saveDraft({ ...draft, ...invalid }), false);
}
f.controls.branch = 'Branch';
assert.equal(f.editor.saveDraft(draft), false);
f.controls.branch = '';
assert.equal(f.writes.length, writes, 'Invalid snapshots and active branches must be rejected before writing');
assert.deepEqual(f.stored, saved);

console.log('test.46 passed: named snapshot storage, switch-only payloads, detached data, multiple snapshots and branch guards; active snapshot save-as follows the author tests.');
