import assert from 'node:assert/strict';
import {verifyTouchData} from './verify-touch-data.mjs';

export async function verifyTouchTheme(page,frame,engine) {
  await verifyTouchData(page,frame,engine);
  // Observe actual native actions without writing or deleting user-like fixtures.
  const card=page.locator('.prompt-card[data-prompt-id]').first();
  await card.waitFor();
  const tools=card.locator('.prompt-card__actions');
  const buttons=tools.locator('button:visible');
  const target=buttons.last();
  await page.evaluate(()=>{window.actionHits=[];window.toggleHits=0;});
  await tools.evaluate(el=>el.addEventListener('click',event=>{window.actionHits.push(event.target.closest('button')?.title);event.stopImmediatePropagation();},true));
  await card.locator('.prompt-card__toggle').evaluate(el=>el.addEventListener('click',event=>{window.toggleHits++;event.stopImmediatePropagation();},true));
  const tap=async locator=>{const r=await locator.boundingBox();assert.ok(r);await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);};
  const reset=async()=>{await tap(page.locator('[data-pmm-dummy-outside]'));await card.hover();await page.locator('html').evaluate(el=>el.setAttribute('data-pmm-touch-tools',''));await page.waitForTimeout(240);};
  await page.evaluate(()=>{const el=document.createElement('button');el.dataset.pmmDummyOutside='';el.style.cssText='position:fixed;right:0;top:0;width:20px;height:20px;z-index:2147483647';document.body.append(el);});
  await reset();
  assert.equal(await tools.evaluate(el=>Number(getComputedStyle(el).opacity)),0);
  for(let i=0;i<await buttons.count();i++){
    await reset();const button=buttons.nth(i);const before=await page.evaluate(()=>actionHits.length);
    await tap(button);assert.equal(await page.evaluate(()=>actionHits.length),before,'First tap only reveals hidden action');
    await page.waitForTimeout(250);assert.equal(await tools.evaluate(el=>Number(getComputedStyle(el).opacity)),1);
    await tap(button);assert.equal(await page.evaluate(()=>actionHits.length),before+1,'Second tap executes visible action');
  }
  assert.equal(await page.evaluate(()=>toggleHits),0,'Revealing tools does not activate the quick-toggle hot zone');
  await reset();
  const beforeFastTap=await page.evaluate(()=>actionHits.length);
  await tap(target);
  // WebKit may skip opacity transitions when display changes. Hold an actual
  // partially visible frame so both engines test the same readiness boundary.
  await tools.evaluate(el=>{el.style.setProperty('transition','none','important');el.style.setProperty('opacity','.4','important');});
  await tap(target);
  assert.equal(await page.evaluate(()=>actionHits.length),beforeFastTap,'Taps during reveal animation cannot execute an action');
  await tools.evaluate(el=>{el.style.removeProperty('opacity');el.style.removeProperty('transition');});
  await page.waitForTimeout(250);await tap(target);
  assert.equal(await page.evaluate(()=>actionHits.length),beforeFastTap+1);
  await tap(page.locator('.prompt-card[data-prompt-id]').nth(1).locator('.prompt-card__name'));
  assert.equal(await tools.getAttribute('data-pmm-tools-shown'),null,'Touching another entry dismisses the previous toolbar');
  await reset();await tap(card.locator('.prompt-card__toggle'));assert.equal(await page.evaluate(()=>toggleHits),1,'Always-visible toggle stays one tap');
  await reset();
  // Synthetic movement covers browsers without a touchscreen swipe API.
  const hits=await page.evaluate(()=>actionHits.length);
  await target.dispatchEvent('pointerdown',{pointerId:7,pointerType:'touch',isPrimary:true,clientX:200,clientY:200});
  await target.dispatchEvent('pointermove',{pointerId:7,pointerType:'touch',isPrimary:true,clientX:200,clientY:240});
  await target.dispatchEvent('pointerup',{pointerId:7,pointerType:'touch',isPrimary:true,clientX:200,clientY:240});
  assert.equal(await page.evaluate(()=>actionHits.length),hits);
  assert.equal(await tools.getAttribute('data-pmm-tools-shown'),null,'Scroll gesture does not reveal tools');
  await page.setViewportSize({width:1280,height:900});await page.mouse.move(0,0);await card.hover();
  await page.waitForTimeout(250);
  assert.equal(await tools.evaluate(el=>Number(getComputedStyle(el).opacity)),1,'Mouse hover reveals tools before clicking');
  await target.click();assert.equal(await page.evaluate(()=>actionHits.length),hits+1,'Mouse hover remains single click');
  await page.setViewportSize({width:390,height:844});
  await page.locator('.pmm-layout-trigger').click();
  const tuner=page.locator('#pmm-mobile-layout-card');await tuner.waitFor();
  // Magic-wand colors are deliberately not the built-in light/dark defaults.
  for(const [surface,ink,accent] of [['rgb(40, 25, 45)','rgb(240, 220, 238)','rgb(230, 130, 190)'],['rgb(239, 248, 230)','rgb(35, 65, 30)','rgb(55, 140, 70)']]){
    await page.locator('.pm-panel-container').evaluate((el,{surface,ink,accent})=>{el.style.setProperty('--pm-panel-bg',surface);el.style.setProperty('--pm-text-primary',ink);el.style.setProperty('--pm-quote-color',accent);},{surface,ink,accent});
    await page.waitForFunction(({surface,ink,accent})=>{const el=document.getElementById('pmm-mobile-layout-card'),css=getComputedStyle(el);return css.backgroundColor===surface&&css.color===ink&&css.getPropertyValue('--pmm-layout-thumb').trim()===accent;},{surface,ink,accent});
    assert.equal(await tuner.evaluate(el=>getComputedStyle(el.querySelector('[data-pmm-layout-top-notifications]')).getPropertyValue('--pm-accent-color').trim()),accent,'Notice toggle inherits the wand accent too');
    await page.waitForTimeout(250);
    await page.screenshot({path:process.env.PMM_BROWSER_ASSET_DIR+'/tuner-'+(surface.includes('239')?'light':'dark')+'-'+engine+'.png'});
  }
  await page.locator('[data-pmm-layout-glass]').click();
  assert.deepEqual(await tuner.evaluate(el=>{const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.fillStyle=getComputedStyle(el).backgroundColor;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];}),[239,248,230,255],'Solid mode retains theme palette');
  await page.locator('[data-pmm-layout-glass]').click();
  await page.locator('[data-pmm-layout-done]').click();
  await frame.evaluate(async()=>{await import('/worldbook-snapshots.js');});
  await page.evaluate(()=>__PMM_SWITCH_SNAPSHOTS_TEST52__.open());
  const preset=page.locator('.pmm-switch-snapshot-dialog');await preset.waitFor();
  const presetBorder=await preset.evaluate(el=>getComputedStyle(el).borderTopColor);
  assert.ok(/0\.1\)|\/\s*0\.1\)/.test(presetBorder),`Preset outer border should be subtle: ${presetBorder}`);
  assert.deepEqual(await preset.evaluate(el=>{
    // Check the saved-default/create/footer variants in the real snapshot style
    // context even when this fixture opens the first-default onboarding screen.
    return ['pmm-switch-snapshot-default','pmm-switch-snapshot-create','pmm-switch-snapshot-footer'].map(name=>{
      const probe=document.createElement(name.endsWith('footer')?'footer':'section');probe.className=name;el.append(probe);
      const css=getComputedStyle(probe),border=[css.borderTopWidth,css.borderBottomWidth];probe.remove();return border;
    });
  }),[['0px','0px'],['0px','0px'],['0px','0px']],'Preset default/create/footer have no full-width separators');
  await page.evaluate(()=>__PMM_SWITCH_SNAPSHOTS_TEST52__.close());
  await page.evaluate(()=>__PMM_WORLDBOOK_SNAPSHOTS__.open());
  const world=page.locator('.pmm-wbs-dialog');await world.waitFor();
  const worldBorder=await world.evaluate(el=>getComputedStyle(el).borderTopColor);
  assert.ok(/0\.1\)|\/\s*0\.1\)/.test(worldBorder),`Worldbook outer border should match batch dialog: ${worldBorder}`);
  assert.equal(await world.locator('.pmm-wbs-foot').evaluate(el=>getComputedStyle(el).borderTopWidth),'0px','Worldbook footer separator is removed');
  await page.screenshot({path:process.env.PMM_BROWSER_ASSET_DIR+'/snapshot-border-'+engine+'.png'});
  await world.locator('[data-wbs="close"]').click();
  await page.evaluate(()=>__PMM_TOUCH_ACTION_GUARD__.cleanup());
  assert.equal(await page.locator('html').getAttribute('data-pmm-touch-tools'),null);
  console.log(`${engine}: hidden-action two-tap, scroll, mouse, visible toggle, live theme and snapshot borders passed`);
}
