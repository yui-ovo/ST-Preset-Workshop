import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createDraftSession } from '../dist/workshop-session-state.js';

const source = fs.readFileSync(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const section = (start, end) => {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert(a >= 0 && b > a, start);
  return source.slice(a, b);
};

// Execute the author's search against flex rows, IME/full-width text and empty results.
{
  const rows = ['ＡＢＣ 测试', 'abc 第二套', 'Other'].map(name => ({
    dataset: { pmmPresetName: name }, hidden: false, filtered: false,
    classList: { toggle(_name, filtered) { this.row.filtered = filtered; } },
    setAttribute(name, value) { this[name] = value; },
  }));
  rows.forEach(row => { row.classList.row = row; });
  const input = { value: ' ａｂｃ ' }, empty = { hidden: true };
  const dialog = {
    querySelector: selector => selector.includes('search') ? input : empty,
    querySelectorAll: () => rows,
  };
  const filter = vm.runInNewContext(`${section('  function normalizeBatchSearchText', '  async function deleteSelectedPresets')}\nfilterBatchList;`);
  for (const [query, visible] of [[' ａｂｃ ', [true, true, false]], ['测试', [true, false, false]], ['不存在', [false, false, false]], ['', [true, true, true]]]) {
    input.value = query;
    filter(dialog);
    assert.deepEqual(rows.map(row => !row.hidden), visible);
    assert.deepEqual(rows.map(row => !row.filtered), visible);
    assert.deepEqual(rows.map(row => row['aria-hidden'] === 'false'), visible);
    assert.equal(empty.hidden, visible.some(Boolean));
  }
}

// Run the merged native entry, including replacement installation and full listener cleanup.
{
  function node() {
    const listeners = new Map();
    return {
      dataset: {}, children: [], listeners,
      setAttribute() {},
      addEventListener(type, fn, options) {
        const current = listeners.get(type) || [];
        current.push({ fn, options }); listeners.set(type, current);
      },
      removeEventListener(type, fn) { listeners.set(type, (listeners.get(type) || []).filter(item => item.fn !== fn)); },
      dispatch(type, target) {
        const event = { target, stopped: false, prevented: false, stopPropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; } };
        for (const { fn } of listeners.get(type) || []) fn(event);
        return event;
      },
    };
  }
  const body = node(), host = node(), doc = node(), activations = [];
  host.querySelector = selector => host.children.find(button => selector.includes(`"${button.dataset.pmmNativePresetAction}"`));
  host.append = button => host.children.push(button);
  doc.body = body;
  doc.getElementById = id => id === 'update_oai_preset' ? { parentElement: host } : null;
  doc.querySelectorAll = () => [...host.children];
  doc.createElement = () => {
    const button = node(); button.remove = () => host.children.splice(host.children.indexOf(button), 1); return button;
  };
  const top = { document: doc,
    __PMM_FLOATING_SNAPSHOT_ENTRY_TEST69__: { openBatch: () => activations.push('batch') },
    __PMM_SWITCH_SNAPSHOTS_TEST52__: { open: context => activations.push(context.source) },
  };
  top.top = top;
  const native = section('/* ===== PMM_NATIVE_PRESET_ENTRY_TEST80', '\n\n;(()=>{');
  const context = { window: top, console, MutationObserver: class { constructor() { throw Error('Ready toolbar must stay idle'); } } };
  for (let install = 0; install < 3; install++) {
    vm.runInNewContext(native, context);
    assert.equal(host.children.length, 2);
    for (const type of ['mousedown', 'pointerdown', 'touchstart', 'click']) {
      const listeners = body.listeners.get(type);
      assert.equal(listeners.length, 1, 'Reload must replace the prior body boundary');
      assert.equal(listeners[0].options.capture, false);
      assert.equal(listeners[0].options.passive, true);
      for (const selector of ['.pmm-native-preset-entry', '.pmm-switch-snapshot-overlay', '.pmm-preset-batch-overlay', '#preset-manager-floating-panel', '#preset-manager-main-panel']) {
        const target = { closest: candidate => candidate === selector ? target : null };
        assert.equal(body.dispatch(type, target).stopped, true);
        assert.equal(body.dispatch(type, { parentElement: target }).stopped, true, 'Text-node targets retain the boundary');
      }
      // The host html class must not turn unrelated extension/chat buttons into workshop controls.
      const unrelated = { closest: selector => selector === '[class*="pmm-"]' ? { className: 'pmm-mobile-toolbar-ready' } : null };
      const event = body.dispatch(type, unrelated);
      assert.equal(event.stopped, false);
      assert.equal(event.prevented, false);
    }
    for (const button of host.children) button.dispatch('click', button);
  }
  assert.deepEqual(activations, ['batch', 'native-preset', 'batch', 'native-preset', 'batch', 'native-preset']);
  top.__PMM_NATIVE_PRESET_ENTRY_TEST80_CLEANUP__();
  assert.equal(host.children.length, 0);
  assert([...body.listeners.values(), ...doc.listeners.values()].every(list => list.length === 0));
}

// Opening the workshop may clear the native overlay; preserve its preset/source across that await.
{
  const open = vm.runInNewContext(`(() => {
    let overlayContext = { source: 'native-preset', presetName: 'Native A' }, ready = false, received;
    const TOP = { entry: { async openWorkshopHome() { overlayContext = null; ready = true; return true; } } };
    const FLOATING_ENTRY_API_KEY = 'entry';
    const normalPresetContainer = () => ready;
    const blockWhileBranchActive = () => false;
    const closeOverlay = () => { overlayContext = null; };
    const enterCaptureMode = context => { received = context; };
    const notify = () => { throw Error('Native entry unexpectedly failed'); };
    ${section('  async function enterCaptureModeFromOverlay', '  function renderCaptureSavePrompt')}
    return async () => { await enterCaptureModeFromOverlay(); return received; };
  })()`);
  assert.deepEqual(clone(await open()), { source: 'native-preset', presetName: 'Native A' });
}

// Actual preset store + session cache + upstream capture transaction: two consecutive recordings.
for (const entry of ['clean', 'dirty', 'native-preset']) {
  const baseline = [
    { id: 'one', name: 'One', content: 'Saved', enabled: true, role: 'system', position: { type: 'relative' } },
    { id: 'two', name: 'Two', content: 'Second', enabled: false, role: 'user' },
  ];
  const stored = new Map(), storage = { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) };
  const timers = { setTimeout: () => 1, clearTimeout() {} };
  const session = createDraftSession(storage, timers), namedWrites = [], groupWrites = [], runtimeWrites = [];
  let captureActive = false, draftGroups = [{ id: 'g1', enabled: true }];
  const nativeGroups = { groups: clone(draftGroups) };
  const compatContext = {
    sharedRoot: {
      document: { querySelector: () => captureActive ? {} : null },
      setPreset: async (name, value) => namedWrites.push({ name, value: clone(value) }),
      getLoadedPresetName: () => 'A',
    },
    localRoot: {}, clone, text: value => String(value || ''), compat: {}, hasAppliedBranch: () => false,
    getPresetManager: () => ({}), readNativeState: () => clone(nativeGroups), refreshRuntime: async () => {},
    writeNativeState: async (_name, state) => { groupWrites.push(clone(state)); return true; },
  };
  const compat = vm.runInNewContext(`${section('  function isSnapshotCaptureActive()', '  function readGroupEnabledStates')}\n({syncEnabledStates,syncGroupEnabledState});`, compatContext);
  const store = vm.runInNewContext(`(() => {${section("const Je=n('preset',()=>{", ",je=n('branch'")};return Je();})()`, {
    n: (_name, setup) => setup, t: clone, _pmmDrafts: session,
    i: { ref: value => ({ value }), computed: read => ({ get value() { return read(); } }), toRaw: value => value, onScopeDispose() {}, watch() {} },
    s: () => 'A', d: () => clone(baseline), Pe: () => null, getLoadedPresetName: () => 'A', l: () => ['A'], Ue: () => [],
    ze: () => ({}), __PMM_BAIBAI_COMPAT__: compat,
  });
  await store.initialize();
  if (entry !== 'clean') await store.updatePrompt('one', { content: 'Unsaved draft' });
  const expected = entry === 'dirty' ? clone(store.prompts.value) : clone(baseline);
  const bridge = { restoreClean: prompts => store.refreshDisplayedPrompts(prompts), update: (id, patch) => store.updatePrompt(id, patch) };
  const api = vm.runInNewContext(`(() => {
    let captureMode = null, overlayContext = null, composer = null, openMenuId = '';
    ${section('  async function writeSwitchesToDraft', '  async function refreshNativePromptManager')}
    ${section('  async function exitCaptureMode', '  async function enterCaptureModeFromOverlay')}
    return { enterCaptureMode, exitCaptureMode, current: () => captureMode };
  })()`, {
    clone, text: value => String(value || ''),
    closeOverlay() {}, notify() {}, scheduleMount() {}, syncCaptureModeUI: () => { captureActive = Boolean(api.current()); },
    currentPresetName: () => 'A', currentDraftBridge: () => bridge, currentPresetDraftStore: () => ({ isDirty: store.isDirty.value }),
    draftPrompts: () => clone(store.prompts.value), settleDraft: async () => {}, getPrompts: () => clone(store.prompts.value), storedPrompts: () => clone(baseline),
    readStore: () => ({ snapshots: [{ presetName: 'A', default: true }] }), isDefaultSnapshot: item => item.default,
    blockWhileBranchActive: () => false, blockWhileSnapshotActive: () => false,
    makeStates: prompts => prompts.map(({ id, enabled }) => ({ id, enabled })), makeGroupStates: () => clone(draftGroups),
    applyGroupSnapshotStates: async (_name, groups) => { draftGroups = clone(groups); },
    syncRuntimeSwitches: async (_name, prompts) => { runtimeWrites.push(clone(prompts)); return true; },
  });
  for (let round = 0; round < 2; round++) {
    api.enterCaptureMode(entry === 'native-preset' ? { source: 'native-preset', presetName: 'A' } : null);
    assert(captureActive);
    assert.deepEqual(clone(api.current().entryPrompts), expected);
    assert.equal(api.current().entryWasDirty, entry === 'dirty');
    await store.toggleEnabled('one');
    await store.toggleEnabled('two');
    draftGroups[0].enabled = false;
    await compat.syncGroupEnabledState({ presetName: 'A', sectionId: 'baibai_g1', enabled: false });
    session.flush(); // A pending cache flush during capture must be corrected on normal exit.
    assert.equal(namedWrites.length, 0, 'Capture toggles must not write named presets or live runtime');
    assert.equal(groupWrites.length, 0, 'Capture group toggles must not write native group storage');
    await api.exitCaptureMode(round === 1);
    session.flush();
    assert.equal(captureActive, false);
    assert.equal(api.current(), null);
    assert.deepEqual(clone(store.prompts.value), expected);
    assert.deepEqual(runtimeWrites.at(-1), expected);
    assert.equal(store.isDirty.value, entry === 'dirty');
    assert.equal(draftGroups[0].enabled, true);
    const restarted = createDraftSession(storage, timers);
    assert.deepEqual(restarted.read('A', baseline), entry === 'dirty' ? expected : null);
    restarted.dispose();
  }
  await compat.syncEnabledStates({ presetName: 'A', prompts: baseline });
  await compat.syncGroupEnabledState({ presetName: 'A', sectionId: 'baibai_g1', enabled: false });
  assert.deepEqual(namedWrites.map(write => write.name), ['A', 'in_use'], 'Normal toggles still sync after capture ends');
  assert.equal(groupWrites.length, 1);
  session.dispose();
}

console.log('2.97.36 融合运行回归通过：搜索、精确事件边界与重载清理、连续录制隔离及干净/未保存/原生来源草稿恢复。');
