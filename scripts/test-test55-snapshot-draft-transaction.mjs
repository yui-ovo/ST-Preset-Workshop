import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位快照草稿事务片段：${startMarker}`);
  return source.slice(start, end);
}

for (const marker of [
  'function currentDraftBridge()',
  'function draftPrompts()',
  'function mergeSnapshotStates(prompts, states)',
  'async function writeSwitchesToDraft(nextPrompts',
  'async function saveAppliedDraft(presetName, prompts, draftUpdated)',
  'data-pmm-snapshot-native-save-disabled',
  'pmm-switch-snapshot-native-save-disabled',
]) {
  assert.ok(source.includes(marker), `test.55 缺少实时草稿快照事务：${marker}`);
}

const getPrompts = section('function getPrompts(presetName)', 'function isBranchMode()');
assert.ok(getPrompts.includes('draftPrompts()'), '保存快照仍未优先读取工坊实时草稿');

const apply = section('async function applySnapshot(id)', 'function renameSnapshot(id)');
assert.ok(apply.includes('mergeSnapshotStates(prompts, snapshot.states)'), '应用快照没有统一匹配 UID 与名称兜底');
assert.ok(apply.includes('writeSwitchesToDraft(nextPrompts'), '应用快照没有更新当前工坊草稿');
assert.ok(apply.includes('saveAppliedDraft(presetName, nextPrompts, draftUpdated)'), '应用快照没有走工坊保存链路同步主预设');

const persist = section('async function saveAppliedDraft(presetName, prompts, draftUpdated)', 'async function applySnapshot(id)');
assert.ok(persist.includes('button.click()'), '应用快照没有调用工坊自己的保存按钮');
assert.ok(persist.includes("await setPreset('in_use', { prompts: clone(prompts) })"), '应用当前预设后没有保证运行状态同步');
assert.ok(persist.includes('return true;'), '原生保存链路没有向快照层报告已有保存通知');

const applyNotice = section('async function applySnapshot(id)', 'function renameSnapshot(id)');
assert.ok(applyNotice.includes('!notifiedByNativeSave'), '应用快照没有避免与工坊原生保存重复通知');

const capture = section('async function exitCaptureMode(showNotice = false)', 'function renderCaptureSavePrompt()');
assert.ok(capture.includes('session.entryStates'), '退出快照模式没有恢复进入前开关');
assert.ok(capture.includes('clone(session.entryPrompts)'), '退出快照模式没有优先恢复冻结的完整基线');
assert.ok(capture.includes('entryStates: makeStates(prompts)'), '进入快照模式没有保存临时事务起点');
assert.ok(capture.includes("captureSource === 'native-preset' ? false : !!currentPresetDraftStore()?.isDirty"), '进入快照模式没有区分原生干净基线与工坊草稿脏状态');

const nativeSave = section('function nativeSaveButton()', 'function restoreCaptureEditButton(button)');
assert.ok(nativeSave.includes("button.disabled = true"), '快照模式没有真正禁用原生保存按钮');
assert.ok(nativeSave.includes('pmmSnapshotNativeSaveOriginalHtml'), '退出快照模式无法恢复原生保存图标');
assert.ok(nativeSave.includes("const markup = button.dataset.pmmSnapshotNativeSaveOriginalHtml || '<div class=\"card-icon\"><i class=\"fa-solid fa-save\"></i></div>';"), '禁用时没有保留原生软盘图标');
assert.ok(!nativeSave.includes('pmm-switch-snapshot-save-block-mark'), '原生保存按钮不应再叠加禁用 X');

const style = section('function installStyle()', 'function scheduleMount()');
assert.ok(style.includes('#10b981'), '左侧保存快照按钮没有使用原生保存同系绿色高亮');
assert.ok(style.includes('title-edit-btn.pmm-switch-snapshot-capture-save'), '铅笔位置没有获得保存快照样式');
assert.ok(style.includes(`.title-action-btn.${'${TRIGGER_CLASS}'}.is-capture-mode`), '相机位置没有获得取消样式');
const toolbarStyle = style.slice(0, style.indexOf('.pmm-switch-snapshot-overlay'));
assert.ok(!toolbarStyle.includes('width:32px!important'), '快照保存仍被放大为 32px');
assert.ok(!toolbarStyle.includes('min-width:29px!important'), '快照取消仍被放大为 29px');
assert.ok(style.includes('pointer-events:none!important;cursor:default!important;opacity:.3!important'), '右侧原生保存没有像撤销一样完全变暗并禁用');
assert.ok(style.includes('button[data-pmm-snapshot-native-save-disabled]'), '右侧原生保存仍依赖会被 Vue 重写的 class，无法持续保持暗色');
assert.ok(!style.includes('.pmm-switch-snapshot-save-block-mark{'), '样式中仍残留保存按钮叠加 X');

const panelObserver = section('function observeWorkshopPanel(panel)', 'function install()');
assert.ok(panelObserver.includes("attributes: true, attributeFilter: ['disabled']"), '没有监听 Vue 对原生保存 disabled 状态的重写');

const onboarding = section('function ensureOverlay()', 'function openOverlay()');
assert.ok(onboarding.includes("if (saveDefaultSnapshot({ silent: true })) void enterCaptureModeFromOverlay()"), '首次保存预设默认后没有静默进入快照模式');

console.log('test.55 回归通过：快照录制是冻结基线后可还原的草稿事务，原生保存禁用，应用与恢复会同步当前工坊及主预设。');
