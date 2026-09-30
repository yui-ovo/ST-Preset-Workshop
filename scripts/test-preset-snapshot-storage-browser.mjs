import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { pathToFileURL, fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PMM_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PMM_PLAYWRIGHT_MODULE).href : 'playwright');
const names = ['snapshot-name-dialog.js', 'snapshot-preset-links.js', 'snapshot-backup-core.js', 'snapshot-backup.js', 'preset-snapshot-storage.js'];
const files = Object.fromEntries(await Promise.all(names.map(async n => [n, await readFile(new URL(`../dist/${n}`, import.meta.url), 'utf8')])));
const bundle = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
files['preset.js'] = "import {requestSnapshotName} from './snapshot-name-dialog.js';\nimport {installPresetSnapshotLinks} from './snapshot-preset-links.js';\nimport {installPresetSnapshotStorage} from './preset-snapshot-storage.js';\n" + bundle.slice(bundle.indexOf('/* ===== PMM_SWITCH_SNAPSHOTS_TEST52'), bundle.indexOf('/* ===== PMM_THEMED_COMPARE_DRAG_LINE_V289'));
files['scripts/openai.js'] = 'export const promptManager={render(){}};';
let saved, fail = false, writes = [], reads = 0;
const original = () => ({ temperature: 0.7, prompts: [{ identifier: 'p0', content: 'SAVED BODY' }],
  prompt_order: [{ character_id: 100001, order: [{ identifier: 'p0', enabled: false }] }], extensions: { other: { keep: true } } });
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;font:14px sans-serif;color:#eee;background:#222;--SmartThemeBodyColor:#eee;--SmartThemeBlurTintColor:#25252b;--SmartThemeBorderColor:#888}
body.light{color:#333;background:#eee;--SmartThemeBodyColor:#333;--SmartThemeBlurTintColor:#f8f5f3}button{color:inherit;background:transparent}
</style><button id="open">预设快照</button><button id="backup">快照备份</button><script>
const presetName='当前测试预设';
window.fixture={prompts:Array.from({length:3},(_,i)=>({id:'p'+i,name:'条目'+i,enabled:true,content:'UNSAVED BODY'})),live:{temperature:1.7,extensions:{}},cached:{extensions:{}},listeners:new Map(),writes:0,intervals:0,toasts:[]};
const events={on(t,fn){if(!fixture.listeners.has(t))fixture.listeners.set(t,new Set());fixture.listeners.get(t).add(fn)},off(t,fn){fixture.listeners.get(t)?.delete(fn)},async emit(t,v){for(const fn of fixture.listeners.get(t)||[])await fn(v)}};
window.SillyTavern={getContext:()=>({characters:[],getRequestHeaders:()=>({'Content-Type':'application/json','X-CSRF-Token':'test'}),eventSource:events,eventTypes:{PRESET_RENAMED:'renamed',PRESET_CHANGED:'changed',CHAT_CHANGED:'chat'},getPresetManager:()=>({getSelectedPresetName:()=>presetName,getAllPresets:()=>[presetName],getCompletionPresetByName:()=>fixture.cached,getPresetList:()=>({settings:fixture.live})})})};
window.getLoadedPresetName=()=>presetName;window.getPreset=()=>({prompts:structuredClone(fixture.prompts)});window.setPreset=()=>fixture.writes++;
window.toastr={success:m=>fixture.toasts.push(m),info:m=>fixture.toasts.push(m),warning:m=>fixture.toasts.push(m),error:m=>fixture.toasts.push(m)};
const oldInterval=window.setInterval;window.setInterval=(...args)=>{fixture.intervals++;return oldInterval(...args)};
if(location.search.includes('seed'))localStorage.setItem('pmm.switch-snapshots.v1',JSON.stringify({version:1,snapshots:[{id:'default',name:'预设默认',isDefault:true,presetName,states:[{id:'p0',name:'条目0',enabled:false}]},{id:'role',name:'日常',presetName,states:[{id:'p0',name:'条目0',enabled:true}]}]}));
</script><script type="module">
import './preset.js';import {openSnapshotBackup} from './snapshot-backup.js';
document.querySelector('#open').onclick=()=>__PMM_SWITCH_SNAPSHOTS_TEST52__.open({source:'native-preset'});
document.querySelector('#backup').onclick=()=>openSnapshotBackup(window);
await __PMM_PRESET_SNAPSHOT_STORAGE__.ensure();window.ready=true;
</script>`;
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname.slice(1);
  if (path.startsWith('api/')) {
    res.setHeader('Content-Type', 'application/json');
    if (path === 'api/settings/get') { reads++; res.end(JSON.stringify({ openai_setting_names: ['当前测试预设'], openai_settings: [JSON.stringify(saved)] })); return; }
    let body = ''; for await (const chunk of req) body += chunk;
    if (path !== 'api/presets/save' || req.headers['x-csrf-token'] !== 'test') { res.writeHead(400); res.end('{}'); return; }
    const data = JSON.parse(body); writes.push(data);
    if (fail) { res.writeHead(500); res.end('{}'); return; }
    saved = structuredClone(data.preset); res.end(JSON.stringify({ name: data.name })); return;
  }
  res.setHeader('Content-Type', files[path] ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8');
  res.end(files[path] || html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const output = new URL('../../outputs/preset-snapshot-storage/', import.meta.url); await mkdir(output, { recursive: true });
const status = page => page.locator('[data-pmm-snapshot-storage]');
async function settled(page) { await page.waitForFunction(() => __PMM_PRESET_SNAPSHOT_STORAGE__.state('当前测试预设').state === 'saved'); }
try {
  for (const width of [390, 820, 1280]) {
    saved = original(); writes = []; reads = 0; fail = false;
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width < 1000 });
    const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto(url + '?seed'); await page.waitForFunction(() => window.ready); await settled(page);
    assert.equal(writes.length, 1); assert.equal(reads, 2, 'Migration batch uses one preflight and one verification read');
    const plain = structuredClone(saved); delete plain.extensions.pmm_switch_snapshots;
    assert.deepEqual(plain, original());
    await page.click('#open'); await status(page).filter({ hasText: '已保存到预设' }).waitFor();
    assert.equal(await page.locator('.pmm-switch-snapshot-row').count(), 1);
    if (width === 820) await page.evaluate(() => document.body.className = 'light');
    const b = await page.locator('.pmm-switch-snapshot-dialog').boundingBox();
    assert(b.y >= 0 && b.y + b.height <= 844 && b.x >= 0 && b.x + b.width <= width);
    if (width <= 768) assert(b.height <= 844 * .6 + 1, 'Mobile dialog keeps existing height cap');
    await page.screenshot({ path: fileURLToPath(new URL(`saved-${width}.png`, output)) });
    const count = writes.length;
    await page.evaluate(() => { fixture.prompts[0].enabled = false; fixture.live.temperature = 1.9; });
    await page.waitForTimeout(750); assert.equal(writes.length, count, 'Temporary switches/parameters do not save preset');
    fail = true;
    await page.locator('[data-pmm-snapshot-action="menu"]').click();
    await page.locator('[data-pmm-snapshot-action="overwrite"]').click();
    await status(page).filter({ hasText: '仅存本地' }).waitFor();
    assert.equal(saved.extensions.pmm_switch_snapshots.snapshots.find(s => s.id === 'role').states[0].enabled, true);
    await page.screenshot({ path: fileURLToPath(new URL(`retry-${width}.png`, output)) });
    fail = false; await status(page).getByRole('button', { name: '重试' }).click(); await settled(page);
    assert.equal(saved.extensions.pmm_switch_snapshots.snapshots.find(s => s.id === 'role').states[0].enabled, false);
    assert.equal(saved.temperature, .7); assert.equal(saved.prompts[0].content, 'SAVED BODY');
    assert.equal(await page.evaluate(() => fixture.live.temperature), 1.9);
    // Create a snapshot through the real editor; background persistence leaves the dialog usable.
    await page.locator('[data-pmm-snapshot-action="new"]').click();
    await page.locator('[data-pmm-editor-action="save"]').click();
    await page.locator('input#name').fill('新方案'); await page.locator('button[type="submit"]').click();
    await settled(page); assert(saved.extensions.pmm_switch_snapshots.snapshots.some(s => s.name === '新方案'));
    assert.equal(await page.evaluate(() => fixture.writes), 0, 'Metadata save never calls live setPreset');
    await page.evaluate(() => document.querySelector('#backup').click());
    assert.equal(await page.locator('[data-migration]').isVisible(), true);
    await page.locator('[data-migration] summary').click();
    const downloadWait = page.waitForEvent('download'); await page.locator('[data-export-migration]').click();
    const download = await downloadWait; assert.equal(download.suggestedFilename(), '预设工坊-迁移前本地快照.json');
    await page.locator('[data-close]').click();
    // A genuinely isolated browser context has no localStorage from the first one.
    const other = await browser.newContext({ viewport: { width, height: 844 } }), fresh = await other.newPage();
    const before = writes.length; await fresh.goto(url); await fresh.waitForFunction(() => window.ready);
    await fresh.click('#open'); await settled(fresh);
    assert.equal(await fresh.locator('.pmm-switch-snapshot-row').count(), 2); assert.equal(writes.length, before);
    await fresh.evaluate(() => __PMM_SWITCH_SNAPSHOTS_TEST52__.cleanup()); await other.close();
    await page.evaluate(() => __PMM_SWITCH_SNAPSHOTS_TEST52__.cleanup());
    assert.equal(await page.evaluate(() => [...fixture.listeners.values()].reduce((n, s) => n + s.size, 0)), 0);
    assert.equal(await page.evaluate(() => fixture.intervals), 0); assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('Embedded snapshot browser passed: real UI create/overwrite, failure/retry, isolated-browser restore, migration backup, unsaved-body isolation, 390/820/1280 layout and cleanup.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
