import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const renameStart = source.indexOf('async function batchRenameSelectedVariables');
const stripStart = source.indexOf('async function handleStripButton', renameStart);
const stripEnd = source.indexOf('function updateBasketBadges', stripStart);
assert.ok(renameStart >= 0 && stripStart > renameStart && stripEnd > stripStart, '无法定位变量弹窗文案');

const uiCopy = source.slice(renameStart, stripEnd);
for (const wording of [
  '改名后，还有 ${preview.remainingOldSet} 个有内容的变量项叫“${oldName}”',
  '所以旧 G（已找到 ${preview.oldGetOccurrences} 处）和旧的同名空变量项（已找到 ${preview.oldEmptySetOccurrences} 处）会继续保留',
  '只把选中的 ${preview.selectedEntries} 项从“${oldName}”改成“${newName}”，其他 G 和同名空变量项都不变',
  '已经没有叫“${oldName}”的有内容变量项',
  'G 与同名空变量项保持不变',
]) {
  assert.ok(uiCopy.includes(wording), `变量弹窗缺少大白话文案：${wording}`);
}
assert.ok(!uiCopy.includes('“获取变量”中'), '变量弹窗不应把全预设扫描结果误写成只来自“获取变量”条目');
assert.ok(!uiCopy.includes('空变量登记'), '变量弹窗不应继续使用“空变量登记”旧称');
assert.ok(!uiCopy.includes('（只有变量名，无内容）'), '选项正文不应继续夹带括号术语解释');
assert.ok(source.includes('test.20 已加载：变量弹窗统一使用“同名空变量项”，并以大白话说明改名结果'), '缺少 test.20 运行标记');

console.log('test.20 回归通过：变量弹窗使用“同名空变量项”，改名说明已改为大白话。');
