import assert from 'node:assert/strict';
import vm from 'node:vm';
import { clone, section } from './lib/snapshot-test-fixture.mjs';

// The camera now belongs to the native preset toolbar; resolve its API on each click.
const top = {}, routes = [], notices = [];
const activate = vm.runInNewContext(`(() => {
  ${section('  function activate(action)', '  function makeButton(')}
  return activate;
})()`, {
  TOP: top, BATCH_API_KEY: 'batch', SNAPSHOT_API_KEY: 'snapshot',
  notify: message => notices.push(message),
});
activate('snapshot');
assert.equal(notices.length, 1, 'A not-yet-mounted API must give feedback');
top.snapshot = { open: options => routes.push(clone(options)) };
activate('snapshot');
assert.deepEqual(routes, [{ source: 'native-preset' }]);
top.snapshot = { open: options => routes.push({ ...clone(options), replaced: true }) };
activate('snapshot');
assert.equal(routes.at(-1).replaced, true, 'An update must not leave the camera calling an obsolete API');
top.batch = { openBatch: () => routes.push('batch') };
activate('batch');
assert.equal(routes.at(-1), 'batch');

let selected = 'Native A', hasDefault = true, blocked = false;
const rendered = [], warnings = [];
const context = vm.createContext({
  text: value => String(value ?? '').trim(),
  nativeSelectedPresetName: () => selected,
  blockWhileBranchActive: () => blocked,
  ensureOverlay: () => rendered.push('ensure'),
  defaultSnapshotForCurrentPreset: () => hasDefault,
  renderFirstDefaultPrompt: () => rendered.push('onboarding'),
  renderOverlay: () => rendered.push('manager'),
  notify: (...args) => warnings.push(args),
});
vm.runInContext(`
  let overlayContext = null;
  function currentPresetName() { return overlayContext?.source === 'native-preset' ? overlayContext.presetName : 'Workshop draft'; }
  ${section('  function openOverlay()', '  function normalPresetContainer()')}
  globalThis.entry = { open: openOverlay, current: () => overlayContext };
`, context);
const entry = context.entry;
entry.open({ source: 'native-preset' });
assert.deepEqual(clone(entry.current()), { source: 'native-preset', presetName: 'Native A' });
assert.deepEqual(rendered.splice(0), ['ensure', 'manager']);
selected = 'Native B'; hasDefault = false;
entry.open({ source: 'native-preset' });
assert.equal(entry.current().presetName, 'Native B', 'Each open must read the current Tavern selection');
assert.deepEqual(rendered.splice(0), ['ensure', 'onboarding']);
entry.open({ source: 'native-preset', presetName: 'Returned preset' });
assert.equal(entry.current().presetName, 'Returned preset', 'Editor return must preserve its source preset');
entry.open();
assert.deepEqual(clone(entry.current()), { source: 'workshop', presetName: '' });
rendered.length = 0;
blocked = true;
entry.open({ source: 'native-preset' });
assert.equal(entry.current(), null);
assert.deepEqual(rendered, []);
blocked = false; selected = '';
entry.open({ source: 'native-preset' });
assert.equal(entry.current(), null);
assert.deepEqual(rendered, []);
assert.equal(warnings.length, 1);

console.log('test.47 passed: native camera routing, replaced APIs, selected preset, onboarding, return context and entry guards.');
