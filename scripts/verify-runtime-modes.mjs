import assert from 'node:assert/strict';
export async function verifyRuntimeModes(page, engine) {
  page.setDefaultTimeout(12000);
  await page.evaluate(async()=>{
    TavernHelper._bind={}; TavernHelper.z=await import('/zod4.mjs');
    window.z=TavernHelper.z;
    const settings=document.createElement('div');settings.id='extensions_settings';document.body.append(settings);
    const preset=document.createElement('div');preset.innerHTML='<select id="settings_preset_openai"><option>First</option></select><button id="update_oai_preset">Save</button>';document.body.append(preset);
    // Mimic the native delegated drawer interaction, not a custom mode design.
    $(document).on('click','.inline-drawer-toggle',function(){$(this).next().toggle();});
    window.otherExtensionCalls=0;document.addEventListener('fixture-event',()=>otherExtensionCalls++);
    window.modeBootMarker={};
    const context=SillyTavern.getContext();
    window.modeListeners=new Map();context.eventTypes.CHAT_CHANGED='chat';
    context.eventSource.on=(type,fn)=>{if(!modeListeners.has(type))modeListeners.set(type,new Set());modeListeners.get(type).add(fn);};
    context.eventSource.off=context.eventSource.removeListener=(type,fn)=>modeListeners.get(type)?.delete(fn);
    localStorage.setItem('pmm.switch-snapshots.v1',JSON.stringify({version:1,snapshots:[{id:'kept',name:'保留的快照',presetName:'First',states:[{id:'p0',name:'Prompt 0',enabled:false}]}]}));
    await import('/index.js');
  });
  const runtime=()=>page.frames().find(f=>f.name().startsWith('TH-script--'));
  await page.waitForFunction(()=>document.querySelector('iframe[id^="TH-script--"]')?.contentWindow?.testOpen);
  await page.waitForFunction(()=>document.getElementById('preset-manager-floating-panel'));
  await page.locator('#pmm-runtime-mode-settings .inline-drawer-header').click();
  assert.ok(await page.getByRole('checkbox',{name:'完整模式'}).isVisible());
  const marker=await page.evaluate(()=>modeBootMarker);
  let snapshotListenerCount;
  for(let pass=0;pass<3;pass++) {
    // Exercise the actual full app before teardown, including lazy modules.
    await runtime().evaluate(async()=>{testOpen();await __PMM_LOAD_WORLDBOOK_STITCH__();await __PMM_LOAD_REGEX_MANAGER__();});
    await page.waitForFunction(()=>document.getElementById('preset-manager-main-panel'));
    if(pass===0) {
      await runtime().evaluate(()=>{testStores().main.prompts[0].content+='dirty mode guard';});
      // The open workshop covers the settings in this bare fixture. Dispatch a
      // settings change to exercise the checkbox's cancellation/rollback path.
      await page.getByRole('checkbox',{name:'完整模式'}).evaluate(input=>{input.checked=false;input.dispatchEvent(new Event('change',{bubbles:true}));});
      await page.locator('[data-pmm-editing-dialog]').getByRole('button',{name:'继续编辑'}).click();
      await page.waitForFunction(()=>document.querySelector('[aria-label="完整模式"]').checked&&!document.querySelector('[aria-label="完整模式"]').disabled);
      assert.equal(await page.locator('#preset-manager-main-panel').count(),1,'Cancel retains the full workshop');
      await runtime().evaluate(()=>testStores().main.discardChanges());
    }
    // Like a user, close the foreground workshop before clicking settings behind it.
    await page.evaluate(()=>__PMM_WORKSHOP_EDITING__.closeMain());
    await page.locator('#preset-manager-main-panel').waitFor({state:'detached'});
    await page.evaluate(()=>{window.previousScope=document.querySelector('iframe[id^="TH-script--"]').contentWindow.__PMM_RUNTIME_SCOPE__;});
    await page.getByRole('checkbox',{name:'完整模式'}).uncheck();
    await page.waitForFunction(()=>!document.getElementById('preset-manager-floating-panel')&&document.querySelector('iframe[id^="TH-script--"]')?.contentWindow?.__PMM_RUNTIME_SCOPE__?.active && !document.querySelector('[aria-label="完整模式"]').disabled);
    assert.deepEqual(await page.evaluate(()=>previousScope.stats()),{listeners:0,observers:0,timers:0,emitters:0});
    assert.equal(await page.evaluate(()=>previousScope.active),false);
    assert.equal(await page.locator('#preset-manager-main-panel').count(),0);
    assert.equal(await page.evaluate(()=>typeof __PMM_WORLDBOOK_STITCH_TEST3__),'undefined');
    assert.equal(await runtime().evaluate(()=>typeof Vue),'undefined','Snapshot mode does not retain full runtime libraries');
    assert.equal(await page.locator('[data-pmm-native-preset-action="snapshot"]').count(),1);
    assert.equal(await page.locator('[data-pmm-native-preset-action="batch"]').count(),0);
    await page.keyboard.press('Control+Shift+P');
    assert.equal(await page.locator('#preset-manager-main-panel').count(),0,'Old full-mode shortcut was detached');
    const snapshotData=await page.evaluate(()=>JSON.parse(localStorage.getItem('pmm.switch-snapshots.v1')));
    assert.ok(snapshotData.snapshots.some(s=>s.id==='kept'&&s.states[0].enabled===false),'Saved snapshot survives mode replacement');
    const count=await page.evaluate(()=>[...modeListeners.values()].reduce((n,set)=>n+set.size,0));
    assert.ok(count>0,'Snapshot binding remains subscribed');
    snapshotListenerCount ??= count;assert.equal(count,snapshotListenerCount,'Context subscriptions do not accumulate');
    await page.evaluate(()=>document.dispatchEvent(new Event('fixture-event')));
    assert.equal(await page.evaluate(()=>otherExtensionCalls),pass+1,'Other extension listeners survive teardown');
    assert.deepEqual(await page.evaluate(()=>modeBootMarker),marker);
    await page.evaluate(()=>{window.previousScope=document.querySelector('iframe[id^="TH-script--"]').contentWindow.__PMM_RUNTIME_SCOPE__;});
    await page.getByRole('checkbox',{name:'完整模式'}).check();
    await page.waitForFunction(()=>document.getElementById('preset-manager-floating-panel')&&!document.querySelector('[aria-label="完整模式"]').disabled);
    assert.deepEqual(await page.evaluate(()=>previousScope.stats()),{listeners:0,observers:0,timers:0,emitters:0});
    assert.equal(await page.locator('[data-pmm-native-preset-action="snapshot"]').count(),1);
    assert.equal(await page.locator('#preset-manager-floating-panel').count(),1);
    assert.equal(await page.locator('iframe[id^="TH-script--"]').count(),1);
  }
  console.log(`${engine}: production boot, native mode settings, three full/snapshot round trips, lazy modules and resource teardown passed`);
}

