import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const moduleStart = source.indexOf('/* ===== PMM_SWITCH_SNAPSHOTS_TEST52');
const moduleEnd = source.indexOf('/* ===== PMM_THEMED_COMPARE_DRAG_LINE_V289', moduleStart);
assert.ok(moduleStart >= 0 && moduleEnd > moduleStart, '无法定位开关快照模块');
const snapshots = source.slice(moduleStart, moduleEnd);

function section(startMarker, endMarker) {
  const start = snapshots.indexOf(startMarker);
  const end = snapshots.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位快照片段：${startMarker}`);
  return snapshots.slice(start, end);
}

const storage = section('function readStore()', 'function normalizeUniqueBindings');
for (const marker of [
  'homeSnapshots: parsed.homeSnapshots',
  'homeSnapshots: store.homeSnapshots',
  'homeSnapshots: {}',
]) {
  assert.ok(storage.includes(marker), `主页快照没有可靠持久化：${marker}`);
}

const state = section('function activeSnapshotForPreset', 'function blockWhileSnapshotActive');
assert.ok(state.includes('function homeSnapshotForPreset'), '缺少按预设读取主页快照的入口');
assert.ok(state.includes('function fallbackSnapshotForPreset'), '缺少主页快照到预设默认的回退链');
assert.ok(state.includes('homeSnapshotForPreset(name, store)'), '未优先恢复进入聊天前的主页快照');
assert.ok(state.includes('isDefaultSnapshot(snapshot)'), '主页快照失效时没有退回预设默认');
assert.ok(state.includes('function migrateCurrentHomeSnapshot'), '升级旧版时没有保留主页正在应用的快照');

const apply = section('async function applySnapshot(id)', 'function renameSnapshot');
assert.ok(apply.includes("!options.automatic && !currentChat()"), '主页手动应用没有记住返回快照');
assert.ok(apply.includes('{ rememberHome }'), '应用结果没有写入主页快照状态');

const binding = section('async function bindSnapshotToCurrentCharacter', 'function openCharacterPicker');
assert.ok(binding.includes('await autoApplyBoundSnapshot({ silent: true })'), '绑定当前角色或聊天后没有立即静默解析并应用快照');
assert.ok(binding.includes("isBoundHere ? '已解除当前角色绑定' : '已绑定当前角色'"), '角色绑定原有行为被破坏');
assert.ok(binding.includes("isBoundHere ? '已解除当前聊天绑定' : '已绑定当前聊天'"), '聊天绑定原有行为被破坏');

const automatic = section('function boundSnapshotForContext', 'function scheduleBoundSnapshotAutoApply');
assert.ok(automatic.includes('if (chat && character)'), '酒馆主页仍可能误用残留角色绑定');
assert.ok(automatic.includes('binding.snapshot || fallbackSnapshotForPreset'), '无绑定上下文不会恢复主页快照或预设默认');
assert.ok(automatic.includes("binding.chat?.key || ''"), '自动应用没有区分聊天变化');
assert.ok(automatic.includes("binding.character?.key || ''"), '自动应用没有区分角色变化');
assert.ok(automatic.includes("target?.id || ''"), '自动应用没有区分快照目标变化');

const cleanup = section('function deleteSnapshot', 'function formatSavedAt');
assert.ok(cleanup.includes('delete store.homeSnapshots[presetName]'), '删除快照没有清理主页快照引用');
assert.ok(cleanup.includes('delete latestStore.homeSnapshots[presetName]'), '重置预设快照没有清理主页状态');

const install = section('function install()', 'TOP[API_KEY] =');
assert.ok(install.includes('migrateCurrentHomeSnapshot(store)'), '安装时没有执行旧主页状态迁移');

const viewport = section('function bindSnapshotToVisibleViewport', 'function closeOverlay');
for (const marker of [
  'const isIOS = /iPad|iPhone|iPod/i.test(userAgent)',
  "overlay.classList.toggle('pmm-switch-snapshot-ios', isIOS)",
  'const useFixedKeyboardViewport = isIOS && keyboardTarget && !!viewport',
  "useFixedKeyboardViewport ? 'fixed' : 'absolute'",
  'viewport?.pageLeft',
  'viewport?.pageTop',
  "ownerDocument.addEventListener?.('focusin', settleKeyboardViewport, true)",
  "ownerDocument.addEventListener?.('focusout', settleKeyboardViewport, true)",
  'for (const delay of [80, 180, 360])',
  'keyboardTimers.clear()',
]) {
  assert.ok(viewport.includes(marker), `iOS 键盘视口修复缺少：${marker}`);
}

const stylesheet = section('function installStyle()', 'function scheduleMount()');
assert.ok(stylesheet.includes('.pmm-switch-snapshot-overlay.pmm-switch-snapshot-ios .pmm-switch-snapshot-save-capture input{font-size:16px!important}'), 'iOS 仍会因小号快照名称输入框自动缩放页面');

console.log('test.78 回归通过：主页快照可在角色/聊天临时覆盖后恢复，绑定立即生效，iOS 键盘不再把快照弹层推离可视区。');
