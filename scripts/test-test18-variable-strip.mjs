import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
for (const marker of [
  'function unwrapWholeSetVariable(content)',
  'function buildVariableStripPlan(batch, selectedIds, cleanRelated)',
  'function applyVariableStripPlan(batch, plan)',
  'class="pmm-variable-btn pmm-variable-btn--strip"',
  'title="去除变量格式"',
  '.pmm-variable-btn--strip::after',
  'transform:rotate(45deg)',
  "label: '只变成普通条目'",
  "label: '同时清理失效变量'",
  '其他条目仍在使用变量“${retainedNames.join(\'、\')}”，因此暂不能清理对应的 G 和同名空变量项',
  'test.18 已加载：S 斜线按钮可还原普通条目',
]) {
  assert.ok(source.includes(marker), `test.18 去除变量格式缺少实现：${marker}`);
}

const start = source.indexOf('function escapeVariableRegex(value)');
const end = source.indexOf('function applyTheme(dialog, panel)', start);
assert.ok(start >= 0 && end > start, '无法定位去除变量格式纯逻辑');
const logic = source.slice(start, end);
const api = vm.runInNewContext(
  `(() => { ${logic}; return { unwrapWholeSetVariable, buildVariableStripPlan, applyVariableStripPlan }; })()`,
  { text: value => String(value ?? '').trim() },
);

assert.deepEqual(
  { ...api.unwrapWholeSetVariable('{{setvar::文风框架::正文 {{getvar::其他变量}} 结束}}') },
  { name: '文风框架', content: '正文 {{getvar::其他变量}} 结束' },
  '完整外壳应取最后的 }}，保留正文中的嵌套宏',
);
assert.equal(api.unwrapWholeSetVariable('{{setvar::文风框架:: }}'), null, '空 setvar 登记不得还原成空白普通条目');
assert.equal(api.unwrapWholeSetVariable('前文 {{setvar::文风框架::局部正文}} 后文'), null, '正文中的局部 S 不得被误拆');

const prompts = [
  { id: 'dark-a', content: '{{setvar::文风框架::阴暗正文 A}}' },
  { id: 'dark-b', content: '{{setvar::文风框架::阴暗正文 B}}' },
  { id: 'light-a', content: '{{setvar::文风框架::明亮正文 A}}' },
  { id: 'light-b', content: '{{setvar::文风框架::明亮正文 B}}' },
  { id: 'getter', content: '<文风框架>\n{{getvar::文风框架}}\n{{getvar::其他变量}}\n</文风框架>' },
  { id: 'registry', name: '📜获取变量', content: '{{setvar::文风框架:: }}{{setvar::其他变量:: }}' },
];
const batch = { prompts: () => prompts };

const partialClean = api.buildVariableStripPlan(batch, ['dark-a', 'dark-b'], true);
assert.equal(partialClean.unwrappedEntries, 2);
assert.equal(partialClean.cleanableVariables.length, 0);
assert.equal(partialClean.retainedVariables[0]?.name, '文风框架');
assert.equal(partialClean.retainedVariables[0]?.remainingSetOccurrences, 2);
assert.equal(partialClean.removedGetOccurrences, 0, '仍有同名正文 S 时不得清理 G');
assert.equal(partialClean.removedEmptySetOccurrences, 0, '仍有同名正文 S 时不得清理空登记');
assert.equal(partialClean.updates.find(item => item.id === 'getter'), undefined);
assert.equal(partialClean.updates.find(item => item.id === 'registry'), undefined);
assert.equal(partialClean.updates.find(item => item.id === 'dark-a')?.content, '阴暗正文 A');

const fullKeep = api.buildVariableStripPlan(batch, ['dark-a', 'dark-b', 'light-a', 'light-b'], false);
assert.equal(fullKeep.cleanableVariables[0]?.name, '文风框架');
assert.equal(fullKeep.cleanableGetOccurrences, 1);
assert.equal(fullKeep.cleanableEmptySetOccurrences, 1);
assert.equal(fullKeep.updates.find(item => item.id === 'getter'), undefined, '选择不清理时 G 必须保持原样');
assert.equal(fullKeep.updates.find(item => item.id === 'registry'), undefined, '选择不清理时空登记必须保持原样');

const fullClean = api.buildVariableStripPlan(batch, ['dark-a', 'dark-b', 'light-a', 'light-b'], true);
assert.equal(fullClean.cleanableVariables[0]?.remainingSetOccurrences, 0);
assert.equal(fullClean.removedGetOccurrences, 1);
assert.equal(fullClean.removedEmptySetOccurrences, 1);
assert.equal(
  fullClean.updates.find(item => item.id === 'getter')?.content,
  '<文风框架>\n{{getvar::其他变量}}\n</文风框架>',
  '失效的整行 G 应连同该行换行清除，其他 G 保留',
);
assert.equal(
  fullClean.updates.find(item => item.id === 'registry')?.content,
  '{{setvar::其他变量:: }}',
  '获取变量中只删除失效变量的空登记',
);

const writes = [];
const labels = [];
assert.equal(api.applyVariableStripPlan({
  update: (id, changes) => writes.push({ id, changes }),
  record: label => labels.push(label),
}, fullClean), true);
assert.equal(labels.length, 1, '整批还原与清理只能建立一个撤销快照');
assert.match(labels[0], /去除变量格式 4 条/);
assert.equal(writes.length, fullClean.updates.length);

console.log('test.18 回归通过：斜线 S 可还原单条或多选正文，并只清理已经没有正文 S 使用的同名 G 与空登记。');
