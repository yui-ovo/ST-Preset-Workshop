import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const gecko = manifest.name.endsWith('-gecko');
const bundle = gecko ? 'workshop-v3.08.js' : 'workshop-v3.02.js';
const source = await readFile(new URL(`../dist/${bundle}`, import.meta.url), 'utf8');
const clone = value => structuredClone(value);
const plain = value => JSON.parse(JSON.stringify(value));
function between(start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Cannot extract ${start}`);
  return source.slice(a, b);
}

// Execute the shipped capture, matching, application, binding, draft and save
// functions. Supply only the Tavern/UI/storage boundaries in this fixture.
function fixture({ prompts = initialPrompts(), snapshots = [], groups = [], draft = false,
  nativeSave = false, nativeEntry = false, chat = { key: 'chat' }, character = { key: 'character' } } = {}) {
  let saved = clone(prompts), inUse = clone(prompts), draftPrompts = clone(prompts);
  let nativeGroups = clone(groups);
  const store = { snapshots: clone(snapshots) };
  const writes = [], updates = [], notices = [];
  const bridge = {
    record() { assert.fail('Applying a snapshot must not create an undo record'); },
    update(id, fields) {
      updates.push({ id, ...fields });
      draftPrompts = draftPrompts.map(prompt => prompt.id === id ? { ...prompt, ...fields } : prompt);
    },
  };
  let context;
  const compat = {
    readGroupEnabledStates: () => clone(nativeGroups),
    async syncGroupEnabledStates({ states }) {
      const matches = context.matchGroupStates(nativeGroups, states);
      let changed = 0;
      for (const { current, saved: state } of matches) {
        if (current.enabled !== state.enabled) changed++;
        current.enabled = state.enabled;
      }
      return { applied: matches.length, changed };
    },
  };
  const top = {
    requestAnimationFrame: callback => callback(),
    setTimeout: callback => callback(),
    getLoadedPresetName: () => 'preset',
    async setPreset(name, data) {
      writes.push(name);
      if (name === 'in_use') inUse = clone(data.prompts);
      else { assert.equal(name, 'preset'); saved = clone(data.prompts); }
    },
  };
  context = vm.createContext({
    pmmRuntimeResource: target => target,
    TOP: top, SELF: {}, clone, console,
    text: value => String(value ?? '').trim(),
    readStore: () => store,
    getPrompts: () => clone(draft && !nativeEntry ? draftPrompts : saved),
    currentPresetName: () => 'preset', loadedPresetName: () => 'preset',
    currentCharacter: () => character, currentChat: () => chat,
    currentDraftBridge: () => draft ? bridge : null,
    draftPrompts: () => clone(draftPrompts),
    nativeSaveButton: () => nativeSave ? {
      disabled: false, dataset: {},
      click() { writes.push('native-button'); saved = clone(draftPrompts); },
    } : null,
    getContext: () => null,
    refreshNativePromptManager: async () => {},
    isBranchMode: () => false, activeBranchName: () => '',
    blockWhileBranchActive: () => false, isCaptureMode: () => false,
    overlayContext: nativeEntry ? { source: 'native-preset' } : null,
    notify: (...args) => notices.push(args), renderOverlay() {},
    setActiveSnapshot: (_, id) => { store.activeId = id; },
    activeSnapshotForPreset: () => store.snapshots.find(item => item.id === store.activeId) || null,
    homeSnapshotForPreset: () => null, fallbackSnapshotForPreset: () => null,
    baiBaiCompat: () => compat, sectionGroupStore: () => null,
    workshopGroupStates: () => [],
    closeOverlay() {}, syncCaptureModeUI() {}, scheduleMount() {},
  });
  vm.runInContext([
    'let autoApplySerial = 0, lastAutoContextKey = "", captureMode = null;',
    between('  function makeStates(', '  function baiBaiCompat('),
    between('  function makeGroupStates(', '  function defaultSnapshotName('),
    between('  function isDefaultSnapshot(', '  function defaultSnapshotForCurrentPreset('),
    between('  function findSnapshot(', '  async function settleDraft('),
    between('  async function settleDraft(', gecko ? '  async function persistPromptsDirectly(' : '  async function refreshNativePromptManager('),
    between('  async function persistPromptsDirectly(', '  function renameSnapshot('),
    between('  function boundSnapshotForContext(', '  function scheduleBoundSnapshotAutoApply('),
    gecko ? between('  async function exitCaptureMode(', '  function enterCaptureMode(') : '',
  ].join('\n'), context);
  return {
    context, store, writes, updates, notices,
    get saved() { return plain(saved); },
    get inUse() { return plain(inUse); },
    get draft() { return plain(draftPrompts); },
    get groups() { return plain(nativeGroups); },
    add(prompt) { saved.push(clone(prompt)); inUse.push(clone(prompt)); draftPrompts.push(clone(prompt)); },
    capture(id = 'snapshot', extra = {}) {
      const snapshot = { id, presetName: 'preset', name: id,
        states: plain(context.makeStates(context.getPrompts())),
        groupStates: clone(nativeGroups), characters: [], chats: [], ...extra };
      store.snapshots.push(snapshot);
      return snapshot;
    },
  };
}

function initialPrompts() {
  return [
    { id: 'original', name: 'Original', enabled: true, content: 'Original content', role: 'system' },
    { id: 'off', name: 'Disabled', enabled: false, content: 'Keep disabled' },
  ];
}
const added = { id: 'variant', name: 'Character variant', enabled: true, content: 'New content', position: 7 };
const expected = [...initialPrompts(), { ...added, enabled: false }];

// Capture first, add later, then apply through each real application/save route.
for (const mode of ['manual', 'draft', 'native-save', 'default', 'character', 'chat', ...(!gecko ? ['native-entry'] : [])]) {
  const f = fixture({ draft: ['draft', 'native-save', 'native-entry'].includes(mode),
    nativeSave: mode === 'native-save', nativeEntry: mode === 'native-entry' });
  const snapshot = f.capture('old', {
    isDefault: mode === 'default',
    characters: mode === 'character' || mode === 'chat' ? [{ key: 'character' }] : [],
    chats: mode === 'chat' ? [{ key: 'chat' }] : [],
  });
  const recorded = clone(snapshot.states);
  if (mode === 'chat') {
    f.store.snapshots.push({ ...clone(snapshot), id: 'character-only', updatedAt: 999,
      chats: [], states: [{ id: 'off', name: 'Disabled', enabled: true }] });
  }
  f.add(added);
  assert.equal(f.saved.at(-1).enabled, true, 'Creating an entry must not disable it');
  const automatic = mode === 'character' || mode === 'chat';
  assert.equal(await (automatic ? f.context.autoApplyBoundSnapshot() : f.context.applySnapshot('old')), true, mode);
  assert.deepEqual(f.saved, expected, `${mode}: named preset must disable new entries`);
  assert.deepEqual(f.inUse, expected, `${mode}: active Tavern preset must match`);
  if (mode === 'draft' || mode === 'native-save') assert.deepEqual(f.draft, expected);
  if (mode === 'native-entry') assert.equal(f.updates.length, 0, 'Native entry must not read a hidden draft');
  assert.deepEqual(snapshot.states, recorded, 'Applying must not add entries to the stored snapshot');
  assert.equal(f.store.activeId, mode === 'default' ? '' : 'old', 'Chat binding must take priority over character binding');
  assert.ok(f.writes.length > 0);
  const writes = f.writes.length;
  assert.equal(await f.context.applySnapshot('old', { automatic: true }), true);
  assert.equal(f.writes.length, writes, 'An unchanged automatic apply must not save again');
}

// Recorded true/false values are restored even after they are manually changed.
{
  const f = fixture({ prompts: initialPrompts().map(p => ({ ...p, enabled: !p.enabled })) });
  const snapshot = f.capture();
  snapshot.states = initialPrompts().map(({ id, name, enabled }) => ({ id, name, enabled }));
  f.add(added);
  assert.equal(await f.context.applySnapshot(snapshot.id), true);
  assert.deepEqual(f.saved, expected);
}

// Preserve legacy unique-name fallback, but never reuse an ID-matched record
// for a newly added entry with the old name (including after a rename).
{
  const { context } = fixture();
  const merge = (prompts, states) => plain(context.mergeSnapshotStates(prompts, states, { closeUnrecorded: true }));
  const states = [{ id: 'old-id', name: 'Legacy', enabled: true }];
  assert.equal(merge([{ id: 'new-id', name: 'Legacy', enabled: false }], states).nextPrompts[0].enabled, true);
  assert.equal(merge([{ id: 'new-id', name: 'Legacy', enabled: false }], [{ name: 'Legacy', enabled: true }]).nextPrompts[0].enabled, true);
  const renamed = merge([
    { id: 'old-id', name: 'Renamed', enabled: false },
    { id: 'new-id', name: 'Legacy', enabled: true },
  ], states);
  assert.deepEqual(renamed.nextPrompts.map(p => p.enabled), [true, false]);
  assert.equal(renamed.applied, 1);
  const duplicate = [{ id: 'old-id', name: 'Legacy', enabled: true }, { id: 'new-id', name: 'Legacy', enabled: true }];
  assert.deepEqual(merge(duplicate, states).nextPrompts.map(p => p.enabled), [true, false]);
  assert.deepEqual(merge(duplicate.map(p => ({ ...p, id: `unknown-${p.id}` })), states).nextPrompts.map(p => p.enabled), [false, false]);
  assert.equal(merge([{ id: 'new-id', name: 'Legacy', enabled: true }], [...states, { ...states[0], id: 'another-id' }]).nextPrompts[0].enabled, false);
  const alreadyOff = [{ id: 'unrecorded', name: 'Already off', enabled: false }];
  assert.equal(merge(alreadyOff, states).changed, 0);
  assert.equal(merge([{ id: 'new', enabled: true }], []).nextPrompts[0].enabled, false);
}

// A snapshot with no matching entries or groups is rejected before writing.
for (const groupStates of [[], [{ id: 'gone-group', name: 'Gone', enabled: true }]]) {
  const f = fixture({ groups: [{ id: 'current-group', name: 'Current', enabled: true }] });
  f.capture('stale', { states: [{ id: 'gone', name: 'Gone', enabled: true }], groupStates });
  assert.equal(await f.context.applySnapshot('stale'), false);
  assert.deepEqual(f.saved, initialPrompts());
  assert.deepEqual(f.writes, []);
}
{
  const f = fixture();
  f.capture('other', { presetName: 'other-preset' });
  f.add(added);
  assert.equal(await f.context.applySnapshot('other'), false);
  assert.equal(f.saved.at(-1).enabled, true);
  assert.equal(f.writes.length, 0);
}

// Group switches retain their recorded semantics; they do not reopen new entries.
{
  const f = fixture({ groups: [{ id: 'g', name: 'Group', enabled: false }] });
  f.capture('group', { groupStates: [{ id: 'g', name: 'Group', enabled: true }] });
  f.add(added);
  assert.equal(await f.context.applySnapshot('group'), true);
  assert.equal(f.groups[0].enabled, true);
  assert.equal(f.saved.at(-1).enabled, false);
}

// The helper's default remains a partial restore for cancel/edit rollback.
{
  const f = fixture({ draft: true });
  const entryStates = plain(f.context.makeStates(f.context.getPrompts()));
  f.add(added);
  const restored = f.context.mergeSnapshotStates(f.context.getPrompts(), entryStates);
  assert.equal(restored.nextPrompts.at(-1).enabled, true);
  if (gecko) {
    f.context.session = { presetName: 'preset', entryStates, entryGroupStates: [], restoring: false };
    f.context.currentDraftBridge().update('original', { enabled: false });
    vm.runInContext('captureMode = session;', f.context);
    await f.context.exitCaptureMode();
    assert.equal(f.draft[0].enabled, true);
    assert.equal(f.draft.at(-1).enabled, true, 'Cancel capture must preserve newly added entries');
    assert.equal(f.writes.length, 0, 'Cancel must not persist the preset');
  }
}

assert.ok(source.includes('应用时，未记录在快照中的条目会关闭。'));
console.log(`${gecko ? 'Gecko' : 'Official'} snapshot regression passed: capture/add/apply, native persistence, draft, default, character/chat bindings, matching, stale guards, groups and cancellation.`);
