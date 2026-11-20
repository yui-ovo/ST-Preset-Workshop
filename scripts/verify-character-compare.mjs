import assert from 'node:assert/strict';

export async function verifyCharacterCompare(page) {
  const old = { name: '猫', description: '我来自月球。', first_mes: '你好', alternate_greetings: ['晚上好'],
    character_book: { name: '月球', entries: [{ id: 1, name: '故乡', content: '月球' }, { id: 2, name: '归期', content: '今晚' }] } };
  const next = { ...old, description: '我来自月球！', first_mes: '早上好', alternate_greetings: ['你好', '晚上好'],
    character_book: { name: '月球', entries: [{ id: 1, name: '家乡', content: '月球' }, { id: 2, name: '归期', content: '明晚' }] } };
  const contextCards = await page.evaluateHandle(() => SillyTavern.getContext().characters);
  await contextCards.evaluate((list, data) => list.push({ name: data.name, avatar: '新版.png', data }), next);
  const entry = page.getByRole('button', { name: '打开角色卡对比' });
  await entry.waitFor();
  assert.equal(await entry.evaluate(el => el.previousElementSibling.title), '世界书');
  await entry.click();
  const dialog = page.getByRole('dialog', { name: '角色卡对比' });
  const panels = dialog.locator('section');
  const open = dialog.getByRole('button', { name: '查看对比详情' });
  const stats = key => dialog.locator('[data-cc-status="' + key + '"]');
  const back = () => dialog.getByRole('button', { name: '返回', exact: true }).click();
  assert.equal(await open.isDisabled(), true);
  const upload = (panel, name, data) => panel.locator('input[type=file]').first().setInputFiles({
    name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)),
  });
  await upload(panels.first(), 'old.json', { data: old });
  await panels.last().getByRole('combobox').selectOption('新版.png');
  await open.click();
  assert.match(await stats('changed').textContent(), /1$/);
  assert.match(await stats('same').textContent(), /2$/);
  assert.match(await stats('new').textContent(), /1$/);
  const items = dialog.locator('.cc-row');
  await items.first().click();
  assert.deepEqual(await dialog.locator('mark').allTextContents(), ['。','！']);
  await dialog.getByRole('button', { name: '下一个条目' }).click();
  assert.match(await dialog.locator('h2').textContent(), /开场白 1/);
  await back();
  await dialog.getByRole('button', { name: '绑定世界书' }).click();
  assert.match(await stats('renamed').textContent(), /1$/);
  await stats('renamed').click(); assert.equal(await items.count(), 1);
  await stats('changed').click(); assert.equal(await items.count(), 2);
  await stats('renamed').click(); assert.equal(await items.count(), 1);
  await items.first().click();
  assert.deepEqual(await dialog.locator('pre').filter({hasText:/[今明]晚/}).allTextContents(), ['今晚','明晚']);
  await back(); await back();
  await dialog.getByRole('button', { name: '交换新旧卡' }).click();
  await dialog.getByRole('button', { name: '人设', exact: true }).click();
  await open.click();
  assert.match(await stats('old').textContent(), /1$/);
  await back();
  const linked = { ...old, character_book: undefined, extensions: { world: '月球' } };
  await upload(panels.first(), 'linked.json', linked);
  await dialog.getByRole('button', { name: '绑定世界书' }).click();
  assert.equal(await open.isDisabled(), true);
  await panels.first().locator('input[type=file]').last().setInputFiles({ name: '月球.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(next.character_book)) });
  await open.click();
  assert.match(await stats('renamed').textContent(), /1$/);
  await back();
  await dialog.getByRole('button',{ name: '关闭' }).click();
  assert.equal(await dialog.count(), 0);
  assert.equal(await page.evaluate(() => fixtureWorldWrites), 0);
}
