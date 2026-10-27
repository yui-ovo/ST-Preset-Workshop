import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8')).replace(/pmmRuntimeResource\((\w+)\)/g, '$1');
const helperStart = source.indexOf('function xn(e,n)');
const helperEnd = source.indexOf('const fn=', helperStart);

assert.ok(helperStart >= 0 && helperEnd > helperStart, '无法定位主题颜色辅助函数');

const context = {};
vm.runInNewContext(
  `${source.slice(helperStart, helperEnd)};globalThis.helpers={
    alpha:_pmmThemeAlpha,
    surfaceOr:_pmmThemeSurfaceOr,
    luminance:value=>_pmmThemeLuminance(_pmmParseThemeColor(value)),
    cardFromPanel:_pmmThemeCardFromPanel,
    readableForSurfaces:_pmmReadableThemeTextForSurfaces
  };`,
  context,
);

const { alpha, surfaceOr, luminance, cardFromPanel, readableForSurfaces } = context.helpers;

assert.equal(alpha('transparent'), 0, 'transparent 必须视为全透明');
assert.equal(alpha('rgba(0, 0, 0, 0)'), 0, '透明黑不能当成黑色表面');
assert.equal(alpha('rgba(255, 255, 255, 0.08)'), 0.08, '必须保留 rgba 的真实透明度');
assert.equal(alpha('rgb(21, 21, 21)'), 1, '实体 rgb 表面应视为不透明');

const powderPanel = 'rgba(251, 251, 249, 1)';
assert.equal(
  surfaceOr('rgba(0, 0, 0, 0)', powderPanel, 1),
  powderPanel,
  '粉巧甜点兔的透明条目不能被补成黑色',
);

const powderCard = cardFromPanel(powderPanel, 0.92);
assert.ok(luminance(powderCard) > 0.8, '粉色浅主题应生成同属浅色系的条目卡片');
assert.equal(
  readableForSurfaces([powderPanel, powderCard], 'rgba(133, 106, 106, 1)', 4.5),
  'rgba(133, 106, 106, 1)',
  '粉色主题文字对比度足够时应保留原色',
);

const feltPanel = 'rgba(253, 248, 251, 1)';
const feltCard = cardFromPanel(feltPanel, 0.92);
assert.ok(luminance(feltCard) > 0.8, '小猫毡的透明图片层也应回退到浅色系卡片');

const weiboPanel = 'rgba(21, 21, 21, 1)';
const weiboCard = surfaceOr('rgba(30, 30, 30, 1)', cardFromPanel(weiboPanel), 0.92);
assert.ok(luminance(weiboPanel) < 0.02 && luminance(weiboCard) < 0.03, '夜间微博应保持深色面板与深色卡片');
assert.equal(
  readableForSurfaces([weiboPanel, weiboCard], 'rgb(20, 20, 20)', 4.5),
  '#f8fafc',
  '深色面板上的深色文字必须自动改成浅色',
);

assert.ok(source.includes("getPropertyValue('--SmartThemeBlurTintColor')"), '应优先读取酒馆主题面板色');
assert.ok(source.includes("getPropertyValue('--SmartThemeBodyColor')"), '应读取酒馆主题正文色');
assert.ok(source.includes('_pmmThemeSurfaceOr(e,_pmmThemeCardFromPanel(A,.92),.92)'), '透明条目应回退到同色系卡片');
assert.ok(source.includes('_pmmReadableThemeTextForSurfaces([A,a],o,4.5)'), '正文颜色应同时校验面板和卡片');
assert.ok(source.includes('V2.82 已加载：从 v2.78 干净基线恢复缝合交互'), '当前运行版没有保留 v2.78 干净基线');

console.log('v2.78 透明主题测试通过：粉色透明层保持浅色，夜间实体卡片保持深色，文字对比度同步校验。');
