import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位快照运行态同步片段：${startMarker}`);
  return source.slice(start, end);
}

const runtimeSync = section('async function syncRuntimeSwitches', 'async function persistPromptsDirectly');
assert.ok(runtimeSync.includes("await setPreset('in_use', { prompts: clone(prompts) })"), '退出快照没有同步酒馆当前运行预设');
assert.ok(!runtimeSync.includes('button.click()'), '退出快照不应触发原生保存');
assert.ok(!runtimeSync.includes('setPreset(presetName,'), '退出快照不应覆盖命名预设文件');

const captureExit = section('async function exitCaptureMode', 'function enterCaptureMode');
assert.ok(captureExit.includes('await syncRuntimeSwitches(session.presetName, nextPrompts)'), '退出快照没有把恢复后的状态同步回主预设');
assert.ok(captureExit.includes('applyGroupSnapshotStates(session.presetName, session.entryGroupStates)'), '退出快照遗漏柏宝箱分组开关还原');

console.log('test.81 回归通过：退出快照会同步酒馆运行态，不保存或覆盖命名预设。');
