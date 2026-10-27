import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8')).replace(/pmmRuntimeResource\((\w+)\)/g, '$1');
const guardStart = source.indexOf('/* ===== PMM_MOBILE_PERFORMANCE_GUARD_V275');
const guardEnd = source.indexOf('/* ===== PMM_VARIABLE_MACRO_ASSISTANT_V263', guardStart);
assert.ok(guardStart >= 0 && guardEnd > guardStart, '无法隔离移动端性能保护样式');

const guard = source.slice(guardStart, guardEnd);
const genericStart = guard.indexOf('#preset-manager-main-panel.pmm-perf-busy .prompt-item,');
const shadowStart = guard.indexOf('#preset-manager-main-panel.pmm-perf-busy .prompt-item:not(.prompt-item--drop-before):not(.prompt-item--drop-after)');
assert.ok(genericStart >= 0 && shadowStart > genericStart, '忙碌样式没有拆分普通特效与阴影规则');
assert.ok(!guard.slice(genericStart, shadowStart).includes('box-shadow: none'), '通用忙碌规则仍会抹掉拖拽定位阴影');

assert.ok(
  guard.includes('.prompt-card:not(.prompt-card--drop-before):not(.prompt-card--drop-after)'),
  '卡片上方／下方落点仍被性能模式清除阴影',
);
assert.ok(
  guard.includes('.section-card:not(.section-card--drop-before):not(.section-card--drop-after):not(.section-card--drop-into)'),
  '分组落点仍被性能模式清除阴影',
);
assert.ok(
  guard.includes(':not(.prompt-item--placeholder):not(.prompt-item--drop-before):not(.prompt-item--drop-after)'),
  '离屏绘制保护仍会裁掉条目上下边缘的蓝线',
);

assert.ok(source.includes('.prompt-item--drop-before::before{content:""'), '原有条目上方蓝线样式缺失');
assert.ok(source.includes('.prompt-item--drop-after::after{content:""'), '原有条目下方蓝线样式缺失');
assert.ok(source.includes('.prompt-card--drop-before[data-v-3e8fd3dc]{box-shadow:0 -3px'), '原有卡片上方蓝色阴影缺失');
assert.ok(source.includes('.prompt-card--drop-after[data-v-3e8fd3dc]{box-shadow:0 3px'), '原有卡片下方蓝色阴影缺失');
assert.ok(source.includes('V2.76 已加载：拖拽落点保留上方／下方蓝色定位线'), '缺少 v2.76 拖拽反馈加载标记');

console.log('v2.76 拖拽反馈测试通过：性能保护保留上方／下方蓝色落点线。');
