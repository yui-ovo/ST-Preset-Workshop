import assert from 'node:assert/strict';
import { resolve } from 'node:path';

// Run against the full bundle/real Vue fixture from test-panel-startup-browser.
export async function verifyPromptCardActions(page) {
  const card = page.locator('.preset-panel').first().locator('.prompt-card').first();
  const name = card.locator('.prompt-card__name');
  const actions = card.locator('.prompt-card__actions');
  const star = actions.locator('.prompt-card__action--favorite');
  const idle = async () => {
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.mouse.move(1, 1);
    await page.waitForTimeout(250);
  };
  const width = async locator => (await locator.boundingBox()).width;
  const waitStar = pressed => page.waitForFunction(value => document.querySelector('.preset-panel .prompt-card .prompt-card__action--favorite')?.getAttribute('aria-pressed') === value, pressed, { polling: 25 });
  for (const viewportWidth of [320, 390, 768]) {
    await page.setViewportSize({ width: viewportWidth, height: 844 });
    await card.scrollIntoViewIfNeeded();
    await idle();
    assert.equal(await actions.isVisible(), false, 'Invisible actions must release title width');
    const idleWidth = await width(name);
    await card.hover();
    await page.waitForTimeout(250);
    const activeWidth = await width(name);
    assert.ok(idleWidth > activeWidth + 45, `${viewportWidth}: idle title must recover button space (${idleWidth} / ${activeWidth})`);
    await star.evaluate(node => { window.originalFavoriteButton = node; });
    const before = await star.boundingBox();
    const relativeX = before.x - (await card.boundingBox()).x;
    const count = await actions.locator('button').count();
    for (const pressed of ['true', 'false', 'true']) {
      await star.click();
      await waitStar(pressed);
      assert.equal(await star.evaluate(node => node === window.originalFavoriteButton), true, 'Favorite toggling must reuse its DOM button');
      assert.equal(await actions.locator('button').count(), count, 'Favorite must not replace or shift neighboring actions');
      const after = await star.boundingBox();
      assert.ok(Math.abs(relativeX - (after.x - (await card.boundingBox()).x)) < 1, 'Favorite slot relative to the card must remain stable');
      assert.ok(Math.abs(activeWidth - await width(name)) < 1, 'Favoriting must not further shorten the title');
    }
    await idle();
    assert.equal(await star.isVisible(), true, 'Saved favorite remains discoverable at rest');
    const visibleButtons = await actions.locator('button').evaluateAll(nodes => nodes.filter(n => {
      const s = getComputedStyle(n); return s.display !== 'none' && s.visibility !== 'hidden';
    }).length);
    assert.equal(visibleButtons, 1, 'Only the favorite indicator occupies space at rest');
    assert.ok(await width(name) > activeWidth + 25, 'Saved favorite must not reserve space for other hidden actions');
    // A touch on the visible idle star must never activate delete or the entry switch.
    const enabled = await card.getAttribute('class');
    await star.tap();
    await waitStar('false');
    assert.equal((await card.getAttribute('class')).includes('prompt-card--disabled'), enabled.includes('prompt-card--disabled'));
    console.log(`Prompt actions ${viewportWidth}px: idle title grows, favorite node/position stable, idle touch safe`);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  const desktopX = (await star.boundingBox()).x - (await card.boundingBox()).x;
  await star.click(); await waitStar('true');
  assert.ok(Math.abs(desktopX - ((await star.boundingBox()).x - (await card.boundingBox()).x)) < 1, 'Desktop favorite position also stays stable');
  await idle(); assert.equal(await star.isVisible(), true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.panel-btn[title="缝合"]').click();
  await page.locator('.preset-panel').nth(1).locator('.title-select').selectOption('Second');
  await page.waitForFunction(() => document.querySelectorAll('.preset-panel')[1]?.querySelectorAll('.prompt-card').length > 0, null, { polling: 25 });
  const lowerCard = page.locator('.preset-panel').nth(1).locator('.prompt-card').first();
  const lowerName = lowerCard.locator('.prompt-card__name');
  const lowerStar = lowerCard.locator('.prompt-card__action--favorite');
  await lowerCard.scrollIntoViewIfNeeded();
  await idle();
  const lowerIdleWidth = await width(lowerName);
  if (process.env.PMM_SCREENSHOT_DIR) await page.screenshot({ path: resolve(process.env.PMM_SCREENSHOT_DIR, 'prompt-actions-idle.png') });
  await lowerCard.hover(); await page.waitForTimeout(250);
  assert.ok(lowerIdleWidth > await width(lowerName) + 45, 'Merge lower pane must also recover name width');
  const oldPressed = await lowerStar.getAttribute('aria-pressed');
  const lowerX = (await lowerStar.boundingBox()).x - (await lowerCard.boundingBox()).x;
  await lowerStar.click();
  await page.waitForFunction(old => document.querySelectorAll('.preset-panel')[1]?.querySelector('.prompt-card__action--favorite')?.getAttribute('aria-pressed') !== old, oldPressed, { polling: 25 });
  assert.ok(Math.abs(lowerX - ((await lowerStar.boundingBox()).x - (await lowerCard.boundingBox()).x)) < 1, 'Merge pane favorite slot stays stable');
  if (process.env.PMM_SCREENSHOT_DIR) await page.screenshot({ path: resolve(process.env.PMM_SCREENSHOT_DIR, 'prompt-actions-active.png') });
  await page.locator('.panel-btn[title="缝合"]').click();
  console.log('Merge panes: title space and favorite position passed');
}
