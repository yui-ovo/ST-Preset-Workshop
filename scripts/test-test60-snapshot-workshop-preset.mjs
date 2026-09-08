import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位工坊预设快照片段：${startMarker}`);
  return source.slice(start, end);
}

const resolver = section('function workshopPresetName()', 'function storedPrompts(presetName)');
assert.ok(resolver.includes('normalPresetContainer()'), '快照没有从当前工坊主页读取预设');
assert.ok(resolver.includes("querySelector?.('.preset-panel .title-select, .title-select')"), '快照没有读取工坊顶部预设选择框');
assert.ok(resolver.includes("overlayContext?.source === 'native-preset'"), '原生相机入口没有独立使用酒馆当前预设');
assert.ok(resolver.includes('const workshopName = workshopPresetName();'), '当前快照预设没有接入工坊选择结果');
assert.ok(resolver.includes('if (workshopName) return workshopName;'), '工坊当前预设没有成为快照第一优先级');

const currentResolver = section('function currentPresetName()', 'function storedPrompts(presetName)');
const workshopIndex = currentResolver.indexOf('const workshopName = workshopPresetName();');
const nativeIndex = currentResolver.indexOf('getSelectedPresetName?.()');
const loadedIndex = currentResolver.indexOf('TOP.getLoadedPresetName || SELF.getLoadedPresetName');
assert.ok(workshopIndex >= 0 && nativeIndex > workshopIndex && loadedIndex > nativeIndex,
  '普通工坊入口优先级不正确：应为工坊当前选择、原生管理器、酒馆已加载预设');

const prompts = section('function getPrompts(presetName)', 'function isBranchMode()');
assert.ok(prompts.includes('text(presetName) === currentPresetName()'), '快照条目没有与工坊当前预设绑定');
assert.ok(prompts.includes('draftPrompts()'), '快照没有读取工坊当前预设的实时开关草稿');

console.log('test.60 回归通过：工坊入口优先跟随工坊预设，原生相机入口独立跟随酒馆当前预设。');
