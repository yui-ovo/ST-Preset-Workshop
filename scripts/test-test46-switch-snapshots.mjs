import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位快照片段：${startMarker}`);
  return source.slice(start, end);
}

for (const marker of [
  'PMM_SWITCH_SNAPSHOTS_TEST52',
  "const STORAGE_KEY = 'pmm.switch-snapshots.v1'",
  "const TRIGGER_CLASS = 'pmm-switch-snapshot-trigger'",
  'function saveNewSnapshot(inputName, afterSave = null, promptsOverride = null)',
  'async function applySnapshot(id)',
  'function overwriteSnapshot(id)',
  'function bindSnapshotToCurrentCharacter(id)',
  'function deleteSnapshot(id)',
  'function openOverlay()',
]) {
  assert.ok(source.includes(marker), `test.46 缺少完整开关快照实现：${marker}`);
}

const stateBuilder = section('function makeStates(prompts)', 'function defaultSnapshotName()');
assert.ok(stateBuilder.includes('id: text(prompt.id)'), '快照必须优先保存条目 UID，不能只用名称匹配');
assert.ok(stateBuilder.includes('name: text(prompt.name || prompt.id)'), '快照需要保留名称作为旧预设兼容兜底');
assert.ok(stateBuilder.includes('enabled: prompt.enabled === true'), '快照没有保存完整开关状态');

const apply = section('async function applySnapshot(id)', 'function renameSnapshot(id)');
assert.ok(apply.includes("text(snapshot.presetName) !== presetName"), '快照不应跨预设误应用');
assert.ok(apply.includes('mergeSnapshotStates(prompts, snapshot.states)'), '应用快照时没有按 UID 与唯一名称安全匹配');
assert.ok(apply.includes('writeSwitchesToDraft(nextPrompts'), '应用快照没有刷新工坊当前卡片');
assert.ok(apply.includes('saveAppliedDraft(presetName, nextPrompts, draftUpdated)'), '应用快照没有写回真实预设与运行状态');

const matching = section('function mergeSnapshotStates(prompts, states)', 'async function settleDraft()');
assert.ok(matching.includes('const statesById = new Map'), '应用快照时没有按 UID 匹配');
assert.ok(matching.includes('uniqueStatesByName'), '重导入后 UID 变化时没有名称兼容兜底');
assert.ok(matching.includes('promptNameCounts.get(name) === 1'), '同名条目不能在名称兜底时被错误覆盖');

const snapshotCreation = section('function saveNewSnapshot(inputName, afterSave = null, promptsOverride = null)', 'function findSnapshot(id)');
assert.ok(snapshotCreation.includes('states: makeStates(prompts)'), '新快照没有冻结当前全部条目状态');
assert.ok(snapshotCreation.includes('characters: []'), '新快照应默认保持角色未绑定');
assert.ok(snapshotCreation.includes('chats: []'), '新快照应默认保持聊天未绑定');
assert.ok(snapshotCreation.includes('writeStore(store)'), '新快照没有持久化');

const overwrite = section('function overwriteSnapshot(id)', 'function bindSnapshotToCurrentCharacter(id)');
assert.ok(overwrite.includes('snapshot.states = makeStates(prompts)'), '覆盖操作没有更新整份冻结状态');

const branchGuard = source.match(/function isBranchMode\(\)[\s\S]*?function currentCharacter\(\)/)?.[0] || '';
assert.ok(branchGuard.includes('pm-panel-container--branch-mode'), '快照没有识别分支模式');
assert.ok(!snapshotCreation.includes('isBranchMode()'), '仅打开空分支工具页不应阻止新建快照');
assert.ok(snapshotCreation.includes("blockWhileBranchActive('新建快照')"), '新建快照必须仅阻止实际已应用的命名分支');
assert.ok(apply.includes('isBranchMode()'), '分支模式下仍能错误应用快照');

const trigger = section('function mountTrigger()', 'function installStyle()');
assert.ok(trigger.includes("const nextTitle = captureActive ? '取消快照并恢复进入前开关' : '开关快照'"), '顶部相机入口没有在快照模式中明确切换为取消');
assert.ok(trigger.includes('turnEditIntoCaptureSave(currentEditButton)'), '顶部铅笔入口没有在快照模式中切换为保存');
assert.ok(trigger.includes("actionsHost?.querySelector?.('[title=\"导入\"]')"), '快照入口没有定位导入按钮');
assert.ok(trigger.includes('host.insertBefore(button, importButton)'), '快照入口没有放在导入／导出的左边');

assert.ok(source.includes('@media (max-width:768px)'), '快照面板缺少手机端底部弹层布局');
assert.ok(source.includes('快照保存条目开关与柏宝箱分组开关。'), '快照面板没有说明其保存的开关范围');
assert.ok(source.includes('角色锁绑定当前角色，聊天锁绑定当前聊天；可通过「…」批量绑定多个角色；进入已绑定的角色或聊天时，会自动应用该快照。'), '快照面板没有说明角色锁、聊天锁与自动应用');

console.log('test.46 回归通过：完整开关快照支持多份命名、UID 优先匹配、名称安全兜底、当前预设即时应用、角色绑定与实际应用分支隔离。');
