import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(
  process.env.PMM_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.PMM_PLAYWRIGHT_MODULE).href
    : 'playwright'
);
const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const start = source.indexOf('/* ===== PMM_SEARCH_REPEAT_JUMP_V29818');
const endMarker = '/* ===== PMM_SEARCH_REPEAT_JUMP_V29818 END ===== */';
const end = source.indexOf(endMarker, start);
assert.ok(start >= 0 && end > start, '找不到单结果重复定位模块');
const moduleSource = source.slice(start, end + endMarker.length);

const rows = Array.from({ length: 160 }, (_, index) =>
  `<div class="prompt-item${index === 145 ? ' prompt-item--highlighted' : ''}" style="height:52px">条目 ${index}</div>`
).join('');
const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<style>.prompt-panel__list{height:420px;overflow:auto}.prompt-item{box-sizing:border-box;border:1px solid transparent}</style>
<div id="preset-manager-main-panel"><div class="preset-panel">
  <input class="search-card__input"><button class="search-card__nav"><span>下一个</span></button>
  <div class="prompt-panel__list">${rows}</div>
</div></div><script type="module" src="/fix.js"></script>`;
const server = createServer((request, response) => {
  response.setHeader('Content-Type', request.url === '/fix.js' ? 'text/javascript' : 'text/html; charset=utf-8');
  response.end(request.url === '/fix.js' ? moduleSource : html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 360, height: 790 } });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const list = page.locator('.prompt-panel__list');
  const input = page.locator('.search-card__input');
  const nav = page.locator('.search-card__nav span');

  await input.dispatchEvent('input');
  await page.waitForTimeout(430);
  assert.ok(await list.evaluate(node => node.scrollTop > 6000), '单个远距离结果首次搜索没有定位');

  await list.evaluate(node => { node.scrollTop = 0; node.style.height = '180px'; });
  await nav.click();
  await page.waitForTimeout(430);
  const centered = await page.locator('.prompt-item--highlighted').evaluate((target) => {
    const list = target.parentElement;
    const listRect = list.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    return Math.abs((targetRect.top + targetRect.height / 2) - (listRect.top + listRect.height / 2));
  });
  assert.ok(centered < 2, '同一个结果在手机可视高度变化后没有重新居中');

  await list.evaluate(node => { node.scrollTop = 0; });
  await nav.click();
  await page.waitForTimeout(430);
  assert.ok(await list.evaluate(node => node.scrollTop > 6000), '单结果连续点击没有再次定位');
  assert.equal(await page.evaluate(() => typeof MutationObserver === 'function'), true);
  console.log('搜索定位浏览器回归通过：单个远距离结果可重复跳转，并适配手机键盘后的高度变化。');
} finally {
  await browser.close();
  server.close();
}
