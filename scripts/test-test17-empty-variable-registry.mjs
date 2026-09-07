import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
for (const marker of [
  'function emptySetVariableRegex(name)',
  'function nonEmptySetVariableRegex(name)',
  'oldEmptySetOccurrences',
  'addedEmptySetOccurrences',
  'renamedEmptySetOccurrences',
  "smartLabel = '保留旧项，并新增新变量'",
  "smartLabel = '同步改名 G 与同名空变量项'",
  'test.17 已加载：空 setvar 登记不参与正文 S 判断',
]) {
  assert.ok(source.includes(marker), `test.17 空变量登记缺少实现：${marker}`);
}

const start = source.indexOf('function escapeVariableRegex(value)');
const end = source.indexOf('function applyTheme(dialog, panel)', start);
assert.ok(start >= 0 && end > start, '无法定位批量重命名变量逻辑');
const logic = source.slice(start, end);
const api = vm.runInNewContext(
  `(() => { ${logic}; return { selectedVariableSummary, buildBatchVariableRenamePlan }; })()`,
  { text: value => String(value ?? '').trim() },
);

const prompts = [
  { id: 'dark-a', content: '{{setvar::文风框架::阴暗正文 A}}' },
  { id: 'dark-b', content: '{{setvar::文风框架::阴暗正文 B}}' },
  { id: 'light-a', content: '{{setvar::文风框架::明亮正文 A}}' },
  { id: 'light-b', content: '{{setvar::文风框架::明亮正文 B}}' },
  { id: 'getter', content: '{{getvar::文风框架}}' },
  { id: 'registry', name: '📜获取变量', content: '{{setvar::文风框架:: }}{{setvar::文风补丁1:: }}' },
];

const batch = ids => ({
  state: { active: true, count: ids.length, ids },
  prompts: () => prompts,
});

const registryOnly = api.selectedVariableSummary(batch(['registry']));
assert.equal(registryOnly.variables.length, 0, '空 setvar 登记不得被识别成可重命名的正文 S');
assert.equal(registryOnly.convertibleCount, 0, '含空 setvar 的登记条目不得被批量再次包装');

const bodySummary = api.selectedVariableSummary(batch(['dark-a', 'dark-b']));
const styleVariable = bodySummary.variables.find(item => item.name === '文风框架');
assert.equal(styleVariable?.totalSetOccurrences, 4, '正文 S 统计必须排除空登记');
assert.equal(styleVariable?.totalEmptySetOccurrences, 1, '空登记应单独统计');

const split = api.buildBatchVariableRenamePlan(
  batch(['dark-a', 'dark-b']),
  '文风框架',
  '阴暗文风',
  true,
);
assert.equal(split.mode, 'split');
assert.equal(split.remainingOldSet, 2);
assert.equal(split.oldEmptySetOccurrences, 1);
assert.equal(split.addedEmptySetOccurrences, 1);
assert.equal(split.renamedEmptySetOccurrences, 0);
assert.equal(
  split.updates.find(item => item.id === 'registry')?.content,
  '{{setvar::文风框架:: }}{{setvar::阴暗文风:: }}{{setvar::文风补丁1:: }}',
  '部分拆分必须原样保留旧空登记，并紧邻复制新登记',
);

const full = api.buildBatchVariableRenamePlan(
  batch(['dark-a', 'dark-b', 'light-a', 'light-b']),
  '文风框架',
  '阴暗文风',
  true,
);
assert.equal(full.mode, 'rename', '空登记不得导致全部改名被误判成部分拆分');
assert.equal(full.remainingOldSet, 0);
assert.equal(full.addedEmptySetOccurrences, 0);
assert.equal(full.renamedEmptySetOccurrences, 1);
assert.equal(
  full.updates.find(item => item.id === 'registry')?.content,
  '{{setvar::阴暗文风:: }}{{setvar::文风补丁1:: }}',
  '全部改名必须同步替换空登记',
);

const withExistingRegistry = prompts.map(prompt => prompt.id === 'registry'
  ? { ...prompt, content: '{{setvar::文风框架:: }}{{setvar::阴暗文风:: }}{{setvar::文风补丁1:: }}' }
  : prompt);
const noDuplicate = api.buildBatchVariableRenamePlan(
  {
    state: { active: true, count: 2, ids: ['dark-a', 'dark-b'] },
    prompts: () => withExistingRegistry,
  },
  '文风框架',
  '阴暗文风',
  true,
);
assert.equal(noDuplicate.addedEmptySetOccurrences, 0);
assert.equal(noDuplicate.skippedEmptySetEntries, 1);
assert.equal(noDuplicate.updates.find(item => item.id === 'registry'), undefined, '已有新空登记时不得重复新增');

const withRepeatedOldRegistry = prompts.map(prompt => prompt.id === 'registry'
  ? { ...prompt, content: '{{setvar::文风框架:: }}{{setvar::文风框架:: }}' }
  : prompt);
const repeatedOld = api.buildBatchVariableRenamePlan(
  {
    state: { active: true, count: 2, ids: ['dark-a', 'dark-b'] },
    prompts: () => withRepeatedOldRegistry,
  },
  '文风框架',
  '阴暗文风',
  true,
);
const repeatedRegistry = repeatedOld.updates.find(item => item.id === 'registry')?.content || '';
assert.equal((repeatedRegistry.match(/setvar::阴暗文风::/gu) || []).length, 1, '同一登记条目内只应新增一个新空变量');

console.log('test.17 回归通过：获取变量中的空 setvar 会随部分拆分新增、随全部改名替换，并且不干扰正文 S 判断。');
