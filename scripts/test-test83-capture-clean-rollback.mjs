import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位快照干净回滚片段：${startMarker}`);
  return source.slice(start, end);
}

const storeLookup = section('function currentPresetDraftStore()', 'function draftPrompts()');
assert.ok(storeLookup.includes("getElementById?.('preset-manager-main-panel')?.__vue_app__"), '没有从当前工坊实例定位 Pinia');
assert.ok(storeLookup.includes("typeof store?.refreshDisplayedPrompts !== 'function'"), '没有只选择支持整份草稿刷新的主预设 store');

const rollback = section('async function restoreCapturedDraft', 'async function refreshNativePromptManager');
assert.ok(rollback.includes('store.refreshDisplayedPrompts(clone(nextPrompts))'), '干净草稿退出快照时没有一次性恢复草稿和基线');
assert.ok(rollback.includes("return writeSwitchesToDraft(nextPrompts, '', false)"), '进入前已有未保存编辑时没有保留原有脏状态');

const capture = section('async function exitCaptureMode', 'function renderCaptureSavePrompt()');
assert.ok(capture.includes('restoreCapturedDraft(nextPrompts, !!session.entryWasDirty)'), '退出快照仍在逐条回滚普通编辑');
assert.ok(capture.includes('clone(session.entryPrompts)'), '退出快照没有使用进入时冻结的完整基线');
assert.ok(capture.includes("captureSource === 'native-preset' ? false : !!currentPresetDraftStore()?.isDirty"), '录制起点没有按入口记录正确的脏状态');

console.log('test.83 回归通过：快照退出会原子恢复冻结基线，避免开关偶发回写和保存按钮误高亮。');
