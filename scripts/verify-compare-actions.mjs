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
  const modal=page.locator('[data-pmm-compare-modal]:visible');
  const guard=page.locator('[data-pmm-editing-dialog]');
  const read=()=>frame.evaluate(()=>({main:JSON.parse(JSON.stringify(testStores().main.prompts)),target:JSON.parse(JSON.stringify(testStores().merge.rightPrompts))}));
  const original=await read();
  async function open() {
    await page.locator('.preset-panel').nth(1).getByTitle('比对',{exact:true}).click();
    await page.getByTitle('查看详细比对结果',{exact:true}).click();
    if (page.viewportSize().width <= 768) await page.locator('#pmm-diff-detail-portal [data-pmm-compare-mode]').waitFor();
    await modal.locator('[data-pmm-compare-mode]').waitFor();
  }
  await open();
  assert.equal(await page.locator('[data-pmm-editing-dialog]').count(),0,'Actions stay inside the comparison');
  const cycle=modal.locator('[data-pmm-compare-mode]');
  assert.equal(await cycle.textContent(),'替换');
  assert.deepEqual(await modal.locator('.pmm-ca-name').allTextContents(),['A'],'Replace mode only lists replaceable entries');
  await cycle.click();assert.equal(await cycle.textContent(),'插入');
  assert.deepEqual(await modal.locator('.pmm-ca-name').allTextContents(),['N1','N2','Solo'],'Insert mode only lists source entries eligible for insertion');
  assert.equal(await modal.locator('.pmm-ca-single').filter({hasText:'替换'}).count(),0);
  await cycle.click();assert.equal(await cycle.textContent(),'关闭');
  assert.equal(await modal.getByRole('checkbox').count(),0,'Selection controls are hidden in off mode');
  assert.ok(await modal.getByRole('searchbox').isHidden());
  assert.ok(await modal.locator('.pmm-ca-submit').isHidden());
  assert.ok(await modal.locator('[data-pmm-diff-list]').isVisible());
  await cycle.click();
  await modal.getByRole('searchbox').fill('N1');
  assert.ok(await modal.getByRole('checkbox',{name:'全选可操作的搜索结果'}).isDisabled(),'Ineligible search results cannot be selected');
  await modal.getByRole('searchbox').fill('');
  await modal.locator('.pmm-ca-badge[data-status="content"]').first().click();
  await page.locator('.pmm-content-diff-back').waitFor();
  await page.locator('.pmm-content-diff-back').click();
  for (const width of [320,390,768,1280]) {
    await page.setViewportSize({width,height:844});
    const box=await modal.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=844);
    assert.ok(await modal.getByRole('button',{name:'关闭',exact:true}).isVisible());
    const columns = await modal.locator('.pmm-ca-row').evaluateAll(rows => rows.slice(0,3).map((row,index)=>{
      row.querySelector('.pmm-ca-percent').textContent=['1%','10%','100%'][index];
      return {check:row.querySelector('.pmm-ca-check-slot').getBoundingClientRect().x,percent:row.querySelector('.pmm-ca-percent').getBoundingClientRect().right};
    }));
    assert.ok(columns.every(c=>Math.abs(c.check-columns[0].check)<1 && Math.abs(c.percent-columns[0].percent)<1),'1%, 10% and 100% keep the checkbox column aligned');
    const titleBox=await modal.locator('[data-pmm-diff-title]').boundingBox(), dirBox=await modal.locator('.pmm-ca-direction').boundingBox();
    assert.ok(dirBox.x>=titleBox.x+titleBox.width-1,'Direction stays on the right of the title');
  }
  await page.setViewportSize({width:390,height:844});
  await modal.getByRole('checkbox',{name:'全选可操作的搜索结果'}).check();
  await modal.getByRole('button',{name:'替换（1）',exact:true}).click();await modal.waitFor({state:'detached'});
  assert.deepEqual((await read()).target[0],{...original.target[0],content:'new'});
  assert.deepEqual((await read()).main,original.main);
  assert.equal(await page.evaluate(()=>compareWrites.length),0);
  await page.locator('.preset-panel').nth(1).getByTitle('撤销：对比替换正文',{exact:true}).click();
  assert.deepEqual((await read()).target,original.target);
  await open();await modal.locator('[data-pmm-compare-mode]').click();
  await modal.getByRole('checkbox',{name:'全选可操作的搜索结果'}).check();
  await modal.getByRole('searchbox').fill('N');
  await modal.getByRole('checkbox',{name:'全选可操作的搜索结果'}).uncheck();
  assert.equal(await modal.locator('.pmm-ca-submit').textContent(),'插入（0）','Unchecking all also clears previously selected hidden rows');
  await modal.getByRole('searchbox').fill('N');await modal.getByRole('checkbox',{name:'全选可操作的搜索结果'}).check();
  await page.screenshot({path:process.env.PMM_BROWSER_ASSET_DIR+'/compare-insert-'+engine+'.png'});
  await modal.getByRole('button',{name:'插入（2）',exact:true}).click();await modal.waitFor({state:'detached'});
  assert.deepEqual((await read()).target.map(p=>p.id),['A','N1','N2','B']);
  assert.equal(await page.evaluate(()=>compareWrites.length),0);
  await page.locator('.preset-panel').nth(1).getByTitle('撤销：对比插入条目',{exact:true}).click();
  assert.deepEqual((await read()).target,original.target);
  // Desktop reverse, followed by stale-draft rejection.
  await page.setViewportSize({width:1280,height:844});await open();
  await modal.getByRole('button',{name:'反转方向'}).click();
  await modal.locator('.pmm-ca-single').first().click();await modal.waitFor({state:'detached'});
  assert.equal((await read()).main[0].content,'old');
  await page.locator('.preset-panel').first().getByTitle('撤销：对比替换正文',{exact:true}).click();
  await open();await frame.evaluate(()=>{testStores().merge.rightPrompts[0].content='changed elsewhere';});
  await modal.locator('.pmm-ca-single').first().click();
  await modal.getByText(/预设或分组已变化/).waitFor();
  assert.equal((await read()).target[0].content,'changed elsewhere');
  await modal.getByRole('button',{name:'关闭',exact:true}).click();
  await frame.evaluate(()=>testStores().diff.clearCompareResult());
  // Group membership and group order are part of the same undo transaction.
  await frame.evaluate(async()=>{
    const {main,merge,groups}=testStores();main.loadPresetContent('First');merge.loadRightPreset('Second');
    for(const [name,prompts] of [['First',main.prompts],['Second',merge.rightPrompts]]) {
      const state=groups.getPanelState(name);
      await groups.restorePresetSnapshot(name,{...state,groupSource:'manual',sections:[{id:'g',displayName:'测试分组',itemIds:prompts.map(p=>p.id)}]},prompts);
    }
  });
  await open();await modal.locator('[data-pmm-compare-mode]').click();
  await modal.getByRole('searchbox').fill('N');await modal.getByRole('checkbox',{name:'全选可操作的搜索结果'}).check();
  await modal.getByRole('button',{name:'插入（2）',exact:true}).click();await modal.waitFor({state:'detached'});
  assert.deepEqual(await frame.evaluate(()=>testStores().groups.getPanelState('Second').sections[0].itemIds),['A','N1','N2','B']);
  await page.locator('.preset-panel').nth(1).getByTitle('撤销：对比插入条目',{exact:true}).click();
  assert.deepEqual(await frame.evaluate(()=>testStores().groups.getPanelState('Second').sections[0].itemIds),['A','B']);
  await frame.evaluate(async()=>{
    const {main,groups}=testStores();main.prompts=[{id:'Z',name:'无对应条目',content:'completely unrelated',enabled:true,role:'system',position:{type:'relative'}}];
    await groups.restorePresetSnapshot('First',{...groups.getPanelState('First'),sections:[]},main.prompts);
  });
  await page.setViewportSize({width:390,height:844});await open();
  await modal.locator('[data-pmm-compare-mode]').click();
  assert.ok(await modal.getByRole('button',{name:'插入（0）',exact:true}).isDisabled());
  await modal.getByRole('combobox',{name:'目标分组'}).selectOption('g');
  await modal.getByRole('combobox',{name:'插入位置'}).selectOption('0');
  await modal.getByRole('checkbox',{name:'全选可操作的搜索结果'}).check();
  await modal.getByRole('button',{name:'插入（1）',exact:true}).click();await modal.waitFor({state:'detached'});
  assert.deepEqual((await read()).target.map(p=>p.id),['Z','A','B']);
  assert.deepEqual(await frame.evaluate(()=>testStores().groups.getPanelState('Second').sections[0].itemIds),['Z','A','B']);
  assert.equal(await page.evaluate(()=>compareWrites.length),0,'All operations remain drafts');
  await page.locator('.preset-panel').nth(1).getByTitle('撤销：对比插入条目',{exact:true}).click();
  assert.deepEqual((await read()).target.map(p=>p.id),['A','B']);
  // A long real comparison must fill the available space, with theme-owned
  // checkbox visuals and the selection count sharing the footer with actions.
  await frame.evaluate(()=>{
    const rows=Array.from({length:120},(_,i)=>({id:'long'+i,name:'长列表条目 '+i,content:'来源正文 '+i,enabled:true,role:'system',position:{type:'relative'}}));
    parent.comparePresets.First={prompts:rows};
    parent.comparePresets.Second={prompts:rows.map(p=>({...p,content:'目标正文 '+p.id}))};
    const {main,merge}=testStores();main.loadPresetContent('First');merge.loadRightPreset('Second');
  });
  const theme=await page.addStyleTag({content:`body input[type=checkbox]{appearance:none;width:18px;height:18px;border:2px solid rgb(180,120,220);border-radius:6px;box-shadow:0 0 0 1px rgb(80,70,90);background:rgb(40,35,50)}body input[type=checkbox]:checked{background:rgb(180,120,220)}`});
  for(const width of [320,390,768,1280]) {
    await page.setViewportSize({width,height:844});await open();
    assert.equal(await modal.locator('.pmm-ca-row').count(),120);
    await modal.getByRole('checkbox',{name:'全选可操作的搜索结果'}).check();
    assert.equal(await modal.locator('.pmm-ca-count').textContent(),'已选 120 条');
    const geometry=await modal.evaluate(root=>{
      const list=root.querySelector('.pmm-ca-list'), footer=root.querySelector('[data-pmm-diff-footer]'), count=root.querySelector('.pmm-ca-count'), submit=root.querySelector('.pmm-ca-submit');
      const l=list.getBoundingClientRect(), f=footer.getBoundingClientRect(), c=count.getBoundingClientRect(), s=submit.getBoundingClientRect();
      const box=root.getBoundingClientRect(), checkbox=getComputedStyle(root.querySelector('.pmm-ca-check-slot input'));
      return {gap:f.top-l.bottom,scrolls:list.scrollHeight>list.clientHeight,countLeft:c.left-footer.clientLeft-f.left,order:c.right<=s.left+1,sameLine:Math.abs(c.top+c.height/2-s.top-s.height/2)<2,overflow:footer.scrollWidth>footer.clientWidth,footerBottom:f.bottom,modalBottom:box.bottom,appearance:checkbox.appearance,radius:checkbox.borderRadius,shadow:checkbox.boxShadow};
    });
    assert.ok(geometry.gap>=0&&geometry.gap<=16,`No unused region below the list at ${width}: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.scrolls&&geometry.order&&geometry.sameLine&&!geometry.overflow,`Scrollable list and inline footer at ${width}: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.countLeft<=16&&geometry.footerBottom<=geometry.modalBottom+1);
    assert.equal(geometry.appearance,'none');assert.equal(geometry.radius,'6px');assert.notEqual(geometry.shadow,'none');
    if(width===390)await page.screenshot({path:process.env.PMM_BROWSER_ASSET_DIR+'/compare-layout-'+engine+'.png'});
    await modal.getByRole('button',{name:'关闭',exact:true}).click();
    await frame.evaluate(()=>testStores().diff.clearCompareResult());
    await page.waitForFunction(()=>!document.querySelector('[data-pmm-compare-modal]'));
    await page.locator('#pmm-diff-detail-portal').waitFor({state:'detached'});
  }
  await theme.evaluate(node=>node.remove());
  await frame.evaluate(()=>{testStores().main.prompts[0].content+='未保存修改';});
  await page.evaluate(async()=>{
    const mode=await import('/workshop-mode.js');window.modeReloads=0;
    window.modeSwitch=mode.changeWorkshopMode(window,'snapshots',()=>modeReloads++);
  });
  await guard.getByRole('button',{name:'继续编辑',exact:true}).click();
  assert.equal(await page.evaluate(()=>modeSwitch),false);assert.equal(await page.evaluate(()=>modeReloads),0);
  await page.evaluate(async()=>{
    const mode=await import('/workshop-mode.js');window.modeSwitch=mode.changeWorkshopMode(window,'snapshots',()=>modeReloads++);
  });
  await guard.getByRole('button',{name:'不保存关闭',exact:true}).click();
  assert.equal(await page.evaluate(()=>modeSwitch),true);assert.equal(await page.evaluate(()=>modeReloads),1);
  assert.equal(await page.evaluate(()=>localStorage.getItem('pmm.runtime-mode.v1')),'snapshots');
  console.log(`${engine}: actual compare entry, mobile clone, batch body replacement/insertion, undo, reverse, stale guard passed`);
}
