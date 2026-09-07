import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
const isGecko = String(manifest.display_name || '').includes('Gecko');
const workshopPath = '../dist/workshop-v3.02.js';
const workshop = await readFile(new URL(workshopPath, import.meta.url), 'utf8');
const entry = await readFile(new URL('../dist/index.js', import.meta.url), 'utf8');
const editor = await readFile(new URL('../dist/preset-content-editor.js', import.meta.url), 'utf8');

for (const marker of [
  'function buildBatchVariableRenamePlan(batch, oldName, newName, syncGet)',
  'function buildVariableStripPlan(batch, selectedIds, cleanRelated)',
  "label: '批量重命名变量'",
  "label: '只变成普通条目'",
  "label: '同时清理失效变量'",
  "text: '空变量项指：只有变量名，里面无内容的变量。如：{{setvar::变量名:: }}'",
  'batchVariablePrompts:()=>A.prompts',
  "prompts:()=>A.prompts,update:(e,n)=>a('update',e,n)",
]) {
  assert.ok(workshop.includes(marker), `移植版变量功能缺少实现：${marker}`);
}

const logicStart = workshop.indexOf('function escapeVariableRegex(value)');
const logicEnd = workshop.indexOf('function applyTheme(dialog, panel)', logicStart);
assert.ok(logicStart >= 0 && logicEnd > logicStart, '无法定位变量功能纯逻辑');
const logic = workshop.slice(logicStart, logicEnd);
const api = vm.runInNewContext(
  `(() => { ${logic}; return { buildBatchVariableRenamePlan, buildVariableStripPlan }; })()`,
  { text: value => String(value ?? '').trim() },
);

const prompts = [
  { id: 'dark-a', content: '{{setvar::文风框架::阴暗正文 A}}' },
  { id: 'dark-b', content: '{{setvar::文风框架::阴暗正文 B}}' },
  { id: 'light', content: '{{setvar::文风框架::明亮正文}}' },
  { id: 'getter', content: '{{getvar::文风框架}}' },
  { id: 'registry', content: '{{setvar::文风框架:: }}' },
];
const batch = ids => ({
  state: { active: true, count: ids.length, ids },
  prompts: () => prompts,
});

const split = api.buildBatchVariableRenamePlan(batch(['dark-a', 'dark-b']), '文风框架', '阴暗文风', true);
assert.equal(split.mode, 'split');
assert.equal(split.remainingOldSet, 1);
assert.equal(split.addedGetOccurrences, 1);
assert.equal(split.addedEmptySetOccurrences, 1);
assert.match(split.updates.find(item => item.id === 'getter')?.content || '', /getvar::阴暗文风/);
assert.match(split.updates.find(item => item.id === 'registry')?.content || '', /setvar::阴暗文风::/);

const full = api.buildBatchVariableRenamePlan(batch(['dark-a', 'dark-b', 'light']), '文风框架', '新文风', true);
assert.equal(full.mode, 'rename');
assert.equal(full.remainingOldSet, 0);
assert.equal(full.renamedGetOccurrences, 1);
assert.equal(full.renamedEmptySetOccurrences, 1);

const stripped = api.buildVariableStripPlan(batch(['dark-a', 'dark-b', 'light']), ['dark-a', 'dark-b', 'light'], true);
assert.equal(stripped.unwrappedEntries, 3);
assert.equal(stripped.removedGetOccurrences, 1);
assert.equal(stripped.removedEmptySetOccurrences, 1);

for (const marker of [
  "event.target.closest?.('.prompt-editor__expand-btn')",
  'event.stopImmediatePropagation?.();',
  "sourceField.dispatchEvent(new TOP.Event('input', { bubbles: true }))",
  "sourceField.dispatchEvent(new TOP.Event('change', { bubbles: true }))",
  'data-pmm-editor-undo',
  'width:min(92%,660px);height:min(82%,680px)',
  'width:94%;height:82%;max-height:calc(100dvh - 24px)',
]) {
  assert.ok(editor.includes(marker), `预设正文全屏编辑缺少实现：${marker}`);
}
assert.ok(!/worldbook|data-wb|pmm-wb/iu.test(editor), '预设正文编辑器不得包含世界书功能或世界书标记');

assert.equal(manifest.hooks?.update, 'onUpdate', 'manifest 必须注册酒馆官方 update 钩子');
for (const marker of [
  'export function onUpdate()',
  'scheduleNativeSingleUpdateReload()',
  'bulkExtensionUpdateInProgress = true',
  'NATIVE_UPDATE_RELOAD_DELAY = 1_000',
  'RAPID_VERSION_CHECK_INTERVAL = 750',
  "document.addEventListener('click', handleNativeExtensionManagerClick, true)",
  "new URL('./preset-content-editor.js', import.meta.url)",
]) {
  assert.ok(entry.includes(marker), `更新刷新或预设编辑器入口缺少实现：${marker}`);
}

console.log(`移植回归通过：${isGecko ? 'Gecko' : '正式'}版已具备变量工具、更新刷新和独立预设正文全屏编辑，且不含世界书。`);
