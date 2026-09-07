import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const start = source.indexOf('PMM_SWITCH_SNAPSHOTS_TEST52');
assert.ok(start >= 0, '找不到开关快照模块');
const snapshots = source.slice(start);

for (const required of [
  '.pmm-switch-snapshot-capture-mode .section-group[data-section-id^="baibai_"]>.section-header .section-header__actions',
  'button.section-action[title^="关闭分组供电"]',
  'button.section-action[title^="恢复分组供电"]',
  'button.section-action{display:none!important}',
]) {
  assert.ok(snapshots.includes(required), `快照录制原生柏宝箱分组开关缺失：${required}`);
}

assert.ok(
  !snapshots.includes('.section-header:hover .section-header__actions>button.section-action:not([title^="关闭分组供电"])'),
  '快照模式悬停分组时不应重新显示改名或解散按钮',
);

assert.ok(
  source.includes("String(e.sectionId).startsWith('baibai_')?(e.groupDisabled?'恢复分组供电':'关闭分组供电')"),
  '未找到可复用的原生柏宝箱分组供电开关',
);

for (const forbidden of [
  "const CAPTURE_GROUP_TOGGLE_CLASS = 'pmm-switch-snapshot-group-toggle'",
  'function syncNativeGroupCaptureToggles()',
  'function scheduleNativeGroupCaptureToggleSync()',
  'await store.toggleSectionDisabled(sectionId, null, activePreset)',
  'pmm-switch-snapshot-group-toggle__track',
]) {
  assert.ok(!snapshots.includes(forbidden), `不应在快照模式复制第二个分组开关：${forbidden}`);
}

console.log('test.77 通过：快照录制仅常驻柏宝箱原生分组开关，不创建或露出其他分组操作。');
