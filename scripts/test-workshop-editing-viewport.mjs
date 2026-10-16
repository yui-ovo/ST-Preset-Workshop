import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';

const playwright = await import(process.env.PMM_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PMM_PLAYWRIGHT_MODULE).href : 'playwright');
const engine = process.env.PMM_BROWSER_ENGINE || 'chromium';
const files = Object.fromEntries(await Promise.all(['workshop-editing.js', 'workshop-editing-core.js'].map(async name => [name, await readFile(new URL(`../dist/${name}`, import.meta.url), 'utf8')])));
const html = `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>
body{margin:0;background:#222;color:#eee;font:14px sans-serif}
#workshop{position:fixed;inset:44px 8px 34px;border:1px solid #888;border-radius:16px;--tt-inset-top:44px;--tt-inset-bottom:34px}
/* The host theme must not move or resize the overlay, nor style its inner section. */
body.interference>div:not(#workshop){transform:translateY(-50%)!important;top:0!important;height:600px!important;max-height:600px!important;padding:24px!important;border:8px solid red!important}
section{position:fixed!important;top:-300px!important;min-height:800px!important;height:100vh!important;transform:translateY(-50%)!important}
</style><div id="workshop"><button id="open">沿用开关</button><button id="close">关闭工坊</button></div><script type="module">
import {openSwitchTransfer,confirmWorkshopClose} from '/workshop-editing.js';
const host=document.querySelector('#workshop');
const prompts=Array.from({length:348},(_,i)=>({id:'p'+i,name:'条目 '+i,enabled:false,content:'内容'}));
const sides=[{name:'旧预设 · '+ '很长的完整名称'.repeat(8),prompts}, {name:'新预设 · '+ '完整名称'.repeat(10),prompts:prompts.map((p,i)=>({...p,id:i>326?'new'+i:p.id,name:i>326?'未匹配 '+i:p.name,enabled:true}))}];
window.applied=0;window.closedCount=0;window.dirty=true;
const entries=()=>dirty?Array.from({length:12},(_,i)=>({destination:'draft'+i,label:'未保存预设 '+i+' '+ '名称'.repeat(15),read:()=>({}),save:async()=>{dirty=false},discard:()=>{dirty=false},dirty:()=>dirty})):[];
document.querySelector('#open').onclick=()=>openSwitchTransfer(host,{read:()=>sides,apply:async()=>{applied++},notice:()=>{}});
document.querySelector('#close').onclick=()=>confirmWorkshopClose(host,entries,()=>{closedCount++});
</script>`;
const server = createServer((req, res) => {
  const name = new URL(req.url, 'http://local').pathname.slice(1);
  res.setHeader('Content-Type', files[name] ? 'text/javascript' : 'text/html; charset=utf-8');
  res.end(files[name] || html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const output = new URL('../../outputs/editing-viewport/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await playwright[engine].launch(engine === 'chromium' ? { channel: 'msedge', headless: true } : { headless: true });
try {
  for (const width of [320, 390, 768, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      const vv = new EventTarget(); Object.assign(vv, { width: innerWidth, height: innerHeight, offsetTop: 0, offsetLeft: 0 });
      Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
      const active = new Set();
      for (const [target, types] of [[window, ['resize', 'orientationchange']], [vv, ['resize', 'scroll']]]) {
        const add = target.addEventListener.bind(target), remove = target.removeEventListener.bind(target);
        const registered = new Map();
        target.addEventListener = (type, fn, ...rest) => { if (types.includes(type)) { const key = {type, fn}; registered.set(type + ':' + fn, key); active.add(key); } add(type, fn, ...rest); };
        target.removeEventListener = (type, fn, ...rest) => { const key = registered.get(type + ':' + fn); active.delete(key); registered.delete(type + ':' + fn); remove(type, fn, ...rest); };
      }
      window.viewportListeners = () => active.size;
      window.changeViewport = (width, height, offsetTop = 0, offsetLeft = 0) => { Object.assign(vv, { width, height, offsetTop, offsetLeft }); vv.dispatchEvent(new Event('resize')); vv.dispatchEvent(new Event('scroll')); };
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const overlay = page.locator('[data-pmm-editing-dialog]');
    async function check() {
      const metric = await overlay.evaluate(layer => {
        const root = layer.shadowRoot;
        const rect = node => { const r = node.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; };
        const vv = window.visualViewport;
        return { layer: rect(layer), panel: rect(root.querySelector('section')), fixed: [root.querySelector('h2'), ...root.querySelectorAll('footer button')].map(rect), visible: { top: vv?.offsetTop || 0, left: vv?.offsetLeft || 0, width: vv?.width || innerWidth, height: vv?.height || innerHeight }, main: { client: root.querySelector('main').clientHeight, scroll: root.querySelector('main').scrollHeight } };
      });
      const { visible: v, layer: l, panel: p } = metric;
      for (const key of ['top', 'left', 'width', 'height']) assert.ok(Math.abs(l[key] - v[key]) < 1, 'Overlay follows the visible viewport: ' + JSON.stringify(metric));
      for (const r of [p, ...metric.fixed]) {
        assert.ok(r.top >= v.top + 44 - 1 && r.bottom <= v.top + v.height - 34 + 1, 'Heading and actions respect safe insets: ' + JSON.stringify(metric));
        assert.ok(r.left >= v.left + 15 && r.right <= v.left + v.width - 15, 'No horizontal clipping: ' + JSON.stringify(metric));
      }
      assert.ok(Math.abs((p.top + p.bottom) / 2 - (v.top + 44 + (v.height - 44 - 34) / 2)) < 1, 'Center inside the safe visible area');
      return metric;
    }
    async function change(width, height, top = 0, left = 0) {
      await page.evaluate(args => changeViewport(...args), [width, height, top, left]);
      await page.waitForFunction(() => { const r = document.querySelector('[data-pmm-editing-dialog]')?.getBoundingClientRect(), v = visualViewport; return r && Math.abs(r.top - v.offsetTop) < 1 && Math.abs(r.height - v.height) < 1; });
    }
    async function closed() {
      assert.equal(await overlay.count(), 0);
      assert.equal(await page.evaluate(() => viewportListeners()), 0, 'All viewport listeners removed');
      assert.equal(await page.locator('#workshop').evaluate(n => n.inert), false, 'Workshop interactive again');
      assert.deepEqual(errors, []);
    }
    await page.locator('#open').click();
    await check();
    // Apply interference only after opening so the old implementation's displacement is measurable.
    await page.evaluate(() => document.body.classList.add('interference'));
    await check();
    await overlay.locator('details').evaluate(el => el.open = true);
    await overlay.locator('.row').first().waitFor();
    await check();
    await page.screenshot({ path: fileURLToPath(new URL(`${engine}-${width}.png`, output)) });
    await change(width - 20, 360, 150, 10);
    assert.ok((await check()).main.scroll > (await check()).main.client, 'Long content scrolls internally');
    const before = await overlay.locator('footer').boundingBox();
    await overlay.locator('main').evaluate(n => n.scrollTop = n.scrollHeight);
    await check();
    assert.deepEqual(await overlay.locator('footer').boundingBox(), before, 'Actions stay still while content scrolls');
    await page.screenshot({ path: fileURLToPath(new URL(`${engine}-${width}-reduced.png`, output)) });
    await overlay.getByRole('button', { name: '取消', exact: true }).click();
    await closed();
    assert.equal(await page.evaluate(() => applied), 0);
    await page.evaluate(() => changeViewport(innerWidth, 844));
    await page.locator('#open').click();
    await check();
    await overlay.getByRole('button', { name: '新预设沿用旧预设开关', exact: true }).click();
    await closed(); assert.equal(await page.evaluate(() => applied), 1);
    await page.locator('#close').click();
    await check(); await change(width, 360, 150); await check();
    await overlay.getByRole('button', { name: '继续编辑', exact: true }).click();
    await closed();
    await page.evaluate(() => changeViewport(innerWidth, 844));
    await page.locator('#close').click();
    await overlay.getByRole('button', { name: '不保存关闭', exact: true }).click();
    await closed(); assert.equal(await page.evaluate(() => closedCount), 1);
    // Old WebViews without visualViewport still follow window resize.
    await page.evaluate(() => Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true }));
    await page.locator('#open').click();
    await check();
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForFunction(() => Math.abs(document.querySelector('[data-pmm-editing-dialog]').getBoundingClientRect().height - innerHeight) < 1);
    await check();
    await page.keyboard.press('Escape'); await closed();
    await page.close();
    console.log(`Editing viewport passed: ${engine} ${width}, theme isolation, safe area, long content, visual viewport, close/apply cleanup and resize fallback.`);
  }
} finally { await browser.close(); server.close(); }
