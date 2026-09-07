import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const tunerStart = source.indexOf('/* ===== PMM_MOBILE_LAYOUT_TUNER_V1');
const tunerEnd = source.indexOf('/* ===== PMM_FLOATING_PANEL_BATCH_V1', tunerStart);
const tuner = source.slice(tunerStart, tunerEnd);

assert.ok(tuner.includes("'pmm-layout-item-gap-tight'"), '缺少小间距落点线状态');
assert.ok(tuner.includes('current.customized.itemGap === true && current.values.itemGap < 3'), '没有只在小于 3px 时启用内部落点线');
assert.ok(tuner.includes('.pmm-layout-item-gap-tight .prompt-item.prompt-item--drop-before::before'), '条目上方落点缺少内部兜底');
assert.ok(tuner.includes('.pmm-layout-item-gap-tight .prompt-item.prompt-item--drop-after::after'), '条目下方落点缺少内部兜底');
assert.ok(tuner.includes('top:0!important;'), '上方落点线没有移入条目内部');
assert.ok(tuner.includes('bottom:0!important;'), '下方落点线没有移入条目内部');
assert.ok(tuner.includes('inset 0 2px 0 0 var(--pm-accent,#6366f1)'), '卡片上方缺少主题色内部边线');
assert.ok(tuner.includes('inset 0 -2px 0 0 var(--pm-accent,#6366f1)'), '卡片下方缺少主题色内部边线');
assert.ok(!tuner.slice(tuner.indexOf('/* 小于 3px 时'), tuner.indexOf('#preset-manager-main-panel.pmm-layout-custom-item-gap .prompt-group')).includes('gap:'), '内部落点线错误地强制撑开条目间距');

const themedStart = source.indexOf('/* ===== PMM_THEMED_COMPARE_DRAG_LINE_V289');
const themed = source.slice(themedStart);
assert.ok(themed.includes('0 -3px 0 0 var(--pm-accent, #6366f1)'), '正常间距的原版上方外部线被改动');
assert.ok(themed.includes('0 3px 0 0 var(--pm-accent, #6366f1)'), '正常间距的原版下方外部线被改动');
assert.ok(source.includes('V2.94 已加载：条目间距小于 3px 时拖拽落点线自动切换到卡片内侧'), '缺少 v2.94 运行标记');

console.log('v2.94 小间距落点线回归通过：正常间距保留外部线，小于 3px 自动改用内部主题色边线。');
