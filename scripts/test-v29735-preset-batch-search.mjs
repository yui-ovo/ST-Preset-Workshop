import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const start = source.indexOf('PMM_FLOATING_PANEL_BATCH_V1');
const end = source.indexOf('PMM_NATIVE_PRESET_ENTRY_TEST80', start);
assert.ok(start >= 0 && end > start, '找不到批量管理预设模块');
const batch = source.slice(start, end);

for (const marker of [
  'function normalizeBatchSearchText(value)',
  "source.normalize('NFKC')",
  'function filterBatchList(dialog)',
  "row.classList.toggle('pmm-preset-batch-row--filtered', filtered)",
  "row.setAttribute('aria-hidden', filtered ? 'true' : 'false')",
  'data-pmm-preset-empty hidden',
  "for (const type of ['input', 'search', 'change', 'compositionend'])",
  '.pmm-preset-batch-row.pmm-preset-batch-row--filtered{display:none!important}',
  '.pmm-preset-batch-empty[hidden]{display:none!important}',
]) {
  assert.ok(batch.includes(marker), `批量预设搜索缺少：${marker}`);
}

assert.ok(batch.indexOf('row.classList.toggle') < batch.indexOf('data-pmm-preset-empty hidden'), '筛选实现没有在弹窗创建前定义');
console.log('v2.97.35 回归通过：批量预设搜索使用明确隐藏样式，并兼容手机搜索与中文输入完成事件。');
