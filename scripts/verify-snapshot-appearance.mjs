import assert from 'node:assert/strict';

// Use the production snapshot sheets and their complete stylesheets. The sample
// children cover saved snapshots without changing fixture/user storage.
export async function verifySnapshotAppearance(page, engine) {
  const hostStyle = await page.addStyleTag({content:'button { background:#eee; color:#eee; }'});
  const palette = async locator => locator.evaluate(el => {
    const css = getComputedStyle(el), canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    const rgba = color => { ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data]; };
    return {bg:rgba(css.backgroundColor), ink:rgba(css.color), border:rgba(css.borderTopColor)};
  });
  for (const [tone,surface,ink,accent] of [
    ['dark','#191919','#eeeeee','#dddddd'],
    ['light','#fafafa','#303030','#505050'],
  ]) {
    // A persistent theme rule survives Vue's responsive style-attribute updates.
    const themeStyle = await page.addStyleTag({content:`body,.preset-panel,.pmm-wb-inline-panel,.floating-panel-root {
      --pm-panel-bg:${surface}!important;--pm-card-bg:${surface}!important;
      --pm-text-primary:${ink}!important;--pm-accent:${accent}!important;
      --fp-glass-bg:${surface}!important;--fp-card-bg:${surface}!important;
      --fp-text-color:${ink}!important;--fp-accent-color:${accent}!important;
    }`});
    await page.evaluate(() => __PMM_SWITCH_SNAPSHOTS_TEST52__.open());
    const preset = page.locator('.pmm-snapshot-hub-preset .pmm-switch-snapshot-dialog');
    await preset.waitFor();
    await preset.evaluate(el => {
      el.innerHTML = `<header class="pmm-switch-snapshot-head"><div><h2>预设快照</h2><p>样式测试预设 v1.26</p></div></header>
        <section class="pmm-switch-snapshot-default is-saved"><div class="pmm-switch-snapshot-default-copy"><div>预设默认</div><small>124/297 条 · 20 分组</small></div><div class="pmm-switch-snapshot-default-actions"><button>恢复默认</button><button>更新默认</button></div></section>
        <div class="pmm-switch-snapshot-create"><button>＋ 新建开关快照</button></div>
        <div class="pmm-switch-snapshot-list"><article class="pmm-switch-snapshot-row"><div class="pmm-switch-snapshot-copy"><div class="pmm-switch-snapshot-name">角色快照</div><div class="pmm-switch-snapshot-meta">124/297 条 · 20 分组</div></div><div class="pmm-switch-snapshot-actions"><button>全局应用</button></div></article></div>
        <footer class="pmm-switch-snapshot-footer">快照保存条目开关与分组开关。</footer>`;
    });
    const create = preset.locator('.pmm-switch-snapshot-create');
    assert.deepEqual(await create.evaluate(el => {
      const css=getComputedStyle(el);return [css.backgroundColor,css.backgroundImage,css.borderTopWidth,css.borderBottomWidth,css.boxShadow];
    }),['rgba(0, 0, 0, 0)','none','0px','0px','none'],'Only the new-snapshot button has a surface; its wrapper is transparent');
    assert.equal(await preset.locator('.pmm-switch-snapshot-default-copy').evaluate(el=>getComputedStyle(el).flexGrow),'1','Default-copy selector survives separator removal');
    const newPreset = await palette(create.locator('button'));
    const applyPreset = await palette(preset.locator('.pmm-switch-snapshot-actions>button'));
    assert.ok(newPreset.bg[3] < 40 && applyPreset.bg[3] < 40,'Host white button fill must not leak through');
    assert.ok(newPreset.ink.slice(0,3).every(v=>tone==='dark'?v>200:v<70),'Button text follows the sheet theme');
    assert.equal(newPreset.ink[3],255);
    await page.screenshot({path:process.env.PMM_BROWSER_ASSET_DIR+`/snapshot-preset-${tone}-${engine}.png`});
    await page.evaluate(()=>__PMM_SWITCH_SNAPSHOTS_TEST52__.close());
    await page.evaluate(()=>__PMM_WORLDBOOK_SNAPSHOTS__.open());
    const world=page.locator('.pmm-wbs-dialog');await world.waitFor();
    await world.locator('.pmm-wbs-body').evaluate(el=>{
      el.innerHTML='<div class="pmm-switch-snapshot-create"><button data-wbs="new">＋ 新建开关快照</button></div><article class="pmm-wbs-row"><span>角色快照</span><button data-wbs="apply">全局应用</button></article>';
    });
    assert.equal((await palette(world.locator('.pmm-switch-snapshot-create'))).bg[3],0,'Worldbook new-snapshot wrapper is also transparent');
    assert.deepEqual(await palette(world.locator('[data-wbs="new"]')),newPreset,'Preset/worldbook new buttons use the same palette');
    assert.deepEqual(await palette(world.locator('[data-wbs="apply"]')),applyPreset,'Preset/worldbook apply buttons use the same palette');
    await page.screenshot({path:process.env.PMM_BROWSER_ASSET_DIR+`/snapshot-worldbook-${tone}-${engine}.png`});
    await world.locator('[data-wbs="close"]').click();
    await themeStyle.evaluate(el=>el.remove());
  }
  await hostStyle.evaluate(el=>el.remove());
  console.log(`${engine}: snapshot wrappers, host-style isolation and matching light/dark button palettes passed`);
}
