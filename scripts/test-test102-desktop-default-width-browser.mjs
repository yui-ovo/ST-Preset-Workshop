import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(
  process.env.PMM_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.PMM_PLAYWRIGHT_MODULE).href
    : 'playwright'
);

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const splitRatioMarker = source.indexOf('--pmm-user-split-left:52fr');
const splitStart = source.lastIndexOf('#preset-manager-main-panel.pmm-mobile-layout-enabled{', splitRatioMarker);
const splitEnd = source.indexOf('\n  }', splitStart) + 4;
const titleStart = source.indexOf('#preset-manager-main-panel .pm-panel-container--merge-mode .pm-header>.header-left,', splitRatioMarker);
const titleEnd = source.indexOf('\n    }', titleStart) + 6;
const splitRule = source.slice(splitStart, splitEnd);
const titleRule = source.slice(titleStart, titleEnd);

assert.ok(splitRatioMarker >= 0 && splitStart >= 0 && splitEnd > splitStart, '无法提取桌面双屏默认比例规则');
assert.ok(titleStart >= 0 && titleEnd > titleStart, '无法提取桌面双屏标题框规则');
assert.ok(splitRule.includes('--pmm-user-split-left:52fr'), '桌面双屏兜底必须给左面板 52% 宽度');
assert.ok(splitRule.includes('--pmm-user-split-right:48fr'), '桌面双屏兜底必须给右面板 48% 宽度');
assert.ok(titleRule.includes('clamp(220px,18vw,240px)'), '标题框必须只在宽屏时适度加宽');

const html = `<!doctype html><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  #preset-manager-main-panel { padding: 16px; }
  .pm-panel-container--branch-mode {
    display: grid;
    grid-template-columns: minmax(220px, var(--pmm-user-split-left)) 72px minmax(220px, var(--pmm-user-split-right));
    gap: 6px;
    width: 1312px;
  }
  .preset-panel { min-width: 0; }
  .preset-panel--left { grid-column: 1; }
  .preset-panel--right { grid-column: 3; }
  .pm-header { display: flex; min-height: 60px; }
  .header-left { flex: 0 0 180px; width: 180px; }
  @media screen and (min-width: 769px) { ${splitRule} }
  @media (min-width: 1024px) { ${titleRule} }
</style>
<main id="preset-manager-main-panel" class="pmm-mobile-layout-enabled">
  <section class="pm-panel-container--branch-mode">
    <article class="preset-panel preset-panel--left"><header class="pm-header"><div class="header-left"></div></header></article>
    <aside></aside>
    <article class="preset-panel preset-panel--right"><header class="pm-header"><div class="header-left"></div></header></article>
  </section>
</main>`;

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.setContent(html);
  const wide = await page.evaluate(() => {
    const panels = [...document.querySelectorAll('.preset-panel')].map(node => node.getBoundingClientRect().width);
    const titleWidth = document.querySelector('.header-left').getBoundingClientRect().width;
    return { panels, titleWidth };
  });
  assert.ok(wide.panels[0] > wide.panels[1], '桌面默认双屏必须让左侧比右侧略宽');
  assert.ok(Math.abs(wide.panels[0] / wide.panels[1] - 52 / 48) < 0.02, '双屏默认比例必须稳定为 52:48');
  assert.equal(Math.round(wide.titleWidth), 240, '宽屏有余白时标题框应扩展到 240px');

  await page.setViewportSize({ width: 1100, height: 900 });
  const compactTitleWidth = await page.locator('.header-left').first().evaluate(node => node.getBoundingClientRect().width);
  assert.equal(Math.round(compactTitleWidth), 220, '较窄桌面标题框应保留 220px，给工具组留出空间');

  await page.setViewportSize({ width: 700, height: 900 });
  const mobileTitleWidth = await page.locator('.header-left').first().evaluate(node => node.getBoundingClientRect().width);
  assert.equal(Math.round(mobileTitleWidth), 180, '移动视口不能套用桌面标题框加宽规则');
  await page.close();

  console.log('test.102 回归通过：桌面双屏默认 52:48、标题框仅在宽屏适度加宽，窄桌面和移动端保留紧凑宽度。');
} finally {
  await browser.close();
}
