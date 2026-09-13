import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workshop = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const worldbook = await readFile(new URL('../dist/worldbook-snapshots.js', import.meta.url), 'utf8');

const sheetStart = worldbook.indexOf('/* Keep mobile snapshot sheets comfortably tall');
const sheetEnd = worldbook.indexOf('.pmm-wbs-source-section[hidden]', sheetStart);
assert.ok(sheetStart >= 0 && sheetEnd > sheetStart, '找不到快照弹窗自然高度规则');
const sheet = worldbook.slice(sheetStart, sheetEnd);

assert.ok(sheet.includes('.pmm-wbs-dialog:not(.is-editing):not(.pmm-wbs-batch-dialog),.pmm-snapshot-hub-preset .pmm-switch-snapshot-dialog'), '预设与世界书快照必须共用自然高度规则');
assert.ok(sheet.includes('height:auto!important;'), '快照弹窗必须允许内容在默认高度上继续增长');
assert.ok(sheet.includes('max-height:min(60dvh,var(--wbs-sheet-max-height,var(--pmm-switch-snapshot-sheet-max-height,60dvh)))!important;'), '快照弹窗必须限制为真实可视区的六成');
assert.ok(worldbook.includes('min-height:min(50dvh,var(--wbs-sheet-min-height,var(--pmm-switch-snapshot-sheet-min-height,50dvh)))!important;'), '手机快照弹窗默认必须至少占真实可视区的一半');
assert.ok(!sheet.includes('height:min(460px'), '快照弹窗不得继续固定为 460px');
assert.ok(sheet.includes('.pmm-wbs-dialog:not(.is-editing):not(.pmm-wbs-batch-dialog) .pmm-wbs-body,.pmm-snapshot-hub-preset .pmm-switch-snapshot-list { flex:1 1 auto!important; min-height:0!important; max-height:none!important; overflow:auto!important; }'), '空余高度与超出内容必须由世界书正文或预设快照列表承接');
assert.ok(worldbook.includes("overlay.style.setProperty('--wbs-sheet-min-height', `${Math.max(1,Math.floor(visibleHeight*.5))}px`);"), '世界书必须按真实可视区同步默认半屏高度');
assert.ok(worldbook.includes("overlay.style.setProperty('--wbs-sheet-max-height', `${Math.max(1,Math.floor(visibleHeight*.6))}px`);"), '世界书必须按真实可视区同步六成上限');
assert.ok(workshop.includes("overlay.style.setProperty('--pmm-switch-snapshot-sheet-min-height', `${Math.max(1, Math.floor(height * 0.5))}px`, 'important');"), '预设快照必须按真实可视区同步默认半屏高度');
assert.ok(workshop.includes("overlay.style.setProperty('--pmm-switch-snapshot-sheet-max-height', `${Math.max(1, Math.floor(height * 0.6))}px`, 'important');"), '预设快照必须按真实可视区同步六成上限');
assert.ok(workshop.includes("overlay.style.removeProperty('--pmm-switch-snapshot-sheet-min-height');"), '预设快照关闭后必须清理默认高度变量');
assert.ok(workshop.includes("overlay.style.removeProperty('--pmm-switch-snapshot-sheet-max-height');"), '预设快照关闭后必须清理可视区高度变量');
assert.ok(worldbook.includes('.pmm-wbs-dialog.is-editing { height:min(680px'), '世界书快照编辑器仍应保留原有大号编辑高度');
assert.ok(worldbook.includes('.pmm-wbs-batch-dialog { height:min(560px'), '世界书批量管理不应被半屏快照规则误伤');

console.log('test.41 快照弹窗高度回归通过：手机默认半屏、最多六成，预设与世界书均由内部列表承接空余和溢出。');
