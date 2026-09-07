import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位快照模式稳定性片段：${startMarker}`);
  return source.slice(start, end);
}

for (const marker of [
  'PMM_SWITCH_SNAPSHOTS_TEST52',
  'function restoreCaptureEditButton(button)',
  'function turnEditIntoCaptureSave(button)',
  'data-pmm-snapshot-edit-stashed',
  'data-pmm-snapshot-capture-save',
]) {
  assert.ok(source.includes(marker), `test.52 缺少快照模式稳定性修复：${marker}`);
}

const replaceEdit = section('function turnEditIntoCaptureSave(button)', 'function mountTrigger()');
assert.ok(replaceEdit.includes('button.dataset.pmmSnapshotOriginalTitle'), '临时替换铅笔按钮时没有保留原标题');
assert.ok(replaceEdit.includes('button.dataset.pmmSnapshotOriginalHtml'), '临时替换铅笔按钮时没有保留原图标');
assert.ok(replaceEdit.includes("if (!button || button.dataset.pmmSnapshotEditStashed) return;"), '铅笔按钮每次重绘仍会被反复替换');

const restoreEdit = section('function restoreCaptureEditButton(button)', 'function turnEditIntoCaptureSave(button)');
assert.ok(restoreEdit.includes('delete button.dataset.pmmSnapshotCaptureSave'), '退出快照模式没有恢复铅笔按钮的点击身份');
assert.ok(restoreEdit.includes('button.innerHTML = button.dataset.pmmSnapshotOriginalHtml'), '退出快照模式没有恢复铅笔图标');

const trigger = section('function mountTrigger()', 'function handleDocumentClick(event)');
assert.ok(trigger.includes("titleContent?.querySelector?.('[data-pmm-snapshot-edit-stashed], .title-row .title-edit-btn[title=\"编辑预设名\"]')"), '快照模式没有稳定定位铅笔位置');
assert.ok(!trigger.includes('host.insertBefore(cancel, button.nextSibling)'), '快照模式仍额外插入取消按钮并挤动工具栏');
assert.ok(trigger.includes('if (button.innerHTML !== nextMarkup)'), '快照入口重绘没有避免重复改写 DOM');
assert.ok(trigger.includes('turnEditIntoCaptureSave(currentEditButton)'), '铅笔按钮没有切换为保存');
assert.ok(!trigger.includes('turnImportIntoCaptureCancel'), '快照模式仍会改动导入按钮');

const cleanup = section('cleanup()', '  };\n  install();');
assert.ok(cleanup.includes("querySelectorAll?.('[data-pmm-snapshot-edit-stashed]').forEach(restoreCaptureEditButton)"), '扩展重载时没有恢复被临时替换的铅笔按钮');
assert.ok(cleanup.includes("querySelectorAll?.('[data-pmm-snapshot-native-save-stashed]').forEach(restoreCaptureNativeSaveButton)"), '扩展重载时没有恢复被临时禁用的原生保存按钮');

console.log('test.52 回归通过：快照模式复用铅笔为保存、相机为取消，重绘及热重载均能恢复原按钮。');
