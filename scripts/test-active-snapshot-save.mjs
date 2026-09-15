import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Missing ${start}`);
  return source.slice(a, b);
}

function fixture({ native = true, confirm = true, failWrite = false, branch = '' } = {}) {
  const baseline = { id: 'default', name: '预设默认', presetName: 'preset', isDefault: true,
    states: [{ id: 'p', name: 'Entry', enabled: false }], groupStates: [], characters: [], chats: [] };
  const role = { id: 'role', name: '邵央 开关', presetName: 'preset',
    states: [{ id: 'p', name: 'Entry', enabled: true }],
    groupStates: [{ id: 'g', name: 'Group', enabled: true }],
    characters: [{ key: 'avatar.png', name: '邵央' }], chats: [{ key: 'chat-1', name: 'Chat' }],
    createdAt: 123, updatedAt: 123 };
  let store = { version: 1, activeSnapshots: { preset: role.id }, homeSnapshots: { preset: 'home' },
    snapshots: [baseline, role, { ...copy(role), id: 'other', name: '另一个快照' }] };
  const prompts = [{ id: 'p', name: 'Entry', enabled: false, content: 'Current text' },
    { id: 'new', name: 'New entry', enabled: true, content: 'Not stored in a snapshot' }];
  const draft = prompts.map(p => ({ ...p, enabled: !p.enabled }));
  const groups = [{ id: 'g', name: 'Group', enabled: false }];
  const notices = [], confirmations = [];
  let writes = 0, mounts = 0;
  const context = vm.createContext({
    console, clone: copy, text: value => String(value ?? '').trim(),
    TOP: { confirm: message => { confirmations.push(message); return confirm; } },
    DOC: { getElementById: () => ({}) }, EDITOR_OVERLAY_ID: 'editor',
    readStore: () => copy(store),
    writeStore: next => { if (failWrite) return false; store = copy(next); writes++; return true; },
    currentPresetName: () => 'preset', currentCharacter: () => null,
    isBranchMode: () => false, activeBranchName: () => branch,
    blockWhileBranchActive: () => !!branch,
    storedPrompts: () => copy(prompts), draftPrompts: () => copy(draft),
    makeGroupStates: () => copy(groups),
    editorGroupState: () => groups.map(g => ({ ...g, promptIds: new Set(['p']) })),
    makeId: () => 'new-snapshot', defaultSnapshotName: () => '另存',
    renderOverlay() {}, notify: (...args) => notices.push(args),
    closeOverlay() {}, openOverlay() {}, destroySnapshotEditor() {},
    requestSnapshotName: async () => '微调副本',
    mountSnapshotEditor: () => { mounts++; return true; },
    overlayContext: { source: native ? 'native-preset' : 'workshop', presetName: 'preset' },
  });
  vm.runInContext([
    'let openMenuId = "", snapshotEditorSession = null;',
    section('  function makeStates(', '  function baiBaiCompat('),
    section('  function getPrompts(', '  function workshopDocuments('),
    section('  function isDefaultSnapshot(', '  function defaultSnapshotForCurrentPreset('),
    section('  function activeSnapshotForPreset(', '  function homeSnapshotForPreset('),
    section('  function blockWhileSnapshotActive(', '  function findSnapshot('),
    section('  function overwriteSnapshot(', '  async function bindSnapshotToCurrentCharacter('),
    section('  function createSnapshotEditorDraft(', '  function snapshotEditorGroupCount('),
    section('  function returnFromSnapshotEditor(', '  function mountSnapshotEditor('),
    section('  function openSnapshotEditorFromOverlay(', '  function renderFirstDefaultPrompt('),
  ].join('\n'), context);
  return { context, notices, confirmations, prompts, draft,
    get store() { return copy(store); }, get writes() { return writes; }, get mounts() { return mounts; },
    get session() { return vm.runInContext('snapshotEditorSession', context); } };
}

for (const native of [true, false]) {
  const f = fixture({ native });
  const before = f.store, current = native ? f.prompts : f.draft;
  const expectedStates = current.map(({ id, name, enabled }) => ({ id, name, enabled }));
  assert.equal(f.context.overwriteSnapshot('role'), true, 'Active snapshot may capture current adjustments');
  const saved = f.store.snapshots.find(s => s.id === 'role');
  assert.deepEqual(saved.states, expectedStates, 'Capture the correct entry source');
  assert.deepEqual(saved.groupStates, [{ id: 'g', name: 'Group', enabled: false }]);
  assert.equal(saved.createdAt, 123);
  assert.ok(saved.updatedAt > 123);
  assert.deepEqual(saved.characters, before.snapshots[1].characters);
  assert.deepEqual(saved.chats, before.snapshots[1].chats);
  assert.deepEqual(f.store.snapshots[0], before.snapshots[0], 'Default must remain unchanged');
  assert.deepEqual(f.store.snapshots[2], before.snapshots[2]);
  assert.deepEqual(f.store.activeSnapshots, before.activeSnapshots);
  assert.deepEqual(f.store.homeSnapshots, before.homeSnapshots);
  assert.equal(f.confirmations[0], '用当前开关覆盖快照“邵央 开关”？');
  assert.deepEqual(f.context.getPrompts('preset'), copy(current), 'Overwrite must not apply or restore switches');

  f.context.openSnapshotEditorFromOverlay();
  assert.equal(f.mounts, 1, 'New editor opens while a snapshot is active');
  assert.deepEqual(copy(f.session.promptStates).map(({ key, ...state }) => state), expectedStates);
  f.session.promptStates[0].enabled = !current[0].enabled;
  assert.equal(await f.context.saveSnapshotEditor(), true, 'New snapshot saves while another remains active');
  const created = f.store.snapshots.find(s => s.id === 'new-snapshot');
  assert.equal(created.name, '微调副本');
  assert.equal(created.states[0].enabled, !current[0].enabled);
  assert.deepEqual(created.characters, []);
  assert.deepEqual(created.chats, []);
  assert.deepEqual(f.store.snapshots.find(s => s.id === 'role'), saved);
  assert.deepEqual(f.store.snapshots.find(s => s.id === 'default'), before.snapshots[0]);
  assert.deepEqual(f.store.activeSnapshots, before.activeSnapshots, 'Save-as must not change the active binding');
  assert.deepEqual(copy(f.context.getPrompts('preset')), current, 'Save-as does not apply its edits');
  assert.equal(f.notices.some(args => args.join('').includes('先恢复')), false);
}

// Confirm names the selected target, including when overwriting a different snapshot.
{
  const f = fixture(), before = f.store;
  assert.equal(f.context.overwriteSnapshot('other'), true);
  assert.equal(f.confirmations[0], '用当前开关覆盖快照“另一个快照”？');
  assert.deepEqual(f.store.snapshots[1], before.snapshots[1]);
  assert.deepEqual(f.store.activeSnapshots, before.activeSnapshots);
}
for (const options of [{ confirm: false }, { failWrite: true }]) {
  const f = fixture(options), before = f.store;
  assert.equal(f.context.overwriteSnapshot('role'), false);
  assert.deepEqual(f.store, before, 'Cancelled/failed overwrite must leave storage intact');
  assert.equal(f.writes, 0);
}
{
  const f = fixture(), before = f.store;
  assert.equal(f.context.saveDefaultSnapshot(), false, 'Updating default remains blocked while active');
  assert.equal(f.context.overwriteSnapshot('default'), false, 'Ordinary overwrite cannot bypass default protection');
  assert.equal(f.context.overwriteSnapshot('missing'), false);
  assert.deepEqual(f.store, before);
  assert.equal(f.confirmations.length, 0);
  f.context.currentPresetName = () => 'different-preset';
  assert.equal(f.context.overwriteSnapshot('role'), false, 'Cross-preset writes remain blocked');
}
{
  const f = fixture({ branch: 'branch' });
  assert.equal(f.context.overwriteSnapshot('role'), false);
  f.context.openSnapshotEditorFromOverlay();
  assert.equal(f.mounts, 0);
  assert.equal(f.context.saveSnapshotDraft({ presetName: 'preset', name: 'branch', promptStates: f.prompts }), false);
  assert.equal(f.writes, 0);
}
{
  const f = fixture(), before = f.store;
  f.context.openSnapshotEditorFromOverlay();
  f.session.promptStates[0].enabled = true;
  f.context.returnFromSnapshotEditor();
  assert.deepEqual(f.store, before, 'Cancel new editor leaves snapshots intact');
  assert.equal(f.prompts[0].enabled, false, 'Cancel new editor leaves current switches intact');
}
console.log('Active snapshot save passed: overwrite/save-as, native/draft sources, bindings, defaults, confirmation, cancellation and branch guards.');
