import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const entry = await readFile(new URL('../dist/index.js', import.meta.url), 'utf8');
const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

assert.ok(entry.includes('iframe.hidden = true'), '正常浏览器版没有保留稳定的 hidden 后台方式');
assert.ok(!entry.includes("left: '-10000px'"), '正常浏览器版重新混入了 Gecko 屏幕外 iframe 补丁');
assert.ok(entry.includes("new URL('./workshop-v3.02.js', import.meta.url)"), '启动器没有指向当前 v2.98');

for (const snippet of [
  "branchWidth: 0",
  "branchWidth: [0, 128]",
  "branchWidth: 'pmm-layout-custom-branch-width'",
  "{ key:'branchWidth', label:'分支名称框长度', unit:'px', step:.1 }",
  "setLayoutVariable(target, '--pmm-user-branch-width-offset', `${current.values.branchWidth}px`)",
]) {
  assert.ok(source.includes(snippet), `分支名称长度缺少独立状态：${snippet}`);
}

const captureStart = source.indexOf('  function capturePresetViewportWidths()');
const captureEnd = source.indexOf('  function refreshHeaderWrapping()', captureStart);
assert.ok(captureStart >= 0 && captureEnd > captureStart, '无法隔离标题宽度测量函数');
const capture = source.slice(captureStart, captureEnd);
assert.ok(
  capture.includes('.pm-panel-container > .pm-main-wrapper .pm-header,.pm-panel-container--merge-mode > .preset-panel .pm-header'),
  '缝合上下两张预设卡片没有共用预设宽度测量',
);
assert.ok(
  capture.includes(".pm-panel-container--branch-mode > .preset-panel .pm-header"),
  '分支卡片没有独立测量标题宽度',
);
assert.ok(capture.includes("customKey:'presetWidth'"), '预设名称框没有使用独立样式状态');
assert.ok(capture.includes("customKey:'branchWidth'"), '分支名称框没有使用独立样式状态');
assert.ok(!capture.includes("valueKey:'presetWidth'"), '预设宽度测量仍会改写滑杆值');
assert.ok(!capture.includes("valueKey:'branchWidth'"), '分支宽度测量仍会改写滑杆值');

const presetCssStart = source.indexOf('/* 外层标题视窗始终固定；默认时只让内部名称缩短，以保证搜索和铅笔可见。 */');
const branchCssStart = source.indexOf('/* 分支卡片使用独立的“分支名称框长度”', presetCssStart);
const cssEnd = source.indexOf('#preset-manager-main-panel.pmm-layout-custom-split-ratio', branchCssStart);
assert.ok(presetCssStart >= 0 && branchCssStart > presetCssStart && cssEnd > branchCssStart, '无法隔离双标题宽度样式');
const presetCss = source.slice(presetCssStart, branchCssStart);
const branchCss = source.slice(branchCssStart, cssEnd);
assert.ok(presetCss.includes('.pm-main-wrapper .pm-header .title-row'), '预设滑杆未命中上方原生标题');
assert.ok(presetCss.includes('.pm-panel-container--merge-mode > .preset-panel .pm-header .title-row'), '预设滑杆未命中缝合下方原生预设标题');
assert.ok(presetCss.includes('.pmm-wb-inline-panel[data-pmm-wb-panel="top"] .pmm-wb-source-select'), '预设滑杆未命中上方世界书标题');
assert.ok(!presetCss.includes('.pm-panel-container--merge-mode > .preset-panel .title-row'), '存在未限定 pm-header 的宽泛下方卡片规则');
assert.ok(!presetCss.includes('data-pmm-wb-panel="bottom"'), '预设滑杆仍会改变下方世界书标题');
assert.ok(!presetCss.includes('.pm-panel-container--branch-mode'), '预设滑杆仍会改变分支标题');
assert.ok(branchCss.includes('.pm-panel-container--branch-mode > .preset-panel .title-row'), '分支滑杆未命中分支标题');
assert.ok(!branchCss.includes('.pm-panel-container--merge-mode'), '分支滑杆仍会改变缝合标题');

assert.ok(branchCss.includes('+ 16px)!important'), '分支标题行仍预留了过大的按钮空白');
assert.ok(branchCss.includes('flex:0 0 calc(var(--pmm-native-branch-width,84px) + var(--pmm-user-branch-width-offset))!important'), '分支输入框没有随滑杆真正扩展 flex 宽度');
assert.ok(branchCss.includes('.title-row .title-edit-btn'), '没有固定铅笔按钮紧跟输入框');
assert.ok(branchCss.includes('margin-left:0!important'), '新建按钮前仍保留额外外边距');
assert.ok(!branchCss.includes('+ 50px)!important'), '分支标题行仍有旧的 50px 空白预留');

assert.ok(source.includes('V2.71 已加载'), '缺少 v2.71 运行标记');
console.log('v2.71 分支标题测试通过：名称框真实扩展，铅笔和新建按钮保持紧邻。');
