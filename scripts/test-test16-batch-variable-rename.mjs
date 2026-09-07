import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

for (const marker of [
  "prompts:()=>A.prompts,update:(e,n)=>a('update',e,n)",
  'batchVariablePrompts:()=>A.prompts',
  'batchVariableUpdate:(e,n)=>a(\'update\',e,n)',
  'batchVariableRecord:le',
  "label: '批量重命名变量'",
  "smartLabel = '保留旧项，并新增新变量'",
  "smartLabel = '同步改名 G 与同名空变量项'",
  "label: '只改已选 S'",
  'test.16 已加载：多选 S 支持批量重命名',
]) {
  assert.ok(source.includes(marker), `test.16 缺少实现：${marker}`);
}

const start = source.indexOf('function escapeVariableRegex(value)');
const end = source.indexOf('function applyTheme(dialog, panel)', start);
assert.ok(start >= 0 && end > start, '无法定位批量重命名变量的纯逻辑');
const logic = source.slice(start, end);
const api = vm.runInNewContext(
  `(() => { ${logic}; return { selectedVariableSummary, buildBatchVariableRenamePlan, applyBatchVariableRename }; })()`,
  { text: value => String(value ?? '').trim() },
);

const basePrompts = [
  { id: 'dark-a', content: '{{setvar::文风框架::阴暗正文 A}}' },
  { id: 'dark-b', content: '{{setvar::文风框架::阴暗正文 B}}' },
  { id: 'light-a', content: '{{setvar::文风框架::明亮正文 A}}' },
  { id: 'light-b', content: '{{setvar::文风框架::明亮正文 B}}' },
  { id: 'getter', content: '调用：\n{{getvar::文风框架}}' },
  { id: 'other', content: '{{setvar::人物框架::人物正文}}' },
];

function batch(ids, prompts = basePrompts) {
  return {
    state: { active: true, count: ids.length, ids },
    prompts: () => prompts,
  };
}

const summary = api.selectedVariableSummary(batch(['dark-a', 'dark-b', 'other']));
assert.equal(summary.selectedCount, 3);
assert.equal(summary.variables.length, 2);
assert.equal(summary.variables.find(item => item.name === '文风框架')?.selectedEntries, 2);
assert.equal(summary.variables.find(item => item.name === '文风框架')?.totalSetOccurrences, 4);
assert.equal(summary.variables.find(item => item.name === '文风框架')?.totalGetOccurrences, 1);

const splitPlan = api.buildBatchVariableRenamePlan(
  batch(['dark-a', 'dark-b']),
  '文风框架',
  '阴暗文风',
  true,
);
assert.equal(splitPlan.mode, 'split');
assert.equal(splitPlan.renamedSetOccurrences, 2);
assert.equal(splitPlan.remainingOldSet, 2);
assert.equal(splitPlan.addedGetOccurrences, 1);
assert.equal(splitPlan.renamedGetOccurrences, 0);
assert.equal(splitPlan.updates.find(item => item.id === 'dark-a')?.content, '{{setvar::阴暗文风::阴暗正文 A}}');
assert.equal(splitPlan.updates.find(item => item.id === 'light-a'), undefined, '未选中的同名 S 不得修改');
assert.equal(
  splitPlan.updates.find(item => item.id === 'getter')?.content,
  '调用：\n{{getvar::文风框架}}\n{{getvar::阴暗文风}}',
  '部分拆分必须保留旧 G 并新增新 G',
);

const setOnlyPlan = api.buildBatchVariableRenamePlan(
  batch(['dark-a', 'dark-b']),
  '文风框架',
  '阴暗文风',
  false,
);
assert.equal(setOnlyPlan.mode, 'split');
assert.equal(setOnlyPlan.updates.find(item => item.id === 'getter'), undefined, '只改 S 时不得修改 G');

const fullPlan = api.buildBatchVariableRenamePlan(
  batch(['dark-a', 'dark-b', 'light-a', 'light-b']),
  '文风框架',
  '新文风',
  true,
);
assert.equal(fullPlan.mode, 'rename');
assert.equal(fullPlan.remainingOldSet, 0);
assert.equal(fullPlan.renamedGetOccurrences, 1);
assert.equal(fullPlan.updates.find(item => item.id === 'getter')?.content, '调用：\n{{getvar::新文风}}');

const alreadyHasNewGet = basePrompts.map(prompt => prompt.id === 'getter'
  ? { ...prompt, content: '{{getvar::文风框架}}\n{{getvar::阴暗文风}}' }
  : prompt);
const noDuplicatePlan = api.buildBatchVariableRenamePlan(
  batch(['dark-a', 'dark-b'], alreadyHasNewGet),
  '文风框架',
  '阴暗文风',
  true,
);
assert.equal(noDuplicatePlan.addedGetOccurrences, 0);
assert.equal(noDuplicatePlan.skippedGetEntries, 1);
assert.equal(noDuplicatePlan.updates.find(item => item.id === 'getter'), undefined, '已有新 G 时不得重复新增');

const writes = [];
const labels = [];
assert.equal(api.applyBatchVariableRename({
  update: (id, changes) => writes.push({ id, changes }),
  record: label => labels.push(label),
}, splitPlan), true);
assert.equal(labels.length, 1, '整次批量重命名必须只建立一个撤销快照');
assert.match(labels[0], /文风框架 → 阴暗文风/);
assert.equal(writes.length, splitPlan.updates.length);

console.log('test.16 回归通过：多选变量支持部分拆分、完整改名、G 智能处理、去重与单步撤销。');
