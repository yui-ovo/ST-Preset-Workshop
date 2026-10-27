import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workshop = (await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8')).replace(/pmmRuntimeResource\((\w+)\)/g, '$1');

const fabStart = workshop.indexOf('function makeFab(doc)');
const fabEnd = workshop.indexOf('function visiblePanelContainer', fabStart);
assert.ok(fabStart >= 0 && fabEnd > fabStart, '无法隔离 v2.67 手机备用入口');
const fab = workshop.slice(fabStart, fabEnd);

const pointerDownStart = fab.indexOf('function onPointerDown(ev)');
const pointerDownEnd = fab.indexOf('function onPointerMove(ev)', pointerDownStart);
assert.ok(pointerDownStart >= 0 && pointerDownEnd > pointerDownStart, '无法隔离 pointerdown 处理');
const pointerDown = fab.slice(pointerDownStart, pointerDownEnd);
assert.ok(!pointerDown.includes('ev.preventDefault()'), 'pointerdown 仍会拦截 Gecko 后续点击事件');

for (const snippet of [
  'const WIDTH = 22',
  'const HEIGHT = 44',
  "b.innerHTML = '<i class=\"fa-solid fa-chevron-left\"></i>'",
  "snap === 'left' ? 'fa-chevron-right' : 'fa-chevron-left'",
  'snap = center <= vp.w / 2',
  'lastDirectOpenAt = Date.now()',
  'void openManager()',
  'Date.now() - lastDirectOpenAt < 650',
  "doc.addEventListener('pointermove', onPointerMove, { passive: false, capture: true })",
  "doc.addEventListener('pointerup', finishPointer, { passive: false, capture: true })",
  'unbindDocumentPointerTracking()',
  'async function waitForVisibleMainPanel(timeout = 1400)',
  '入口已响应，但面板没有成功挂载',
]) {
  assert.ok(fab.includes(snippet), `Gecko 入口缺少关键行为：${snippet}`);
}

const finishStart = fab.indexOf('function finishPointer(ev)');
const finishEnd = fab.indexOf('function cancelPointer(ev)', finishStart);
const finish = fab.slice(finishStart, finishEnd);
assert.ok(finish.includes('if (moved)'), 'pointerup 没有区分拖动和轻点');
assert.ok(finish.includes('lastDirectOpenAt = Date.now()'), '轻点没有记录直接打开时间');
assert.ok(finish.includes('void openManager()'), '轻点仍依赖可能被 Gecko 吞掉的 click');

const cssStart = workshop.indexOf('#pm-mobile-fab-standalone {');
const cssEnd = workshop.indexOf('/* 1.3.11', cssStart);
assert.ok(cssStart >= 0 && cssEnd > cssStart, '无法隔离备用入口样式');
const css = workshop.slice(cssStart, cssEnd);
for (const snippet of [
  'width: 22px !important',
  'height: 44px !important',
  'border-radius: 0 9px 9px 0 !important',
  'border-radius: 9px 0 0 9px !important',
  'background: var(--SmartThemeBlurTintColor',
  'color: var(--SmartThemeBodyColor',
]) {
  assert.ok(css.includes(snippet), `侧边箭头缺少样式：${snippet}`);
}
assert.ok(!css.includes('border-radius: 50%'), '备用入口仍是旧的圆形按钮');
assert.ok(!css.includes('translateX(-29px)'), '左侧入口仍被推出屏幕');
assert.ok(!css.includes('translateX(29px)'), '右侧入口仍被推出屏幕');

assert.ok(workshop.includes('V2.67 已加载'), '缺少 v2.67 运行标记');
assert.ok(workshop.includes('html.pmm-mobile-toolbar-ready #pm-mobile-fab-standalone{display:none!important}'), '新版悬浮工具栏就绪后没有隐藏备用箭头');

console.log('v2.67 Gecko 入口测试通过：轻点由 pointerup 直接打开，跨 document 拖动可换边，备用入口统一为侧边箭头。');
