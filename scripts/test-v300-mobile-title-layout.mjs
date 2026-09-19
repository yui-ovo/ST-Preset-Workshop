import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workshop = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const worldbook = await readFile(new URL('../dist/worldbook-stitch-test3.js', import.meta.url), 'utf8');

assert.ok(worldbook.includes('data-pmm-wb-panel="${sideName}"'), '世界书卡片缺少上下位置标记');
assert.ok(worldbook.includes('return sideName === \'top\''), '世界书标题结构没有区分上、下卡片');
assert.ok(worldbook.includes('pmm-wb-header-left${sideName === \'top\' ? \' header-left\' : \'\'}'), '上方世界书没有复用预设标题左区结构');
assert.ok(worldbook.includes('header-card title-card title-card--interactive pmm-wb-title-card'), '上方世界书没有复用预设标题卡片外框');
assert.ok(worldbook.includes(': row;'), '下方世界书没有保留原有无外框标题结构');

const presetCssStart = workshop.indexOf('/* 外层标题视窗始终固定；默认时只让内部名称缩短，以保证搜索和铅笔可见。 */');
const presetCssEnd = workshop.indexOf('/* 分支卡片使用独立的“分支名称框长度”', presetCssStart);
assert.notEqual(presetCssStart, -1, '找不到上方名称框作用域样式');
assert.notEqual(presetCssEnd, -1, '找不到上方名称框作用域样式结尾');
const presetCss = workshop.slice(presetCssStart, presetCssEnd);
const presetOuterStart = presetCss.indexOf('.pm-panel-container > .pm-main-wrapper .pm-header .header-left');
const presetOuterCss = presetCss.slice(presetOuterStart, presetCss.indexOf('}', presetOuterStart));
const worldbookOuterStart = presetCss.indexOf('.pmm-wb-inline-panel[data-pmm-wb-panel="top"] .pmm-wb-header-left');
const worldbookOuterCss = presetCss.slice(worldbookOuterStart, presetCss.indexOf('}', worldbookOuterStart));

assert.ok(workshop.includes('--pmm-title-viewport-width:150px!important'), '原生预设与上方世界书没有统一外层视口');
assert.ok(workshop.includes('--pmm-native-preset-width:108px!important'), '内部预设名称缺少固定基准');
assert.ok(workshop.includes("setLayoutVariable(root, '--pmm-primary-title-viewport-width', '150px')"), '上方世界书没有取得稳定外框宽度');
assert.ok(presetOuterCss.includes('flex:0 0 var(--pmm-title-viewport-width,150px)'), '预设外层标题视窗没有固定');
assert.ok(presetOuterCss.includes('width:var(--pmm-title-viewport-width,150px)'), '预设外层标题宽度不是统一固定值');
assert.ok(!presetOuterCss.includes('--pmm-user-preset-width-offset'), '滑杆仍会改变预设外层标题框');
assert.ok(presetCss.includes('.pm-header > .header-right'), '原生标题右侧按钮组没有独立占满剩余空间');
assert.ok(presetCss.includes('justify-content:space-evenly!important'), '右侧按钮没有按可用屏宽平均分布');
assert.ok(presetCss.includes('width:calc(100% + var(--pmm-title-overflow-actions-width))'), '导入导出没有保留在标题横划区');
assert.ok(presetCss.includes('width:calc(100% - var(--pmm-title-overflow-actions-width))'), '默认名称行没有给横划操作区留位');
assert.ok(presetCss.includes('.pmm-mobile-layout-enabled.pmm-layout-custom-preset-width'), '手动调节滑杆后没有切换内部自定义宽度');
assert.ok(presetCss.includes('flex:1 1 0!important'), '默认名称框不能随小屏优先缩短');
assert.ok(presetCss.includes('flex:0 0 max-content!important'), '手动调节后内部标题没有独立横向展开');
assert.ok(presetCss.includes('width:calc(var(--pmm-native-preset-width,108px) + var(--pmm-user-preset-width-offset))'), '滑杆没有只改变内部预设名称框');
assert.ok(workshop.includes('.pmm-preset-search-btn{width:24px!important;min-width:24px!important'), '预设搜索按钮没有固定宽度');
assert.ok(workshop.includes('.pm-header .title-row>.title-edit-btn{flex:0 0 17px!important'), '预设小铅笔仍可能被压缩');
assert.ok(!presetCss.includes('.pm-panel-container--merge-mode > .preset-panel .title-select'), '存在会误伤下方世界书的宽泛选择器');
assert.ok(!presetCss.includes('.pm-panel-container--merge-mode > .preset-panel .title-row'), '存在会误伤下方世界书的宽泛标题行');
assert.ok(worldbookOuterCss.includes('flex:0 0 var(--pmm-primary-title-viewport-width,150px)'), '上方世界书外框没有固定');
assert.ok(!worldbookOuterCss.includes('--pmm-user-preset-width-offset'), '滑杆仍会改变上方世界书外框');
assert.ok(presetCss.includes('.pmm-wb-inline-panel[data-pmm-wb-panel="top"] .pmm-wb-header-right'), '上方世界书右侧按钮没有平均分布作用域');
assert.ok(presetCss.includes('.pmm-worldbook-mode.pmm-layout-custom-preset-width'), '滑杆没有命中上方世界书内部名称');
assert.ok(presetCss.includes('width:calc(90px + var(--pmm-user-preset-width-offset))'), '滑杆没有只改变上方世界书内部名称框');
assert.ok(!presetCss.includes('data-pmm-wb-panel="bottom"'), '下方世界书仍被预设名称滑杆覆盖');
assert.ok(!worldbook.includes('.title-action-btn[title^="导入"]'), '世界书模式仍会隐藏导入按钮');
assert.ok(!worldbook.includes('.title-action-btn[title^="导出"]'), '世界书模式仍会隐藏导出按钮');

console.log('v3.00 手机标题布局通过：外框固定、内部滑杆独立、右侧按钮平均分布。');
