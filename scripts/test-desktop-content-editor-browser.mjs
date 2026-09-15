import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PMM_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PMM_PLAYWRIGHT_MODULE).href : 'playwright');
const source = await readFile(new URL('../dist/preset-content-editor.js', import.meta.url), 'utf8');
const baseline = process.env.PMM_EDITOR_BASELINE ? await readFile(process.env.PMM_EDITOR_BASELINE, 'utf8') : null;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
async function open({ width = 1280, height = 800, top = 400, transform = '', mobile = false, code = source } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, ...(mobile ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148', hasTouch: true } : {}) });
  await page.setContent(`<style>body{margin:0;min-height:2400px}#preset-manager-main-panel{position:absolute;top:${top}px;left:40px;width:85%;height:600px;transform:${transform || 'none'};background:#eee}.prompt-editor{padding:20px}.prompt-editor__textarea{color:rgb(42,42,42);background:rgb(250,240,245)}</style><div id="preset-manager-main-panel"><div class="prompt-editor"><input class="prompt-editor__name-input" value="测试条目"><textarea class="prompt-editor__textarea">original</textarea><button class="prompt-editor__expand-btn">expand</button></div></div>`);
  await page.addScriptTag({ content: code });
  await page.evaluate(() => {
    window.scrollTo(0, 250);
    window.events = [];
    const field = document.querySelector('.prompt-editor__textarea');
    for (const name of ['input', 'change']) field.addEventListener(name, () => events.push(name));
    window.__PMM_PRESET_CONTENT_EDITOR_V1__.openPresetContentEditor(document.querySelector('button'));
  });
  await page.waitForTimeout(50);
  return page;
}
async function geometry(page) {
  return page.locator('.pmm-preset-editor-overlay').evaluate(el => {
    const rect = el.querySelector('section').getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
      position: getComputedStyle(el).position, parent: el.parentElement.id || el.parentElement.tagName,
      scroll: scrollY, color: getComputedStyle(el.querySelector('textarea')).color };
  });
}
try {
  // Reproduce offscreen/translated/scrolled workshop containers independently of viewport.
  for (const options of [{ top: -500 }, { top: 900 }, { top: 400, transform: 'translateY(300px) scale(.8)' }]) {
    const page = await open(options);
    const g = await geometry(page);
    assert.equal(g.parent, 'BODY'); assert.equal(g.position, 'fixed'); assert.equal(g.scroll, 250);
    assert.ok(Math.abs(g.x + g.width / 2 - 640) < 2);
    assert.ok(Math.abs(g.y + g.height / 2 - 400) < 2);
    assert.equal(g.color, 'rgb(42, 42, 42)');
    await page.setViewportSize({ width: 1000, height: 450 });
    const resized = await geometry(page);
    assert.ok(Math.abs(resized.y + resized.height / 2 - 225) < 2);
    assert.ok(resized.y >= 0 && resized.y + resized.height <= 450);
    const field = page.locator('.pmm-preset-editor-dialog textarea');
    await field.fill('changed');
    await page.locator('[data-pmm-editor-undo]').click();
    assert.equal(await field.inputValue(), 'original');
    await field.fill('saved');
    await page.locator('[data-pmm-editor-save]').click();
    assert.equal(await page.locator('.prompt-editor__textarea').inputValue(), 'saved');
    assert.deepEqual(await page.evaluate(() => events), ['input', 'change']);
    await page.evaluate(() => __PMM_PRESET_CONTENT_EDITOR_V1__.openPresetContentEditor(document.querySelector('button')));
    await page.locator('.pmm-preset-editor-dialog textarea').fill('discard');
    await page.locator('[data-pmm-editor-cancel]').click();
    assert.equal(await page.locator('.prompt-editor__textarea').inputValue(), 'saved');
    await page.evaluate(() => {
      __PMM_PRESET_CONTENT_EDITOR_V1__.openPresetContentEditor(document.querySelector('button'));
      document.getElementById('preset-manager-main-panel').remove();
    });
    await page.waitForFunction(() => !document.querySelector('.pmm-preset-editor-overlay'));
    await page.close();
  }
  // Mobile placement and geometry must match the exact pre-fix implementation.
  for (const width of [390, 820]) {
    const page = await open({ width, mobile: true });
    const g = await geometry(page);
    assert.equal(g.parent, 'preset-manager-main-panel'); assert.equal(g.position, 'absolute');
    if (baseline) {
      const old = await open({ width, mobile: true, code: baseline });
      assert.deepEqual(g, await geometry(old), 'Mobile geometry/focus scrolling must stay unchanged');
      await old.close();
    }
    await page.close();
  }
  const narrow = await open({ width: 600 });
  assert.equal((await geometry(narrow)).position, 'absolute');
  await narrow.close();
  console.log('Desktop editor passed: viewport centering, resize, scroll, theme, save/undo/cancel, cleanup; mobile geometry unchanged.');
} finally { await browser.close(); }
