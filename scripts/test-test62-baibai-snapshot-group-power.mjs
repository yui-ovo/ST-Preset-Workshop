import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位柏宝箱快照适配片段：${startMarker}`);
  return source.slice(start, end);
}

const compat = section('async function syncGroupEnabledState', 'Object.assign(compat');
assert.ok(compat.includes('compat.__suspendGroupPowerSync===true'), '批量恢复时没有暂停逐组写入，可能互相覆盖');
assert.ok(compat.includes('function readGroupEnabledStates'), '兼容桥没有提供柏宝箱分组开关读取');
assert.ok(compat.includes('async function syncGroupEnabledStates'), '兼容桥没有提供柏宝箱分组开关批量恢复');
assert.ok(compat.includes("group.enabled=enabled"), '批量恢复没有写入柏宝箱独立的 group.enabled');
assert.ok(compat.includes("writeNativeState(resolvedPreset,state,{syncMembership:false})"), '批量恢复不应改动分组成员关系');

const storage = section('function readStore()', 'function writeStore(store)');
assert.ok(storage.includes('Array.isArray(snapshot.groupStates)'), '旧快照读取没有兼容可选的分组开关数据');
assert.ok(storage.includes('groupStates: snapshot.groupStates.map'), '分组开关数据没有安全克隆');

const groupHelpers = section('function baiBaiCompat()', 'function defaultSnapshotName()');
assert.ok(groupHelpers.includes("candidate._s.get('sectionGroup')"), '没有连接工坊当前的分组响应式状态');
assert.ok(groupHelpers.includes("startsWith('baibai_')"), '快照不应误收录工坊普通分组');
assert.ok(groupHelpers.includes('enabled: !disabled.has'), '没有把工坊断电分组转换为快照开关');
assert.ok(groupHelpers.includes('readGroupEnabledStates?.(presetName)'), '没有原生柏宝箱状态读取兜底');
assert.ok(groupHelpers.includes('if (!Array.isArray(savedStates))'), '旧快照缺少 groupStates 时应保持现有分组开关');
assert.ok(groupHelpers.includes('await store.toggleSectionDisabled'), '应用快照后工坊分组界面不会同步刷新');
assert.ok(groupHelpers.includes('compat.__suspendGroupPowerSync = true'), '恢复多个分组时没有合并逐组写入');
assert.ok(groupHelpers.includes('compat.syncGroupEnabledStates({ presetName, states: requested })'), '应用快照没有批量同步柏宝箱持久状态');

const saveDefault = section('function saveDefaultSnapshot()', 'function saveNewSnapshot');
assert.ok(saveDefault.includes('existing.groupStates = groupStates'), '更新预设默认没有覆盖分组开关');
assert.ok(saveDefault.includes('groupStates,'), '首次保存预设默认没有记录分组开关');

const saveSnapshot = section('function saveNewSnapshot', 'function findSnapshot');
assert.ok(saveSnapshot.includes('groupStates,'), '新建角色快照没有记录分组开关');

const apply = section('async function applySnapshot(id)', 'function renameSnapshot');
assert.ok(apply.includes('await applyGroupSnapshotStates(presetName, snapshot.groupStates)'), '应用快照没有恢复柏宝箱分组开关');

const overwrite = section('function overwriteSnapshot', 'function bindSnapshotToCurrentCharacter');
assert.ok(overwrite.includes('snapshot.groupStates = makeGroupStates(presetName)'), '覆盖快照没有更新分组开关');

const capture = section('async function exitCaptureMode', 'function renderCaptureSavePrompt');
assert.ok(capture.includes('session.entryGroupStates'), '退出快照模式没有恢复进入前的分组开关');
assert.ok(capture.includes('captureMode.entryGroupStates = makeGroupStates(presetName)'), '进入快照模式没有冻结分组开关事务起点');

console.log('test.62 回归通过：开关快照完整保存、应用并回滚柏宝箱独立分组开关，同时兼容旧快照。');
