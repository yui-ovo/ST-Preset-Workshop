import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const moduleStartMarker = '/* ===== PMM_SWITCH_SNAPSHOTS_TEST52：完整开关快照与预设默认（测试版） ===== */';
const moduleEndMarker = '/* ===== PMM_THEMED_COMPARE_DRAG_LINE_V289';
const start = source.indexOf(moduleStartMarker);
const end = source.indexOf(moduleEndMarker, start);
assert.ok(start >= 0 && end > start, '无法定位完整开关快照模块');
const snapshots = source.slice(start, end);

function section(startMarker, endMarker) {
  const sectionStart = snapshots.indexOf(startMarker);
  const sectionEnd = snapshots.indexOf(endMarker, sectionStart);
  assert.ok(sectionStart >= 0 && sectionEnd > sectionStart, '无法定位快照片段：' + startMarker);
  return snapshots.slice(sectionStart, sectionEnd);
}

assert.ok(snapshots.includes('let snapshotViewportCleanup = null;'), '快照没有保存可视区域监听清理器');

const viewportBinding = section('function isSnapshotMobile(view)', 'function closeOverlay()');
for (const required of [
  'function bindSnapshotToVisibleViewport(overlay, ownerDocument)',
  'ownerDocument?.defaultView || TOP || SELF',
  'const viewport = view.visualViewport',
  'view.scrollX || view.pageXOffset',
  'view.scrollY || view.pageYOffset',
  'viewport?.offsetLeft',
  'viewport?.offsetTop',
  'viewport?.width || view.innerWidth',
  'viewport?.height || view.innerHeight',
  "overlay.style.setProperty('position', useFixedKeyboardViewport ? 'fixed' : 'absolute', 'important')",
  "overlay.style.setProperty('inset', 'auto', 'important')",
  "overlay.style.setProperty('--pmm-switch-snapshot-visible-height'",
  "viewport?.addEventListener?.('resize', scheduleUpdate",
  "viewport?.addEventListener?.('scroll', scheduleUpdate",
  "view.addEventListener?.('resize', scheduleUpdate",
  "view.addEventListener?.('scroll', scheduleUpdate",
  "view.addEventListener?.('orientationchange', onOrientationChange",
  'timeout?.(scheduleUpdate, 120)',
  'snapshotViewportCleanup = () =>',
  "viewport?.removeEventListener?.('resize', scheduleUpdate)",
  "viewport?.removeEventListener?.('scroll', scheduleUpdate)",
  "view.removeEventListener?.('orientationchange', onOrientationChange)",
]) {
  assert.ok(viewportBinding.includes(required), '手机快照可视区域修复缺少：' + required);
}
assert.ok(viewportBinding.includes('if (!overlay || !isSnapshotMobile(view)) return;'), '桌面端不应绑定手机可视区域监听');
assert.ok(viewportBinding.includes('if (!isSnapshotMobile(view)) {'), '横竖屏切换到桌面宽度时没有恢复默认定位');

const closeOverlay = section('function closeOverlay()', 'function openComposer()');
assert.ok(closeOverlay.includes('unbindSnapshotViewport()'), '关闭快照时没有清理可视区域监听');

const ensureOverlay = section('function ensureOverlay()', 'function openOverlay()');
assert.ok(ensureOverlay.includes('DOC.body.appendChild(overlay)'), '快照遮罩不再挂在外层页面 body');
assert.ok(ensureOverlay.includes('bindSnapshotToVisibleViewport(overlay, overlay.ownerDocument || DOC)'), '快照遮罩创建后没有绑定真实可视区域');

const stylesheet = section('function installStyle()', 'function scheduleMount()');
assert.ok(stylesheet.includes('.pmm-switch-snapshot-overlay{position:fixed!important;inset:0!important'), '桌面端快照遮罩基准定位被误改');
for (const required of [
  '--pmm-switch-snapshot-safe-top',
  '--pmm-switch-snapshot-safe-right',
  '--pmm-switch-snapshot-safe-bottom',
  '--pmm-switch-snapshot-safe-left',
  'env(safe-area-inset-top,0px)',
  'env(safe-area-inset-right,0px)',
  'env(safe-area-inset-bottom,0px)',
  'env(safe-area-inset-left,0px)',
  'var(--pmm-switch-snapshot-visible-height,100dvh)',
]) {
  assert.ok(stylesheet.includes(required), '手机快照安全区／高度约束缺少：' + required);
}

console.log('test.75 回归通过：手机快照遮罩按 visualViewport、滚动、旋转和安全区重新定位，桌面基准保持不变。');
