import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位原生相机首次应用片段：${startMarker}`);
  return source.slice(start, end);
}

const presetLookup = section('function nativeSelectedPresetName()', 'function workshopDocuments()');
assert.ok(presetLookup.includes("overlayContext?.source === 'native-preset'"), '原生相机入口没有与工坊草稿入口隔离');
assert.ok(presetLookup.includes('return storedPrompts(presetName)'), '原生相机入口仍可能读取隐藏工坊的旧草稿');

const apply = section('async function applySnapshot(id)', 'function renameSnapshot(id)');
assert.ok(apply.includes("const applyFromNativePreset = overlayContext?.source === 'native-preset'"), '应用流程没有识别原生相机来源');
assert.ok(apply.includes('changed > 0 || applyFromNativePreset'), '零差异时原生相机入口仍会跳过幂等同步');
assert.ok(apply.includes('saveAppliedDraft(presetName, nextPrompts, draftUpdated)'), '首次应用没有写回当前预设并刷新原生列表');

const overlay = section('function openOverlay()', 'function normalPresetContainer()');
assert.ok(overlay.includes("text(options.source) === 'native-preset'"), '原生相机传入的来源标记没有被接收');
assert.ok(overlay.includes('presetName: source === \'native-preset\' ? nativeSelectedPresetName()'), '原生相机没有锁定酒馆当前预设');

console.log('test.86 回归通过：原生相机首次应用绕过隐藏工坊旧草稿，零差异也会写回并刷新主预设。');
