import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(
  process.env.PMM_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.PMM_PLAYWRIGHT_MODULE).href
    : 'playwright'
);

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const moduleStart = source.indexOf("const API_KEY = '__PMM_DESKTOP_FOUR_CORNER_RESIZE__';");
const styleStart = source.indexOf('    style.textContent = `', moduleStart);
const cssStart = source.indexOf('`', styleStart) + 1;
const cssEnd = source.indexOf('\n    `;', cssStart);
assert.ok(moduleStart >= 0 && styleStart > moduleStart && cssEnd > cssStart, '无法提取桌面缩放样式');
const resizeCss = source.slice(cssStart, cssEnd);

const html = `<!doctype html><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  #preset-manager-main-panel { padding: 24px; }
  .pm-panel-container { position: relative; display: flex; align-items: stretch; width: 600px; height: 500px; }
  .pm-main-wrapper { position: relative; display: flex; align-items: stretch; }
  .preset-panel { width: 600px; max-width: 600px; height: 500px; flex: 0 0 auto; background: #eee; border: 1px solid #333; }
  .side-panel-root { position: absolute; right: 0; top: 50%; transform: translateY(-50%) translateX(100%); width: 16px; height: 220px; background: #555; }
  ${resizeCss}
</style>
<div id="preset-manager-main-panel" class="pmm-mobile-layout-enabled">
  <div class="pm-panel-container pmm-desktop-custom-sized" style="--pmm-custom-panel-width: 1000px; --pmm-custom-panel-height: 500px">
    <div class="pm-main-wrapper">
      <section class="preset-panel">实际可见的主面板</section>
      <aside class="side-panel-root">侧栏</aside>
    </div>
  </div>
</div>`;

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.setContent(html);

  const desktop = await page.evaluate(() => {
    const container = document.querySelector('.pm-panel-container').getBoundingClientRect();
    const wrapper = document.querySelector('.pm-main-wrapper').getBoundingClientRect();
    const panel = document.querySelector('.preset-panel').getBoundingClientRect();
    const side = document.querySelector('.side-panel-root').getBoundingClientRect();
    return { container, wrapper, panel, side };
  });
  const closeEnough = (a, b) => Math.abs(a - b) < 1;

  assert.ok(closeEnough(desktop.container.width, 1000), '桌面自定义宽度必须作用于外层容器');
  assert.ok(closeEnough(desktop.wrapper.width, desktop.container.width), '主包装器必须占满缩放后的外层容器');
  assert.ok(closeEnough(desktop.panel.width, desktop.wrapper.width), '实际主面板必须随缩放容器变宽');
  assert.ok(closeEnough(desktop.panel.right, desktop.wrapper.right), '实际主面板右边缘必须与侧栏锚点所在包装器重合');
  assert.ok(closeEnough(desktop.side.left, desktop.wrapper.right), '侧栏的可见起点必须紧贴实际主面板右边缘');

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileWidth = await page.locator('.pm-panel-container').evaluate(node => node.getBoundingClientRect().width);
  assert.ok(closeEnough(mobileWidth, 600), '窄视口不应套用桌面自定义尺寸规则');
  await page.close();

  console.log('test.100 回归通过：桌面缩放同步实际主面板和侧栏锚点，带有移动布局类时仍生效，窄视口不套用桌面尺寸。');
} finally {
  await browser.close();
}
