import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const tunerStart = source.indexOf('/* ===== PMM_MOBILE_LAYOUT_TUNER_V1');
const tunerEnd = source.indexOf('/* ===== PMM_FLOATING_PANEL_BATCH_V1', tunerStart);
const tuner = source.slice(tunerStart, tunerEnd);

assert.notEqual(tunerStart, -1, '找不到手机布局调节模块');
assert.notEqual(tunerEnd, -1, '找不到手机布局调节模块末尾');
assert.ok(tuner.includes("if (key === 'presetWidth') return LIMITS.presetWidth;"), '预设名称框没有使用固定独立范围');
assert.ok(tuner.includes("if (key === 'branchWidth') return LIMITS.branchWidth;"), '分支名称框没有使用固定独立范围');
assert.ok(!tuner.includes('presetWidthMaxOffset'), '预设名称框仍会被动态测量锁死');
assert.ok(!tuner.includes('branchWidthMaxOffset'), '分支名称框仍会被动态测量锁死');
assert.ok(!tuner.includes('maximumWidth - Math.max(...nativeWidths)'), '仍会用名称原始宽度反推滑杆上限');

const captureStart = tuner.indexOf('  function capturePresetViewportWidths()');
const captureEnd = tuner.indexOf('  function refreshHeaderWrapping()', captureStart);
const capture = tuner.slice(captureStart, captureEnd);
assert.ok(!capture.includes('header.dataset[datasetKey] !== mode'), '切换布局仍会把既有标题栏加入重测队列');
assert.ok(!capture.includes('header.style.removeProperty(viewportVariable);'), '切换布局仍会清空外层标题卡片宽度');
assert.ok(!capture.includes('header.style.removeProperty(nativeVariable);'), '切换布局仍会覆盖稳定的名称框宽度基准');
assert.ok(capture.includes('外层标题卡片和名称框原始宽度都只测一次'), '缺少外层标题卡片稳定宽度保护');
assert.ok(capture.includes("customKey:'presetWidth'"), '缺少预设名称框独立测量');
assert.ok(capture.includes("customKey:'branchWidth'"), '缺少分支名称框独立测量');

const applyStart = tuner.indexOf('  function applyState(save = false)');
const applyEnd = tuner.indexOf('  function _pmmBindAndroidRangeGestureGuard', applyStart);
const apply = tuner.slice(applyStart, applyEnd);
assert.ok(!apply.includes('capturePresetViewportWidths();'), '滑杆输入仍会重复测量两个名称框');

const syncStart = tuner.indexOf('  function sync()');
const syncEnd = tuner.indexOf('  function scheduleSync()', syncStart);
const sync = tuner.slice(syncStart, syncEnd);
assert.ok(sync.indexOf('capturePresetViewportWidths();') < sync.indexOf('applyState(false);'), '布局同步没有先取得稳定基准再应用设置');

console.log('v2.94 名称框独立调节回归通过：内层可加长，外层标题卡片在布局切换后保持稳定。');
