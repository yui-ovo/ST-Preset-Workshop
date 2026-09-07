import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const worldbook = await readFile(new URL('../dist/worldbook-stitch-test3.js', import.meta.url), 'utf8');
const workshop = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

const autoStart = workshop.indexOf('let _pmmAutoScrollSpeed=0,_pmmAutoScrollHeartbeat=0;function Z(e){');
const autoEnd = workshop.indexOf('function ae(e){', autoStart);
assert.ok(autoStart >= 0 && autoEnd > autoStart, '无法定位安卓拖拽自动滚动实现');
const autoScroll = workshop.slice(autoStart, autoEnd);
assert.ok(autoScroll.includes('Date.now()-_pmmAutoScrollHeartbeat>140'), '自动滚动缺少拖拽事件失联保护');
assert.ok(autoScroll.includes('window.requestAnimationFrame'), '自动滚动没有改为逐帧调度');
assert.ok(autoScroll.includes('window.cancelAnimationFrame'), '自动滚动没有在结束时取消逐帧调度');
assert.ok(!autoScroll.includes('setInterval(()=>{p.value?p.value.scrollTop+=e:Ae()},16)'), '自动滚动仍使用持续定时器');
assert.ok(workshop.includes("onDragend:Ae}"), '拖拽松手时没有立即停止自动滚动');

const presetStart = workshop.indexOf('n.length>1&&(()=>{const h=window.parent&&window.parent.document?window.parent.document:document');
const presetEnd = workshop.indexOf('})())}function w(){', presetStart);
assert.ok(presetStart >= 0 && presetEnd > presetStart, '无法定位预设多选浮卡');
const presetFloat = workshop.slice(presetStart, presetEnd);
assert.ok(presetFloat.includes('will-change:transform'), '预设浮卡没有声明合成层优化');
assert.ok(presetFloat.includes('translate3d('), '预设浮卡没有使用合成层位移');
assert.ok(presetFloat.includes('requestAnimationFrame'), '预设浮卡没有逐帧合并跟手位置');
assert.ok(presetFloat.includes('pmmMultiDragPerf="lite"'), '预设浮卡没有标记安卓轻量模式');
assert.ok(presetFloat.includes('D.style.webkitBackdropFilter="none"'), '预设安卓浮卡没有关闭后层毛玻璃');
assert.ok(presetFloat.includes('E.style.webkitBackdropFilter="none"'), '预设安卓浮卡没有关闭前层毛玻璃');
assert.ok(!presetFloat.includes('t.getBoundingClientRect()'), '预设浮卡仍在每次拖动时强制读取布局');
assert.ok(presetFloat.includes('const c=a.x-99,d=a.y-29;'), '预设浮卡没有以手指为中心定位');
assert.ok(!presetFloat.includes('i>=12?i:l'), '预设浮卡仍会在左右两侧切换');
assert.ok(!presetFloat.includes('Math.max(12,o-198-20)'), '预设浮卡仍会为了留在屏幕内改变锚点');

for (const marker of [
  'const MULTI_DRAG_FLOAT_WIDTH = 198;',
  'let worldMultiDragFrame = 0;',
  'worldMultiDragPoint = { x, y };',
  'TOP.requestAnimationFrame(render)',
  'chip.style.transform = `translate3d(${horizontal}px, ${vertical}px, 0)`;',
  "chip.dataset.pmmWbMultiDragPerf = 'lite';",
  'will-change:transform',
  '[data-pmm-wb-multi-drag-perf="lite"]',
  '-webkit-backdrop-filter:none;backdrop-filter:none',
]) {
  assert.ok(worldbook.includes(marker), `世界书安卓浮卡缺少性能优化：${marker}`);
}
assert.ok(!worldbook.includes('worldMultiDragFloat.getBoundingClientRect()'), '世界书浮卡仍在每次拖动时强制读取布局');

const worldFloatStart = worldbook.indexOf('function positionWorldMultiDragFloat(event) {');
const worldFloatEnd = worldbook.indexOf('function showWorldMultiDragFloat(', worldFloatStart);
assert.ok(worldFloatStart >= 0 && worldFloatEnd > worldFloatStart, '无法定位世界书多选浮卡定位逻辑');
const worldFloat = worldbook.slice(worldFloatStart, worldFloatEnd);
assert.ok(worldFloat.includes('const horizontal = point.x - MULTI_DRAG_FLOAT_WIDTH / 2;'), '世界书浮卡没有以手指为水平中心');
assert.ok(worldFloat.includes('const vertical = point.y - MULTI_DRAG_FLOAT_HEIGHT / 2;'), '世界书浮卡没有以手指为垂直中心');
assert.ok(!worldFloat.includes('alternateLeft'), '世界书浮卡仍会在左右两侧切换');
assert.ok(!worldFloat.includes('Math.max(12, Math.min('), '世界书浮卡仍会为了留在屏幕内而改变锚点');

console.log('test.38 回归通过：安卓多选拖动逐帧跟手、居中浮卡、轻量样式与松手自动刹车均已覆盖。');
