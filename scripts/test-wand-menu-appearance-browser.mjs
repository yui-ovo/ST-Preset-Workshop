import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { pathToFileURL, fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PMM_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PMM_PLAYWRIGHT_MODULE).href : 'playwright');
const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const start = source.indexOf('  function syncWandEntryMenuAppearance(entry, menu) {');
const end = source.indexOf('  function setRuntimeButtonVisual(', start);
assert(start > 0 && end > start);
const functions = source.slice(start, end);
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:24px;background:#202020;color:#dedede;--SmartThemeBodyColor:#dedede;font:18px/1.4 sans-serif}
body.light{background:#fafafa;color:#555;--SmartThemeBodyColor:#555}
#extensionsMenu{display:block;width:280px;background:#171717;border-radius:8px}
body.light #extensionsMenu{background:#fff;box-shadow:0 2px 8px #0002}
/* Native ST/TT menu rules, including the containers used by bundled extensions. */
.flex-container{display:flex;align-items:center}.flexGap5{gap:5px}
.options-content i,.extensionsMenuExtensionButton{height:20px;width:20px;font-size:19.8px;display:flex;align-items:center;justify-content:center;pointer-events:none}
#extensionsMenu>.extension_container>div,#extensionsMenu>div:not(.extension_container),.list-group .list-group-item{color:var(--SmartThemeBodyColor);padding:5px;text-decoration:none;display:flex;column-gap:10px;cursor:pointer;align-items:baseline}
#extensionsMenu>.extension_container>div,#extensionsMenu>div:not(.extension_container),.list-group-item{opacity:.5}
#extensionsMenu>.extension_container>div:hover,#extensionsMenu>div:not(.extension_container):hover,.list-group-item:hover{opacity:1}
/* Representative shared theme overrides must remain live instead of copied inline. */
body.custom .list-group-item{padding:9px 12px;column-gap:18px;color:#afa7b9;opacity:.65}
body.custom.light .list-group-item{color:#65576e}
body.custom .list-group-item:hover{opacity:1;color:#bd89ea}
body.custom .list-group-item>span{opacity:.8;-webkit-text-fill-color:currentColor}
body.custom .extensionsMenuExtensionButton{width:26px;height:26px;opacity:.9}
.foreign-only{font-size:30px!important;color:red!important}.disabled{opacity:.15!important}
</style><button id="extensionsMenuButton">魔法棒</button><div id="extensionsMenu" class="options-content"></div><script>
const FAB_RUNTIME_TOKEN=Symbol('fixture');window.opens=0;
function openWorkshopFromWand(){window.opens++}
${functions}
window.sync=()=>ensureWandEntry(document);
window.setup=(shape)=>{
  const menu=document.querySelector('#extensionsMenu');
  const icon=shape==='native-div'?'div':'i';
  const row='<div id="reference" class="list-group-item flex-container flexGap5 interactable"><'+icon+' class="fa-solid fa-book extensionsMenuExtensionButton">▣</'+icon+'><span>打开数据库</span></div>';
  menu.innerHTML=shape==='legacy-direct'?row:'<div class="extension_container">'+row+'</div>';
  menu.insertAdjacentHTML('beforeend','<div class="list-group-item foreign-only disabled"><i>×</i><span>其他扩展</span></div>');
  window.sync();document.querySelector('#pmm-wand-open-workshop i').textContent='☷';
};
</script>`;
const server = createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const output = new URL('../../outputs/wand-menu-appearance/', import.meta.url); await mkdir(output, { recursive: true });
async function appearance(page, selector) {
  return page.locator(selector).evaluate(row => {
    const icon = row.querySelector('.extensionsMenuExtensionButton'), label = row.querySelector('span');
    const r = row.getBoundingClientRect(), i = icon.getBoundingClientRect(), l = label.getBoundingClientRect();
    const style = getComputedStyle(row), text = getComputedStyle(label), glyph = getComputedStyle(icon);
    return { color:style.color, opacity:style.opacity, textColor:text.color, textOpacity:text.opacity,
      fill:text.webkitTextFillColor, iconColor:glyph.color, iconOpacity:glyph.opacity,
      width:i.width, height:r.height, gap:l.x-i.right, inset:i.x-r.x, font:text.fontSize };
  });
}
try {
  for (const shape of ['native-div','wrapped-i','legacy-direct']) for (const custom of [false,true]) {
    const page = await browser.newPage({ viewport: { width:390, height:700 } });
    const errors=[]; page.on('pageerror', e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(({shape,custom})=>{ document.body.className=custom?'custom':'';setup(shape); },{shape,custom});
    for (const light of [false,true]) {
      // No rescan needed after a theme change; native CSS updates both rows.
      await page.evaluate(light=>document.body.classList.toggle('light',light),light);
      await page.mouse.move(385,690);
      assert.deepEqual(await appearance(page,'#pmm-wand-open-workshop'),await appearance(page,'#reference'),`${shape}, custom=${custom}, light=${light}`);
      const idle=await appearance(page,'#pmm-wand-open-workshop');
      assert(idle.gap>=10); assert.equal(idle.textOpacity,custom?'0.8':'1','No multiplied row transparency on label');
      await page.locator('#reference').hover(); const nativeHover=await appearance(page,'#reference');
      await page.locator('#pmm-wand-open-workshop').hover();
      assert.deepEqual(await appearance(page,'#pmm-wand-open-workshop'),nativeHover,'Hover follows native CSS');
      await page.mouse.move(385,690);
      if(shape==='native-div') await page.screenshot({path:fileURLToPath(new URL(`${custom?'custom':'native'}-${light?'light':'dark'}.png`,output))});
    }
    // Simulate stale inline overrides/container class from an old runtime.
    await page.evaluate(()=>{
      const row=document.querySelector('#pmm-wand-open-workshop');row.className='extension_container foreign-only';
      for(const node of [row,...row.children])node.style.cssText='color:red!important;opacity:.2!important;-webkit-text-fill-color:red!important';
      sync();sync();sync();
    });
    assert.deepEqual(await appearance(page,'#pmm-wand-open-workshop'),await appearance(page,'#reference'));
    assert.equal(await page.locator('#pmm-wand-open-workshop').count(),1);
    await page.locator('#pmm-wand-open-workshop').click();assert.equal(await page.evaluate(()=>opens),1);
    assert.equal(await page.locator('#extensionsMenu').isVisible(),false);
    for(const key of ['Enter','Space']){
      await page.evaluate(()=>document.querySelector('#extensionsMenu').style.display='block');
      await page.locator('#pmm-wand-open-workshop').focus();await page.keyboard.press(key);
    }
    assert.equal(await page.evaluate(()=>opens),3,'No duplicated click/key handlers after rescan');
    await page.evaluate(()=>{document.querySelector('#extensionsMenu').outerHTML='<div id="extensionsMenu" class="options-content"></div>';setup('native-div');});
    assert.equal(await page.locator('#pmm-wand-open-workshop').count(),1);
    await page.mouse.move(385,690);
    assert.deepEqual(await appearance(page,'#pmm-wand-open-workshop'),await appearance(page,'#reference'));
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('Wand appearance passed: native div / wrapped i / direct i menus, dark/light/custom themes, opacity, spacing, hover, stale overrides, menu replacement, click and keyboard.');
} finally { await browser.close();await new Promise(resolve=>server.close(resolve)); }
