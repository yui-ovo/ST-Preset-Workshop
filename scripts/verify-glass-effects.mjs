import assert from 'node:assert/strict';
import { resolve } from 'node:path';

export async function verifyGlassEffects(page, frame, engine, pass = 0) {
  const toggle = page.locator('[data-pmm-layout-glass]');
  const open = async () => {
    if (!(await page.locator('.pmm-layout-trigger').isVisible())) await page.locator('.side-tab').click();
    await page.locator('.pmm-layout-trigger').click();
    await toggle.waitFor({ state:'visible' });
  };
  const close = () => page.locator('[data-pmm-layout-done]').click();
  const blur = node => { const s = getComputedStyle(node); return s.backdropFilter || s.webkitBackdropFilter || 'none'; };
  const opaque = value => !value.startsWith('rgba(') && !/\/\s*0?\./.test(value) && value !== 'transparent';
  await open();
  assert.equal(await toggle.getAttribute('aria-checked'), pass ? 'false' : 'true');
  if (pass) {
    assert.equal(await page.locator('html').getAttribute('data-pmm-glass'), 'off', 'Page reload keeps the disabled preference');
    assert.equal(await page.locator('#pmm-mobile-layout-card').evaluate(blur), 'none');
    await page.locator('[data-pmm-layout-reset]').click();
    assert.equal(await toggle.getAttribute('aria-checked'), 'true', 'Restore defaults restores the glass preference');
    assert.notEqual(await page.locator('#pmm-mobile-layout-card').evaluate(blur), 'none');
    await close();
    console.log(`${engine}: full page reload and restore defaults passed`);
    return;
  }
  const initial = await page.locator('#pmm-mobile-layout-card').evaluate(blur);
  assert.notEqual(initial, 'none', 'Existing glass appearance remains the default');
  // A host-owned surface must not be affected by the workshop setting.
  await page.evaluate(() => {
    const host = document.createElement('div'); host.id = 'host-glass-test';
    host.style.cssText = 'position:fixed;left:-100px;backdrop-filter:blur(5px);background:rgba(30,40,50,.4)';
    document.body.append(host);
  });
  const hostBefore = await page.locator('#host-glass-test').evaluate(blur);
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-checked'), 'false');
  assert.equal(await page.evaluate(() => localStorage.getItem('pmm_glass_effects_enabled_v1')), '0');
  await page.waitForTimeout(400); // Existing card transitions settle after changing styles.
  const filtered = await page.locator('#preset-manager-main-panel, #preset-manager-main-panel *').evaluateAll(nodes => nodes.filter(node => {
    const s = getComputedStyle(node); const f = s.backdropFilter || s.webkitBackdropFilter;
    return f && f !== 'none';
  }).map(node => node.className));
  assert.deepEqual([...new Set(filtered)], [], 'All panel layers, including settings, release their blur');
  assert.equal(await frame.locator('html').getAttribute('data-pmm-glass'), 'off', 'Hidden runtime gets the same preference');
  assert.equal(await page.locator('#host-glass-test').evaluate(blur), hostBefore, 'Host theme remains unchanged');
  const floating = frame.locator('#preset-manager-floating-panel .panel-wrapper');
  if (await floating.count()) {
    assert.equal(await floating.evaluate(blur), 'none', 'Floating preset picker stops blurring too');
    assert.ok(opaque(await floating.evaluate(node => getComputedStyle(node).backgroundColor)), 'Floating surface is opaque');
  }
  const saved = process.env.PMM_SCREENSHOT_DIR;
  if (saved) await page.screenshot({ path:resolve(saved, `glass-off-${engine}.png`) });
  await toggle.click();
  assert.equal(await page.locator('#pmm-mobile-layout-card').evaluate(blur), initial, 'Turning back on restores the original effect');
  await toggle.click();
  await close();
  // Theme updates must flow through the existing Vue store while glass is off.
  const backgrounds = new Set();
  for (let step = 0; step < 3; step++) {
    await page.locator('.pmm-mobile-theme-toggle').click();
    await page.waitForTimeout(350);
    const bg = await page.locator('.preset-panel').first().evaluate(node => getComputedStyle(node).backgroundColor);
    assert.ok(opaque(bg), `Theme ${step} must have an opaque panel (${bg})`);
    backgrounds.add(bg);
  }
  assert.ok(backgrounds.size >= 2, 'Day/night still change the opaque panel color');
  for (const width of [320, 820, 1280]) {
    await page.setViewportSize({ width, height:900 });
    await page.waitForTimeout(150);
    await open();
    const dialog = await page.locator('#pmm-mobile-layout-card').boundingBox();
    const control = await toggle.boundingBox();
    assert.ok(control.x >= dialog.x && control.x + control.width <= dialog.x + dialog.width + 1, 'Toggle fits the settings card');
    assert.ok(dialog.y >= 0 && dialog.y + dialog.height <= 901, 'Settings stay inside viewport');
    assert.equal(await toggle.getAttribute('aria-checked'), 'false');
    await close();
  }
  // Body-level snapshot overlays are not descendants of the main panel.
  await page.evaluate(async () => {
    const { openSnapshotBackup } = await import('/snapshot-backup.js');
    openSnapshotBackup(window);
  });
  const backup = page.locator('#pmm-snapshot-backup .pmm-backup-panel');
  await backup.waitFor({ state:'visible' });
  assert.ok(opaque(await backup.evaluate(node => getComputedStyle(node).backgroundColor)), 'Snapshot backup also gets an opaque surface');
  await page.locator('#pmm-snapshot-backup [data-close]').click();
  // Portal inline !important filters and newly created windows use the current preference.
  await page.evaluate(() => {
    const portal = document.createElement('div'); portal.dataset.pmmGlassPortal = '1'; portal.id = 'glass-test-portal';
    portal.style.setProperty('backdrop-filter', 'var(--pmm-glass-filter, blur(7px))', 'important');
    document.body.append(portal);
  });
  assert.equal(await page.locator('#glass-test-portal').evaluate(blur), 'none');
  await page.evaluate(() => document.querySelector('#glass-test-portal').remove());
  console.log(`${engine}: default, toggling, opaque day/night, mobile/tablet/desktop, portal and host isolation passed`);
}
