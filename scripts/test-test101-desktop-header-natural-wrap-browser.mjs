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
assert.ok(moduleStart >= 0 && styleStart > moduleStart && cssEnd > cssStart, '无法提取桌面顶部布局样式');
const resizeCss = source.slice(cssStart, cssEnd);

const html = `<!doctype html><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  #preset-manager-main-panel { padding: 24px; }
  .preset-panel { width: 760px; background: #eee; border: 1px solid #333; }
  .pm-header { display: flex; align-items: center; justify-content: space-between; min-height: 80px; padding: 12px 16px; gap: 8px; }
  .header-left { display: flex; align-items: center; min-width: 0; }
  .title-card { width: 252px; height: 42px; background: #ddd; }
  .header-right { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
  .header-right > * { width: 38px; height: 36px; border: 0; }
  .header-right > .theme-switch-card { width: 64px; }
  ${resizeCss}
</style>
<div id="preset-manager-main-panel" class="pmm-mobile-layout-enabled">
  <section class="preset-panel">
    <header class="pm-header">
      <div class="header-left"><div class="title-card">预设名称</div></div>
      <div class="header-right">
        <button>缝合</button><button>分支</button><button>收藏</button><button>世界书</button><button>正则</button><button class="theme-switch-card">主题</button>
      </div>
    </header>
  </section>
</div>`;

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.setContent(html);
  const readLayout = () => page.evaluate(() => {
    const header = document.querySelector('.pm-header').getBoundingClientRect();
    const left = document.querySelector('.header-left').getBoundingClientRect();
    const right = document.querySelector('.header-right').getBoundingClientRect();
    const headerNode = document.querySelector('.pm-header');
    return { header, left, right, scrollWidth: headerNode.scrollWidth, clientWidth: headerNode.clientWidth };
  });

  const wide = await readLayout();
  assert.ok(Math.abs((wide.left.top + wide.left.height / 2) - (wide.right.top + wide.right.height / 2)) < 1, '宽度充足时标题与工具组必须保持同一行');
  assert.ok(wide.scrollWidth <= wide.clientWidth + 1, '宽度充足时顶部不能横向溢出');

  await page.locator('.preset-panel').evaluate(node => { node.style.width = '480px'; });
  const narrow = await readLayout();
  assert.ok(narrow.right.top > narrow.left.top + 20, '宽度不足时右侧整组工具必须进入第二行');
  assert.ok(narrow.header.height > wide.header.height + 20, '换行后顶部应自然增高，而不是把按钮挤出面板');
  assert.ok(narrow.scrollWidth <= narrow.clientWidth + 1, '窄面板换行后顶部不能横向溢出');
  assert.ok(narrow.right.width < narrow.clientWidth, '第二行完整工具组必须能放进面板内容宽度');

  await page.setViewportSize({ width: 700, height: 844 });
  const mobileFlexWrap = await page.locator('.pm-header').evaluate(node => getComputedStyle(node).flexWrap);
  assert.equal(mobileFlexWrap, 'nowrap', '窄屏移动视口不应套用桌面顶部换行规则');
  await page.close();

  console.log('test.101 回归通过：宽桌面单行、窄桌面整组工具换到第二行且无横向溢出，移动视口保持原有布局。');
} finally {
  await browser.close();
}
