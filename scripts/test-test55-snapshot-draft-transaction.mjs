import assert from 'node:assert/strict';
import { clone, snapshotFixture } from './lib/snapshot-test-fixture.mjs';

const f = snapshotFixture(), original = clone(f.prompts), initialStore = f.stored;
f.editor.open();
assert.deepEqual(f.events.slice(0, 2), ['close', 'mount']);
const draft = f.editor.current();
assert.equal(draft.promptContents[0], 'Saved text');
draft.promptStates[0].enabled = false;
draft.groups[0].enabled = false;
assert.deepEqual(f.prompts, original, 'Editor switches must stay isolated from the source preset');
f.editor.cancel();
assert.equal(f.editor.current(), null);
assert.deepEqual(f.stored, initialStore);
assert.equal(f.writes.length, 0);
assert.deepEqual(f.events.at(-1), { source: 'native-preset', presetName: 'A' });

f.editor.open();
let saving = f.editor.save();
assert.equal(f.editor.save(), false, 'Repeated save clicks must not open another naming dialog');
f.answer(null);
assert.equal(await saving, false);
assert.ok(f.editor.current());
assert.equal(f.editor.current().saving, false);
assert.equal(f.writes.length, 0, 'Cancelling the name dialog must retain the draft without writing');

f.controls.writeFailure = true;
f.editor.current().promptStates[0].enabled = false;
f.editor.current().groups[0].enabled = false;
saving = f.editor.save(); f.answer('Retry me');
assert.equal(await saving, false);
assert.ok(f.editor.current(), 'Failed storage must keep the editor available for retry');
assert.equal(f.editor.current().saving, false);
assert.deepEqual(f.stored, initialStore);
f.controls.writeFailure = false;
saving = f.editor.save(); f.answer('Saved');
assert.equal(await saving, true);
assert.equal(f.editor.current(), null);
assert.equal(f.stored.snapshots.length, 2);
assert.equal(f.stored.snapshots[0].states[0].enabled, false);
assert.equal(f.stored.snapshots[0].groupStates[0].enabled, false);
assert.ok(f.stored.snapshots[0].states.every(state => !('content' in state) && !('key' in state)));
assert.deepEqual(f.events.at(-1), { source: 'native-preset', presetName: 'A' });

// Resolve an old naming dialog after cancel/reopen: it cannot save or close the new editor.
const persisted = f.stored, writeCount = f.writes.length;
f.editor.open(); saving = f.editor.save();
f.editor.cancel(); f.editor.open();
const replacement = f.editor.current();
f.answer('Stale result');
assert.equal(await saving, false);
assert.equal(f.editor.current(), replacement);
assert.equal(f.writes.length, writeCount);
assert.deepEqual(f.stored, persisted);
f.editor.cancel();
f.controls.mountFailure = true;
f.editor.open();
assert.equal(f.editor.current(), null);
assert.deepEqual(f.events.at(-1), { source: 'native-preset', presetName: 'A' });
assert.deepEqual(f.prompts, original);
assert.equal(f.writes.length, writeCount);

console.log('test.55 passed: isolated editor, cancel, name cancellation, single save, storage retry, stale dialog and mount failure return.');
