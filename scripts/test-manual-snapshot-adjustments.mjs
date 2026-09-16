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

const base = { id: 'default', presetName: 'preset', name: '默认', isDefault: true,
  states: [{ id: 'p', name: 'Entry', enabled: false }], groupStates: [], characters: [], chats: [] };
const manual = { ...copy(base), id: 'manual', name: 'Manual', isDefault: false,
  states: [{ id: 'p', name: 'Entry', enabled: true }], groupStates: [{ id: 'g', name: 'Group', enabled: true }] };
const environment = {
  storage: JSON.stringify({ version: 1, snapshots: [base, manual], activeSnapshots: {}, homeSnapshots: {} }),
  prompts: [{ id: 'p', name: 'Entry', enabled: false, content: 'Untouched' }],
  groups: [{ id: 'g', name: 'Group', enabled: true }],
  chat: null, character: null, writes: 0,
};

function runtime() {
  let c;
  const top = {
    localStorage: { getItem: () => environment.storage, setItem: (_, value) => { environment.storage = value; } },
    confirm: () => true, requestAnimationFrame: fn => fn(),
    getLoadedPresetName: () => 'preset',
    setPreset: async (_, data) => { environment.prompts = copy(data.prompts); environment.writes++; },
  };
  c = vm.createContext({
    console, TOP: top, SELF: {}, STORAGE_KEY: 'snapshots', clone: copy,
    text: value => String(value ?? '').trim(),
    syncChatBindingListener() {}, notify() {}, renderOverlay() {},
    currentPresetName: () => 'preset', loadedPresetName: () => 'preset',
    currentChat: () => environment.chat, currentCharacter: () => environment.character,
    getPrompts: () => copy(environment.prompts), currentDraftBridge: () => null,
    draftPrompts: () => [], nativeSaveButton: () => null,
    getContext: () => null, refreshNativePromptManager: async () => {},
    isBranchMode: () => false, activeBranchName: () => '', blockWhileBranchActive: () => false,
    overlayContext: null,
    sectionGroupStore: () => null, workshopGroupStates: () => [],
    baiBaiCompat: () => ({
      readGroupEnabledStates: () => copy(environment.groups),
      syncGroupEnabledStates: async ({ states }) => {
        const matches = c.matchGroupStates(environment.groups, states);
        for (const { current, saved } of matches) current.enabled = saved.enabled;
        return { applied: matches.length };
      },
    }),
  });
  vm.runInContext([
    'let autoApplySerial = 0, lastAutoContextKey = "", openMenuId = "";',
    section('  function readStore(', '  function normalizeUniqueBindings('),
    section('  function makeStates(', '  function baiBaiCompat('),
    section('  function makeGroupStates(', '  function defaultSnapshotName('),
    section('  function isDefaultSnapshot(', '  function defaultSnapshotForCurrentPreset('),
    section('  function activeSnapshotForPreset(', '  function blockWhileSnapshotActive('),
    section('  function findSnapshot(', '  async function refreshNativePromptManager('),
    section('  async function persistPromptsDirectly(', '  function renameSnapshot('),
    section('  function overwriteSnapshot(', '  async function bindSnapshotToCurrentCharacter('),
    section('  function boundSnapshotForContext(', '  function scheduleBoundSnapshotAutoApply('),
    section('  function isManualSnapshotAdjusted(', '  function renderOverlay('),
  ].join('\n'), c);
  return c;
}
let c = runtime();
const adjusted = () => c.isManualSnapshotAdjusted('preset', c.activeSnapshotForCurrentPreset());
assert.equal(await c.applySnapshot('manual'), true);
assert.equal(c.readStore().manualSnapshots.preset, 'manual');
assert.equal(adjusted(), false);
const originalStates = copy(c.findSnapshot('manual').states);
environment.prompts[0].enabled = false;
assert.equal(adjusted(), true);
const writes = environment.writes;
for (const chat of [null, { key: 'a' }, { key: 'b' }, null, { key: 'a' }]) {
  environment.chat = chat;
  assert.equal(await c.autoApplyBoundSnapshot(), false, 'Unbound context changes must not reapply manual snapshot');
  assert.equal(environment.prompts[0].enabled, false);
}
assert.equal(environment.writes, writes);
assert.deepEqual(copy(c.findSnapshot('manual').states), originalStates, 'Manual edits do not update the stored snapshot');

// Reload the module/storage while Tavern retains its adjusted switches.
c = runtime();
assert.equal(await c.autoApplyBoundSnapshot(), false);
assert.equal(adjusted(), true);
assert.equal(await c.applySnapshot('manual'), true, 'Explicit restore works for an adjusted active snapshot');
assert.equal(environment.prompts[0].enabled, true);
assert.equal(adjusted(), false);
environment.groups[0].enabled = false;
assert.equal(adjusted(), true, 'Group switches participate in adjustment detection');
await c.applySnapshot('manual');
assert.equal(environment.groups[0].enabled, true);
assert.equal(adjusted(), false);
environment.prompts.push({ id: 'new', name: 'New entry', enabled: true });
assert.equal(adjusted(), true, 'New enabled entries differ from the frozen snapshot');
await c.applySnapshot('manual');
assert.equal(environment.prompts[1].enabled, false);
assert.equal(adjusted(), false);
environment.prompts[0].content = 'Changed text only';
assert.equal(adjusted(), false, 'Content edits do not affect a toggle-only snapshot');
environment.prompts[0].enabled = false;
assert.equal(c.overwriteSnapshot('manual'), true);
assert.equal(adjusted(), false, 'Overwrite returns to current without resetting switches');
assert.equal(environment.prompts[0].enabled, false);
assert.equal(c.readStore().manualSnapshots.preset, 'manual');

// Bindings retain priority, including the automatic no-change fast path.
let store = c.readStore();
store.snapshots.push({ ...copy(manual), id: 'role', characters: [{ key: 'character', name: 'Role' }], chats: [] });
store.snapshots.push({ ...copy(manual), id: 'chat', states: [{ id: 'p', name: 'Entry', enabled: false }], chats: [{ key: 'bound-chat', name: 'Chat' }] });
c.writeStore(store);
environment.character = { key: 'character' };
environment.chat = { key: 'role-chat' };
assert.equal(await c.autoApplyBoundSnapshot(), true);
assert.equal(environment.prompts[0].enabled, true);
assert.equal(c.activeSnapshotForCurrentPreset().id, 'role');
assert.equal(c.readStore().manualSnapshots.preset, undefined);
environment.prompts[0].enabled = false;
environment.chat = { key: 'another-role-chat' };
await c.autoApplyBoundSnapshot();
assert.equal(environment.prompts[0].enabled, true, 'Role lock still restores on entering another bound context');
environment.chat = { key: 'bound-chat' };
await c.autoApplyBoundSnapshot();
assert.equal(environment.prompts[0].enabled, false);
assert.equal(c.activeSnapshotForCurrentPreset().id, 'chat', 'Chat lock has priority');

// Returning to the home snapshot applies it once, then preserves later edits.
environment.chat = null; environment.character = null;
await c.autoApplyBoundSnapshot();
assert.equal(c.activeSnapshotForCurrentPreset().id, 'manual');
assert.equal(c.readStore().manualSnapshots.preset, 'manual');
environment.prompts[0].enabled = true;
environment.chat = { key: 'unbound' };
assert.equal(await c.autoApplyBoundSnapshot(), false);
assert.equal(adjusted(), true);
await c.applySnapshot('default');
assert.equal(c.activeSnapshotForCurrentPreset(), null);
assert.equal(c.readStore().manualSnapshots.preset, undefined);

// Binding an identical snapshot must clear manual mode even when no switches change.
environment.chat = { key: 'role-chat' }; environment.character = { key: 'character' };
await c.applySnapshot('role');
assert.equal(c.readStore().manualSnapshots.preset, 'role');
c = runtime();
await c.autoApplyBoundSnapshot();
assert.equal(c.readStore().manualSnapshots.preset, undefined);
console.log('Manual snapshot adjustments passed: persistence, re-entry/reload, explicit restore, overwrite, groups/new entries, defaults and role/chat binding priority.');
