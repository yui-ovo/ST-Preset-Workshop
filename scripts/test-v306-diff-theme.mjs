import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
for (const marker of [
  'function applyContentDiffTheme(overlay, box, sourcePanel, mainRoot)',
  "read('--pm-panel-bg') || readBackground()",
  "box.style.setProperty(`--pmm-diff-${name}`, value, 'important');",
  'applyContentDiffTheme(overlay, box, sourcePanel, mainRoot);',
  'background: var(--pmm-diff-panel, var(--pm-panel-bg,#fff)) !important;',
  'background: var(--pmm-diff-card, var(--pm-card-bg,#fff)) !important;',
  '荧光标记 = 两侧真正不同的文字',
  'color-mix(in srgb, var(--pmm-diff-text, var(--pm-text-primary,#111827)) 24%, transparent)',
  'rgba(216,165,173,.62)',
  'rgba(155,181,203,.62)',
]) assert.ok(source.includes(marker), `对比详情主题跟随缺少实现：${marker}`);

assert.ok(source.indexOf('function applyContentDiffTheme') < source.indexOf('function showContentDiff'), '必须在打开详情前读取当前主题');
assert.ok(!source.includes('黄色荧光标记'), '差异说明不得固定写成黄色荧光标记');
assert.ok(!source.includes('rgba(253, 224, 71, .78)'), '差异荧光不得使用高亮黄色');
console.log('v3.06 对比详情主题测试通过：夜间和魔法棒主题会把当前工坊调色板带入详情弹窗。');
