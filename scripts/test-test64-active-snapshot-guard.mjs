import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位当前快照状态片段：${startMarker}`);
  return source.slice(start, end);
}

const storage = section('function readStore()', 'function makeStates(prompts)');
assert.ok(storage.includes('activeSnapshots: parsed.activeSnapshots'), '刷新后无法恢复当前应用的快照标记');
assert.ok(storage.includes('activeSnapshots: store.activeSnapshots'), '当前应用快照没有写入本地存储');
assert.ok(storage.includes('activeSnapshots: {}'), '旧快照存储缺少安全的空状态兜底');

const state = section('function activeSnapshotForPreset', 'function saveDefaultSnapshot()');
assert.ok(state.includes('function setActiveSnapshot'), '没有统一设置或清除当前快照的入口');
assert.ok(state.includes('function blockWhileSnapshotActive'), '没有统一阻止快照套快照');
assert.ok(state.includes('请先恢复预设默认后再${actionLabel}'), '拦截提示没有说明正确的解锁方法');

const saveDefault = section('function saveDefaultSnapshot()', 'function saveSnapshotDraft');
assert.ok(saveDefault.includes("blockWhileSnapshotActive('更新预设默认')"), '应用快照时仍能误覆盖预设默认');

const saveNew = section('function saveSnapshotDraft', 'function findSnapshot');
assert.ok(saveNew.includes('activeSnapshotForPreset(presetName)'), '已应用快照后仍能直接保存派生快照');

const apply = section('async function applySnapshot(id)', 'function renameSnapshot');
assert.ok(apply.includes("const snapshotId = isDefaultSnapshot(snapshot) ? '' : snapshot.id"), '应用角色快照或恢复默认后没有生成当前状态');
assert.ok(apply.includes('setActiveSnapshot(presetName, snapshotId, { rememberHome })'), '应用角色快照或恢复默认后没有切换当前状态');

const overwrite = section('function overwriteSnapshot', 'function bindSnapshotToCurrentCharacter');
assert.ok(overwrite.includes("blockWhileSnapshotActive('覆盖快照')"), '已应用快照时仍可把当前状态覆盖到其他快照');

const deletion = section('function deleteSnapshot', 'function formatSavedAt');
assert.ok(deletion.includes('active?.id === snapshot.id'), '当前应用中的快照仍能被直接删除');
assert.ok(deletion.includes('请先恢复预设默认后再删除'), '删除拦截没有说明恢复默认');

const editorEntry = section('function openSnapshotEditorFromOverlay()', 'function renderFirstDefaultPrompt');
assert.ok(editorEntry.includes('activeSnapshotForPreset(presetName)'), '轻量编辑器入口没有阻止快照套快照');

const overlay = section('function renderOverlay()', 'function ensureOverlay()');
assert.ok(overlay.includes("${isActive ? '当前' : '全局应用'}"), '预设快照按钮没有区分“全局应用”与“当前”');
assert.ok(overlay.includes("disabled title=\"当前正在应用\""), '当前快照按钮仍可重复点击');
assert.ok(overlay.includes("activeSnapshot ? ' disabled' : ''"), '应用角色快照时更新默认按钮没有禁用');

const snapshotModuleStart = source.indexOf('PMM_SWITCH_SNAPSHOTS_TEST52');
const styleStart = source.indexOf('function installStyle()', snapshotModuleStart);
const style = source.slice(styleStart, source.indexOf('function install()', styleStart));
assert.ok(style.includes('.pmm-switch-snapshot-row.is-active'), '当前快照行没有可见状态');
assert.ok(style.includes('button.is-current:disabled'), '当前按钮没有明确的禁用样式');

console.log('test.64 回归通过：当前应用快照跨刷新保留，恢复默认前禁止新建、覆盖默认和派生快照。');
