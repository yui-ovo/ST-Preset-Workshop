import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const start = source.indexOf('PMM_SWITCH_SNAPSHOTS_TEST52');
assert.ok(start >= 0, '找不到开关快照模块');
const snapshots = source.slice(start);

for (const marker of [
  '.pmm-switch-snapshot-capture-mode .prompt-card__actions',
  '.pmm-switch-snapshot-capture-mode .prompt-card__favorite-icon',
  '.pmm-switch-snapshot-capture-mode .prompt-item__actions',
  '.pmm-switch-snapshot-capture-mode .category-header__actions{display:none!important}',
  '.pmm-switch-snapshot-capture-mode .prompt-card{pointer-events:none!important;cursor:default!important}',
  '.pmm-switch-snapshot-capture-mode .prompt-card .prompt-card__toggle{pointer-events:auto!important}',
  '.pmm-switch-snapshot-capture-mode .inline-editor-container{display:none!important}',
  '.pmm-switch-snapshot-capture-mode .section-header__actions{display:none!important}',
]) {
  assert.ok(snapshots.includes(marker), `快照模式没有隐藏非开关操作：${marker}`);
}

for (const powerToggle of [
  'button.section-action[title^="关闭分组供电"]',
  'button.section-action[title^="恢复分组供电"]',
]) {
  assert.ok(snapshots.includes(powerToggle), `快照模式误隐藏柏宝箱分组开关：${powerToggle}`);
}

console.log('test.79 回归通过：快照模式只允许条目与柏宝箱分组开关，编辑类按钮全部隐藏。');
