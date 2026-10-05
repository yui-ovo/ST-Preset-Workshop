import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { performance } from 'node:perf_hooks';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
function between(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a);
  return source.slice(a, b);
}
const initSource = between('async function c(n,t){if(!n)return;const i=o(n);', 'async function d(e)');
const importSource = between('async function _pmmImportBaiBaiGroups(', 'function _pmmScheduleDeferredRender(');
const blank = () => ({ prompts: [], sections: [], collapsedSections: new Set(), disabledSections: new Set(), originalEnabledStates: {}, isInitialized: false, isLoading: false, groupSource: 'none' });
const quiet = { info() {}, warn() {} };
const prompts = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];

// Exercise the production initializer, including its real outer persistence function.
{
  const states = new Map(), selected = { value: '' };
  let saves = 0, deferred = 0, fail = false;
  const state = name => { if (!states.has(name)) states.set(name, blank()); return states.get(name); };
  const initialize = runInNewContext(initSource + ';c', {
    e: { value: states }, A: selected, o: state, a: state, h: quiet,
    s(name, rows) { return { ...blank(), prompts: rows }; },
    r(name, value) { states.set(name, value); },
    l: async () => { saves++; }, d: async () => {},
    _pmmScheduleDeferredRender() { deferred++; },
    async _pmmImportBaiBaiGroups(name, rows, target) {
      if (fail) throw Error('Read failure');
      target.isInitialized = true;
      target.sections = [{ id: 'baibai_g', itemIds: rows.map(p => p.id), displayName: 'Group' }];
      return true;
    },
  });
  await initialize('A', prompts);
  await initialize('B', prompts);
  await initialize('A', prompts); // Cached state must not shadow the save function.
  assert.equal(saves, 3);
  assert.equal(deferred, 3);
  assert.equal(selected.value, 'A');
  assert.equal(state('A').isLoading, false);
  await initialize('A', []);
  assert.equal(state('A').prompts.length, 2, 'Empty transient input must preserve existing entries');
  fail = true;
  await assert.rejects(initialize('C', prompts), /Read failure/);
  assert.equal(state('C').isLoading, false, 'Failure must release the load guard for retry');
  fail = false;
  await initialize('C', prompts);
  assert.equal(selected.value, 'C');
}

function importer(data) {
  return runInNewContext(importSource + ';_pmmImportBaiBaiGroups', {
    h: quiet, structuredClone,
    SillyTavern: { getContext: () => ({ getPresetManager: () => ({ readPresetExtensionField: async () => data }) }) },
  });
}

// Measure algorithmic work, not a machine-specific timing threshold.
for (const [count, groupCount] of [[500, 25], [1000, 100]]) {
  let idReads = 0;
  const rows = Array.from({ length: count }, (_, index) => ({ get id() { idReads++; return `p${index}`; }, name: `Prompt ${index}` }));
  const data = {
    groups: Array.from({ length: groupCount }, (_, id) => ({ id: String(id), name: `Group ${id}`, enabled: id !== 1 })),
    prompts: Object.fromEntries(Array.from({ length: count }, (_, i) => [`p${i}`, { groupId: String(i % groupCount) }])),
  };
  const state = blank(), start = performance.now();
  assert.equal(await importer(data)('Example', rows, state), true);
  const elapsed = performance.now() - start;
  assert.ok(idReads <= count * 6, `Import must not rescan every prompt per group: ${idReads}`);
  assert.equal(state.sections.length, groupCount);
  assert.equal(state.sections.reduce((total, group) => total + group.itemIds.length, 0), count);
  assert.deepEqual(Array.from(state.sections[0].itemIds), Array.from({ length: count / groupCount }, (_, i) => `p${i * groupCount}`));
  assert.equal(state.collapsedSections.size, groupCount);
  assert.deepEqual(Array.from(state.disabledSections), ['baibai_1']);
  console.log(`${count} prompts / ${groupCount} groups: ${idReads} ID reads, ${elapsed.toFixed(1)} ms`);
}

// Native assignment wins while pending unassigned/new-group entries retain their place.
{
  const state = { ...blank(), groupSource: 'baibai', sections: [{ id: 'baibai_new', displayName: 'New', itemIds: ['d'] }],
    collapsedSections: new Set(['baibai_new']), pendingBaiBaiAssignments: { a: '2', b: '2', d: 'new' } };
  await importer({ groups: [{ id: '1' }, { id: '2' }], prompts: { a: { groupId: '1' }, c: { groupId: '2' } } })
    ('Example', ['a', 'b', 'c', 'd'].map(id => ({ id, name: id })), state);
  assert.deepEqual(Array.from(state.sections, group => Array.from(group.itemIds)), [['a'], ['b', 'c'], ['d']]);
  assert.equal(state.collapsedSections.has('baibai_new'), true);
}

assert.ok(source.includes('A.deferred?_pmmCancelContentStart=pmmScheduleVisiblePanelStart(()=>{k.value=!0})'), 'Content spinner must use the visible-host scheduler');
assert.ok(source.includes('(0,i.onBeforeUnmount)(()=>{_pmmCancelContentStart?.()})'), 'Deferred content startup must be canceled on close');
// Unchanged group state must not replace global settings; compare inside the write
// queue so an external edit is not mistaken for a still-current cached value.
{
  let stored = { group_Example: { sections: ['a'] }, otherPlugin: { theme: 'kept' } }, writes = 0;
  const save = runInNewContext(
    between('function ee(e,n,', 'function ne()') +
    between('async function be(e,n)', 'async function fe(e)') + ';be', {
      H: Promise.resolve(), N: 'group_', t: structuredClone, h: { ...quiet, error() {} }, toastr: { error() {} },
      getVariables: () => structuredClone(stored),
      replaceVariables: async value => { stored = structuredClone(value); writes++; },
    });
  await save('Example', { sections: ['a'] });
  await save('Example', { sections: ['a'] });
  assert.equal(writes, 0);
  await save('Example', { sections: ['b'] });
  assert.equal(writes, 1);
  stored.group_Example = { sections: ['external'] };
  await save('Example', { sections: ['b'] });
  assert.equal(writes, 2, 'External group edits must not be hidden by a stale cache');
  assert.equal(stored.otherPlugin.theme, 'kept');
}
console.log('Preset loading passed: first load, cached switches, retry, bounded group indexing and pending assignments.');
