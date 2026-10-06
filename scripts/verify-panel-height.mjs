import assert from 'node:assert/strict';

export async function verifyPanelHeight(page, frame) {
  const panel = page.locator('#preset-manager-main-panel .pm-panel-container');
  const measure = () => panel.evaluate(el => {
    const rect = el.getBoundingClientRect();
    const overlay = el.closest('.pm-overlay');
    const bounds = overlay.getBoundingClientRect();
    const style = getComputedStyle(overlay);
    const top = bounds.top + parseFloat(style.paddingTop);
    const bottom = bounds.bottom - parseFloat(style.paddingBottom);
    return { top: rect.top, bottom: rect.bottom, height: rect.height, available: bottom - top, center: (top + bottom) / 2 };
  });
  const baseline = await measure();
  await page.locator('.pmm-layout-trigger').click();
  const slider = page.locator('[data-pmm-layout-input="panelHeight"]');
  await slider.fill('80');
  await page.locator('[data-pmm-layout-done]').click();
  await page.waitForTimeout(300);
  let rect = await measure();
  assert.ok(Math.abs(rect.height - rect.available * .8) < 2, JSON.stringify(rect));
  assert.ok(Math.abs((rect.top + rect.bottom) / 2 - rect.center) < 2, 'Workspace stays centered within safe area');
  assert.ok(rect.top > baseline.top + 40, 'Top toolbar moves away from the camera');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('pmm_mobile_layout_shared_v2')).mobile.values.panelHeight === 80);
  await frame.evaluate(() => { testClose(); testOpen(); });
  await page.waitForFunction(() => document.querySelector('.pm-panel-container')?.getBoundingClientRect().height > 100);
  await page.waitForTimeout(300);
  rect = await measure();
  assert.ok(Math.abs(rect.height - rect.available * .8) < 2, 'Reopening restores the selected height');
  await page.setViewportSize({ width:1280, height:900 });
  await page.waitForTimeout(250);
  assert.equal(await page.locator('#preset-manager-main-panel').evaluate(el => el.classList.contains('pmm-layout-custom-panel-height')), false, 'Mobile height does not override desktop layout');
  await page.setViewportSize({ width:390, height:844 });
  await page.waitForTimeout(250);
  // Simulate a host-reported safe area: the chosen percentage must fit inside it.
  await page.locator('#preset-manager-main-panel').evaluate(el => el.style.setProperty('--pmm-safe-top', '54px'));
  rect = await measure();
  assert.ok(rect.top >= 54 && Math.abs(rect.height - rect.available * .8) < 2, 'Automatic safe area and manual height compose');
  await page.locator('#preset-manager-main-panel').evaluate(el => el.style.removeProperty('--pmm-safe-top'));
  // Use the visible mode button; both panes must stay within the smaller workspace.
  await page.locator('.panel-btn[title="收藏"]').click();
  await page.waitForFunction(() => document.querySelector('.pm-panel-container--favorite-mode'));
  const panes = await page.locator('.preset-panel').evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { top:r.top, bottom:r.bottom, height:r.height }; }));
  rect = await measure();
  assert.ok(panes.length >= 2 && panes.every(p => p.height > 30 && p.top >= rect.top - 2 && p.bottom <= rect.bottom + 2), JSON.stringify({panes,rect}));
  await frame.evaluate(() => testClose());
  await page.evaluate(() => __PMM_FAVORITE_STORE__.exitMode());
  await frame.evaluate(() => testOpen());
  await page.waitForTimeout(300);
  await page.locator('.pmm-layout-trigger').click();
  await page.locator('[data-pmm-layout-output="panelHeight"]').click();
  await page.locator('[data-pmm-layout-done]').click();
  await page.waitForTimeout(250);
  assert.ok(Math.abs((await measure()).height - baseline.height) < 2, 'Reset restores the original layout');
  console.log('Mobile height: centered resize, saved preference, dual panes and reset passed');
}
