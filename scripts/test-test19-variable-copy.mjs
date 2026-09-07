import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const renameStart = source.indexOf('async function batchRenameSelectedVariables');
const stripStart = source.indexOf('async function handleStripButton', renameStart);
const stripEnd = source.indexOf('function updateBasketBadges', stripStart);
assert.ok(renameStart >= 0 && stripStart > renameStart && stripEnd > stripStart, '无法定位变量弹窗文案');

const uiCopy = source.slice(renameStart, stripEnd);
for (const wording of [
  '所有 G 和同名空变量项都不变',
  '可智能保留或同步 G 与同名空变量项',
  '其他条目仍在使用变量“${retainedNames.join(\'、\')}”，因此暂不能清理对应的 G 和同名空变量项',
  'G 与同名空变量项保持不变',
]) {
  assert.ok(uiCopy.includes(wording), `变量弹窗缺少统一文案：${wording}`);
}
assert.ok(!uiCopy.includes('空 setvar 登记'), '用户可见弹窗不应继续显示“空 setvar 登记”技术说法');
assert.ok(source.includes('test.19 已加载：变量弹窗已完成第一轮空变量说明统一'), '缺少 test.19 运行标记');

console.log('test.19 回归通过：重命名与去除格式弹窗统一说明同名空变量项，并说明其他条目仍在使用。');
