import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/worldbook-stitch-test3.js', import.meta.url), 'utf8');

for (const marker of [
  'pmmRuntimeResource(headerRight).prepend(switcher);',
  'pmm-wb-kind-switch--toolbar',
  'pm-main-wrapper>.preset-panel .theme-switch-card{display:none!important}',
  "toolbarButton('multi', side.multi ? '退出多选' : '多选', 'fa-check-double'",
  "toolbarButton('undo', side.history.length",
  'function pushUndo(owner, label, options = {})',
  'async function undoWorldOperation(side)',
  "if (action === 'undo') return undoWorldOperation(side);",
  "pushUndo(source, move ? '从世界书移动到预设' : '从世界书拖入预设'",
  '.pmm-wb-kind-switch button.is-active{background:var(--pm-quote-color,#3b82f6)',
  '.pmm-wb-tool{width:27px;height:27px;min-width:27px;padding:0;border:0',
]) {
  assert.ok(source.includes(marker), `test.6 世界书工具栏缺少实现：${marker}`);
}

const renderStart = source.indexOf('  function renderWorldCard(sideName, side)');
const renderEnd = source.indexOf('  function createCard(sideName, side)', renderStart);
const render = source.slice(renderStart, renderEnd);
assert.ok(!render.includes("toolbarButton('transfer-copy'"), '世界书卡片仍显示复制按钮');
assert.ok(!render.includes("toolbarButton('transfer-move'"), '世界书卡片仍显示移动按钮');
assert.ok(
  render.indexOf("sideName === 'top' ? typeSwitchMarkup()") < render.indexOf("toolbarButton('multi'"),
  '上方预设／世界书切换没有放到原复制／移动操作区',
);

const decorateStart = source.indexOf('  function decorateNativeTop()');
const decorateEnd = source.indexOf('  function renderPanels()', decorateStart);
const decorate = source.slice(decorateStart, decorateEnd);
assert.ok(!decorate.includes("toolbarButton('transfer-copy'"), '原生预设顶部仍创建复制按钮');
assert.ok(!decorate.includes("toolbarButton('transfer-move'"), '原生预设顶部仍创建移动按钮');

console.log('test.6 世界书工具栏回归通过：拖拽为主、切换按钮移位、主题组隐藏、多选与撤销恢复。');
