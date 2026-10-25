import assert from 'node:assert/strict';
export async function verifyCompareActions(page, frame, engine) {
  await frame.evaluate(() => {
    const row = (id, content=id) => ({id,name:id,enabled:false,content,role:'system',position:{type:'relative'},extra:{keep:true}});
    parent.comparePresets={First:{prompts:[row('A','new'),row('N1'),row('N2'),row('B'),row('Solo')]},Second:{prompts:[row('A','old'),row('B')]}};
    parent.compareWrites=[];
    window.getPreset=name=>_.cloneDeep(parent.comparePresets[name==='in_use'?'First':name]);
    window.setPreset=async(name,data)=>{parent.compareWrites.push({name,data});return true;};
    Object.assign(parent,{getPreset,setPreset}); Object.assign(parent.TavernHelper,{getPreset,setPreset});
    testStores().main.loadPresetContent('First');
  });
  await page.locator('.panel-btn[title="缝合"]').click();
  await page.locator('.preset-panel .title-select').nth(1).selectOption('Second');
  const modal=page.locator('[data-pmm-editing-dialog]');
  const read=()=>frame.evaluate(()=>({main:JSON.parse(JSON.stringify(testStores().main.prompts)),target:JSON.parse(JSON.stringify(testStores().merge.rightPrompts))}));
  const original=await read();
  async function open() {
    await page.locator('.preset-panel').nth(1).getByTitle('比对',{exact:true}).click();
    await page.getByTitle('查看详细比对结果',{exact:true}).click();
    // Mobile clone and desktop Vue modal must both dispatch to the same handler.
    if (page.viewportSize().width < 768) await page.locator('#pmm-diff-detail-portal [data-pmm-compare-actions]').click();
    else await page.locator('[data-pmm-compare-actions]:visible').click();
    await modal.getByRole('heading',{name:'对比 · 替换与插入'}).waitFor();
  }
  await open();
  for (const width of [320,390,768,1280]) {
    await page.setViewportSize({width,height:844});
    const box=await modal.locator('section').boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=844);
    assert.ok(await modal.getByRole('button',{name:'返回对比'}).isVisible());
  }
  await page.setViewportSize({width:390,height:844});
  await modal.getByRole('button',{name:'全选筛选结果'}).click();
  await modal.getByRole('button',{name:'替换正文（1）',exact:true}).click();await modal.waitFor({state:'detached'});
  assert.deepEqual((await read()).target[0],{...original.target[0],content:'new'});
  assert.deepEqual((await read()).main,original.main);
  assert.equal(await page.evaluate(()=>compareWrites.length),0);
  await page.locator('.preset-panel').nth(1).getByTitle('撤销：对比替换正文',{exact:true}).click();
  assert.deepEqual((await read()).target,original.target);
  await open();await modal.getByRole('button',{name:/插入独有条目/}).click();
  await modal.getByRole('searchbox').fill('N');await modal.getByRole('button',{name:'全选筛选结果'}).click();
  await page.screenshot({path:process.env.PMM_BROWSER_ASSET_DIR+'/compare-insert-'+engine+'.png'});
  await modal.getByRole('button',{name:'插入（2）',exact:true}).click();await modal.waitFor({state:'detached'});
  assert.deepEqual((await read()).target.map(p=>p.id),['A','N1','N2','B']);
  assert.equal(await page.evaluate(()=>compareWrites.length),0);
  await page.locator('.preset-panel').nth(1).getByTitle('撤销：对比插入条目',{exact:true}).click();
  assert.deepEqual((await read()).target,original.target);
  // Desktop reverse, followed by stale-draft rejection.
  await page.setViewportSize({width:1280,height:844});await open();
  await modal.getByRole('button',{name:'反转方向'}).click();
  await modal.getByRole('button',{name:'替换此条正文'}).click();await modal.waitFor({state:'detached'});
  assert.equal((await read()).main[0].content,'old');
  await page.locator('.preset-panel').first().getByTitle('撤销：对比替换正文',{exact:true}).click();
  await open();await frame.evaluate(()=>{testStores().merge.rightPrompts[0].content='changed elsewhere';});
  await modal.getByRole('button',{name:'替换此条正文'}).click();
  await modal.getByText(/预设或分组已变化/).waitFor();
  assert.equal((await read()).target[0].content,'changed elsewhere');
  await modal.getByRole('button',{name:'返回对比'}).click();
  await frame.evaluate(()=>testStores().diff.clearCompareResult());
  // Group membership and group order are part of the same undo transaction.
  await frame.evaluate(async()=>{
    const {main,merge,groups}=testStores();main.loadPresetContent('First');merge.loadRightPreset('Second');
    for(const [name,prompts] of [['First',main.prompts],['Second',merge.rightPrompts]]) {
      const state=groups.getPanelState(name);
      await groups.restorePresetSnapshot(name,{...state,groupSource:'manual',sections:[{id:'g',displayName:'测试分组',itemIds:prompts.map(p=>p.id)}]},prompts);
    }
  });
  await open();await modal.getByRole('button',{name:/插入独有条目/}).click();
  await modal.getByRole('searchbox').fill('N');await modal.getByRole('button',{name:'全选筛选结果'}).click();
  await modal.getByRole('button',{name:'插入（2）',exact:true}).click();await modal.waitFor({state:'detached'});
  assert.deepEqual(await frame.evaluate(()=>testStores().groups.getPanelState('Second').sections[0].itemIds),['A','N1','N2','B']);
  await page.locator('.preset-panel').nth(1).getByTitle('撤销：对比插入条目',{exact:true}).click();
  assert.deepEqual(await frame.evaluate(()=>testStores().groups.getPanelState('Second').sections[0].itemIds),['A','B']);
  await frame.evaluate(async()=>{
    const {main,groups}=testStores();main.prompts=[{id:'Z',name:'无对应条目',content:'completely unrelated',enabled:true,role:'system',position:{type:'relative'}}];
    await groups.restorePresetSnapshot('First',{...groups.getPanelState('First'),sections:[]},main.prompts);
  });
  await page.setViewportSize({width:390,height:844});await open();
  await modal.getByRole('button',{name:/插入独有条目/}).click();
  await modal.getByRole('button',{name:'全选筛选结果'}).click();
  assert.ok(await modal.getByRole('button',{name:'插入（1）',exact:true}).isDisabled());
  await modal.getByRole('combobox',{name:'目标分组'}).selectOption('g');
  await modal.getByRole('combobox',{name:'插入位置'}).selectOption('0');
  await modal.getByRole('button',{name:'插入（1）',exact:true}).click();await modal.waitFor({state:'detached'});
  assert.deepEqual((await read()).target.map(p=>p.id),['Z','A','B']);
  assert.deepEqual(await frame.evaluate(()=>testStores().groups.getPanelState('Second').sections[0].itemIds),['Z','A','B']);
  assert.equal(await page.evaluate(()=>compareWrites.length),0,'All operations remain drafts');
  await page.locator('.preset-panel').nth(1).getByTitle('撤销：对比插入条目',{exact:true}).click();
  assert.deepEqual((await read()).target.map(p=>p.id),['A','B']);
  await page.evaluate(async()=>{
    const mode=await import('/workshop-mode.js');window.modeReloads=0;
    window.modeSwitch=mode.changeWorkshopMode(window,'snapshots',()=>modeReloads++);
  });
  await modal.getByRole('button',{name:'继续编辑',exact:true}).click();
  assert.equal(await page.evaluate(()=>modeSwitch),false);assert.equal(await page.evaluate(()=>modeReloads),0);
  await page.evaluate(async()=>{
    const mode=await import('/workshop-mode.js');window.modeSwitch=mode.changeWorkshopMode(window,'snapshots',()=>modeReloads++);
  });
  await modal.getByRole('button',{name:'不保存关闭',exact:true}).click();
  assert.equal(await page.evaluate(()=>modeSwitch),true);assert.equal(await page.evaluate(()=>modeReloads),1);
  assert.equal(await page.evaluate(()=>localStorage.getItem('pmm.runtime-mode.v1')),'snapshots');
  console.log(`${engine}: actual compare entry, mobile clone, batch body replacement/insertion, undo, reverse, stale guard passed`);
}
