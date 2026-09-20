import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { browserPage } from './lib/browser-cdp.mjs';
import { workshopFixture } from './lib/workshop-browser-fixture.mjs';

const source = await readFile(new URL('../dist/preset-content-editor.js', import.meta.url), 'utf8');
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0}#preset-manager-main-panel{position:absolute;top:100px;left:40px;width:1100px;height:600px;background:#eee}
.pm-panel-container{display:flex}.preset-panel{width:50%}.prompt-editor__textarea{background:#fff;color:#222}
</style><div id="chat"></div><div id="app"><div id="preset-manager-main-panel"><div class="pm-panel-container pm-panel-container--merge-mode">
${['left','right'].map(side=>`<div class="preset-panel" id="${side}"><div class="prompt-editor"><input class="prompt-editor__name-input" value="${side}"><textarea class="prompt-editor__textarea">${side} original</textarea><button class="prompt-editor__expand-btn">expand</button></div></div>`).join('')}
</div></div></div>`;
const server = createServer((_req,res) => { res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(html); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const page = await browserPage(), errors = [];
page.on('Runtime.exceptionThrown', ({exceptionDetails}) => errors.push(exceptionDetails.text));
async function openFixture() {
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(code => (0,eval)(code), source);
  await page.evaluate(() => {
    for (const side of ['left','right']) __PMM_PRESET_CONTENT_EDITOR_V1__.openPresetContentEditor(document.querySelector(`#${side} button`));
  });
}
try {
  await page.viewport(1280,800);
  await openFixture();
  const activity = await page.evaluate(async () => {
    const host = document.getElementById('preset-manager-main-panel');
    const original = host.getClientRects; let reads = 0;
    host.getClientRects = function(...args) { reads++; return original.apply(this,args); };
    const settle = () => new Promise(resolve => setTimeout(resolve,0));
    for(let n=0;n<40;n++) { const row=document.createElement('p');row.textContent=`Chat ${n}`;document.getElementById('chat').append(row);await settle(); }
    const chatReads = reads; reads = 0;
    const field = document.querySelector('[data-pmm-editor-side="left"] textarea');
    for(let n=0;n<40;n++) { field.value=`Draft ${n}`;field.dispatchEvent(new Event('input',{bubbles:true}));await settle(); }
    return {chatReads, typingReads:reads, overlays:document.querySelectorAll('.pmm-preset-editor-overlay').length};
  });
  console.log('Desktop editor layout reads:',activity);
  assert.deepEqual(activity,{chatReads:0,typingReads:0,overlays:2},'Unrelated chat and editor typing must not cause workshop layout reads');
  const cleanup = await page.evaluate(async () => {
    dispatchEvent(new Event('pagehide'));
    await new Promise(resolve => setTimeout(resolve,30));
    return {overlays:document.querySelectorAll('.pmm-preset-editor-overlay').length,style:!!document.getElementById('pmm-preset-content-editor-style'),api:!!window.__PMM_PRESET_CONTENT_EDITOR_V1__};
  });
  assert.deepEqual(cleanup,{overlays:0,style:false,api:false},'Runtime pagehide must remove both body portals and their API/style');
  // Removing nested owners, hiding the host and replacing a source must close only affected editors.
  for(const reason of ['source','host','ancestor','hidden','mode']) {
    await openFixture();
    const count = await page.evaluate(async reason => {
      if(reason==='source') document.querySelector('#left .prompt-editor').remove();
      if(reason==='host') document.getElementById('preset-manager-main-panel').remove();
      if(reason==='ancestor') document.getElementById('app').remove();
      if(reason==='hidden') document.getElementById('preset-manager-main-panel').style.display='none';
      if(reason==='mode') document.querySelector('.pm-panel-container').classList.remove('pm-panel-container--merge-mode');
      await new Promise(resolve=>setTimeout(resolve,50));
      return document.querySelectorAll('.pmm-preset-editor-overlay').length;
    }, reason);
    assert.equal(count,reason==='source'?1:0,`Cleanup after ${reason}`);
  }
  const themed = await workshopFixture({ transformHTML: html => html.replace(
    '<textarea class="prompt-editor__textarea" data-v-01bebc6e>可读正文</textarea>',
    '<div class="prompt-editor" data-v-01bebc6e><textarea class="prompt-editor__textarea" data-v-01bebc6e>可读正文</textarea><button class="prompt-editor__expand-btn">expand</button></div>') });
  try {
    await page.goto(themed.url);
    await page.evaluate(async () => { await new Promise(resolve=>setTimeout(resolve,500)); });
    await page.evaluate(code => (0,eval)(code), source);
    for (const skin of ['aqua','violet','glass','theme']) for (const tone of ['light','dark']) {
      const colors = await page.evaluate(async ({skin,tone}) => {
        __PMM_THEME_SYSTEM__.setTheme(skin); __PMM_THEME_SYSTEM__.setTone(tone);
        await new Promise(resolve=>setTimeout(resolve,450));
        const host = document.getElementById('preset-manager-main-panel'), probe = document.createElement('span');
        probe.style.color = 'var(--pmm-theme-text)'; host.append(probe);
        const expected = getComputedStyle(probe).color; probe.remove();
        __PMM_PRESET_CONTENT_EDITOR_V1__.openPresetContentEditor(document.querySelector('.prompt-editor__expand-btn'));
        const fields = [...document.querySelectorAll('.pmm-preset-editor-dialog textarea,.pmm-preset-editor-dialog header strong')]
          .map(node => { const style=getComputedStyle(node);return {color:style.color,fill:style.webkitTextFillColor}; });
        document.querySelector('[data-pmm-editor-cancel]').click();
        return {expected,fields};
      }, {skin,tone});
      for (const color of colors.fields) assert.deepEqual(color,{color:colors.expected,fill:colors.expected},`${skin}/${tone}: body portal must retain the approved editor text color`);
    }
  } finally { await themed.close(); }
  assert.deepEqual(errors,[]);
  console.log('Content editor integration passed: zero chat/typing layout reads, independent source cleanup, hidden/removed owner, mode exit and pagehide.');
} finally { await page.close(); await new Promise(resolve=>server.close(resolve)); }
