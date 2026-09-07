import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位紧凑快照工具栏片段：${startMarker}`);
  return source.slice(start, end);
}

const editSwap = section('function restoreCaptureEditButton(button)', 'function mountTrigger()');
assert.ok(editSwap.includes("button.innerHTML = '<i class=\"fa-solid fa-floppy-disk\"></i>'"), '铅笔位置没有换成保存图标');
assert.ok(editSwap.includes('button.dataset.pmmSnapshotCaptureSave'), '保存图标没有快照专用点击身份');
assert.ok(editSwap.includes('button.dataset.pmmSnapshotOriginalHtml'), '退出快照模式时无法恢复铅笔');
assert.ok(editSwap.includes('function swapCaptureToolbarWidths(editButton, triggerButton)'), '快照保存与取消按钮没有交换宽度');
assert.ok(editSwap.includes('session.toolbarButtonWidths'), '快照重绘时没有记住原始按钮宽度');
assert.ok(editSwap.includes('const captureExtraWidth = 6;'), '快照按钮没有预留更大的触控宽度');
assert.ok(editSwap.includes('const captureMinimumWidth = 28;'), '快照按钮没有明确的适中最小宽度');
assert.ok(editSwap.includes("editButton.style.setProperty('--pmm-switch-snapshot-capture-width', `${Math.max(cancelWidth + captureExtraWidth, captureMinimumWidth)}px`);"), '保存按钮没有使用加宽且受下限保护的 X 宽度');
assert.ok(editSwap.includes("triggerButton.style.setProperty('--pmm-switch-snapshot-capture-width', `${Math.max(saveWidth + captureExtraWidth, captureMinimumWidth)}px`);"), '取消按钮没有使用加宽且受下限保护的保存宽度');

const trigger = section('function mountTrigger()', 'function handleDocumentClick(event)');
assert.ok(trigger.includes("? '<i class=\"fa-solid fa-xmark\"></i>'"), '相机位置没有换成取消 X');
assert.ok(trigger.includes('turnEditIntoCaptureSave(currentEditButton)'), '快照模式没有在铅笔原位挂载保存');
assert.ok(trigger.includes('swapCaptureToolbarWidths(currentEditButton, button)'), '快照模式没有在挂载后交换保存与取消宽度');
assert.ok(!trigger.includes('turnImportIntoCaptureCancel'), '导入按钮不应再被快照模式替换');

const click = section('function handleDocumentClick(event)', 'function installStyle()');
assert.ok(click.indexOf('openCaptureSavePrompt();') < click.indexOf("closest?.('[data-pmm-snapshot-trigger]')"), '保存与取消按钮的行为位置写反');
assert.ok(click.includes('if (isCaptureMode()) void exitCaptureMode(true);'), '相机位置的 X 没有取消并恢复进入前开关');

const style = section('function installStyle()', 'function scheduleMount()');
const toolbarStyle = style.slice(0, style.indexOf('.pmm-switch-snapshot-overlay'));
assert.ok(toolbarStyle.includes('title-edit-btn.pmm-switch-snapshot-capture-save'), '紧凑保存按钮缺少状态样式');
assert.ok(!toolbarStyle.includes('width:32px!important'), '紧凑工具栏仍残留 32px 放大按钮');
assert.ok(!toolbarStyle.includes('min-width:29px!important'), '紧凑工具栏仍残留 29px 放大按钮');
assert.ok(!toolbarStyle.includes('min-height:29px!important'), '紧凑工具栏仍残留放大高度');
assert.ok(style.includes('--pmm-switch-snapshot-capture-width'), '快照按钮没有使用可交换的宽度变量');
assert.ok(style.includes('flex:0 0 var(--pmm-switch-snapshot-capture-width,auto)!important'), '快照按钮没有覆盖标题栏的 Flex 尺寸');
assert.ok(style.includes('#preset-manager-main-panel .pm-header .title-row>.title-edit-btn.pmm-switch-snapshot-capture-save{width:var(--pmm-switch-snapshot-capture-width,auto)!important'), '保存按钮没有覆盖原标题行的高优先级宽度');
assert.ok(style.includes('.title-content.${CAPTURE_TITLE_CLASS}{gap:7px!important}'), '快照保存和取消按钮之间没有拉开安全间距');
assert.ok(style.includes('.title-content.${CAPTURE_TITLE_CLASS} [title="导入"],.title-content.${CAPTURE_TITLE_CLASS} [title="导出"]{display:none!important}'), '快照模式没有同时隐藏导入和导出按钮');
assert.ok(style.includes('calc(100% - var(--pmm-title-overflow-actions-width) - 36px)'), '快照模式没有从名称框回收按钮所需空间');
assert.ok(style.includes('.pmm-switch-snapshot-capture-mode .pmm-preset-search-btn,'), '快照模式没有隐藏多余的预设搜索按钮');
assert.ok(style.includes('.pmm-switch-snapshot-capture-mode .side-panel-root{display:none!important}'), '快照模式没有隐藏底部工具栏');

console.log('test.61 回归通过：快照模式会给保存与取消设最小宽度、隐藏导入导出并保留安全间距和底部工具栏隐藏。');
