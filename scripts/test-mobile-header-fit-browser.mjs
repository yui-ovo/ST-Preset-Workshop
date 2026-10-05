import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const { chromium } = await import(process.env.PMM_PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PMM_PLAYWRIGHT_MODULE).href : 'playwright');
const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
function templateAfter(marker, from = 0) {
  const start = source.indexOf(marker, from);
  assert.ok(start >= 0, `Missing style: ${marker}`);
  const begin = source.indexOf('`', start) + 1;
  const end = source.indexOf('`;', begin);
  const css = source.slice(begin, end);
  assert.ok(end > begin && !css.includes('${'), 'Fixture must load literal production CSS');
  return css;
}
const nativeCss = [...source.matchAll(/\.push\(\[e\.id,('(?:\\.|[^'\\])*'),/g)]
  .map(match => runInNewContext(match[1])).join('\n');
assert.ok(nativeCss.includes('.header-right[data-v-71128760]'), 'Missing native header styles');
const baseCss = templateAfter('  const CSS = `');
const layoutCss = templateAfter('    style.textContent = `', source.indexOf('/* ===== PMM_MOBILE_LAYOUT_TUNER_V1'));
const desktopCss = templateAfter('    style.textContent = `', source.indexOf("const API_KEY = '__PMM_DESKTOP_FOUR_CORNER_RESIZE__';"));
const syncStart = source.indexOf('  function refreshHeaderWrapping()');
const syncEnd = source.indexOf('  function applyState(', syncStart);
assert.ok(syncStart > 0 && syncEnd > syncStart);
const syncCode = source.slice(syncStart, syncEnd);
const actions = ['平铺', '取消分组', '比对', '多选', '搜索', '撤销', '保存'];
function header(id) {
  return `<header class="pm-header" id="${id}">
    <div class="header-left"><div class="header-card title-card"><div class="title-content">
      <div class="title-row"><select class="title-select"><option>【Ako】很长的预设名称</option></select><button class="pmm-preset-search-btn" title="选择预设">⌕</button><button class="title-edit-btn" title="重命名">✎</button></div>
      <div class="title-actions"><button class="title-action-btn" title="导入">↓</button><button class="title-action-btn" title="导出">↑</button></div>
    </div></div></div>
    <div class="header-right">
      ${actions.slice(0, 2).map((title, i) => `<button class="header-card action-card" title="${title}"><span class="card-icon">${['☷', '▣'][i]}</span></button>`).join('')}
      <div class="header-card theme-switch-card"><button class="theme-btn" title="主题">☼</button></div>
      <button class="fixture-toggle" title="开关">◉</button>
      ${actions.slice(2).map((title, i) => `<button class="header-card action-card" title="${title}"><span class="card-icon">${['⇄', '✓', '⌕', '↶', '▣'][i]}</span></button>`).join('')}
      <button class="header-card close-card" title="关闭">×</button>
    </div>
  </header>`;
}
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const output = new URL('../../outputs/mobile-header-fit/', import.meta.url);
await mkdir(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>${nativeCss}\n${baseCss}\n${layoutCss}\n${desktopCss}
    body{margin:0;background:#e4e8e9;font:16px sans-serif}
    #preset-manager-main-panel{--pm-text-primary:#26373d;--pm-text-secondary:#64777d;--pm-control-bg:#edf2f4;--pm-border:#c6cfd2;--pm-bar-bg:#f4f7f8;--pm-panel-bg:#fff}
    /* Fixture supplies panel bounds; header and button sizing comes from shipped CSS. */
    #preset-manager-main-panel .pm-panel-container{position:relative!important;inset:auto!important;width:calc(100% - 24px)!important;max-width:none!important;height:auto!important;min-height:0!important;max-height:none!important;margin:20px 12px!important;transform:none!important;display:flex!important;flex-direction:column!important;gap:24px!important}
    #preset-manager-main-panel .pm-main-wrapper,#preset-manager-main-panel .preset-panel{width:100%!important;min-width:0!important;max-width:none!important;flex:none!important;height:auto!important}
    .fixture-content{padding:24px;background:#fff;color:#64777d;height:160px}
    .fixture-toggle{flex:0 0 26px;width:26px;height:26px;padding:0}
    .pm-header button{cursor:pointer}
    </style><div id="preset-manager-main-panel" class="pmm-mobile-layout-enabled"><div class="pm-panel-container pm-panel-container--merge-mode">
      <div class="pm-main-wrapper">${header('primary')}<div class="fixture-content">上方预设</div></div>
      <div class="preset-panel">${header('secondary')}<div class="fixture-content">下方预设</div></div>
    </div></div><script>
      document.querySelectorAll('.pm-header,.pm-header *').forEach(node=>node.setAttribute('data-v-71128760',''));
      window.clicks=[];document.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>window.clicks.push(button.closest('header').id+':'+button.title)));
      const root=document.querySelector('#preset-manager-main-panel');
      const isMobile=()=>matchMedia('(max-width:768px)').matches;
      ${syncCode}
      window.syncHeaders=refreshHeaderWrapping;
      syncHeaders();
    </script>`;
  await page.setContent(html);
  async function inspect(label) {
    await page.evaluate(() => { for(let i=0;i<3;i++) syncHeaders(); });
    const results = await page.evaluate(() => [...document.querySelectorAll('.pm-header')].map(header => {
      const rect = header.getBoundingClientRect();
      const close = header.querySelector(':scope > .pmm-mobile-header-close');
      if (header.querySelectorAll('.pmm-mobile-header-close').length !== 1) throw new Error('Duplicate or missing mobile close');
      const closeRect = close.getBoundingClientRect();
      const leftRect = header.querySelector('.header-left').getBoundingClientRect();
      const rightRect = header.querySelector('.header-right').getBoundingClientRect();
      return {
        id: header.id, width: rect.width, height: rect.height, inViewport: rect.left >= 0 && rect.right <= innerWidth + 1, overflow: header.scrollWidth - header.clientWidth,
        wrapped: rightRect.top >= leftRect.bottom,
        closeAtTop: Math.abs(closeRect.top - rect.top - 7 * Number(getComputedStyle(document.querySelector('#preset-manager-main-panel')).zoom)) < 1,
        controls: [close].map(button => {
          const r = button.getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return { title: button.title, visible: r.width > 0 && r.left >= rect.left && r.right <= rect.right + 1 && r.top >= rect.top && r.bottom <= rect.bottom + 1,
            clickable: button === hit || button.contains(hit),
            hit: hit?.outerHTML.slice(0, 250), rect: r.toJSON(),
            overlapsClose: button !== close && r.left < closeRect.right && r.right > closeRect.left && r.top < closeRect.bottom && r.bottom > closeRect.top };
        }),
      };
    }));
    for (const result of results) {
      assert.ok(result.overflow <= 1, `${label}/${result.id}: header overflow ${JSON.stringify(result)}`);
      assert.ok(result.inViewport, `${label}/${result.id}: fixture must fit in viewport`);
      assert.ok(result.closeAtTop, `${label}/${result.id}: close button must stay at top right`);
      assert.ok(!result.wrapped, `${label}/${result.id}: tools must stay on the title row`);
      const expectedHeight = await page.evaluate(() => 46 * Number(getComputedStyle(document.querySelector('#preset-manager-main-panel')).zoom));
      assert.ok(Math.abs(result.height - expectedHeight) <= 1, `${label}/${result.id}: header must remain one row high`);
      for (const button of result.controls) assert.ok(button.visible && button.clickable && !button.overlapsClose, `${label}/${result.id}: ${JSON.stringify(button)}`);
      const countBefore = await page.evaluate(id => window.clicks.filter(value=>value===id+':关闭').length, result.id);
      await page.locator(`#${result.id} > .pmm-mobile-header-close`).tap();
      assert.equal(await page.evaluate(id => window.clicks.filter(value=>value===id+':关闭').length, result.id), countBefore+1, 'Proxy must invoke the native close exactly once');
      // Every offscreen tool must be reachable, while close remains visible and stationary.
      const toolbar = page.locator(`#${result.id} .header-right`);
      const closeBefore = await page.locator(`#${result.id} > .pmm-mobile-header-close`).boundingBox();
      const buttons = toolbar.locator('button:not(.close-card)');
      for (let i = 0; i < await buttons.count(); i++) {
        const button = buttons.nth(i);
        await button.evaluate(node => {
          const group = node.closest('.header-right');
          const rect = node.getBoundingClientRect();
          const bounds = group.getBoundingClientRect();
          const zoom = Number(getComputedStyle(document.querySelector('#preset-manager-main-panel')).zoom);
          group.scrollLeft += (rect.x + rect.width / 2 - bounds.x - bounds.width / 2) / zoom;
        });
        const reachable = await button.evaluate(node => {
          const r = node.getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return hit === node || node.contains(hit);
        });
        assert.ok(reachable, `${label}/${result.id}: tool ${i} must be reachable by scrolling`);
        await button.tap();
      }
      const closeAfter = await page.locator(`#${result.id} > .pmm-mobile-header-close`).boundingBox();
      assert.ok(Math.abs(closeAfter.x - closeBefore.x) < 1 && Math.abs(closeAfter.y - closeBefore.y) < 1, 'Scrolling must not move close');
      await page.locator(`#${result.id} > .pmm-mobile-header-close`).tap();
      await toolbar.evaluate(node => { node.scrollLeft = 0; });
    }
    return results;
  }
  for (const width of [280, 320, 360, 375, 390, 461, 600, 768]) {
    await page.setViewportSize({ width, height: 1100 });
    const result = await inspect(`viewport ${width}`);
    if (width === 320) assert.ok(result.every(item => !item.wrapped), 'Narrow header must scroll tools without wrapping');
    if (width === 600) assert.ok(result.every(item => !item.wrapped), 'Wide mobile header must stay single row');
    if ([320, 390, 461].includes(width)) await page.screenshot({ path: fileURLToPath(new URL(`${width}.png`, output)) });
  }
  await page.setViewportSize({ width: 390, height: 1100 });
  // Reproduce toolbar clipping even in Chromium: the close must not depend on
  // an absolutely positioned descendant escaping a scrolling/composited layer.
  await page.addStyleTag({content:'.header-right{transform:translateZ(0)!important;contain:paint!important}'});
  await inspect('composited and clipped toolbar');
  await page.screenshot({path:fileURLToPath(new URL('independent-close.png',output))});
  // Enlarge the rendered UI within the same viewport, including a wider theme button group.
  await page.evaluate(() => {
    document.querySelector('#preset-manager-main-panel').style.zoom = '1.25';
    document.querySelector('#preset-manager-main-panel').style.setProperty('width', '80%', 'important');
    document.documentElement.style.fontSize = '22px';
    document.querySelectorAll('.theme-switch-card').forEach(group=>group.insertAdjacentHTML('beforeend','<button class="theme-btn" title="深色">☾</button><button class="theme-btn" title="自动">✦</button>'));
    document.querySelector('#preset-manager-main-panel').classList.add('pmm-layout-custom-preset-width');
    document.querySelector('#preset-manager-main-panel').style.setProperty('--pmm-user-preset-width-offset','180px');
  });
  await inspect('125% rendered UI, larger font, extra themes and custom title');
  await page.screenshot({ path: fileURLToPath(new URL('large-ui.png', output)) });
  await page.evaluate(() => { const root=document.querySelector('#preset-manager-main-panel'); root.style.zoom = ''; root.style.removeProperty('width'); });
  await page.setViewportSize({ width: 312, height: 1100 });
  await inspect('125% effective viewport, larger font, extra themes and custom title');
  // Re-enter a normal single panel without reloading styles.
  await page.evaluate(() => { document.querySelector('.pm-panel-container').classList.remove('pm-panel-container--merge-mode'); document.querySelector('.preset-panel').remove(); });
  await inspect('single mode');
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.evaluate(() => syncHeaders());
  assert.equal(await page.locator('.pmm-mobile-header-close').count(), 0, 'Desktop must remove mobile controls');
  assert.equal(await page.locator('.close-card').isVisible(), true, 'Desktop must restore original close');
  const desktopClose = await page.locator('.close-card').evaluate(node => getComputedStyle(node).position);
  assert.notEqual(desktopClose, 'absolute', 'Mobile close positioning must not leak into desktop');
  await page.setViewportSize({ width: 390, height: 1100 });
  await inspect('return to mobile');
  assert.ok((await page.evaluate(() => window.clicks)).length >= 18, 'Close controls must accept taps');
  console.log('Mobile header browser regression passed: narrow/wide viewports, enlarged UI, custom title, merge/single modes, close hit targets and desktop isolation.');
} finally {
  await browser.close();
}
