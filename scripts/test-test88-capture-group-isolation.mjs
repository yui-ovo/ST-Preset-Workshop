import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

const itemStart = source.indexOf("async function syncEnabledStates({presetName='',prompts=[]}={})");
const itemEnd = source.indexOf('function resolveNativePresetName', itemStart);
assert.ok(itemStart >= 0 && itemEnd > itemStart, '无法定位条目开关同步函数');
const syncItems = source.slice(itemStart, itemEnd);
assert.ok(syncItems.includes('if(isSnapshotCaptureActive())return true'), '快照条目开关仍会提前写入命名预设');
assert.ok(syncItems.indexOf('if(isSnapshotCaptureActive())return true') < syncItems.indexOf('await setter(presetName'), '条目隔离拦截发生在命名预设写入之后');

const start = source.indexOf("async function syncGroupEnabledState({presetName='',sectionId='',enabled=true}={})");
const end = source.indexOf('function readGroupEnabledStates', start);
assert.ok(start >= 0 && end > start, '无法定位柏宝箱分组开关同步函数');
const syncOneGroup = source.slice(start, end);

const captureGuard = syncOneGroup.indexOf('if(isSnapshotCaptureActive())return true');
const nativeWrite = syncOneGroup.indexOf('writeNativeState(resolvedPreset,state');
assert.ok(source.includes("function isSnapshotCaptureActive(){"), '没有统一识别快照录制画布');
assert.ok(syncOneGroup.includes('if(isSnapshotCaptureActive())return true'), '快照分组开关仍会提前写入原生分组');
assert.ok(captureGuard >= 0 && captureGuard < nativeWrite, '快照录制拦截发生在原生分组写入之后');

const captureExitStart = source.indexOf('async function exitCaptureMode');
const captureExitEnd = source.indexOf('function enterCaptureMode', captureExitStart);
const captureExit = source.slice(captureExitStart, captureExitEnd);
assert.ok(captureExit.includes('applyGroupSnapshotStates(session.presetName, session.entryGroupStates)'), '退出快照没有恢复冻结的分组基线');

const saveStart = source.indexOf('function saveNewSnapshot');
const saveEnd = source.indexOf('function findSnapshot', saveStart);
const saveSnapshot = source.slice(saveStart, saveEnd);
assert.ok(saveSnapshot.includes('groupStates = makeGroupStates(presetName)'), '保存快照没有读取临时分组画面');

console.log('test.88 回归通过：快照模式的条目与柏宝箱分组开关只改临时画面，不提前污染原生存储，退出后恢复冻结基线。');
