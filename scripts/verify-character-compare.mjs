import assert from 'node:assert/strict';

export async function verifyCharacterCompare(page) {
  const old = { name: '余嘉乐', character_version:'v1.0', description: '我来自月球。', first_mes: '雨夜初遇', alternate_greetings: ['天台晚风'],
    character_book: { name: '月球', entries: [{ id: 1, name: '故乡', content: '月球' }, { id: 2, name: '归期', content: '今晚' }] } };
  const next = { ...old, character_version:'v1.1', description: '我来自月球！', first_mes: '车站重逢', alternate_greetings: ['雨夜初遇', '天台晚风'],
    character_book: { name: '月球', entries: [{ id: 1, name: '家乡', content: '月球' }, { id: 2, name: '归期', content: '明晚' }] } };
  const contextCards = await page.evaluateHandle(() => SillyTavern.getContext().characters);
  await contextCards.evaluate((list, data) => list.push({ name: data.name, avatar: '新版.png', data }), next);
  const entry = page.getByRole('button', { name: '打开角色卡对比' });
  await entry.waitFor();
  assert.equal(await entry.evaluate(el => el.previousElementSibling.title), '世界书');
  await entry.click();
  const panels = page.locator('.cc-work-panel'), top = panels.first(), bottom = panels.last();
  const dlg = page.locator('dialog.cc-work-dialog[open]');
  const result = page.locator('dialog.pmm-character-compare[open]');
  const action = (el,label) => el.getByRole('button',{name:label,exact:true});
  const choose = async panel => { await panel.locator('.cc-title').click(); await dlg.waitFor(); };
  const open = action(bottom,'查看对比详情');
  await choose(top);
  await dlg.locator('input[type=file]').setInputFiles({ name:'旧猫.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({data:{...old,extensions:{custom:'keep'}}})) });
  await choose(bottom);
  await dlg.getByRole('combobox',{name:'从酒馆选择'}).selectOption('新版.png');
  await open.click();
  const stats = key => result.locator('[data-cc-status="' + key + '"]');
  assert.match(await stats('changed').textContent(), /1$/);
  assert.match(await stats('same').textContent(), /2$/);
  await result.locator('.cc-row').first().click();
  assert.deepEqual(await result.locator('mark').allTextContents(), ['。','！']);
  await action(result,'下一个条目').click();
  await action(result,'返回').click();
  await action(result,'返回').click();
  await action(top,'绑定世界书').click();
  assert.match(await bottom.innerText(),/家乡/);
  await open.click();
  await stats('renamed').click(); assert.equal(await result.locator('.cc-row').count(),1);
  await stats('changed').click(); assert.equal(await result.locator('.cc-row').count(),2);
  await action(result,'返回').click();
  await action(top,'人设').click();
  const layout = async () => {
    const a = await top.boundingBox(), b = await bottom.boundingBox(), bar = await entry.boundingBox();
    assert.ok(a && b && bar && a.height>80 && b.height>80 && a.y+a.height<=bar.y+3 && bar.y+bar.height<=b.y+3, JSON.stringify({a,b,bar}));
    for (const panel of [top,bottom]) {
      assert.ok(await panel.locator('header').evaluate(el => el.scrollWidth<=el.clientWidth+1),'toolbar fits');
      for (const name of ['导出','多选','撤回','搜索','保存','关闭']) assert.equal(await action(panel,name).count(),1);
    }
  };
  await layout();
  if (process.env.PMM_CHARACTER_PREVIEW) {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({path:process.env.PMM_CHARACTER_PREVIEW});
  }
  await page.setViewportSize({width:320,height:700}); await layout();
  await page.setViewportSize({width:1024,height:768}); await layout();
  await page.setViewportSize({width:390,height:844});
  await action(top,'编辑人设').click();
  await dlg.getByLabel('角色描述',{exact:true}).fill('我来自木星。');
  await action(dlg,'应用到草稿').click();
  await action(top,'搜索').click();
  await top.locator('input[type=search]').fill('天台晚风');
  assert.equal(await top.locator('.cc-work-row').count(),1);
  assert.equal(await bottom.locator('.cc-work-row').count(),4);
  await action(top,'搜索').click();
  await action(top,'保存').click();
  await top.getByRole('status').filter({hasText:'保存在本机'}).waitFor();
  await action(bottom,'多选').click();
  await bottom.locator('input[type=checkbox]').first().check();
  const grip = await bottom.locator('.cc-grip').first().boundingBox(), row = await top.locator('.cc-work-row').last().boundingBox();
  await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);
  await page.mouse.down(); await page.mouse.move(row.x+35,row.y+row.height-3,{steps:12}); await page.mouse.up();
  assert.equal(await top.locator('.cc-work-row').count(),4);
  assert.equal(await bottom.locator('.cc-work-row').count(),4);
  await action(top,'撤回').click();
  assert.equal(await top.locator('.cc-work-row').count(),3);
  const download = page.waitForEvent('download');
  await action(top,'导出').click();
  const downloaded = await download;
  const {readFile}=await import('node:fs/promises');
  const exported=JSON.parse(await readFile(await downloaded.path(),'utf8'));
  assert.equal(exported.data.description,'我来自木星。');
  assert.equal(exported.data.extensions.custom,'keep');
  await action(top,'关闭').click();
  await choose(top);
  const saved = dlg.getByRole('combobox',{name:'打开本机保存的卡'});
  await saved.selectOption({index:1});
  await action(top,'编辑人设').click();
  assert.equal(await dlg.getByLabel('角色描述',{exact:true}).inputValue(),'我来自木星。');
  await dlg.getByLabel('角色描述',{exact:true}).fill('尚未保存');
  await action(dlg,'应用到草稿').click();
  await action(top,'关闭').click();
  await page.getByRole('button',{name:'继续编辑'}).click();
  assert.match(await top.locator('.cc-title').innerText(), /余嘉乐/);
  await action(top,'撤回').click();
  await choose(top); await action(dlg,'交换新旧卡').click();
  await open.click(); assert.match(await stats('old').textContent(),/1$/);
  await action(result,'返回').click();
  await entry.click();
  await top.waitFor({state:'detached',timeout:5000});
  assert.equal(await panels.count(),0);
  assert.equal(await page.evaluate(()=>fixtureWorldWrites),0);
}
