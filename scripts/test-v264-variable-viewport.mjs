import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workshop = (await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8')).replace(/pmmRuntimeResource\((\w+)\)/g, '$1');

for (const snippet of [
  'function mountDialogInVisibleViewport(dialog)',
  'const viewport = win.visualViewport',
  'viewport.offsetLeft',
  'viewport.offsetTop',
  'viewport.width',
  'viewport.height',
  "viewport?.addEventListener('resize', position)",
  "viewport?.addEventListener('scroll', position)",
  "win.addEventListener('orientationchange', onOrientation)",
  'dialog.__pmmVariableViewportCleanup?.()',
  'z-index:2147483000!important',
  'isolation:isolate',
  'env(safe-area-inset-bottom)',
  'max-height:min(72dvh,620px)',
]) {
  assert.ok(workshop.includes(snippet), `v2.64 缺少手机弹层可视区域修复：${snippet}`);
}

assert.equal(
  (workshop.match(/mountDialogInVisibleViewport\(overlay\)/g) || []).length,
  3,
  'S 菜单、变量名弹窗和批量选择弹窗没有全部使用真实可视区域定位',
);
assert.ok(
  workshop.indexOf('DOC.body.appendChild(dialog)') < workshop.indexOf("dialog.style.left = `${Math.round(viewport.offsetLeft)}px`"),
  '弹层没有先挂到最外层 body 再定位',
);

console.log('v2.64 S/G 弹层测试通过：三类弹窗均跟随 visualViewport、安全区、横竖屏并保持最高层级。');
