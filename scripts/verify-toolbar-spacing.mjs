import assert from 'node:assert/strict';
import { resolve } from 'node:path';

export async function verifyToolbarSpacing(page, engine) {
  await page.setViewportSize({ width:390, height:844 });
  await page.locator('.panel-btn[title="缝合"]').click();
  await page.locator('.preset-panel').nth(1).locator('.title-select').selectOption('Second');
  for (const width of [320, 390, 460, 768]) {
    await page.setViewportSize({ width, height:900 });
    for (const gap of [0, 8, 16]) {
      await page.locator('.pmm-layout-trigger').click();
      const slider = page.locator('[data-pmm-layout-input="toolbarGap"]');
      await slider.evaluate((node, value) => {
        node.value = String(value); node.dispatchEvent(new Event('input', { bubbles:true }));
      }, gap);
      await page.locator('[data-pmm-layout-done]').click();
      await page.waitForTimeout(220);
      const results = await page.locator('.preset-panel .pm-header').evaluateAll(headers => headers.map(header => {
        const bar = header.querySelector(':scope > .header-right');
        const close = header.querySelector(':scope > .pmm-mobile-header-close');
        bar.scrollLeft = bar.scrollWidth;
        const controls = [...bar.children].filter(node => getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().width > 0);
        const rects = controls.map(node => node.getBoundingClientRect());
        const end = close.getBoundingClientRect();
        const gaps = rects.slice(1).map((rect, index) => rect.left - rects[index].right);
        gaps.push(end.left - rects.at(-1).right);
        const hit = document.elementFromPoint(end.x + end.width / 2, end.y + end.height / 2);
        const headerRect = header.getBoundingClientRect();
        const theme = bar.querySelector('.theme-switch-card');
        const buttons = theme ? [...theme.querySelectorAll('button')].filter(node => getComputedStyle(node).display !== 'none') : [];
        return {
          gaps, widths:rects.map(r => r.width), controls:controls.map(n => n.className),
          closeVisible:end.left >= headerRect.left && end.right <= headerRect.right + 1 && (hit === close || close.contains(hit)),
          themeGap:buttons.length === 2 ? buttons[1].getBoundingClientRect().left - buttons[0].getBoundingClientRect().right : null,
        };
      }));
      assert.equal(results.length, 2, 'Test both merge headers');
      for (const result of results) {
        assert.ok(result.closeVisible, `${width}/${gap}: close must stay visible and clickable`);
        assert.ok(Math.max(...result.gaps) - Math.min(...result.gaps) < 1.6, `${width}/${gap}: uneven action/close gaps ${JSON.stringify(result)}`);
        assert.ok(Math.min(...result.gaps) >= gap - 1.6, `${width}/${gap}: slider sets the minimum spacing`);
        if (result.themeGap !== null) assert.ok(result.themeGap <= 5, 'Theme and floating toggle stay together');
      }
      if (width === 390 && process.env.PMM_SCREENSHOT_DIR) await page.screenshot({ path:resolve(process.env.PMM_SCREENSHOT_DIR, `toolbar-${engine}-${gap}.png`) });
    }
    console.log(`${engine}/${width}: slider 0/8/16, evenly spaced merge headers, fixed close passed`);
  }
  await page.locator('.panel-btn[title="缝合"]').click();
}
