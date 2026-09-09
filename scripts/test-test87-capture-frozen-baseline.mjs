import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位快照冻结基线片段：${startMarker}`);
  return source.slice(start, end);
}

const exitCapture = section('async function exitCaptureMode', 'function enterCaptureMode');
assert.ok(exitCapture.includes('clone(session.entryPrompts)'), '退出快照没有直接恢复进入时冻结的完整基线');
assert.ok(exitCapture.includes('restoreCapturedDraft(nextPrompts'), '冻结基线没有恢复到工坊草稿');
assert.ok(exitCapture.includes('syncRuntimeSwitches(session.presetName, nextPrompts)'), '冻结基线没有同步到酒馆主预设');

const enterCapture = section('function enterCaptureMode(entryContext = null)', 'async function enterCaptureModeFromOverlay');
assert.ok(enterCapture.includes("entryContext?.source === 'native-preset' || overlayContext?.source === 'native-preset'"), '进入快照没有记住原生相机来源');
assert.ok(enterCapture.includes('entryPrompts: clone(prompts)'), '进入快照没有冻结完整主预设基线');
assert.ok(enterCapture.includes("captureSource === 'native-preset' ? false"), '原生相机仍可能继承隐藏工坊的旧脏标记');

const enterFromOverlay = section('async function enterCaptureModeFromOverlay', 'function renderCaptureSavePrompt');
assert.ok(enterFromOverlay.includes('const entryContext = overlayContext ? { ...overlayContext } : null'), '打开工坊首页前没有冻结原生入口上下文');
assert.ok(enterFromOverlay.includes('enterCaptureMode(entryContext)'), '工坊首页加载后没有沿用冻结的原生入口上下文');

console.log('test.87 回归通过：每次进入快照都会冻结独立基线，保存或取消后整体恢复且不受上一轮草稿影响。');
