import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位原生抽屉事件边界：${startMarker}`);
  return source.slice(start, end);
}

const nativeEntry = section('PMM_NATIVE_PRESET_ENTRY_TEST80', ';(()=>{\n  /* 预设工坊 × 柏宝箱',);
assert.ok(nativeEntry.includes("for (const type of ['pointerdown', 'mousedown', 'touchstart'])"), '原生入口没有拦住酒馆按下阶段的自动关闭');
assert.ok(nativeEntry.includes('button.addEventListener(type, event => event.stopPropagation()'), '原生入口事件没有在按钮自身终止冒泡');
assert.ok(nativeEntry.includes("button.addEventListener('click', event =>"), '原生入口点击没有使用受控事件处理');
assert.ok(!nativeEntry.includes('DOC.body.addEventListener'), '原生入口不应使用影响全页面的 body 拦截器');

const overlay = section('function ensureOverlay()', 'function openOverlay()');
assert.ok(overlay.includes("for (const type of ['pointerdown', 'mousedown', 'touchstart', 'click'])"), '快照弹层没有覆盖酒馆的按下与点击关闭事件');
assert.ok(overlay.includes('overlay.addEventListener(type, event => event.stopPropagation()'), '快照弹层没有建立局部冒泡边界');
assert.ok(overlay.includes('if (event.target === overlay) closeOverlay()'), '局部事件边界破坏了点击遮罩关闭快照弹层');
assert.ok(overlay.includes("action === 'apply'"), '局部事件边界破坏了快照按钮操作');

const capturePanel = section('const captureEventBoundaryNodes = new WeakSet()', 'async function exitCaptureMode');
assert.ok(capturePanel.includes("['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click']"), '快照面板没有覆盖触屏完整点击周期');
assert.ok(capturePanel.includes("container.classList.contains('pmm-switch-snapshot-capture-mode')"), '快照面板事件边界没有限制在录制模式');
assert.ok(capturePanel.includes('event.stopPropagation()'), '快照面板条目操作仍会冒泡到酒馆原生抽屉');
assert.ok(capturePanel.includes('if (container) bindCaptureEventBoundary(container)'), '快照面板重绘后没有重新挂载事件边界');

console.log('test.85 回归通过：原生入口、快照弹层与录制面板只在自身截断事件，操作快照不会关闭酒馆主预设抽屉。');
