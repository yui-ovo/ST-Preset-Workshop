import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const entry = await readFile(new URL('../dist/index.js', import.meta.url), 'utf8');
const workshop = (await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8')).replace(/pmmRuntimeResource\((\w+)\)/g, '$1');

assert.ok(entry.includes('iframe.hidden = true'), '正常浏览器版没有恢复 hidden 后台运行容器');
assert.ok(!entry.includes("left: '-10000px'"), '正常浏览器版仍包含 Gecko 屏幕外 iframe 补丁');
assert.ok(!entry.includes('Object.assign(iframe.style'), '正常浏览器版仍在强制改写 iframe 样式');
assert.ok(entry.includes("new URL('./workshop-v3.02.js', import.meta.url)"), '启动器没有指向 v2.69');

assert.ok(!workshop.includes('function keepRuntimeFrameRenderable()'), '正常浏览器业务入口仍包含 Gecko 后台自修复');
for (const snippet of [
  "b.innerHTML = '<i class=\"fa-solid fa-chevron-left\"></i>'",
  'lastDirectOpenAt = Date.now()',
  'void openManager()',
  "doc.addEventListener('pointerup', finishPointer, { passive: false, capture: true })",
  'html.pmm-mobile-toolbar-ready #pm-mobile-fab-standalone{display:none!important}',
  'V2.69 已加载',
]) {
  assert.ok(workshop.includes(snippet), `v2.69 缺少保留行为：${snippet}`);
}

console.log('v2.69 正常浏览器版测试通过：恢复 hidden 后台方式，并保留侧边入口与拖拽兼容功能。');
