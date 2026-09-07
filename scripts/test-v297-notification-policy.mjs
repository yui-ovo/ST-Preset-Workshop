import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workshop = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const worldbook = await readFile(new URL('../dist/worldbook-stitch-test3.js', import.meta.url), 'utf8');

const silentWorkshopCalls = [
  "toastr.success('预设已保存')",
  "toastr.success('预设已重命名')",
  'toastr.success(`已重命名为 "${q}"`)',
  "toastr.success('已切换回主预设')",
  "toastr.success('分类已删除')",
  "toastr.success('已取消收藏')",
  "toastr.success('已添加到收藏')",
  "toastr.success('已新建条目')",
  "toastr.success('已新建分类')",
  "toastr.success('分组创建成功')",
  "toastr.info('已取消框选分组')",
  "toastr.info(z.value?'已切换为平铺显示（分组数据仍保留）':'已恢复分组显示')",
  "toastr.success('已复制条目')",
  "toastr.success('分组已改名')",
  "toastr.success('分组已解散')",
  "toastr.info('悬浮面板已切换到自由悬浮模式，可拖拽移动','预设管家')",
  'notify(\'success\', `预设已切换：${abbreviatePresetName(name)}`)',
  'notify(\'success\', `已切换至分支：${abbreviatePresetName(name)}`)',
];

for (const call of silentWorkshopCalls) {
  assert.ok(!workshop.includes(call), `仍会弹出日常通知：${call}`);
}

for (const call of [
  "notify('success', '已复制条目')",
  'notify(\'success\', `世界书已重命名为“${selectedName}”`)',
  "notify('success', '世界书已保存')",
]) {
  assert.ok(!worldbook.includes(call), `世界书仍会弹出日常通知：${call}`);
}

for (const retained of [
  "toastr.warning('预设已保存，但无法连接分组接口')",
  "toastr.warning('预设已保存，但柏宝箱分组写入失败，请查看控制台')",
  'toastr.success(compactMessage)',
  "toastr.error('保存失败')",
  '已撤销：${entry.label',
]) {
  assert.ok(workshop.includes(retained), `必要通知被误删：${retained}`);
}

for (const retained of [
  "notify('warning', '请先选择世界书')",
  "notify('error', `打开失败：${error?.message || error}`)",
]) {
  assert.ok(worldbook.includes(retained), `世界书必要通知被误删：${retained}`);
}

assert.ok(workshop.includes('V2.97 已加载：日常可见操作不再重复弹出成功通知。'), '缺少通知策略版本标记');

console.log('v2.97 通知策略测试通过：日常成功提示已静默，错误、风险、撤销与同步结果仍保留。');
