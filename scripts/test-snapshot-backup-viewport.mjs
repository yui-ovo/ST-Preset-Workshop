import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PMM_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PMM_PLAYWRIGHT_MODULE).href : 'playwright');
const files = Object.fromEntries(await Promise.all(['snapshot-backup.js','snapshot-backup-core.js'].map(async name => [name, await readFile(new URL(`../dist/${name}`, import.meta.url), 'utf8')])));
const html = `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>
body{margin:0;background:#222;color:#eee;font:14px sans-serif}
/* Host theme rules that previously could displace the generic backup section. */
body>div{top:50%!important;transform:translateY(-50%)!important}
section{position:fixed!important;top:-300px!important;min-height:800px!important;height:100vh!important;transform:translateY(-50%)!important}
</style><button id="open">备份</button><script type="module">
import {openSnapshotBackup} from '/snapshot-backup.js';
window.openBackup=()=>openSnapshotBackup(window);
document.querySelector('#open').onclick=openBackup;
</script>`;
const server = createServer((req,res) => { const name=new URL(req.url,'http://local').pathname.slice(1); res.setHeader('Content-Type', files[name]?'text/javascript':'text/html; charset=utf-8'); res.end(files[name]||html); });
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const output=new URL('../../outputs/backup-viewport/',import.meta.url); await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const backup={format:'st-preset-workshop-snapshots',version:1,preset:{snapshots:[{id:'p',name:'测试',presetName:'测试预设',states:[]}]},world:{snapshots:[],groups:[],defaults:[]}};
try {
  for(const width of [360,390,1280]) {
    const page=await browser.newPage({viewport:{width,height:844}});
    await page.addInitScript(() => {
      const vv=new EventTarget(); Object.assign(vv,{width:innerWidth,height:innerHeight,offsetTop:0,offsetLeft:0});
      Object.defineProperty(window,'visualViewport',{value:vv,configurable:true});
      const events=new Map(),add=vv.addEventListener.bind(vv),remove=vv.removeEventListener.bind(vv);
      vv.addEventListener=(type,fn,...rest)=>{events.set(fn,type);add(type,fn,...rest)};
      vv.removeEventListener=(type,fn,...rest)=>{events.delete(fn);remove(type,fn,...rest)};
      window.viewportListeners=()=>events.size;
      window.changeViewport=(width,height,offsetTop=0,offsetLeft=0)=>{Object.assign(vv,{width,height,offsetTop,offsetLeft});vv.dispatchEvent(new Event('resize'));vv.dispatchEvent(new Event('scroll'));};
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.click('#open');
    await page.locator('[data-file]').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
    await page.locator('[data-import-actions]:visible').waitFor();
    async function check() {
      await page.waitForFunction(()=>{
        const r=document.querySelector('#pmm-snapshot-backup')?.getBoundingClientRect(),v=visualViewport;
        return r && Math.abs(r.top-v.offsetTop)<1 && Math.abs(r.height-v.height)<1;
      });
      const metric=await page.evaluate(()=>{
        const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height};};
        const body=document.querySelector('.pmm-backup-body');
        return {panel:rect('.pmm-backup-panel'),head:rect('[data-close]'),action:rect('[data-import]'),visible:{top:visualViewport.offsetTop,bottom:visualViewport.offsetTop+visualViewport.height,left:visualViewport.offsetLeft,right:visualViewport.offsetLeft+visualViewport.width,height:visualViewport.height},overflow:body.scrollHeight>body.clientHeight};
      });
      for(const r of [metric.panel,metric.head,metric.action]) {
        assert.ok(r.top>=metric.visible.top && r.bottom<=metric.visible.bottom,JSON.stringify(metric));
        assert.ok(r.left>=metric.visible.left && r.right<=metric.visible.right,JSON.stringify(metric));
      }
      assert.ok(metric.panel.height<=metric.visible.height*(width<=768?.6:.7)+1);
      if(width<=768 || metric.visible.height<500) assert.ok(metric.overflow,'Long import content scrolls inside the body');
    }
    await check();
    await page.screenshot({path:fileURLToPath(new URL(`preview-${width}.png`,output))});
    await page.evaluate(()=>changeViewport(innerWidth,380,160,0));
    await check();
    await page.locator('.pmm-backup-body').evaluate(el=>el.scrollTop=el.scrollHeight);
    await check();
    await page.screenshot({path:fileURLToPath(new URL(`reduced-${width}.png`,output))});
    await page.getByRole('button',{name:'确认合并导入'}).click();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('pmm.switch-snapshots.v1')).snapshots.length),1);
    await page.getByRole('button',{name:'关闭快照备份'}).click();
    assert.equal(await page.evaluate(()=>viewportListeners()),0,'Viewport listeners removed on close');
    await page.evaluate(()=>changeViewport(innerWidth,844));
    await page.click('#open');
    await page.getByRole('button',{name:'关闭快照备份'}).click();
    assert.equal(await page.evaluate(()=>viewportListeners()),0);
    await page.close(); console.log(`Backup viewport passed: ${width}, host CSS, reduced height, offset, scroll, import and cleanup.`);
  }
} finally {await browser.close();server.close();}
