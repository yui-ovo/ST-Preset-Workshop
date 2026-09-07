import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位首次默认引导片段：${startMarker}`);
  return source.slice(start, end);
}

for (const marker of [
  'PMM_SWITCH_SNAPSHOTS_TEST52',
  'function renderFirstDefaultPrompt()',
  'function ensureOverlay()',
  '保存当前预设为默认？',
  '保存并进入',
  '取消',
  'data-pmm-snapshot-action="save-default-and-enter"',
  'data-pmm-snapshot-action="cancel-default-onboarding"',
]) {
  assert.ok(source.includes(marker), `test.50 缺少首次默认引导：${marker}`);
}

const firstPrompt = section('function renderFirstDefaultPrompt()', 'function renderOverlay()');
assert.ok(firstPrompt.includes('不会修改预设内容'), '首次默认引导没有说明保存不会改写预设');
assert.ok(firstPrompt.includes('以后可一键恢复'), '首次默认引导没有说明恢复用途');

const open = section('function openOverlay()', 'function normalTitleActions()');
assert.ok(open.includes('ensureOverlay();'), '打开快照时没有先建立统一弹层');
assert.ok(open.includes('if (!defaultSnapshotForCurrentPreset())'), '已有默认时仍会错误弹首次引导，或首次未识别默认');
assert.ok(open.includes('renderFirstDefaultPrompt();'), '首次点击相机没有显示默认确认');
assert.ok(open.includes('renderOverlay();'), '已有默认时没有直接进入快照面板');

const overlay = section('function ensureOverlay()', 'function openOverlay()');
assert.ok(overlay.includes("action === 'save-default-and-enter'"), '保存并进入没有交给默认保存流程');
assert.ok(overlay.includes('saveDefaultSnapshot()'), '保存并进入没有冻结当前开关');
assert.ok(overlay.includes("action === 'cancel-default-onboarding'"), '取消没有单独处理');
assert.ok(overlay.includes('closeOverlay();'), '取消仍会打开快照面板或留下弹层');

console.log('test.50 回归通过：首次点相机先确认保存默认，保存后直接进入，取消不保存也不进入。');
