import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const tunerStart = source.indexOf('/* ===== PMM_MOBILE_LAYOUT_TUNER_V1');
const tunerEnd = source.indexOf('/* ===== PMM_FLOATING_PANEL_BATCH_V1', tunerStart);
const tuner = source.slice(tunerStart, tunerEnd);

for (const marker of [
  'function resolveLayoutCardTheme()',
  "if (themeMode === 'dark' || themeMode === 'light') return themeMode;",
  '魔法棒(auto)要看已经解析后的工坊表面色',
  "style.getPropertyValue('--pm-panel-bg')",
  "style.getPropertyValue('--pm-text-primary')",
  'syncLayoutCardTheme(panel);',
  'syncLayoutCardTheme();',
  "attributeFilter:['class', 'style']",
]) {
  assert.ok(tuner.includes(marker), `布局弹窗缺少魔法棒跟随逻辑：${marker}`);
}

assert.ok(
  !tuner.includes("panel.dataset.pmmLayoutTheme = themeMode === 'dark' ? 'dark' : 'light';"),
  '布局弹窗仍会把 auto 直接当成浅色',
);

const helperStart = tuner.indexOf('  function parseLayoutThemeColor(value)');
const helperEnd = tuner.indexOf('  function resolveLayoutCardTheme()', helperStart);
const helperSource = tuner.slice(helperStart, helperEnd);
const helpers = new Function(
  `${helperSource}; return { surface: layoutThemeFromSurface };`,
)();

assert.equal(helpers.surface('rgb(26, 31, 40)'), 'dark', '深色魔法棒表面没有识别为深色');
assert.equal(helpers.surface('color(srgb 0.10 0.12 0.16 / 0.92)'), 'dark', 'iOS 计算后的深色表面没有识别为深色');
assert.equal(helpers.surface('rgba(245, 238, 242, .92)'), 'light', '浅色魔法棒表面没有识别为浅色');
assert.equal(helpers.surface('rgba(255, 255, 255, .03)'), '', '透明高光被误当成浅色表面');

console.log('test.5 布局弹窗主题回归通过：日夜间保持原逻辑，魔法棒按实际表面色同步。');
