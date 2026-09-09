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
assert.ok(nativeEntry.includes("const AUTO_CLOSE_EVENTS = ['mousedown', 'pointerdown', 'touchstart', 'click']"), '没有沿用已验证助手脚本的完整酒馆关闭事件集合');
assert.ok(nativeEntry.includes('guardedBody.addEventListener(type, preventNativePresetAutoClose'), '没有在 body 冒泡阶段拦住酒馆关闭来源页');
assert.ok(nativeEntry.includes('[class*="pmm-"]'), 'body 边界没有覆盖工坊相关元素');
assert.ok(nativeEntry.includes('#preset-manager-floating-panel, #preset-manager-main-panel'), 'body 边界没有显式覆盖程序化打开工坊的入口与主面板');
assert.ok(nativeEntry.includes('guardedBody.removeEventListener(type, preventNativePresetAutoClose)'), '卸载时没有清理 body 事件边界');

const overlay = section('function ensureOverlay()', 'function openOverlay()');
assert.ok(overlay.includes("for (const type of ['pointerdown', 'mousedown', 'touchstart', 'click'])"), '快照弹层没有覆盖酒馆的按下与点击关闭事件');
assert.ok(overlay.includes('overlay.addEventListener(type, event => event.stopPropagation()'), '快照弹层没有建立局部冒泡边界');
assert.ok(overlay.includes('if (event.target === overlay) closeOverlay()'), '局部事件边界破坏了点击遮罩关闭快照弹层');
assert.ok(overlay.includes("action === 'apply'"), '局部事件边界破坏了快照按钮操作');

console.log('test.85 回归通过：沿用助手脚本的 body 冒泡边界，打开及操作工坊均保留酒馆主预设来源页。');
