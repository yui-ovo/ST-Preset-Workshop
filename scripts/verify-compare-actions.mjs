import assert from 'node:assert/strict';
import { verifyCompareFilters } from './verify-compare-filters.mjs';
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
  async function closeDetail() {
    await modal.getByRole('button',{name:'关闭',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('[data-pmm-compare-modal]'));
  }
  async function applied() {
    await modal.locator('.pmm-ca-body[aria-busy="false"]').waitFor();
    assert.equal(await frame.evaluate(()=>testStores().diff.isCompared),true,'Actions retain comparison state');
    assert.ok(await modal.isVisible(),'Batch actions retain details');
    await closeDetail();
  }
  async function selectMode() {
    const choose=modal.locator('[data-pmm-compare-select]');
    if(await choose.getAttribute('aria-pressed')!=='true') await choose.click();
  }
  async function open() {
    if(!await frame.evaluate(()=>testStores().diff.isCompared)) await page.locator('.preset-panel').nth(1).getByTitle('比对',{exact:true}).click();
    await page.getByTitle('查看详细比对结果',{exact:true}).click();
    if (page.viewportSize().width <= 768) await page.locator('#pmm-diff-detail-portal [data-pmm-compare-mode]').waitFor();
    await modal.locator('[data-pmm-compare-mode]').waitFor();
    assert.equal(await modal.locator('[data-pmm-compare-mode]').textContent(),'关闭','Comparison opens without an operation');
    await modal.locator('[data-pmm-compare-mode]').click();
    assert.equal(await modal.locator('input[type=checkbox]:visible').count(),0,'Selection starts collapsed');
    assert.equal(await modal.locator('.pmm-ca-single').count(),0,'No per-row replacement button');
    await selectMode();
  }
  await open();
  assert.equal(await page.locator('[data-pmm-editing-dialog]').count(),0,'Actions stay inside the comparison');
  const direction=modal.locator('.pmm-ca-direction');
  await modal.getByRole('checkbox',{name:'选择 A',exact:true}).check();
  await direction.click({delay:650});
  await guard.getByRole('heading',{name:'完整预设名称'}).waitFor();
  assert.deepEqual(await guard.locator('.preset-role').allTextContents(),['旧预设','新预设']);
  assert.deepEqual(await guard.locator('.direction strong').allTextContents(),['First','Second']);
  await guard.getByRole('button',{name:'知道了'}).click();
  assert.equal(await direction.textContent(),'First→Second','Long press never reverses the direction');
  assert.equal(await modal.getByRole('checkbox',{name:'选择 A',exact:true}).isChecked(),true,'Inspecting names preserves selection');
  await direction.click();
  assert.equal(await direction.textContent(),'Second→First','The next short press still reverses');
  await direction.click({button:'right'});
  assert.deepEqual(await guard.locator('.direction strong').allTextContents(),['Second','First']);
  await page.keyboard.press('Escape');
  await direction.click();
  assert.equal(await direction.textContent(),'First→Second');
  await direction.dispatchEvent('pointerdown',{isPrimary:true,button:0,clientX:10,clientY:10,pointerType:'touch'});
  await direction.dispatchEvent('pointermove',{isPrimary:true,clientX:35,clientY:10,pointerType:'touch'});
  await page.waitForTimeout(550);
  assert.equal(await page.locator('[data-pmm-editing-dialog]').count(),0,'Moving a finger cancels long press');
  await direction.dispatchEvent('pointercancel',{isPrimary:true,pointerType:'touch'});
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
  await cycle.click();await selectMode();
  await modal.getByRole('searchbox').fill('N1');
  assert.ok(await modal.locator('[data-pmm-compare-all]').isDisabled(),'Ineligible search results cannot be selected');
  await modal.getByRole('searchbox').fill('');
  await modal.locator('.pmm-ca-badge[data-status="content"]').first().click();
  await page.locator('.pmm-content-diff-back').waitFor();
  const content=page.locator('.pmm-content-diff');
  const left=content.locator('[data-side="left"]'),right=content.locator('[data-side="right"]');
  await right.getByRole('button',{name:'B→A',exact:true}).click();
  assert.equal(await left.locator('textarea').inputValue(),'old');
  assert.equal(await right.locator('textarea').inputValue(),'old');
  await left.locator('.pmm-diff-edit-btn').click();
  await left.locator('textarea').fill('edited draft body');
  await left.getByRole('button',{name:'A→B',exact:true}).click();
  assert.equal(await right.locator('textarea').inputValue(),'edited draft body','Copy uses latest edited body');
  assert.equal(await content.locator('.pmm-diff-save-btn').isEnabled(),true);
  assert.deepEqual(await read(),original,'Copy is local to the content editor until saving');
  assert.equal(await page.evaluate(()=>compareWrites.length),0);
  const actionSize=await right.evaluate(side=>{
    const a=side.querySelector('.pmm-diff-copy-btn'),b=side.querySelector('.pmm-diff-edit-btn');
    return {a:a.getBoundingClientRect().height,b:b.getBoundingClientRect().height,colorA:getComputedStyle(a).color,colorB:getComputedStyle(b).color};
  });
  assert.equal(actionSize.a,actionSize.b);assert.equal(actionSize.colorA,actionSize.colorB);
  await page.screenshot({path:process.env.PMM_BROWSER_ASSET_DIR+'/compare-body-copy-'+engine+'.png'});
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
  await modal.locator('[data-pmm-compare-all]').click();
  await modal.getByRole('button',{name:'替换（1）',exact:true}).click();await applied();
  assert.deepEqual((await read()).target[0],{...original.target[0],content:'new'});
  assert.deepEqual((await read()).main,original.main);
  assert.equal(await page.evaluate(()=>compareWrites.length),0);
  await page.locator('.preset-panel').nth(1).getByTitle('撤销：对比替换正文',{exact:true}).click();
  assert.deepEqual((await read()).target,original.target);
  await open();await modal.locator('[data-pmm-compare-mode]').click();await selectMode();
  await modal.locator('[data-pmm-compare-all]').click();
  await modal.getByRole('searchbox').fill('N');
  await modal.locator('[data-pmm-compare-all]').click();
  assert.equal(await modal.locator('.pmm-ca-submit').textContent(),'插入（0）','Unchecking all also clears previously selected hidden rows');
  await modal.getByRole('searchbox').fill('N');await modal.locator('[data-pmm-compare-all]').click();
  await page.screenshot({path:process.env.PMM_BROWSER_ASSET_DIR+'/compare-insert-'+engine+'.png'});
  await modal.getByRole('button',{name:'插入（2）',exact:true}).click();await applied();
  assert.deepEqual((await read()).target.map(p=>p.id),['A','N1','N2','B']);
  assert.equal(await page.evaluate(()=>compareWrites.length),0);
  await page.locator('.preset-panel').nth(1).getByTitle('撤销：对比插入条目',{exact:true}).click();
  assert.deepEqual((await read()).target,original.target);
  // Desktop reverse, followed by stale-draft rejection.
  await page.setViewportSize({width:1280,height:844});await open();
  await modal.getByRole('button',{name:'反转方向'}).click();
  await modal.locator('[data-pmm-compare-all]').click();await modal.locator('.pmm-ca-submit').click();await applied();
  assert.equal((await read()).main[0].content,'old');
  await page.locator('.preset-panel').first().getByTitle('撤销：对比替换正文',{exact:true}).click();
  await open();await frame.evaluate(()=>{testStores().merge.rightPrompts[0].content='changed elsewhere';});
  await modal.locator('[data-pmm-compare-all]').click();await modal.locator('.pmm-ca-submit').click();
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
  await open();await modal.locator('[data-pmm-compare-mode]').click();await selectMode();
  await modal.getByRole('searchbox').fill('N');await modal.locator('[data-pmm-compare-all]').click();
  await modal.getByRole('button',{name:'插入（2）',exact:true}).click();await applied();
  assert.deepEqual(await frame.evaluate(()=>testStores().groups.getPanelState('Second').sections[0].itemIds),['A','N1','N2','B']);
  await page.locator('.preset-panel').nth(1).getByTitle('撤销：对比插入条目',{exact:true}).click();
  assert.deepEqual(await frame.evaluate(()=>testStores().groups.getPanelState('Second').sections[0].itemIds),['A','B']);
  await frame.evaluate(async()=>{
    const {main,groups}=testStores();main.prompts=[{id:'Z',name:'无对应条目',content:'completely unrelated',enabled:true,role:'system',position:{type:'relative'}}];
    await groups.restorePresetSnapshot('First',{...groups.getPanelState('First'),sections:[]},main.prompts);
  });
  await page.setViewportSize({width:390,height:844});await open();
  await modal.locator('[data-pmm-compare-mode]').click();await selectMode();
  assert.ok(await modal.getByRole('button',{name:'插入（0）',exact:true}).isDisabled());
  await modal.getByRole('combobox',{name:'目标分组'}).selectOption('g');
  await modal.getByRole('combobox',{name:'插入位置'}).selectOption('0');
  await modal.locator('[data-pmm-compare-all]').click();
  await modal.getByRole('button',{name:'插入（1）',exact:true}).click();await applied();
  assert.deepEqual((await read()).target.map(p=>p.id),['Z','A','B']);
  assert.deepEqual(await frame.evaluate(()=>testStores().groups.getPanelState('Second').sections[0].itemIds),['Z','A','B']);
  assert.equal(await page.evaluate(()=>compareWrites.length),0,'All operations remain drafts');
  await page.locator('.preset-panel').nth(1).getByTitle('撤销：对比插入条目',{exact:true}).click();
  assert.deepEqual((await read()).target.map(p=>p.id),['A','B']);
  // A long real comparison must fill the available space, with theme-owned
  // checkbox visuals and the selection count sharing the footer with actions.
  const longNames=await frame.evaluate(()=>{
    const rows=Array.from({length:120},(_,i)=>({id:'long'+i,name:'长列表条目 '+i,content:'来源正文 '+i,enabled:true,role:'system',position:{type:'relative'}}));
    const names=['【万事成真】同名前缀的完整预设名称·'+ '长名称'.repeat(18)+' v1.25','【万事成真】同名前缀的完整预设名称·'+ '长名称'.repeat(18)+' v1.26'];
    parent.comparePresets[names[0]]={prompts:rows};
    parent.comparePresets[names[1]]={prompts:rows.map(p=>({...p,content:'目标正文 '+p.id}))};
    const {main,merge}=testStores();main.switchPreset(names[0]);merge.loadRightPreset(names[1]);return names;
  });
  const theme=await page.addStyleTag({content:`body input[type=checkbox]{appearance:none;width:18px;height:18px;border:2px solid rgb(180,120,220);border-radius:6px;box-shadow:0 0 0 1px rgb(80,70,90);background:rgb(40,35,50)}body input[type=checkbox]:checked{background:rgb(180,120,220)}`});
  for(const width of [320,390,768,1280]) {
    await page.setViewportSize({width,height:844});await open();
    assert.equal(await direction.textContent(),'v1.25→v1.26');
    assert.equal(await modal.locator('.pmm-ca-row').count(),120);
    await modal.locator('[data-pmm-compare-all]').click();
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
    await direction.click({delay:650});
    await guard.getByRole('heading',{name:'完整预设名称'}).waitFor();
    assert.deepEqual(await guard.locator('.direction strong').allTextContents(),longNames,'Version suffixes remain visible in full names');
    const nameLayout=await guard.getByRole('dialog').evaluate(el=>{
      const r=el.getBoundingClientRect(), main=el.querySelector('main');
      return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,overflow:main.scrollWidth>main.clientWidth};
    });
    assert.ok(nameLayout.left>=0&&nameLayout.right<=width&&nameLayout.top>=0&&nameLayout.bottom<=844&&!nameLayout.overflow);
    if(width===390)await page.screenshot({path:process.env.PMM_BROWSER_ASSET_DIR+'/compare-full-names-'+engine+'.png'});
    await guard.getByRole('button',{name:'知道了'}).click();
    assert.equal(await modal.locator('.pmm-ca-count').textContent(),'已选 120 条');
    await modal.getByRole('button',{name:'关闭',exact:true}).click();
    await frame.evaluate(()=>testStores().diff.clearCompareResult());
    await page.waitForFunction(()=>!document.querySelector('[data-pmm-compare-modal]'));
    await page.locator('#pmm-diff-detail-portal').waitFor({state:'detached'});
  }
  await theme.evaluate(node=>node.remove());
  // Duplicate titles and reordered IDs must read the exact compared bodies,
  // without revealing either main-panel group or inline editor.
  await frame.evaluate(async()=>{
    const row=(id,name,content)=>({id,name,content,enabled:false,role:'assistant',position:{type:'relative'},extra:{keep:true}});
    parent.comparePresets.First={prompts:[row('one','优质写作','left one'),row('two','优质写作','left two'),row('gender','男女平等','left gender')]};
    parent.comparePresets.Second={prompts:[row('two','优质写作','right two'),row('one','优质写作','right one'),row('gender','男女平等','right gender')]};
    const {main,merge,groups,diff}=testStores();main.currentPresetName='First';main.loadPresetContent('First');merge.loadRightPreset('Second');diff.clearCompareResult();
    main.expandedIds.clear();merge.rightExpandedIds.clear();
    for(const [name,prompts] of [['First',main.prompts],['Second',merge.rightPrompts]]) await groups.restorePresetSnapshot(name,{groupSource:'manual',sections:[{id:'g',displayName:'折叠分组',itemIds:prompts.map(p=>p.id)}],collapsedSections:['g']},prompts);
  });
  const beforeDuplicate=await read();
  await page.setViewportSize({width:390,height:844});await open();
  assert.deepEqual(await modal.locator('.pmm-ca-name').allTextContents(),['优质写作','优质写作','男女平等']);
  // Inspect the ordinary off-mode row, not only the new action list.
  await cycle.click();await cycle.click();
  await modal.locator('[data-pmm-diff-row="0"]').getByText('内容不同',{exact:true}).click();
  await content.waitFor();
  assert.equal(await left.locator('textarea').inputValue(),'left one');
  assert.equal(await right.locator('textarea').inputValue(),'right one');
  await left.getByRole('button',{name:'A→B',exact:true}).click();
  await content.locator('.pmm-diff-save-btn').click();
  await content.getByText('已保存',{exact:true}).waitFor();
  const savedDuplicate=await read();
  assert.deepEqual(savedDuplicate.target[1],{...beforeDuplicate.target[1],content:'left one'});
  assert.deepEqual(savedDuplicate.target[0],beforeDuplicate.target[0]);
  assert.deepEqual(await frame.evaluate(()=>({left:[...testStores().main.expandedIds],right:[...testStores().merge.rightExpandedIds],collapsed:['First','Second'].map(n=>[...testStores().groups.getPanelState(n).collapsedSections])})),{left:[],right:[],collapsed:[['g'],['g']]});
  await content.locator('.pmm-content-diff-back').click();
  await cycle.click();await selectMode();
  assert.deepEqual(await modal.locator('.pmm-ca-name').allTextContents(),['优质写作','男女平等']);
  for(const name of ['男女平等','优质写作']) {
    await modal.getByRole('checkbox',{name:'选择 '+name,exact:true}).check();
    await modal.locator('.pmm-ca-submit').click();
    await modal.locator('.pmm-ca-body[aria-busy="false"]').waitFor();
    assert.ok(await modal.isVisible());
    assert.equal(await frame.evaluate(()=>testStores().diff.isCompared),true);
  }
  assert.equal(await modal.locator('.pmm-ca-row').count(),0);
  assert.equal(await frame.evaluate(()=>testStores().diff.stats.contentDiffCount),0);
  await closeDetail();
  // Native BaiBai metadata remains stale until saving. Pending assignment must
  // survive reimport, and a single insertion reveals only the target group.
  await frame.evaluate(async()=>{
    const row=id=>({id,name:id,content:id,enabled:true,role:'system',position:{type:'relative'}});
    parent.comparePresets.First={prompts:['a','new','b','tail'].map(row)};parent.comparePresets.Second={prompts:['a','b','tail'].map(row)};
    const context=parent.SillyTavern.getContext();parent.savedCompareManager=context.getPresetManager;
    context.getPresetManager=()=>({readPresetExtensionField:({name})=>({groups:[{id:'g',name:'柏宝箱分组',collapsed:true}],prompts:Object.fromEntries((name==='First'?['a','new','b']:['a','b']).map(id=>[id,{groupId:'g'}]))})});
    const {main,merge,groups,diff}=testStores();main.loadPresetContent('First');merge.loadRightPreset('Second');diff.clearCompareResult();
    for(const [name,prompts] of [['First',main.prompts],['Second',merge.rightPrompts]]) await groups.restorePresetSnapshot(name,{groupSource:'baibai',sections:[{id:'baibai_g',displayName:'柏宝箱分组',itemIds:prompts.filter(p=>p.id!=='tail').map(p=>p.id)}],collapsedSections:['baibai_g']},prompts);
  });
  await open();await cycle.click();
  assert.equal(await modal.locator('.pmm-ca-percent').count(),0,'Insert mode reserves no percentage column');
  await modal.locator('.pmm-ca-single').click();
  await page.waitForFunction(()=>!document.querySelector('[data-pmm-compare-modal]'));
  assert.equal(await frame.evaluate(()=>testStores().diff.isCompared),true);
  const insertedCard=page.locator('.preset-panel').nth(1).locator('.prompt-card[data-prompt-id="new"]');
  assert.ok(await insertedCard.isVisible(),'Single insertion reveals its target card');
  const insertedRect=await insertedCard.boundingBox();assert.ok(insertedRect.y>=0&&insertedRect.y+insertedRect.height<=844,'Inserted card is scrolled into view');
  assert.deepEqual((await read()).target.map(p=>p.id),['a','new','b','tail']);
  await frame.evaluate(async()=>{const {groups,merge}=testStores();await groups.initialize('Second',merge.rightPrompts);});
  assert.deepEqual(await frame.evaluate(()=>testStores().groups.getPanelState('Second').sections.find(s=>s.id==='baibai_g').itemIds),['a','new','b']);
  assert.equal(await frame.evaluate(()=>testStores().groups.getPanelState('Second').pendingBaiBaiAssignments.new),'g');
  await page.locator('.preset-panel').nth(1).getByTitle('撤销：对比插入条目',{exact:true}).click();
  assert.equal(await frame.evaluate(()=>testStores().groups.getPanelState('Second').pendingBaiBaiAssignments.new),undefined);
  assert.deepEqual((await read()).target.map(p=>p.id),['a','b','tail']);
  await page.evaluate(()=>{SillyTavern.getContext().getPresetManager=savedCompareManager;});
  await verifyCompareFilters(page,frame,engine,{open,closeDetail});
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
