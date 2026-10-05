// Full production bundle + real Vue, hosted in a hidden iframe like ST/TT.
// PMM_BROWSER_ASSET_DIR contains vue.runtime.global.prod.js, pinia.iife.prod.js,
// lodash.min.js, zod4.mjs and jquery.min.js. No dependency downloads during tests.
// Optional PMM_THEME_CSS / PMM_COMPANION_SCRIPT load local compatibility fixtures.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyPromptCardActions } from './verify-prompt-card-actions.mjs';
const playwright = await import(process.env.PMM_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PMM_PLAYWRIGHT_MODULE).href : 'playwright');
const assets = process.env.PMM_BROWSER_ASSET_DIR;
assert.ok(assets, 'Set PMM_BROWSER_ASSET_DIR to the local browser dependency fixtures');
const asset = name => readFile(resolve(assets, name), 'utf8');
const engine = process.env.PMM_BROWSER_ENGINE || 'chromium';
const source = (await readFile(process.env.PMM_WORKSHOP_SOURCE || new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8'))
  .replace(/import\{createPinia[^;]+;import\{klona[^;]+;/, 'const e=Pinia.createPinia,n=Pinia.defineStore,t=_.cloneDeep;')
  .replace('export{xo as mountMainPanel,fo as toggleMainPanel,bo as unmountMainPanel};', 'window.testOpen=fo;window.testClose=bo;');
const browser = await playwright[engine].launch(engine === 'chromium' ? { channel: 'msedge', headless: true } : { headless: true });
try {
  for (const paused of ['none', 'runtime', 'all']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://startup.test') return route.abort();
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><head></head><body><div id="top-bar"></div><div id="extensionsMenu"></div><div id="sheld"><div id="chat"><div class="welcomePanel"><span class="welcomeHeaderVersionDisplay">TT</span></div></div></div><div id="send_form"><textarea id="send_textarea"></textarea></div></body>' });
      if (url.pathname === '/zod4.mjs') return route.fulfill({ contentType: 'application/javascript', body: await asset('zod4.mjs') });
      if (/^\/[\w.-]+\.js$/.test(url.pathname)) return route.fulfill({ contentType: 'application/javascript', body: await readFile(new URL(`../dist${url.pathname}`, import.meta.url), 'utf8') });
      return route.abort();
    });
    await page.goto('http://startup.test/');
    await page.addScriptTag({ content: await asset('lodash.min.js') });
    await page.addScriptTag({ content: await asset('jquery.min.js') });
    await page.evaluate(() => {
      const prompts = Array.from({ length: 326 }, (_, i) => ({ id: `p${i}`, name: `Prompt ${i}`, enabled: true, content: 'Fixture content', role: 'system', position: { type: 'relative' } }));
      prompts[0].name = '测试条目名称：这里是原本被隐藏按钮挡住的后半段';
      let variables = {};
      window.fixtureLoads = 0;
      const context = { getPresetManager: () => ({ readPresetExtensionField: () => null, getSelectedPresetName: () => 'First', getCompletionPresetByName: () => ({ prompts }) }), characters: [], chat: [], eventTypes: {}, eventSource: { on() {}, off() {}, emit() {}, removeListener() {} } };
      window.SillyTavern = { getContext: () => context };
      window.__TAURITAVERN__ = {};
      window.TavernHelper = {
        SillyTavern, getVariables: () => _.cloneDeep(variables), replaceVariables: next => { variables = _.cloneDeep(next); },
        updateVariablesWith: fn => { variables = fn(_.cloneDeep(variables)); },
        getScriptId: () => 'startup-fixture', getButtonEvent: name => name,
        eventOn() {}, eventRemoveListener() {}, eventEmit() {}, eventClearAll() {},
        getPresetNames: () => ['First', 'Second'], getLoadedPresetName: () => 'First',
        getPreset: () => { fixtureLoads++; return _.cloneDeep({ prompts }); },
        isPresetPlaceholderPrompt: () => false, isPresetSystemPrompt: () => false,
        tavern_events: {}, toastr: { info() {}, warning() {}, success() {}, error() {} }, YAML: {},
      };
      Object.assign(window, TavernHelper);
      localStorage.setItem('preset-manager-theme-mode', 'auto');
    });
    if (process.env.PMM_THEME_CSS) await page.evaluate(css => {
      const style = document.createElement('style'); style.textContent = css; document.head.append(style);
    }, await readFile(process.env.PMM_THEME_CSS, 'utf8'));
    if (process.env.PMM_COMPANION_SCRIPT) {
      await page.evaluate(() => { const f = document.createElement('iframe'); f.hidden = true; document.body.append(f); });
      await page.frames().at(-1).evaluate(script => { Object.assign(window, parent.TavernHelper); (0, eval)(script); }, await readFile(process.env.PMM_COMPANION_SCRIPT, 'utf8'));
    }
    await page.evaluate(() => { const f = document.createElement('iframe'); f.hidden = true; document.body.append(f); });
    const frame = page.frames().at(-1);
    if (paused !== 'none') await frame.evaluate(() => { window.requestAnimationFrame = () => 1; window.cancelAnimationFrame = () => {}; });
    if (paused === 'all') await page.evaluate(() => { window.requestAnimationFrame = () => 1; window.cancelAnimationFrame = () => {}; });
    for (const file of ['vue.runtime.global.prod.js', 'pinia.iife.prod.js']) await frame.addScriptTag({ content: await asset(file) });
    await frame.evaluate(async () => {
      Object.assign(window, parent.TavernHelper);
      window.TavernHelper = parent.TavernHelper;
      window._ = parent._; window.$ = window.jQuery = parent.jQuery;
      window.z = await import('http://startup.test/zod4.mjs');
      window.log = { info() {}, warn() {}, error() {}, debug() {} };
    });
    await frame.addScriptTag({ type: 'module', content: source });
    await frame.waitForFunction(() => typeof testOpen === 'function' && parent.document.querySelector('#preset-manager-floating-panel'), null, { polling: 25 });
    // Unmount before the deferred initializer: no late load is allowed.
    await page.waitForTimeout(220);
    const loadsBeforeCancel = await page.evaluate(() => fixtureLoads);
    await frame.evaluate(() => { testOpen(); testClose(); });
    await page.waitForTimeout(220);
    assert.equal(await page.locator('#preset-manager-main-panel').count(), 0);
    assert.equal(await page.evaluate(() => fixtureLoads), loadsBeforeCancel, 'Closing immediately cancels the pending preset load');
    const before = await page.evaluate(() => fixtureLoads);
    await frame.evaluate(() => testOpen());
    await page.waitForFunction(() => document.querySelector('.preset-panel .title-select')?.value === 'First' && document.querySelectorAll('.prompt-item').length > 0, null, { polling: 25, timeout: 5000 });
    await page.waitForTimeout(250);
    assert.ok(await page.evaluate(() => fixtureLoads) > before, 'Preset data loaded after reopening');
    const visible = await page.locator('.pm-panel-container').evaluate(node => {
      const style = getComputedStyle(node), rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0.9 && rect.width > 100 && rect.height > 100;
    });
    assert.ok(visible, `${paused}: panel must be painted, not merely present in the DOM`);
    if (paused === 'none' && (process.argv.includes('--prompt-actions') || process.env.PMM_CHECK_PROMPT_ACTIONS === '1')) await verifyPromptCardActions(page);
    // Exercise real native select and close button with normal frame delivery.
    // Browser actionability checks themselves need frames, so use DOM events in the fault cases.
    if (paused === 'none') await page.locator('.preset-panel .title-select').first().selectOption('Second');
    else await page.locator('.preset-panel .title-select').first().evaluate(node => { node.value = 'Second'; node.dispatchEvent(new Event('change', { bubbles: true })); });
    assert.equal(await page.locator('.preset-panel .title-select').first().inputValue(), 'Second');
    await page.locator('.preset-panel .close-card').first().evaluate(node => node.click());
    await page.waitForFunction(() => !document.querySelector('#preset-manager-main-panel'), null, { polling: 25 });
    assert.deepEqual(errors, []);
    console.log(`${engine}/${paused}: real Vue startup, rendered panel, preset selection, close and cancellation passed`);
    await page.close();
  }
} finally { await browser.close(); }
