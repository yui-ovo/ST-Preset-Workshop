import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const start = source.indexOf('PMM_NATIVE_PRESET_ENTRY_TEST80');
const end = source.indexOf(';(()=>{\n  /* 预设工坊 × 柏宝箱', start);
assert.ok(start >= 0 && end > start, '找不到原生主预设入口模块');
const nativeEntry = source.slice(start, end);

for (const broadSelector of ['[class*="pmm-"]', '[id*="pmm-"]', '[class*="workshop"]']) {
  assert.ok(!nativeEntry.includes(broadSelector), `事件边界不得使用会影响全站点击的模糊选择器：${broadSelector}`);
}

for (const exactSelector of [
  '.pmm-switch-snapshot-overlay',
  '.pmm-preset-batch-overlay',
  '#preset-manager-floating-panel',
  '#preset-manager-main-panel',
]) {
  assert.ok(nativeEntry.includes(`'${exactSelector}'`), `事件边界缺少必要的明确根节点：${exactSelector}`);
}

assert.ok(nativeEntry.includes('WORKSHOP_EVENT_SELECTORS.some(selector => target?.closest?.(selector))'), '事件拦截没有逐个检查明确根节点');
assert.ok(nativeEntry.includes('guardedBody.addEventListener(type, preventNativePresetAutoClose'), '仍需在 body 冒泡阶段阻止酒馆误关主预设页');

console.log('v2.97.36 回归通过：TauriTavern 全站点击不再被截断，主预设返回页边界仅覆盖明确工坊区域。');
