import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const start = source.indexOf('PMM_NATIVE_PRESET_ENTRY_TEST80');
assert.ok(start >= 0, '找不到酒馆原生预设栏入口模块');
const end = source.indexOf('/* ===== PMM_', start + 1);
const nativeEntry = source.slice(start, end < 0 ? undefined : end);

for (const marker of [
  "DOC.getElementById('update_oai_preset')",
  'let discoveryObserver = null;',
  "ensure('batch', '批量管理预设', 'fa-list-check')",
  "ensure('snapshot', '开关快照', 'fa-camera')",
  "TOP[BATCH_API_KEY]?.openBatch",
  "TOP[SNAPSHOT_API_KEY]?.open",
  "source: 'native-preset'",
  'discoveryObserver.observe(DOC.documentElement, { childList: true, subtree: true })',
  'discoveryObserver?.disconnect()',
  'button.addEventListener(\'click\'',
]) {
  assert.ok(nativeEntry.includes(marker), `原生预设栏入口缺少：${marker}`);
}

for (const forbidden of [
  'preventAutoClose',
  "addEventListener('pointerdown'",
  "addEventListener('touchstart'",
  "addEventListener('mousedown'",
  'stopImmediatePropagation',
]) {
  assert.ok(!nativeEntry.includes(forbidden), `原生入口不应安装全局点击拦截：${forbidden}`);
}

assert.match(source, /openBatch:\s*\(\)\s*=>\s*openBatchDialog\(/, '批量入口没有直接调用工坊批量管理');
console.log('test.80 回归通过：原生预设栏批量与快照入口独立工作，未引入全局点击拦截。');
