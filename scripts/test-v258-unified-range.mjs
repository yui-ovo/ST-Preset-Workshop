import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8')).replace(/pmmRuntimeResource\((\w+)\)/g, '$1');
const start = source.indexOf("const STYLE_ID='pmm-unified-layout-range-v258'");
const end = source.indexOf("/* ===== PMM_FLOATING_PANEL_BATCH_V1", start);

assert.notEqual(start, -1, '缺少统一滑杆样式');
assert.notEqual(end, -1, '无法定位统一滑杆样式结尾');

const rangePatch = source.slice(start, end);
const scopedSelector = 'html body #preset-manager-main-panel #pmm-mobile-layout-card input.pmm-layout-range[type="range"]';
assert.ok(rangePatch.includes(scopedSelector), '统一滑杆没有限定在工坊设置弹窗');
assert.ok(rangePatch.includes('-webkit-appearance:none!important'), '没有重置 iOS/Chromium 原生滑杆外观');
assert.ok(rangePatch.includes('appearance:none!important'), '没有重置标准原生滑杆外观');
assert.ok(rangePatch.includes('background-image:none!important'), '外部美化仍可保留滑杆背景图');
assert.ok(rangePatch.includes('box-shadow:none!important'), '外部美化仍可保留滑杆立体阴影');
assert.ok(rangePatch.includes('::-webkit-slider-runnable-track'), '缺少 iOS/Chromium 细线轨道');
assert.ok(rangePatch.includes('::-webkit-slider-thumb'), '缺少 iOS/Chromium 圆形滑块');
assert.ok(rangePatch.includes('::-moz-range-track'), '缺少 Firefox 细线轨道');
assert.ok(rangePatch.includes('::-moz-range-thumb'), '缺少 Firefox 圆形滑块');
assert.ok(rangePatch.includes('height:2px!important'), '轨道没有固定为细线');
assert.ok(rangePatch.includes('width:14px!important'), '滑块尺寸没有统一');
assert.ok(rangePatch.includes('height:24px!important'), '没有保留手机触控区域');

console.log('v2.58 滑杆测试通过：细线、圆点和触控区域已统一，外部美化无法改成方框或立体槽。');
