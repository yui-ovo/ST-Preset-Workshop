import assert from 'node:assert/strict';

export async function verifyDndCompat(page, frame, engine) {
  page.setDefaultTimeout(7000);
  await page.evaluate(() => {
    const api = window.__PMM_MOBILE_DND_COMPAT_V266__;
    api.setEnabled(false);
    const add = document.addEventListener;
    document.addEventListener = function(type, listener, options) {
      if (type === 'dragstart' && listener.name === 'onNativeDragStart') window.testNativeStart = listener;
      return add.call(this, type, listener, options);
    };
    try { api.setEnabled(true); } finally { document.addEventListener = add; }
    window.testTouch = (type, id, x, y) => {
      const el = document.querySelector(`:is(.prompt-item,.prompt-card)[data-prompt-id="${id}"]`);
      const init = {identifier:11, target:el, clientX:x, clientY:y};
      let event;
      try {
        const touch = new Touch(init);
        event = new TouchEvent(type, {bubbles:true, cancelable:true,
          changedTouches:[touch], touches:/end|cancel/.test(type)?[]:[touch]});
      } catch (_) {
        // Desktop WebKit exposes Touch but does not allow constructing it.
        event = new Event(type, {bubbles:true,cancelable:true});
        Object.defineProperties(event, {changedTouches:{value:[init]},touches:{value:/end|cancel/.test(type)?[]:[init]}});
      }
      el.dispatchEvent(event);
    };
    // Native isTrusted cannot be fabricated through dispatchEvent. Invoke the
    // captured production handler for that race; touch/drop still use real DOM.
    window.testNativeRace = id => {
      let prevented=false, stopped=false;
      testNativeStart({isTrusted:true, target:document.querySelector(`:is(.prompt-item,.prompt-card)[data-prompt-id="${id}"]`),
        preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}});
      return {prevented,stopped};
    };
  });
  const row = id => page.locator(`:is(.prompt-item,.prompt-card)[data-prompt-id="${id}"]`).first();
  const order = () => frame.evaluate(() => testStores().main.prompts.map(p=>p.id));
  const touch = (type,id,point) => page.evaluate(({type,id,point})=>testTouch(type,id,point.x,point.y),{type,id,point});
  const point = async id => {
    await row(id).scrollIntoViewIfNeeded();
    const r=await row(id).boundingBox();assert.ok(r);
    return {x:r.x+r.width*.35,y:r.y+r.height*.5};
  };
  const before = await order();
  const start = await point('p1');
  await touch('touchstart','p1',start);
  assert.deepEqual(await page.evaluate(()=>testNativeRace('p1')),{prevented:true,stopped:true});
  await page.waitForFunction(()=>document.querySelector('.pmm-dnd-compat-ghost'));
  assert.deepEqual(await page.evaluate(()=>testNativeRace('p1')),{prevented:true,stopped:true});
  assert.deepEqual(await page.evaluate(()=>testNativeRace('p2')),{prevented:false,stopped:false});
  const destination = await point('p0');destination.y-=8;
  await touch('touchmove','p1',destination);
  await page.waitForTimeout(50);
  await touch('touchend','p1',destination);
  await page.waitForTimeout(150);
  assert.deepEqual(await order(),['p1','p0',...before.slice(2)],'Single drop updates real preset order despite native races');
  assert.equal(await page.locator('.pmm-dnd-compat-ghost').count(),0);

  // Moving before the hold threshold remains scrolling, never a drop.
  const stable = await order(), scrollStart=await point('p2');
  await touch('touchstart','p2',scrollStart);
  await touch('touchmove','p2',{...scrollStart,y:scrollStart.y+25});
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.pmm-dnd-compat-ghost').count(),0);
  await touch('touchend','p2',scrollStart);
  assert.deepEqual(await order(),stable);

  // Disabling during a gesture cleans it up without dropping. Re-enabling works.
  await touch('touchstart','p2',scrollStart);
  await page.waitForFunction(()=>document.querySelector('.pmm-dnd-compat-ghost'));
  await page.evaluate(()=>__PMM_MOBILE_DND_COMPAT_V266__.setEnabled(false));
  assert.deepEqual(await page.evaluate(()=>testNativeRace('p2')),{prevented:false,stopped:false});
  assert.equal(await page.locator('.pmm-dnd-compat-ghost').count(),0);
  await touch('touchend','p2',scrollStart);
  assert.deepEqual(await order(),stable);
  await page.evaluate(()=>__PMM_MOBILE_DND_COMPAT_V266__.setEnabled(true));
  await touch('touchstart','p2',scrollStart);
  await page.waitForFunction(()=>document.querySelector('.pmm-dnd-compat-ghost'));
  await touch('touchcancel','p2',scrollStart);
  assert.equal(await page.locator('.pmm-dnd-compat-ghost').count(),0);
  assert.deepEqual(await order(),stable);
  await page.locator('button[title="多选"]').first().click();
  for (const id of ['p3','p2']) {
    await page.locator('.prompt-item').filter({has:row(id)}).locator('.prompt-item__checkbox').click();
  }
  const batchStart=await point('p3');
  await touch('touchstart','p3',batchStart);
  assert.deepEqual(await page.evaluate(()=>testNativeRace('p3')),{prevented:true,stopped:true});
  await page.waitForFunction(()=>document.querySelector('.pmm-dnd-compat-ghost'));
  const batchTarget=await point('p1');batchTarget.y-=8;
  await touch('touchmove','p3',batchTarget);
  await page.waitForTimeout(50);
  await touch('touchend','p3',batchTarget);
  await page.waitForTimeout(150);
  assert.deepEqual(await order(),['p2','p3','p1','p0',...before.slice(4)],'Batch drag preserves original list order, regardless of selection order');
  assert.equal(await page.locator('.pmm-dnd-compat-ghost').count(),0);
  console.log(`${engine}: compatibility native-start races, real single/batch drops, scroll/cancel and mode switching passed`);
}
