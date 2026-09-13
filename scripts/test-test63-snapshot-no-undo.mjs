import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位快照撤销片段：${startMarker}`);
  return source.slice(start, end);
}

const draftWriter = section('async function writeSwitchesToDraft', 'async function refreshNativePromptManager');
assert.ok(draftWriter.includes("recordUndo = true"), '普通工坊编辑仍应默认支持撤销');
assert.ok(draftWriter.includes('if (recordUndo && label)'), '草稿写入器没有保留按调用场景控制撤销的能力');

const apply = section('async function applySnapshot(id)', 'function renameSnapshot');
assert.ok(
  apply.includes('writeSwitchesToDraft(nextPrompts, `应用开关快照：${snapshot.name}`, false)'),
  '应用角色快照与恢复预设默认仍会写入普通编辑撤销栈',
);
assert.ok(apply.includes('saveAppliedDraft(presetName, nextPrompts, draftUpdated)'), '关闭撤销后快照仍必须正常保存并应用');

const editor = section('function createSnapshotEditorDraft', 'function renderFirstDefaultPrompt');
assert.ok(!editor.includes('writeSwitchesToDraft('), '轻量编辑器 draft 不应写入普通编辑撤销栈');

console.log('test.63 回归通过：应用已有快照不进入撤销栈，轻量编辑器 draft 也不写入真实工坊草稿。');
