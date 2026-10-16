import assert from 'node:assert/strict';

export async function verifyWorkshopEditing(page, frame, engine) {
  page.setDefaultTimeout(6000);
  await frame.evaluate(() => {
    const row = (id, name, enabled, content) => ({ id, name, enabled, content, role:'system', position:{type:'relative'}, extra:{keep:true} });
    parent.editingPresets = {
      First:{prompts:[row('stable','原版条目',false,'旧正文'),row('old-id','相同标题',true,'旧正文2'),row('dup1','重名',false,'正文甲'),row('dup2','重名',true,'正文乙')]},
      Second:{prompts:[row('stable','新版标题',true,'新版正文'),row('new-id','相同标题',false,'新版正文2'),row('renamed','重命名待确认',true,'正文甲'),row('added','新增条目',false,'新增正文')]},
    };
    parent.editingWrites = []; parent.editingFail = '';
    window.getPreset = name => _.cloneDeep(parent.editingPresets[name === 'in_use' ? 'First' : name]);
    window.setPreset = async (name, data) => {
      if (parent.editingFail === name) throw Error('测试保存失败');
      parent.editingWrites.push({name, data:_.cloneDeep(data)});
      if (name !== 'in_use') parent.editingPresets[name] = _.cloneDeep(data);
      return true;
    };
    Object.assign(parent, {getPreset, setPreset});
    Object.assign(parent.TavernHelper, {getPreset, setPreset});
    testStores().main.loadPresetContent('First');
  });
  const read = () => frame.evaluate(() => {
    const {main,merge} = testStores();
    return {main:JSON.parse(JSON.stringify(main.prompts)),right:JSON.parse(JSON.stringify(merge.rightPrompts)),dirty:[main.isDirty,merge.isDirty]};
  });
  const modal = page.locator('[data-pmm-editing-dialog]');
  const clickClose = async () => { await frame.evaluate(() => { testClose(); }); };
  const reopen = async () => {
    await frame.evaluate(() => { testOpen(); });
    await page.waitForFunction(() => document.querySelectorAll('.prompt-item').length > 0);
  };
  const closed = () => page.waitForFunction(() => !document.querySelector('#preset-manager-main-panel'));
  const openMerge = async () => {
    if (!await frame.evaluate(()=>testStores().merge.isMergeMode)) await page.locator('.panel-btn[title="缝合"]').click();
    await page.locator('.preset-panel .title-select').nth(1).selectOption('Second');
    await page.waitForFunction(() => [...document.querySelectorAll('.preset-panel .title-select')][1]?.value === 'Second');
  };
  const openTransfer = async () => {
    await page.locator('.preset-panel').nth(1).getByTitle('比对',{exact:true}).click();
    await page.getByTitle('查看详细比对结果',{exact:true}).click();
    const entry = page.viewportSize().width <= 768 ? '#pmm-diff-detail-portal [data-pmm-switch-transfer]' : '[data-pmm-switch-transfer]:visible';
    await page.locator(entry).click();
    await modal.getByRole('heading', {name:'沿用旧版开关'}).waitFor();
  };
  await openMerge();
  const original = await read();
  assert.deepEqual(original.dirty,[false,false]);
  assert.equal(await page.locator('[data-pmm-switch-transfer]').count(),0,'No new main toolbar button');
  await openTransfer();
  assert.match(await modal.locator('section').textContent(),/已对应 2 条 · 将调整 2 条 · 保持新版 2 条/);
  await modal.getByRole('button',{name:'交换方向'}).click();
  assert.deepEqual(await modal.locator('.direction strong').allTextContents(),['Second','First']);
  await modal.getByRole('button',{name:'交换方向'}).click();
  await modal.locator('summary').click();
  const choice = modal.getByLabel('重命名待确认');
  await choice.focus();
  await choice.selectOption('2');
  assert.match(await modal.locator('section').textContent(),/已对应 3 条 · 将调整 3 条 · 保持新版 1 条/);
  await page.screenshot({path:process.env.PMM_BROWSER_ASSET_DIR + '/switch-transfer-' + engine + '.png'});
  await modal.getByRole('button',{name:'应用已对应开关'}).click();
  await modal.waitFor({state:'detached'});
  let after = await read();
  assert.deepEqual(after.right.map(p=>p.enabled),[false,true,false,false]);
  assert.deepEqual(after.right.map(({enabled,...p})=>p),original.right.map(({enabled,...p})=>p));
  assert.deepEqual(after.main,original.main);
  assert.equal(await page.evaluate(()=>editingWrites.length),0,'Transfer stays draft');
  await page.locator('.preset-panel').nth(1).getByTitle('撤销：沿用旧版开关',{exact:true}).click();
  assert.deepEqual((await read()).right,original.right,'One undo restores target draft');
  assert.deepEqual((await read()).dirty,[false,false]);

  // The reverse direction applies to the main panel and its own undo stack.
  await page.setViewportSize({width:1280,height:844});
  await openTransfer();
  await modal.getByRole('button',{name:'交换方向'}).click();
  await modal.getByRole('button',{name:'应用已对应开关'}).click();
  await modal.waitFor({state:'detached'});
  assert.deepEqual((await read()).main.slice(0,2).map(p=>p.enabled),[true,false]);
  await page.locator('.preset-panel').first().getByTitle('撤销：沿用旧版开关',{exact:true}).click();
  assert.deepEqual((await read()).main,original.main);
  await page.setViewportSize({width:390,height:844});
  // Selection and expansion alone don't trigger an unsaved prompt.
  await frame.evaluate(() => { const {main}=testStores(); main.selectedIds.add(main.prompts[0].id); main.expandedIds.add(main.prompts[0].id); });
  await clickClose(); await closed(); assert.equal(await modal.count(),0);
  await reopen(); await openMerge();
  await frame.evaluate(() => { const {main,merge}=testStores(); main.prompts[0].content='修改主预设'; merge.rightPrompts[0].content='修改缝合预设'; });
  await clickClose();
  assert.deepEqual(await modal.locator('li').allTextContents(),['主预设 · First','缝合预设 · Second']);
  for (const width of [320,390,1280]) {
    await page.setViewportSize({width,height:844});
    const box=await modal.locator('section').boundingBox();
    assert.ok(box.x>=0 && box.x+box.width<=width && box.y>=0 && box.y+box.height<=844);
    for (const b of await modal.locator('footer button').all()) assert.ok(await b.isVisible());
    await page.screenshot({path:`${process.env.PMM_BROWSER_ASSET_DIR}/unsaved-close-${engine}-${width}.png`});
  }
  await page.setViewportSize({width:390,height:844});
  await modal.getByRole('button',{name:'继续编辑'}).click();
  assert.deepEqual((await read()).dirty,[true,true]);
  await clickClose();
  await page.evaluate(()=>editingFail='Second');
  await modal.getByRole('button',{name:'保存并关闭'}).click();
  await modal.getByText(/测试保存失败/).waitFor();
  assert.deepEqual((await read()).dirty,[false,true],'Partial success only clears saved draft');
  assert.equal((await read()).right[0].content,'修改缝合预设');
  await page.evaluate(()=>editingFail='');
  await modal.getByRole('button',{name:'保存并关闭'}).click();
  await closed();
  assert.equal(await page.evaluate(()=>editingPresets.Second.prompts[0].content),'修改缝合预设');

  // Same destination with different drafts must never overwrite either side.
  await reopen(); await openMerge();
  await frame.evaluate(() => { const {main,merge}=testStores(); merge.loadRightPreset('First'); main.prompts[0].content='left conflicting'; merge.rightPrompts[0].content='right conflicting'; });
  const writesBefore = await page.evaluate(()=>editingWrites.length);
  await clickClose(); await modal.getByRole('button',{name:'保存并关闭'}).click();
  await modal.getByText(/两侧有不同修改/).waitFor();
  assert.equal(await page.evaluate(()=>editingWrites.length),writesBefore);
  await modal.getByRole('button',{name:'不保存关闭'}).click(); await closed();
  await reopen();
  assert.equal((await read()).main[0].content,'修改主预设','Discard really restores saved state');

  // Lower pane close must be guarded separately.
  await openMerge();
  await frame.evaluate(()=> {testStores().merge.rightPrompts[0].content='lower unsaved';});
  await page.locator('.preset-panel').nth(1).locator('.close-card:visible').click();
  assert.deepEqual(await modal.locator('li').allTextContents(),['缝合预设 · Second']);
  await modal.getByRole('button',{name:'不保存关闭'}).click();
  assert.equal(await page.locator('#preset-manager-main-panel').count(),1);
  assert.equal(await frame.evaluate(()=>testStores().merge.isMergeMode),false);

  // Branch names/roles also count as unsaved, not just content and toggles.
  await frame.evaluate(async()=>{const {branch}=testStores();await branch.enterBranchMode();await branch.createNewBranch('测试分支');branch.rightPrompts[0].name='尚未保存的分支名称';});
  await clickClose();
  assert.deepEqual(await modal.locator('li').allTextContents(),['分支 · 测试分支']);
  await modal.getByRole('button',{name:'继续编辑'}).click();
  await page.locator('.preset-panel').nth(1).locator('.close-card:visible').click();
  await modal.getByRole('button',{name:'不保存关闭'}).click();
  assert.equal(await frame.evaluate(()=>testStores().branch.isBranchMode),false);
  assert.equal(await page.locator('#preset-manager-main-panel').count(),1);

  // Worldbook's close-main cannot clear the book before prompting.
  await frame.evaluate(async()=>{await(await __PMM_LOAD_WORLDBOOK_STITCH__()).open();});
  await page.locator('[data-wb-kind="world"]').first().click();
  await page.evaluate(()=>{const side=__PMM_WORLDBOOK_STITCH_TEST3__.state.bottom; side.entries[0].content='未保存世界书';side.dirty=true;});
  await page.locator('[data-wb-action="close-main"]').first().click();
  assert.match((await modal.locator('li').allTextContents()).join('\n'),/Source/);
  assert.equal(await page.evaluate(()=>__PMM_WORLDBOOK_STITCH_TEST3__.state.bottom.entries[0].content),'未保存世界书');
  await modal.getByRole('button',{name:'继续编辑'}).click();
  await page.evaluate(()=>{const ctx=SillyTavern.getContext();window.savedWorldSaver=ctx.saveWorldInfo;ctx.saveWorldInfo=async()=>{throw Error('世界书保存失败测试');};});
  await clickClose(); await modal.getByRole('button',{name:'保存并关闭'}).click();
  await modal.getByText(/世界书保存失败测试/).waitFor();
  assert.equal(await page.evaluate(()=>__PMM_WORLDBOOK_STITCH_TEST3__.state.bottom.entries[0].content),'未保存世界书');
  await page.evaluate(()=>{SillyTavern.getContext().saveWorldInfo=savedWorldSaver;});
  await modal.getByRole('button',{name:'保存并关闭'}).click(); await closed();
  assert.equal(await page.evaluate(()=>fixtureBooks.Source.entries[0].content),'未保存世界书');
}




