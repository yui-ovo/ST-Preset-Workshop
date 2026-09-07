import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位快照模式片段：${startMarker}`);
  return source.slice(start, end);
}

for (const marker of [
  'PMM_SWITCH_SNAPSHOTS_TEST52',
  'let captureMode = null',
  'function enterCaptureMode()',
  'async function exitCaptureMode(showNotice = false)',
  'function renderCaptureSavePrompt()',
  'function finishCaptureSnapshot()',
  'data-pmm-snapshot-action="save-capture"',
  'data-pmm-snapshot-capture-save',
  'is-capture-mode',
  'pmm-switch-snapshot-capture-mode',
]) {
  assert.ok(source.includes(marker), `test.51 缺少快照模式：${marker}`);
}

const enter = section('function enterCaptureMode()', 'function renderCaptureSavePrompt()');
assert.ok(enter.includes('captureMode = { presetName, entryStates: makeStates(prompts), restoring: false }'), '进入快照模式没有冻结进入前开关');
assert.ok(enter.includes('closeOverlay();'), '新建快照没有返回预设页面');
assert.ok(enter.includes('已进入快照模式'), '进入快照模式没有给出明确提示');
assert.ok(enter.includes('defaultSnapshotForCurrentPreset()'), '没有默认状态时仍可能错误进入快照模式');

const savePrompt = section('function renderCaptureSavePrompt()', 'function openCaptureSavePrompt()');
assert.ok(savePrompt.includes('保存为'), '高亮保存按钮没有弹出命名界面');
assert.ok(savePrompt.includes('保存后退出快照模式'), '命名界面没有说明保存后的状态');

const finish = section('function finishCaptureSnapshot()', 'function renderFirstDefaultPrompt()');
assert.ok(finish.includes('saveNewSnapshot(composer?.name'), '快照模式保存没有复用完整快照保存链路');
assert.ok(finish.includes('await exitCaptureMode(false)'), '保存快照后没有还原进入前开关并退出');
assert.ok(finish.includes('openOverlay();'), '保存快照后没有自动返回开关快照管理面板');

const overlay = section('function ensureOverlay()', 'function openOverlay()');
assert.ok(overlay.includes("action === 'new') void enterCaptureModeFromOverlay()"), '新建快照仍留在旧弹窗而没有进入快照模式');
assert.ok(overlay.includes("action === 'save-capture') void finishCaptureSnapshot()"), '保存高亮按钮没有写入快照');
assert.ok(overlay.includes("action === 'return-capture') closeOverlay()"), '命名取消不应退出或保存快照');

const trigger = section('function mountTrigger()', 'function handleDocumentClick(event)');
assert.ok(trigger.includes("const nextTitle = captureActive ? '取消快照并恢复进入前开关' : '开关快照'"), '相机按钮没有切换为取消按钮');
assert.ok(trigger.includes("? '<i class=\"fa-solid fa-xmark\"></i>'"), '快照模式的相机位置没有使用 X');
assert.ok(trigger.includes('turnEditIntoCaptureSave(currentEditButton)'), '快照模式没有把铅笔位置切换为保存');

const click = section('function handleDocumentClick(event)', 'function installStyle()');
assert.ok(click.includes('void exitCaptureMode(true)'), '取消快照模式没有还原并退出');
assert.ok(click.includes("closest?.('[data-pmm-snapshot-capture-save]')"), '铅笔位置的保存按钮没有独立点击身份');
assert.ok(click.includes('openCaptureSavePrompt();'), '铅笔位置的保存按钮没有打开命名界面');

assert.ok(source.includes('pmm-switch-snapshot-capture-mode{outline:'), '快照模式没有给整个预设添加醒目边框');
const captureFrame = source.match(/#preset-manager-main-panel \.pm-panel-container\.pmm-switch-snapshot-capture-mode\{outline:1px solid color-mix\(in srgb,#10b981[^}]+\}/)?.[0] || '';
assert.ok(captureFrame.includes('#10b981'), '快照模式外框没有使用保存与取消同系绿色');
assert.ok(!captureFrame.includes('var(--pm-quote-color'), '快照模式外框仍错误使用主题色');

console.log('test.51 回归通过：新建快照冻结进入前开关，保存或取消都会还原草稿并退出录制模式。');
