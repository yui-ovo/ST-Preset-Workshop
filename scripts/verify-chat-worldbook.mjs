import assert from 'node:assert/strict';

export async function verifyChatWorldbook(page) {
  const toggle = page.locator('.side-panel-root [data-pmm-worldbook-placeholder="1"]');
  const bottom = page.locator('[data-pmm-wb-panel="bottom"]');
  const select = bottom.getByRole('combobox',{name:'选择世界书'});
  const open = async name => {
    await toggle.click();
    await bottom.waitFor();
    assert.equal(await select.inputValue(),name);
  };
  const close = async () => { await toggle.click(); await bottom.waitFor({state:'detached'}); };
  const manual = async name => {
    await select.selectOption(name);
    await page.waitForFunction(expected => window.__PMM_WORLDBOOK_STITCH_TEST3__.state.bottom.entries[0]?.comment === expected,name);
  };
  await page.evaluate(() => {
    const ctx = SillyTavern.getContext();
    ctx.characters = [
      {name:'同名',avatar:'old.png',data:{extensions:{world:'Source'}}},
      {name:'同名',avatar:'new.png',data:{extensions:{world:' target '}}},
    ];
    ctx.characterId = 1;
    fixtureBooks['手选'] = {entries:{0:{uid:0,comment:'手选',content:'手动选中的条目'}}};
    window.bindingReads = [];
    TavernHelper.getCharacterNames = () => { bindingReads.push('all'); return []; };
    TavernHelper.getCharWorldbookNames = who => {
      bindingReads.push(who);
      return { primary:'已删除', additional:['未安装','Target'] };
    };
  });
  assert.equal(await page.evaluate(()=>fixtureWorldLoads),0);
  await open('Target');
  assert.equal(await page.evaluate(()=>fixtureWorldLoads),1);
  assert.deepEqual(await page.evaluate(()=>bindingReads),[]);
  await bottom.getByText('已有条目',{exact:true}).waitFor();
  await manual('手选');
  await page.locator('.pm-main-wrapper > .preset-panel:not(.pmm-wb-inline-panel) [data-wb-kind="world"]').click();
  await page.locator('[data-pmm-wb-panel="top"]').waitFor();
  assert.equal(await select.inputValue(),'手选');
  await page.locator('[data-pmm-wb-panel="top"] [data-wb-kind="preset"]').click();
  await close();

  // Re-enter in the other same-name card. A numeric id of zero is a valid character.
  await page.evaluate(()=>{ SillyTavern.getContext().characterId = 0; });
  await open('Source');
  await manual('手选');
  await close();
  await page.evaluate(()=>{ SillyTavern.getContext().groupId = 'group'; });
  await open('手选');
  await close();
  await page.evaluate(()=>{
    const ctx = SillyTavern.getContext();
    ctx.groupId = null; ctx.characterId = undefined;
  });
  await open('手选');
  await close();
  assert.deepEqual(await page.evaluate(()=>bindingReads),[]);

  await page.evaluate(()=>{
    const ctx = SillyTavern.getContext();
    ctx.characterId = '0'; delete ctx.characters[0].data.extensions.world;
  });
  await open('Target');
  assert.deepEqual(await page.evaluate(()=>bindingReads),['current']);
  await bottom.locator('[data-wb-action="source-picker"]').click();
  await page.locator('.pmm-wb-picker-dialog').waitFor();
  assert.deepEqual(await page.evaluate(()=>bindingReads),['current','all']);
  await page.locator('.pmm-wb-picker-head button').click();
  await close();

  await page.evaluate(()=>{
    TavernHelper.getCharWorldbookNames = () => { throw Error('绑定暂时不可用'); };
  });
  await open('Target');
  await close();
  await page.evaluate(()=>{
    const ctx = SillyTavern.getContext();
    ctx.characterId = 1;
    ctx.characters[1] = {avatar:'new.png',name:'同名',shallow:true};
    ctx.unshallowCharacter = async id => {
      if (id !== 1) throw Error('Only the current chat card should be loaded');
      ctx.characters[id] = {...ctx.characters[id],shallow:false,data:{extensions:{world:'Source'}}};
    };
  });
  await open('Source');
  await close();
  assert.equal(await page.evaluate(()=>fixtureWorldWrites),0);
}
