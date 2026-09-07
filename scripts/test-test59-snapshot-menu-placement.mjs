import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位快照菜单片段：${startMarker}`);
  return source.slice(start, end);
}

const placement = section('function positionOpenSnapshotMenu(overlay)', 'function renderOverlay()');
assert.ok(placement.includes('overlay.appendChild(menu)'), '快照菜单没有脱离会裁切它的滚动列表');
assert.ok(placement.includes("dialog.querySelector('footer')"), '快照菜单没有把底部说明栏作为可用空间边界');
assert.ok(placement.includes('roomBelow < menuHeight'), '快照菜单没有检测下方剩余空间');
assert.ok(placement.includes("opensAbove ? 'up' : 'down'"), '快照菜单没有记录自适应展开方向');
assert.ok(placement.includes("menu.style.setProperty('position', 'fixed', 'important')"), '快照菜单没有使用脱离裁切区的浮层定位');

const render = section('function renderOverlay()', 'function ensureOverlay()');
assert.ok(render.includes('pmm-switch-snapshot-menu--pending'), '快照菜单定位完成前可能在旧位置闪烁');
assert.ok(render.includes('if (openMenuId) positionOpenSnapshotMenu(existing);'), '打开更多菜单后没有执行自适应定位');

assert.ok(source.includes('.pmm-switch-snapshot-menu--pending{visibility:hidden!important}'), '快照菜单缺少定位前隐藏样式');

console.log('test.59 回归通过：快照更多菜单脱离滚动列表，并按说明栏边界自动向上或向下完整展开。');
