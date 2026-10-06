import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export async function verifySharedFavorites(page, frame, engine) {
  const read = () => page.evaluate(() => __PMM_FAVORITE_STORE__.read());
  await frame.evaluate(async () => { await (await __PMM_LOAD_WORLDBOOK_STITCH__()).open(); });
  const worldStar = page.locator('[data-wb-action="favorite"][data-wb-side="bottom"]').first();
  await page.locator('[data-wb-action="expand"][data-wb-side="bottom"]').first().click();
  await worldStar.click();
  await page.waitForFunction(() => __PMM_FAVORITE_STORE__.read().items.length === 1);
  assert.equal(await worldStar.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => fixtureWorldWrites), 0, 'Favoriting must not save the source book');
  await page.evaluate(() => { const side = __PMM_WORLDBOOK_STITCH_TEST3__.state.bottom; side.entries[0].content = 'unsaved world content'; side.dirty = true; });
  await page.locator('[data-wb-action="update-favorite"]').click();
  await page.waitForFunction(() => __PMM_FAVORITE_STORE__.read().items[0].content === 'unsaved world content');
  const favorite = (await read()).items[0];
  assert.equal(favorite.extra.pmmWorldbookFavorite.entry.depth, 7);
  // Closing the world pane leaves library data independent of the source draft.
  await page.evaluate(() => __PMM_WORLDBOOK_STITCH_TEST3__.close());
  await page.locator('.panel-btn[title="收藏"]').click();
  const library = page.locator('.preset-panel').nth(1);
  assert.equal(await library.locator('.pmm-favorite-kind').first().textContent(), '世界书');
  // Existing category operations and export/import must keep the metadata.
  await library.locator('[title="新建分类"]').click();
  await page.waitForFunction(() => __PMM_FAVORITE_STORE__.read().categories.length === 1);
  await page.evaluate(async () => { const api = __PMM_FAVORITE_STORE__, data = api.read(); await api.update(data.items[0].id, { categoryId: data.categories[0].id }); });
  const exportedPromise = page.waitForEvent('download');
  await library.locator('[title="导出"]').click();
  const exported = await exportedPromise;
  const backup = JSON.parse(await readFile(await exported.path(), 'utf8'));
  assert.equal(backup.data.items[0].extra.pmmWorldbookFavorite.entry.depth, 7);
  assert.equal(backup.data.items[0].categoryId, backup.data.categories[0].id);
  await page.evaluate(async () => { const api = __PMM_FAVORITE_STORE__; for (const item of api.read().items) await api.remove(item.id); });
  const chooserPromise = page.waitForEvent('filechooser');
  await library.locator('[title="导入"]').click();
  await (await chooserPromise).setFiles({ name: 'shared-favorites.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.waitForFunction(() => __PMM_FAVORITE_STORE__.read().items.length === 1);
  const restored = (await read()).items[0];
  assert.deepEqual(restored.extra, favorite.extra);
  assert.equal(restored.categoryId, (await read()).categories[0].id);
  const card = library.locator('.prompt-card').first();
  const useButton = card.locator('[title="使用收藏"]');
  await card.hover(); await useButton.click();
  const dialog = page.locator('.pmm-favorite-picker [role="dialog"]');
  assert.equal(await dialog.isVisible(), true);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    const rect = await dialog.boundingBox();
    assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1 && rect.y >= 0 && rect.y + rect.height <= 845, `${width}: bounded picker`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const before = await page.evaluate(() => __PMM_WORLDBOOK_PRESET_DROP_BRIDGE__.snapshot().prompts);
  await dialog.locator('[data-fav-submit]').click();
  await page.waitForFunction(() => document.querySelector('[data-fav-status]')?.textContent.includes('已添加到预设末尾'));
  const after = await page.evaluate(() => __PMM_WORLDBOOK_PRESET_DROP_BRIDGE__.snapshot().prompts);
  assert.equal(after.length, before.length + 1); assert.deepEqual(after.slice(0, -1), before);
  assert.equal(after.at(-1).content, 'unsaved world content'); assert.equal(after.at(-1).role, 'system');
  assert.deepEqual(after.at(-1).position, { type: 'relative' }); assert.ok(!after.at(-1).extra?.pmmWorldbookFavorite);
  assert.equal(await page.locator('.preset-panel').first().locator('.prompt-card').last().locator('.prompt-card__action--favorite').getAttribute('aria-pressed'), 'false', 'Same-name world favorite must not mark a normal prompt as favorited');
  // This is also the native drag/drop path, with the raw favorite as input.
  await page.evaluate(async () => { await __PMM_WORLDBOOK_PRESET_DROP_BRIDGE__.drop({ entries: [__PMM_FAVORITE_STORE__.read().items[0]] }); });
  const dropped = await page.evaluate(() => __PMM_WORLDBOOK_PRESET_DROP_BRIDGE__.snapshot().prompts.at(-1));
  assert.equal(dropped.content, restored.content); assert.ok(!dropped.extra?.pmmWorldbookFavorite);
  assert.deepEqual(dropped.position, { type: 'relative' }); assert.equal(dropped.role, 'system');
  await dialog.locator('[data-fav-close]').click();
  await card.hover(); await useButton.click();
  const worldLoads = await page.evaluate(() => fixtureWorldLoads);
  await dialog.locator('[data-fav-type]').selectOption('world');
  await page.waitForFunction(() => document.querySelector('[data-fav-world]')?.options.length === 2);
  assert.equal(await page.evaluate(() => fixtureWorldLoads), worldLoads, 'Target picker never scans worldbook content');
  await dialog.locator('[data-fav-world]').selectOption('Target');
  if (process.env.PMM_BROWSER_ASSET_DIR) await page.screenshot({ path: `${process.env.PMM_BROWSER_ASSET_DIR}/shared-favorites-${engine}.png` });
  await dialog.locator('[data-fav-submit]').click();
  await page.waitForFunction(() => document.querySelector('[data-fav-status]')?.textContent.includes('已添加并保存'));
  const target = await page.evaluate(() => fixtureBooks.Target);
  assert.equal(target.entries[1].depth, 7); assert.equal(target.entries[1].probability, 63);
  assert.equal(target.entries[1].content, 'unsaved world content'); assert.equal(target.entries[0].content, 'existing');
  assert.deepEqual(target.entries[1].custom, { x: ['keep'] });
  await dialog.locator('[data-fav-close]').click();
  // Normal favorites and a same-name world favorite must never cancel one another.
  await page.evaluate(async () => { await __PMM_FAVORITE_STORE__.add({ name: '世界书同名条目', content: 'unsaved world content', enabled: false, role: 'user', position: { type: 'relative' } }); });
  assert.equal((await read()).items.length, 2);
  assert.equal(await page.locator('.preset-panel').first().locator('.prompt-card').last().locator('.prompt-card__action--favorite').getAttribute('aria-pressed'), 'true', 'Normal favorite invalidates the lookup cache');
  assert.deepEqual((await library.locator('.pmm-favorite-kind').allTextContents()).sort(), ['世界书', '预设'].sort());
  const promptCard = library.locator('.prompt-card').filter({ has: page.locator('.pmm-favorite-kind', { hasText: /^预设$/ }) });
  await promptCard.hover(); await promptCard.locator('[title="使用收藏"]').click();
  await dialog.locator('[data-fav-type]').selectOption('world');
  await page.waitForFunction(() => document.querySelector('[data-fav-world]')?.options.length === 2);
  await dialog.locator('[data-fav-world]').selectOption('Target');
  await dialog.locator('[data-fav-submit]').click();
  await page.waitForFunction(() => document.querySelector('[data-fav-status]')?.textContent.includes('已添加并保存'));
  const promptWorld = await page.evaluate(() => fixtureBooks.Target.entries[2]);
  assert.equal(promptWorld.disable, true); assert.deepEqual(promptWorld.key, []); assert.equal(promptWorld.position, 0);
  await dialog.locator('[data-fav-close]').click();
  await page.locator('.panel-btn[title="收藏"]').click();
  console.log(`${engine}: world favorite UI, manual update, category/export/import, source isolation, both destination types, legacy favorites and mobile picker passed`);
}
