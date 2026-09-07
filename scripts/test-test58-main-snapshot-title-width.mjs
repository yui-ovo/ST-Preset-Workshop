import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

assert.ok(source.includes("const HOME_TITLE_CLASS = 'pmm-switch-snapshot-home-title'"), '主页面快照没有独立的标题标记');
assert.ok(source.includes("const titleContent = actionsHost?.closest?.('.title-content') || null"), '快照入口没有定位主页面标题内容');
assert.ok(source.includes('titleContent?.classList.add(HOME_TITLE_CLASS)'), '快照入口挂载后没有标记主页面标题');
assert.ok(source.includes('titleContent?.classList.toggle(CAPTURE_TITLE_CLASS, captureActive)'), '快照录制态没有保留独立状态标记');

const styleStart = source.indexOf('@media (max-width:768px){#preset-manager-main-panel.pmm-mobile-layout-enabled:not(.pmm-layout-custom-preset-width)');
assert.notEqual(styleStart, -1, '找不到手机主页面默认快照让位样式');
const style = source.slice(styleStart, styleStart + 1800);
assert.ok(style.includes('.pm-panel-container>.pm-main-wrapper'), '快照让位没有限制在主预设首页');
assert.ok(style.includes('.title-content.${HOME_TITLE_CLASS} .title-row'), '快照让位没有只缩短内部标题行');
assert.ok(style.includes('var(--pmm-title-overflow-actions-width) - 22px'), '默认状态没有为相机按钮留下完整宽度');
assert.ok(!style.includes('.${CAPTURE_TITLE_CLASS} .title-row'), '录制状态仍因放大按钮额外挤压预设名称');
assert.ok(!style.includes('var(--pmm-title-overflow-actions-width) - 34px'), '录制状态仍保留旧的大按钮让位宽度');
assert.ok(style.includes(':not(.pmm-layout-custom-preset-width)'), '手动调整预设名称宽度后仍被强制露出快照');
assert.ok(!style.includes('.pm-panel-container--merge-mode'), '快照让位误改了缝合预设');
assert.ok(!style.includes('.pmm-wb-inline-panel'), '快照让位误改了世界书');

assert.ok(source.includes('node.classList.remove(HOME_TITLE_CLASS, CAPTURE_TITLE_CLASS)'), '离开主页面或热重载时没有清除快照标题标记');

console.log('test.58 回归通过：主预设首页默认缩短名称框以露出搜索、铅笔和快照，滑杆自定义及其他页面保持原样。');
