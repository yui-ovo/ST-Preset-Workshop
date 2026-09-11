import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const start = source.indexOf('  function createSnapshotEditorDraft(');
const end = source.indexOf('  function snapshotEditorGroupCount(', start);
let groups = [];
const create = Function('makeStates', 'clone', 'editorGroupState', 'text', 'defaultSnapshotName', source.slice(start, end) + '\nreturn createSnapshotEditorDraft;')(
  prompts => prompts.map(p => ({ ...p })), structuredClone, () => structuredClone(groups), value => String(value ?? '').trim(), () => '方案',
);
const prompts = ['声明', 'a1', 'a2', '说明', 'b1', '末尾'].map(id => ({ id, name:id, enabled:true }));
groups = [
  { id:'b', promptIds:new Set(['b1']) },
  { id:'a', promptIds:new Set(['a1', 'a2']) },
  { id:'empty', promptIds:new Set() },
];
const draft = create('预设', prompts, {});
assert.deepEqual(draft.rows.map(row => row.group?.id ?? draft.promptStates[row.promptIndex].id), ['声明','a','说明','b','末尾','empty']);
assert.deepEqual(draft.groups.find(g => g.id === 'a').promptIndexes, [1,2]);
assert.deepEqual(draft.promptStates.map(p => p.id), prompts.map(p => p.id), 'UI layout must not reorder persisted states');
assert.equal(draft.groups.length,3,'No synthetic group is saved');
draft.promptStates[0].enabled = false;
assert.equal(prompts[0].enabled,true,'Standalone edits stay in the draft');
groups = [];
assert.deepEqual(create('预设',prompts,{}).rows.map(row => row.promptIndex), [0,1,2,3,4,5]);
assert.deepEqual(create('空预设',[],{}).rows, []);
console.log('test.98 passed: original standalone order, group placement, empty groups, draft isolation and ungrouped-only presets.');
