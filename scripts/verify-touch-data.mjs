import assert from 'node:assert/strict';

export async function verifyTouchData(page,frame,engine) {
  const read=()=>frame.evaluate(()=>{const {items,categories}=parent.__PMM_FAVORITE_STORE__.read();return {prompts:JSON.parse(JSON.stringify(testStores().main.prompts)),right:JSON.parse(JSON.stringify(testStores().merge.rightPrompts)),dirty:testStores().merge.isDirty,favorites:{items,categories}};});
  await page.locator('.panel-btn[title="缝合"]').click();
  await page.locator('.preset-panel .title-select').nth(1).selectOption('Second');
  const card=page.locator('.pm-panel-container > .preset-panel .prompt-card[data-prompt-id]').first();
  await card.waitFor();
  const star=card.locator('.prompt-card__action--favorite');
  await card.hover();const r=await star.boundingBox();assert.ok(r);
  const point={x:r.x+r.width/2,y:r.y+r.height/2};
  await page.evaluate(()=>{const button=document.createElement('button');button.id='touch-data-outside';button.style.cssText='position:fixed;left:0;top:0;width:20px;height:20px;z-index:2147483647';button.onclick=event=>event.stopPropagation();document.body.append(button);});
  await page.mouse.move(0,0);
  await page.touchscreen.tap(10,10);await page.waitForTimeout(250);
  assert.equal(await star.boundingBox(),null,'Start with mobile actions display:none, not pre-hovered');
  const before=await read();
  await page.touchscreen.tap(point.x,point.y);await page.waitForTimeout(300);
  assert.deepEqual(await read(),before,'First touch in the hidden star location must not change favorite data, prompts, switches or dirty state');
  assert.equal(await star.getAttribute('aria-pressed'),'false');
  assert.notEqual(await star.locator('i').evaluate(el=>getComputedStyle(el).color),'rgb(251, 191, 36)','An unstarred touch-hover icon must not look favorited');
  assert.equal(await card.locator('.prompt-card__actions').getAttribute('data-pmm-tools-shown'),'','First touch reveals the toolbar');
  const visible=await star.boundingBox();await page.touchscreen.tap(visible.x+visible.width/2,visible.y+visible.height/2);
  await page.waitForFunction(()=>__PMM_FAVORITE_STORE__.read().items.length>0);
  const after=await read();assert.equal(after.favorites.items.length,before.favorites.items.length+1);
  assert.deepEqual(after.prompts,before.prompts);assert.deepEqual(after.right,before.right);assert.equal(after.dirty,before.dirty);
  await star.click();await page.waitForFunction(()=>__PMM_FAVORITE_STORE__.read().items.length===0);
  await page.locator('.panel-btn[title="缝合"]').click();
  await page.locator('#touch-data-outside').evaluate(el=>el.remove());
  console.log(`${engine}: cold hidden toolbar tap preserves real favorite library, both preset drafts and dirty state`);
}
