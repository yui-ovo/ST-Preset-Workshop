import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const worldbook = await readFile(new URL('../dist/worldbook-stitch-test3.js', import.meta.url), 'utf8');
const workshop = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

for (const marker of [
  'function themeToolbarSlotMarkup()',
  'data-pmm-theme-toolbar-slot',
  'if (switcher.nextElementSibling !== themeSlot) switcher.after(themeSlot);',
  'function placeThemeToolbarButton(',
  "const themeToggle = state.host.querySelector('.pmm-mobile-theme-toggle');",
  'placeThemeToolbarButton(themeToggle);',
  '.pmm-wb-theme-slot .pmm-mobile-theme-toggle',
]) {
  assert.ok(worldbook.includes(marker), `test.30 世界书主题工具栏缺少实现：${marker}`);
}

const renderStart = worldbook.indexOf('  function renderWorldCard(sideName, side)');
const renderEnd = worldbook.indexOf('  function createCard(sideName, side)', renderStart);
const render = worldbook.slice(renderStart, renderEnd);
const kindIndex = render.indexOf("sideName === 'top' ? typeSwitchMarkup()");
const themeIndex = render.indexOf("sideName === 'top' ? themeToolbarSlotMarkup()");
const multiIndex = render.indexOf("toolbarButton('multi'");
assert.ok(kindIndex >= 0 && kindIndex < themeIndex && themeIndex < multiIndex,
  '世界书模式下主题按钮槽没有位于世界书图标和多选之间');

const decorateStart = worldbook.indexOf('  function decorateNativeTop()');
const decorateEnd = worldbook.indexOf('  function renderPanels()', decorateStart);
const decorate = worldbook.slice(decorateStart, decorateEnd);
assert.ok(decorate.includes('switcher.after(themeSlot)'),
  '预设模式下主题按钮槽没有紧跟在预设／世界书切换器后');

for (const marker of [
  "let themeToggle = root.querySelector('.pmm-mobile-theme-toggle');",
  "'[data-pmm-wb-panel=\"top\"] [data-pmm-theme-toolbar-slot]'",
  "'.pm-main-wrapper > .preset-panel:not(.pmm-wb-native-hidden) [data-pmm-theme-toolbar-slot]'",
]) {
  assert.ok(workshop.includes(marker), `test.30 原主题按钮无法稳定复用或归位：${marker}`);
}

const placementStart = worldbook.indexOf('  function placeThemeToolbarButton(');
const placementEnd = worldbook.indexOf('  function renderPanels()', placementStart);
const placement = worldbook.slice(placementStart, placementEnd);
assert.ok(!placement.includes('pmm-mobile-fab-toggle'),
  '悬浮按钮开关被错误地一起移入了世界书工具栏');

console.log('test.30 世界书主题工具栏回归通过：三态主题按钮按模式归位，悬浮按钮开关不随行。');
