import assert from 'node:assert/strict';

export async function verifyCompareFilters(page, frame, engine, {open,closeDetail}) {
  await frame.evaluate(async()=>{
    const row=(id,name,content)=>({id,name,content,enabled:true,role:'system',position:{type:'relative'}});
    const common='alpha beta gamma delta epsilon zeta eta theta iota kappa ';
    parent.comparePresets.First={prompts:[row('c','正文条目','old content'),row('n','旧名称','same renamed body'),row('lp','相似甲',common+'old'),row('lu','上侧独有','独有苹果'),row('m','一致','identical')]};
    parent.comparePresets.Second={prompts:[row('c','正文条目','new content'),row('n','新名称','same renamed body'),row('rp','相似乙',common+'new'),row('ru','下侧独有','unique zzzzz'),row('m','一致','identical')]};
    const {main,merge,groups,diff}=testStores();main.currentPresetName='First';main.loadPresetContent('First');merge.loadRightPreset('Second');diff.clearCompareResult();
    for(const [name,prompts] of [['First',main.prompts],['Second',merge.rightPrompts]]) await groups.restorePresetSnapshot(name,{groupSource:'manual',sections:[],collapsedSections:[]},prompts);
  });
  await page.setViewportSize({width:390,height:844});await open();
  const modal=page.locator('[data-pmm-compare-modal]:visible');
  const cycle=modal.locator('[data-pmm-compare-mode]');
  const card=key=>modal.locator(`[data-pmm-diff-filter="${key}"]`);
  const nativeRows=()=>modal.locator('[data-pmm-diff-row]:visible');
  const actionNames=()=>modal.locator('.pmm-ca-name').allTextContents();
  const counts=await modal.locator('[data-pmm-diff-filter]').allTextContents();
  assert.equal(counts.length,5,'Only the five difference categories are filters');
  const stats=await frame.evaluate(()=>({...testStores().diff.stats}));
  assert.deepEqual(stats,{contentDiffCount:1,nameDiffCount:1,partialCount:1,leftUniqueCount:1,rightUniqueCount:1,matchCount:1});
  await cycle.click();await cycle.click();
  await verifyCompareSession(page,frame,engine,{closeDetail});
  assert.equal(await nativeRows().count(),5);
  await card('content').click();assert.equal(await nativeRows().count(),1);
  await card('name').click();assert.equal(await nativeRows().count(),2,'Category selections use union');
  await card('content').click();assert.equal(await nativeRows().count(),1);
  await card('name').click();assert.equal(await nativeRows().count(),5,'No selected category restores all rows');
  await card('leftUnique').click();await card('rightUnique').click();
  assert.equal(await nativeRows().count(),2);
  assert.deepEqual(await modal.locator('[data-pmm-diff-filter]').allTextContents(),counts,'Filtering does not alter global counts');
  await page.screenshot({path:process.env.PMM_BROWSER_ASSET_DIR+'/compare-filter-off-'+engine+'.png'});
  await card('leftUnique').click();await card('rightUnique').click();
  await card('content').click();await card('name').click();
  await cycle.click();
  assert.deepEqual(await actionNames(),['正文条目'],'Replace mode still excludes rename-only rows');
  await modal.locator('[data-pmm-compare-select]').click();
  await modal.getByRole('checkbox',{name:'选择 正文条目',exact:true}).check();
  await card('partial').click();
  assert.equal(await modal.locator('.pmm-ca-count').textContent(),'已选 0 条','Changing categories clears selected entries');
  assert.deepEqual(await actionNames(),['正文条目','相似甲']);
  await modal.getByRole('searchbox').fill('相似');
  assert.deepEqual(await actionNames(),['相似甲'],'Text search intersects category filters');
  await modal.locator('[data-pmm-compare-all]').click();
  assert.equal(await modal.locator('.pmm-ca-count').textContent(),'已选 1 条');
  await card('name').click();await card('partial').click();
  assert.equal(await modal.locator('.pmm-ca-count').textContent(),'已选 0 条');
  assert.deepEqual(await actionNames(),[]);
  await modal.getByRole('searchbox').fill('');
  await cycle.click();
  assert.deepEqual(await actionNames(),[],'Insert mode intersects the selected content category');
  await card('content').click();assert.deepEqual(await actionNames(),['上侧独有']);
  await card('rightUnique').click();assert.deepEqual(await actionNames(),[]);
  await modal.getByRole('button',{name:'反转方向'}).click();assert.deepEqual(await actionNames(),['下侧独有']);
  await card('leftUnique').click();assert.deepEqual(await actionNames(),['下侧独有'],'Unique categories remain tied to original physical sides');
  await modal.getByRole('button',{name:'反转方向'}).click();assert.deepEqual(await actionNames(),['上侧独有']);
  await modal.locator('[data-pmm-compare-select]').click();
  await modal.locator('[data-pmm-compare-all]').click();await modal.locator('.pmm-ca-submit').click();
  await modal.locator('.pmm-ca-body[aria-busy="false"]').waitFor();
  assert.equal(await card('leftUnique').getAttribute('aria-pressed'),'true');
  assert.equal(await card('rightUnique').getAttribute('aria-pressed'),'true');
  assert.deepEqual(await actionNames(),[],'Filtered results refresh without resetting selected categories');
  assert.equal(await frame.evaluate(()=>testStores().diff.stats.leftUniqueCount),0);
  await cycle.click();assert.equal(await nativeRows().count(),1);
  await card('leftUnique').click();await card('rightUnique').click();
  await card('name').focus();await page.keyboard.press('Enter');assert.equal(await nativeRows().count(),1);
  await page.keyboard.press('Space');assert.equal(await nativeRows().count(),4);
  await closeDetail();
  console.log(`${engine}: category union, toggle reset, search/mode intersection, selection clearing and refresh retention passed`);
}

async function verifyCompareSession(page,frame,engine,{closeDetail}) {
  const modal=page.locator('[data-pmm-compare-modal]:visible');
  const cycle=modal.locator('[data-pmm-compare-mode]');
  const reopen=async()=>{
    await page.getByTitle('查看详细比对结果',{exact:true}).click();
    if(page.viewportSize().width<=768) await page.locator('#pmm-diff-detail-portal [data-pmm-compare-mode]').waitFor();
    await cycle.waitFor();
  };
  await frame.evaluate(()=>{window.compareWarnings=[];window.savedCompareWarning=toastr.warning;toastr.warning=message=>compareWarnings.push(message);});
  try {
    for(const width of [390,1280]) {
      await closeDetail();await page.setViewportSize({width,height:844});await reopen();
      assert.equal(await cycle.textContent(),'关闭');
      for(const [key,label] of [['content','内容不同'],['partial','正文相似']]) {
        const card=modal.locator(`[data-pmm-diff-filter="${key}"]`),text=card.getByText(label,{exact:true});
        assert.equal(await text.evaluate(el=>getComputedStyle(el).textDecorationLine),'none','Category labels have no entry underline');
        await text.click();assert.equal(await card.getAttribute('aria-pressed'),'true','Clicking the label filters');
        assert.equal(await modal.locator('[data-pmm-diff-row]:visible').count(),1);
        assert.equal(await page.locator('.pmm-content-diff').count(),0,'Category label does not open a body editor');
        assert.deepEqual(await frame.evaluate(()=>compareWarnings),[],'Category label never emits an entry lookup warning');
        await modal.locator('[data-pmm-diff-row]:visible').getByText(label,{exact:true}).click();
        await page.locator('.pmm-content-diff-back').waitFor();
        await page.locator('.pmm-content-diff-back').click();
        await text.click();assert.equal(await card.getAttribute('aria-pressed'),'false');
      }
      for(const expected of ['替换','插入','关闭']) {
        await cycle.click();assert.equal(await cycle.textContent(),expected);
        await closeDetail();await reopen();
        assert.equal(await cycle.textContent(),expected,'Closing only details retains the current operation mode');
      }
      await cycle.click();await cycle.click();assert.equal(await cycle.textContent(),'插入');
      await closeDetail();await frame.evaluate(()=>testStores().diff.clearCompareResult());
      await page.locator('.preset-panel').nth(1).getByTitle('比对',{exact:true}).click();await reopen();
      assert.equal(await cycle.textContent(),'关闭','Ending and restarting comparison resets operation mode');
    }
    await closeDetail();await page.setViewportSize({width:390,height:844});await reopen();
  } finally {
    await frame.evaluate(()=>{toastr.warning=savedCompareWarning;delete window.savedCompareWarning;});
  }
  console.log(`${engine}: mobile/desktop category label clicks and comparison-session mode retention passed`);
}
