import assert from 'node:assert/strict';
import { resolve } from 'node:path';

export async function verifyRegexManager(page, frame, engine) {
  await page.route('**/script.js', route => route.fulfill({ contentType: 'application/javascript', body: `export async function saveSettings(){window.rxSettingsWrites++; if(window.rxFail)return false; return ${process.env.PMM_TEST_HOST === 'st' ? 'undefined' : 'true'};}` }));
  await page.route('**/api/characters/merge-attributes', async route => {
    await page.evaluate(data => { window.rxCharacterWrite = data; }, route.request().postDataJSON());
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.evaluate(() => {
    const ctx = SillyTavern.getContext(); window.rxOriginalPM = ctx.getPresetManager;
    const row = (id, name) => ({ id, scriptName: name, findRegex: '/(x)/g', replaceString: '$1', placement: [1, 2], disabled: false, trimStrings: ['trim'], substituteRegex: 2, minDepth: 0, maxDepth: 5, unknown: { x: 7 } });
    window.rxData = { First: [row('a', '添加标签'), row('b', '移除思维链'), row('c', '保留正文')], Second: [row('d', '原有正则')] };
    window.rxWrites = 0; window.rxReads = 0; window.rxSettingsWrites = 0;
    ctx.extensionSettings = { regex: [] }; ctx.characterId = 0; ctx.characters = [{ name: '测试角色', avatar: 'a.png', data: { extensions: {} } }]; ctx.getRequestHeaders = () => ({ 'Content-Type': 'application/json' });
    ctx.getPresetManager = () => ({ apiId: 'openai', getAllPresets: () => ['First', 'Second'], getSelectedPresetName: () => 'First', readPresetExtensionField: ({ name }) => { rxReads++; return structuredClone(rxData[name || 'First']); }, writePresetExtensionField: async ({ name, value }) => { if (window.rxFail) throw Error('保存测试失败'); rxWrites++; rxData[name] = structuredClone(value); } });
  });
  await frame.evaluate(() => { window.__PMM_LOAD_REGEX_MANAGER__ = () => import('http://startup.test/regex-manager.js'); });
  await page.evaluate(() => __PMM_OPEN_PRESET_REGEX__());
  const root = page.locator('#pmm-regex-manager');
  await root.waitFor({ state: 'visible' });
  const a = root.locator('.rx-pane[data-side=a]'), b = root.locator('.rx-pane[data-side=b]');
  const row = (pane, i) => pane.locator('.rx-row').nth(i);
  const settle = () => page.waitForFunction(() => document.querySelector('#pmm-regex-manager')?.dataset.busy !== 'true');
  const dragAcross = async (from, to) => {
    const grip = await row(from, 0).locator('.rx-grip').boundingBox(); const box = await to.locator('.rx-list').boundingBox();
    await page.mouse.move(grip.x + 10, grip.y + 10); await page.mouse.down();
    await page.mouse.move(box.x + 90, box.y + 12, { steps: 8 }); await page.mouse.up(); await settle();
  };
  assert.equal(await a.locator('.rx-row').count(), 3); assert.equal(await b.locator('.rx-row').count(), 1);
  await a.locator('.rx-source-name').click();
  const beforePicker = await page.evaluate(() => rxReads);
  await root.locator('.rx-picker input').fill('Sec');
  assert.equal(await root.locator('.rx-picker-list button').count(), 1);
  assert.equal(await page.evaluate(() => rxReads), beforePicker, 'Preset name search does not load contents');
  await root.getByRole('button', { name: '关闭预设选择', exact: true }).click();
  const sourceReads = await page.evaluate(() => rxReads);
  await page.waitForTimeout(350); assert.equal(await page.evaluate(() => rxReads), sourceReads, 'Idle performs no background reads');
  await row(a, 0).locator('input').check(); await row(a, 2).locator('input').check();
  const grip = await row(a, 0).locator('.rx-grip').boundingBox(); const dest = await row(b, 0).boundingBox();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await page.mouse.down();
  await page.mouse.move(dest.x + 100, dest.y + 8, { steps: 10 }); await page.waitForTimeout(60);
  assert.equal(await root.locator('.rx-drop-line').count(), 1);
  await page.mouse.up(); await settle();
  assert.deepEqual(await page.evaluate(() => rxData.Second.map(r => r.scriptName)), ['添加标签', '保留正文', '原有正则']);
  assert.equal(await page.evaluate(() => rxWrites), 1, 'Batch copy saves once');
  assert.equal(await page.evaluate(() => rxData.First.length), 3);
  assert.equal(await page.evaluate(() => rxData.Second[0].unknown.x), 7);
  await root.getByRole('button', { name: '撤销上一步', exact: true }).click(); await settle();
  assert.equal(await b.locator('.rx-row').count(), 1);
  // Same-list pointer reordering, after the final row.
  const firstGrip = await row(a, 0).locator('.rx-grip').boundingBox(); const lastRow = await row(a, 2).boundingBox();
  await page.mouse.move(firstGrip.x + 10, firstGrip.y + 10); await page.mouse.down();
  await page.mouse.move(lastRow.x + 110, lastRow.y + lastRow.height - 5, { steps: 8 }); await page.mouse.up(); await settle();
  assert.deepEqual(await page.evaluate(() => rxData.First.map(r => r.id)), ['b', 'c', 'a']);
  await root.getByRole('button', { name: '撤销上一步', exact: true }).click(); await settle();
  await row(a, 0).locator('.rx-row-title').click();
  const order = await a.locator('.rx-actions button').evaluateAll(nodes => nodes.map(n => n.title));
  assert.ok(order[0].startsWith('收藏') && order[1].startsWith('复制'));
  assert.ok(!order.some(label => label.includes('移动')));
  await a.getByRole('button', { name: '复制：在原条目下方生成副本', exact: true }).click(); await settle();
  const copies = await page.evaluate(() => structuredClone(rxData.First));
  assert.deepEqual(copies.map(r => r.scriptName), ['添加标签', '添加标签', '移除思维链', '保留正文']);
  assert.equal(copies[0].id, 'a'); assert.notEqual(copies[1].id, 'a');
  assert.equal(await b.locator('.rx-row').count(), 1, 'Copy button does not transfer into other pane');
  await root.getByRole('button', { name: '撤销上一步', exact: true }).click(); await settle();
  await row(a, 0).locator('.rx-row-title').click();
  await a.getByRole('button', { name: '收藏选中的正则', exact: true }).click(); await settle();
  assert.equal(await page.evaluate(() => rxSettingsWrites), 1, 'Native settings module runs in host realm');
  await b.locator('select').selectOption('favorites'); assert.equal(await b.locator('.rx-row').count(), 1);
  await a.locator('select').selectOption('global'); assert.equal(await a.locator('.rx-row').count(), 0);
  // Empty destination touch pointer drop uses the same pointer path as mobile.
  await row(b, 0).locator('.rx-grip').evaluate((handle, target) => {
    handle.setPointerCapture = () => {}; handle.releasePointerCapture = () => {};
    const r = handle.getBoundingClientRect(); handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 31, pointerType: 'touch', button: 0, clientX: r.x + 10, clientY: r.y + 10 }));
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 31, pointerType: 'touch', clientX: target.x, clientY: target.y }));
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 31, pointerType: 'touch', clientX: target.x, clientY: target.y }));
  }, await a.locator('.rx-list').evaluate(n => { const r = n.getBoundingClientRect(); return { x: r.x + 80, y: r.y + 45 }; }));
  await settle(); assert.equal(await a.locator('.rx-row').count(), 1);
  // Both panes showing globals must duplicate, not move the original to the end.
  await b.locator('select').selectOption('global');
  await row(a, 0).locator('.rx-row-title').click();
  const originalGlobalId = await page.evaluate(() => SillyTavern.getContext().extensionSettings.regex[0].id);
  await a.getByRole('button', { name: '复制：在原条目下方生成副本', exact: true }).click(); await settle();
  assert.equal(await a.locator('.rx-row').count(), 2); assert.equal(await b.locator('.rx-row').count(), 2);
  assert.equal(await page.evaluate(() => SillyTavern.getContext().extensionSettings.regex[0].id), originalGlobalId);
  await root.getByRole('button', { name: '撤销上一步', exact: true }).click(); await settle();
  await b.locator('select').selectOption('favorites');
  await a.locator('select').selectOption('character');
  await dragAcross(b, a);
  assert.equal(await page.evaluate(() => rxCharacterWrite.avatar), 'a.png'); assert.equal(await a.locator('.rx-row').count(), 1);
  // Storage failure must preserve both lists and show a useful error.
  await a.locator('select').selectOption('preset'); await page.evaluate(() => { rxFail = true; });
  await dragAcross(b, a);
  assert.equal(await b.locator('.rx-row').count(), 1); assert.equal(await a.locator('.rx-row').count(), 3);
  assert.match(await root.locator('.rx-status').innerText(), /保存测试失败/); await page.evaluate(() => { rxFail = false; });
  await a.getByRole('button', { name: '全选当前搜索结果', exact: true }).click(); assert.match(await a.locator('.rx-count').innerText(), /已选 3/);
  await a.locator('.rx-search').fill('思维'); assert.equal(await a.locator('.rx-row').count(), 1); await a.locator('.rx-search').fill('');
  // Long source: bounded initial DOM and no regex body preview until expansion.
  await page.evaluate(() => { window.rxShortRows = structuredClone(rxData.First); rxData.First = Array.from({ length: 1000 }, (_, i) => ({ id: `long${i}`, scriptName: `长列表 ${i}`, placement: [1], findRegex: 'x'.repeat(4000) })); });
  await root.getByRole('button', { name: '刷新两栏列表', exact: true }).click(); await settle();
  assert.equal(await a.locator('.rx-row').count(), 80); assert.equal(await a.locator('pre').count(), 0);
  const longGrip = await row(a, 0).locator('.rx-grip').boundingBox(); const listBox = await a.locator('.rx-list').boundingBox();
  const writesBeforeCancel = await page.evaluate(() => rxWrites);
  await page.mouse.move(longGrip.x + 10, longGrip.y + 10); await page.mouse.down();
  await page.mouse.move(listBox.x + 90, listBox.y + listBox.height - 8, { steps: 6 }); await page.waitForTimeout(300);
  assert.ok(await a.locator('.rx-list').evaluate(n => n.scrollTop) > 0, 'Edge drag scrolls the list');
  await page.mouse.move(1, 1); await page.mouse.up(); await settle();
  assert.equal(await page.evaluate(() => rxWrites), writesBeforeCancel, 'Dropping outside cancels without saving');
  await page.evaluate(() => { rxData.First = rxShortRows; });
  await root.getByRole('button', { name: '刷新两栏列表', exact: true }).click(); await settle();
  assert.ok(await row(a, 0).evaluate(n => n.getBoundingClientRect().height) < 52, 'Rows are compact');
  assert.equal(await a.locator('.rx-source-box').evaluate(n => n.getBoundingClientRect().height), 28);
  assert.equal(await root.getByRole('button', { name: '撤销上一步', exact: true }).locator('svg').count(), 1);
  await page.screenshot({ path: resolve('../../outputs', `regex-manager-${engine}.png`) });
  const contrast = () => a.locator('select').evaluate(n => { const s = getComputedStyle(n); return { text: s.color, bg: s.backgroundColor }; });
  let colors = await contrast(); assert.notEqual(colors.text, colors.bg, 'Dark source selector remains readable');
  assert.equal(await a.locator('select').evaluate(n => getComputedStyle(n).getPropertyValue('-webkit-appearance')), 'none', 'WebKit native white select surface cannot override dark colors');
  await page.evaluate(() => {
    const source = document.querySelector('#preset-manager-main-panel .pm-overlay'); window.rxOriginalTheme = source.style.cssText;
    source.style.setProperty('--pm-panel-bg', '#ffffff'); source.style.setProperty('--pm-text-primary', '#1a2638'); source.style.setProperty('--pm-card-bg', '#f0f3f8'); source.style.setProperty('--pm-text-secondary', '#4a5b70'); source.style.setProperty('--pm-border', '#d3dce7');
    source.style.setProperty('--pm-hover-bg', '#e3e8ef');
  });
  await page.waitForTimeout(40); colors = await contrast(); assert.notEqual(colors.text, colors.bg, 'Light source selector remains readable');
  assert.equal(colors.bg, 'rgb(255, 255, 255)');
  await page.screenshot({ path: resolve('../../outputs', `regex-manager-light-${engine}.png`) });
  await page.evaluate(() => { document.querySelector('#preset-manager-main-panel .pm-overlay').style.cssText = rxOriginalTheme; });
  // Safe area, narrow width and desktop direction.
  assert.ok(await root.locator('.rx-shell').evaluate(n => { const r = n.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1; }));
  await page.setViewportSize({ width: 1280, height: 900 });
  assert.equal(await root.locator('.rx-panes').evaluate(n => getComputedStyle(n).flexDirection), 'row');
  await root.getByRole('button', { name: '关闭正则整理', exact: true }).click(); assert.equal(await root.count(), 0);
  await page.evaluate(() => { SillyTavern.getContext().characterId = undefined; });
  await page.evaluate(() => __PMM_OPEN_PRESET_REGEX__());
  assert.equal(await root.locator('select').first().locator('option[value=character]').isDisabled(), true);
  await root.getByRole('button', { name: '关闭正则整理', exact: true }).click();
  await page.evaluate(() => { SillyTavern.getContext().getPresetManager = rxOriginalPM; });
  await page.setViewportSize({ width: 390, height: 844 });
  console.log(`${engine}: regex pane integration, pointer batch copy, touch empty drop, favorites, character/global saves, rollback and 1000-row DOM budget passed`);
}
