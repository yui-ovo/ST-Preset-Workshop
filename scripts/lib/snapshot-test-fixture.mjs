import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export const source = readFileSync(new URL('../../dist/workshop-v3.02.js', import.meta.url), 'utf8');
export const clone = value => structuredClone(value);
export function section(start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `Cannot extract ${start}`);
  return source.slice(from, to);
}

// Execute shipped editor/storage functions; only host, DOM and naming UI are fixtures.
export function snapshotFixture() {
  const prompts = [
    { id: 'one', name: 'One', content: 'Saved text', enabled: true, role: 'system' },
    { id: 'two', name: 'Two', content: 'Second text', enabled: false },
  ];
  let store = { snapshots: [{ id: 'default', presetName: 'A', kind: 'default' }] };
  const controls = { presetName: 'A', branch: '', writeFailure: false, mountFailure: false };
  const events = [], names = [], writes = [], notices = [];
  let serial = 0;
  const context = vm.createContext({
    clone, events, controls,
    text: value => String(value ?? '').trim(),
    DOC: { getElementById: () => ({}) }, EDITOR_OVERLAY_ID: 'snapshot-editor',
    currentPresetName: () => controls.presetName,
    activeBranchName: () => controls.branch,
    readStore: () => clone(store),
    writeStore: value => {
      writes.push(clone(value));
      if (controls.writeFailure) return false;
      store = clone(value); return true;
    },
    isDefaultSnapshot: item => item.kind === 'default',
    draftPrompts: () => [],
    storedPrompts: name => { assert.equal(name, 'A'); return clone(prompts); },
    defaultSnapshotName: () => 'Snapshot',
    editorGroupState: () => [{ id: 'g', name: 'Group', enabled: true, promptIds: new Set(['one']) }],
    mountSnapshotEditor: () => { events.push('mount'); return !controls.mountFailure; },
    notify: (...args) => notices.push(args), makeId: () => `snapshot-${++serial}`,
    requestSnapshotName: () => new Promise(resolve => names.push(resolve)),
    setPreset: () => assert.fail('Editing a snapshot must not write Tavern presets'),
  });
  vm.runInContext(`
    let snapshotEditorSession = null, overlayContext = { source: 'native-preset', presetName: 'A' }, openMenuId = '';
    function closeOverlay() { overlayContext = null; events.push('close'); }
    function destroySnapshotEditor() { snapshotEditorSession = null; events.push('destroy'); }
    function openOverlay(options) { overlayContext = clone(options); events.push(clone(options)); }
    ${section('  function getPrompts(', '  function workshopDocuments(')}
    ${section('  function makeStates(', '  function baiBaiCompat(')}
    ${section('  function createSnapshotEditorDraft(', '  function snapshotEditorGroupCount')}
    ${section('  function saveSnapshotDraft(', '  function findSnapshot(')}
    ${section('  function returnFromSnapshotEditor()', '  function mountSnapshotEditor(')}
    ${section('  function openSnapshotEditorFromOverlay()', '  function renderFirstDefaultPrompt')}
    globalThis.editor = {
      open: openSnapshotEditorFromOverlay, save: saveSnapshotEditor, cancel: returnFromSnapshotEditor,
      current: () => snapshotEditorSession, saveDraft: saveSnapshotDraft,
    };
  `, context);
  return {
    editor: context.editor, controls, events, names, writes, notices, prompts,
    get stored() { return clone(store); },
    answer(name) { assert.equal(names.length, 1); names.shift()(name); },
  };
}
