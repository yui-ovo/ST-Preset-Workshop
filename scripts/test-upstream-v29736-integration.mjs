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

// The author lightweight snapshot editor replaces the former main-window capture transaction.
// Exercise real editor opening/saving against a live dirty store and the local restart cache.
for (const dirty of [false, true]) {
  const baseline = [
    { id: 'one', name: 'One', content: 'Saved', enabled: true, role: 'system' },
    { id: 'two', name: 'Two', content: 'Second', enabled: false, role: 'user' },
  ];
  const storageValues = new Map();
  const storage = { getItem: key => storageValues.get(key), setItem: (key, value) => storageValues.set(key, value) };
  const session = createDraftSession(storage, { setTimeout: () => 1, clearTimeout() {} });
  const store = vm.runInNewContext(`(() => {${section("const Je=n('preset',()=>{", ",je=n('branch'")};return Je();})()`, {
    n: (_name, setup) => setup, t: clone, _pmmDrafts: session,
    i: { ref: value => ({ value }), computed: read => ({ get value() { return read(); } }), toRaw: value => value, onScopeDispose() {}, watch() {} },
    s: () => 'A', d: () => clone(baseline), Pe: () => null, getLoadedPresetName: () => 'A', l: () => ['A'], Ue: () => [],
  });
  await store.initialize();
  if (dirty) await store.updatePrompt('one', { content: 'Unsaved text' });
  const expected = clone(store.prompts.value), opened = [];
  let snapshots = { snapshots: [{ presetName: 'A', default: true }] };
  const api = vm.runInNewContext(`(() => {
    let snapshotEditorSession = null, overlayContext = { source: 'native-preset', presetName: 'A' }, openMenuId = '';
    const closeOverlay = () => { overlayContext = null; };
    const destroySnapshotEditor = () => { snapshotEditorSession = null; };
    ${section('  function makeStates(', '  function baiBaiCompat(')}
    ${section('  function createSnapshotEditorDraft', '  function snapshotEditorGroupCount')}
    ${section('  function openSnapshotEditorFromOverlay()', '  function renderFirstDefaultPrompt')}
    ${section('  function saveSnapshotDraft', '  function findSnapshot')}
    ${section('  function returnFromSnapshotEditor()', '  function mountSnapshotEditor')}
    return { open: openSnapshotEditorFromOverlay, save: saveSnapshotEditor, cancel: returnFromSnapshotEditor, current: () => snapshotEditorSession };
  })()`, {
    text: value => String(value || ''), clone, DOC: { getElementById: () => ({}) }, EDITOR_OVERLAY_ID: 'snapshot',
    currentPresetName: () => 'A', activeBranchName: () => '', activeSnapshotForPreset: () => null,
    readStore: () => clone(snapshots), writeStore: value => { snapshots = clone(value); return true; },
    isDefaultSnapshot: item => item.default, storedPrompts: () => clone(baseline), defaultSnapshotName: () => 'Snapshot',
    editorGroupState: () => [{ id: 'g1', name: 'Group', enabled: true, promptIds: new Set(['one']) }],
    mountSnapshotEditor: () => true, openOverlay: value => opened.push(clone(value)), notify() {}, makeId: () => 'snapshot-id',
    requestSnapshotName: async () => 'Snapshot',
    setPreset: () => { throw Error('Snapshot editing must not write named or in-use presets'); },
  });
  for (const save of [false, true]) {
    api.open();
    const draft = api.current();
    assert(draft);
    assert.equal(draft.promptContents[0], 'Saved', 'Native snapshot source stays independent of an open workshop draft');
    draft.promptStates[0].enabled = false;
    draft.groups[0].enabled = false;
    session.flush();
    if (save) assert.equal(await api.save(), true); else api.cancel();
    assert.equal(api.current(), null);
    assert.deepEqual(opened.at(-1), { source: 'native-preset', presetName: 'A' });
    assert.deepEqual(clone(store.prompts.value), expected);
    assert.equal(store.isDirty.value, dirty);
    assert.deepEqual(baseline.map(item => item.enabled), [true, false]);
    session.flush();
    const restarted = createDraftSession(storage, { setTimeout: () => 1, clearTimeout() {} });
    assert.deepEqual(restarted.read('A', baseline), dirty ? expected : null);
    restarted.dispose();
  }
  assert.equal(snapshots.snapshots.length, 2, 'Cancel creates no snapshot; save creates exactly one');
  assert.equal(snapshots.snapshots[0].states[0].enabled, false);
  assert.equal(snapshots.snapshots[0].groupStates[0].enabled, false);
  assert(!('content' in snapshots.snapshots[0].states[0]), 'Snapshot storage contains switches, not duplicated prompt text');
  session.dispose();
}

console.log('作者整合运行回归通过：搜索、原生入口与清理，以及轻量快照保存/取消时的正文草稿与重启缓存隔离。');
