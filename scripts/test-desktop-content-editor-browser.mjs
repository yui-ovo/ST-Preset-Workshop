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
  await page.evaluate(() => {
    window.editorMonitoring = { mutationObservers: 0, resizeObservers: 0, viewportListeners: 0 };
    for (const [name, key] of [['MutationObserver', 'mutationObservers'], ['ResizeObserver', 'resizeObservers']]) {
      const Original = window[name];
      window[name] = class extends Original {
        constructor(...args) {
          super(...args);
          // Count the editor's observers, excluding Playwright's own DOM monitoring.
          if (new Error().stack.includes('pmm-editor-under-test.js')) editorMonitoring[key]++;
        }
      };
    }
    for (const target of [window, window.visualViewport].filter(Boolean)) {
      const add = target.addEventListener;
      target.addEventListener = function(type, ...args) {
        if ((type === 'resize' || type === 'scroll') && new Error().stack.includes('pmm-editor-under-test.js')) editorMonitoring.viewportListeners++;
        return add.call(this, type, ...args);
      };
    }
  });
  await page.addScriptTag({ content: code + '\n//# sourceURL=pmm-editor-under-test.js' });
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
async function setupMerge(page) {
  await page.evaluate(() => {
    document.querySelector('[data-pmm-editor-cancel]').click();
    const host = document.getElementById('preset-manager-main-panel');
    host.style.cssText = 'position:absolute;top:300px;left:40px;width:calc(100% - 80px);height:600px';
    const entry = side => `<div class="prompt-editor"><input class="prompt-editor__name-input" value="${side}"><textarea class="prompt-editor__textarea">${side} original</textarea><button class="prompt-editor__expand-btn">expand ${side}</button></div>`;
    host.innerHTML = `<div class="pm-panel-container pm-panel-container--merge-mode" style="display:flex;gap:60px"><div class="pm-main-wrapper" style="flex:1;min-width:0"><div class="preset-panel" id="left">${entry('left')}</div></div><div class="preset-panel" id="right" style="flex:1;min-width:0">${entry('right')}</div></div>`;
    host.querySelectorAll('.prompt-editor>*').forEach(node => node.style.display = 'block');
    events.length = 0;
    for (const side of ['left', 'right']) for (const name of ['input', 'change']) {
      document.querySelector(`#${side} textarea`).addEventListener(name, () => events.push(`${side}:${name}`));
    }
  });
}
try {
  // Reproduce offscreen/translated/scrolled workshop containers independently of viewport.
  for (const options of [{ top: -500 }, { top: 900 }, { top: 400, transform: 'translateY(300px) scale(.8)' }]) {
    const page = await open(options);
    const g = await geometry(page);
    assert.equal(await page.evaluate(() => editorMonitoring.mutationObservers), 1, 'Counter must detect the actual desktop observer');
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
  // Use real expand-button clicks: the unopened side must remain reachable.
  for (const width of [1000, 1600]) {
    const page = await open({ width });
    await setupMerge(page);
    await page.locator('#left button').click();
    const left = page.locator('[data-pmm-editor-side="left"]');
    const right = page.locator('[data-pmm-editor-side="right"]');
    await left.locator('textarea').fill('left edited');
    await page.locator('#right button').click();
    await right.locator('textarea').fill('right edited');
    assert.equal(await page.locator('.pmm-preset-editor-overlay').count(), 2);
    const l = await left.boundingBox(), r = await right.boundingBox();
    assert.equal(l.x, 0); assert.equal(l.width, width / 2);
    assert.equal(r.x, width / 2); assert.equal(r.width, width / 2);
    assert.equal(await left.locator('[role="dialog"]').getAttribute('aria-modal'), 'false');
    await left.locator('[data-pmm-editor-undo]').click();
    assert.equal(await left.locator('textarea').inputValue(), 'left original');
    assert.equal(await right.locator('textarea').inputValue(), 'right edited');
    await left.locator('textarea').fill('left saved');
    await left.locator('[data-pmm-editor-save]').click();
    assert.equal(await page.locator('#left textarea').inputValue(), 'left saved');
    assert.equal(await page.locator('#right textarea').inputValue(), 'right original');
    assert.equal(await right.locator('textarea').inputValue(), 'right edited');
    await page.locator('#left button').click();
    await left.locator('textarea').fill('discard');
    await left.locator('[data-pmm-editor-cancel]').click();
    assert.equal(await page.locator('#left textarea').inputValue(), 'left saved');
    await right.locator('[data-pmm-editor-save]').click();
    assert.equal(await page.locator('#right textarea').inputValue(), 'right edited');
    assert.deepEqual(await page.evaluate(() => events), ['left:input', 'left:change', 'right:input', 'right:change']);
    await page.locator('#left button').click();
    await page.locator('#right button').click();
    await right.locator('textarea').press('Escape');
    assert.equal(await left.count(), 1); assert.equal(await right.count(), 0);
    await page.locator('#right button').click();
    await page.evaluate(() => document.querySelector('.pm-panel-container').classList.remove('pm-panel-container--merge-mode'));
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
    await setupMerge(page);
    await page.evaluate(() => {
      const api = __PMM_PRESET_CONTENT_EDITOR_V1__;
      api.openPresetContentEditor(document.querySelector('#left button'));
      api.openPresetContentEditor(document.querySelector('#right button'));
    });
    assert.equal(await page.locator('.pmm-preset-editor-overlay').count(), 1, 'Mobile merge remains single-editor');
    assert.equal(await page.locator('[data-pmm-editor-side]').count(), 0);
    assert.equal((await geometry(page)).parent, 'preset-manager-main-panel');
    for (let attempt = 0; attempt < 5; attempt++) {
      await page.locator('[data-pmm-editor-cancel]').click();
      await page.evaluate(() => __PMM_PRESET_CONTENT_EDITOR_V1__.openPresetContentEditor(document.querySelector('#left button')));
    }
    assert.deepEqual(await page.evaluate(() => editorMonitoring), {
      mutationObservers: 0, resizeObservers: 0, viewportListeners: 0,
    }, 'Mobile must not create desktop observers or viewport listeners, including repeated opens');
    console.log(`Mobile ${width}px: single editor; 0 MutationObservers, 0 ResizeObservers, 0 viewport listeners after repeated opens.`);
    await page.close();
  }
  const narrow = await open({ width: 600 });
  assert.equal((await geometry(narrow)).position, 'absolute');
  await narrow.close();
  console.log('Desktop editor passed: centering, independent merge editors, opposite-side clicks, save/undo/cancel, cleanup; mobile geometry and single-editor behavior unchanged.');
} finally { await browser.close(); }
