import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const layoutStart = source.indexOf('/* ===== PMM_MOBILE_LAYOUT_TUNER_V1：手机版布局调节测试版 ===== */');
const layoutEnd = source.indexOf('/* ===== PMM_FLOATING_PANEL_BATCH_V1', layoutStart);
assert.ok(layoutStart >= 0 && layoutEnd > layoutStart, '无法定位手机布局调节模块');
const layout = source.slice(layoutStart, layoutEnd);

assert.ok(layout.includes('@media (max-width:374px){'), '窄手机没有专用标题栏保护');
assert.ok(layout.includes('--pmm-title-viewport-width:130px!important'), '窄手机没有收回标题卡片宽度');
assert.ok(layout.includes('.pm-panel-container > .pm-main-wrapper .pm-header'), '窄手机保护没有覆盖主预设标题栏');
assert.ok(layout.includes('.pm-panel-container--merge-mode > .preset-panel .pm-header'), '窄手机保护没有覆盖分屏标题栏');
assert.ok(layout.includes('--pmm-title-viewport-width:150px!important'), '常规手机标题卡片默认宽度被误改');
assert.ok(!layout.includes('IS_ANDROID') || layout.includes('function _pmmBindAndroidRangeGestureGuard'), '标题栏保护不应依赖安卓 UA 分支');

console.log('test.76 回归通过：极窄手机会为最右关闭键收回标题卡片空间，常规手机布局保持不变。');
