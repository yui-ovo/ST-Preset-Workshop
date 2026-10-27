import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8')).replace(/pmmRuntimeResource\((\w+)\)/g, '$1');
const start = source.indexOf('/* ===== PMM_THEMED_COMPARE_DRAG_LINE_V289');
assert.ok(start >= 0, '缺少 v2.89 原版主题落点线兼容补丁');
const patch = source.slice(start);

assert.ok(!patch.includes('::after'), '仍在使用 v2.88 的独立粗线伪元素');
assert.ok(!patch.includes('#2688ff'), '仍在强制使用固定蓝色');
assert.ok(
  patch.includes('0 -3px 0 0 var(--pm-accent, #6366f1)'),
  '上方落点线没有恢复原版主题色与细线尺寸',
);
assert.ok(
  patch.includes('0 3px 0 0 var(--pm-accent, #6366f1)'),
  '下方落点线没有恢复原版主题色与细线尺寸',
);
assert.ok(
  patch.includes('.prompt-card.prompt-card--drop-before'),
  '上方落点选择器优先级不足，可能再次被差异样式覆盖',
);
assert.ok(
  patch.includes('.prompt-card.prompt-card--drop-after'),
  '下方落点选择器优先级不足，可能再次被差异样式覆盖',
);
assert.ok(
  patch.includes('V2.89 已加载：已恢复原版随主题变化的细落点线'),
  '缺少 v2.89 修复标记',
);

console.log('v2.89 主题落点线测试通过：原版细线随主题变化，并可覆盖显示在对比差异边框上。');
