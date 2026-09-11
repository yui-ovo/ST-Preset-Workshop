import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位主预设刷新片段：${startMarker}`);
  return source.slice(start, end);
}

const refresh = section('async function refreshNativePromptManager', 'async function persistPromptsDirectly');
assert.ok(refresh.includes('OAI_PRESET_CHANGED_AFTER'), '没有发送酒馆 PromptManager 要求的原生重绘事件');
assert.ok(refresh.includes('context.eventSource.emit(eventType)'), '原生重绘事件没有真正发送');
assert.ok(refresh.includes("new URL('/scripts/openai.js'"), '没有取得酒馆原生 Prompt Manager 实例');
assert.ok(refresh.includes('await promptManager.renderPromptManagerListItems()'), '没有立即重建酒馆原生条目列表');

const directPersist = section('async function persistPromptsDirectly', 'async function saveAppliedDraft');
assert.ok(directPersist.includes('await refreshNativePromptManager()'), '直接应用快照后没有刷新主预设列表');

const draftSave = section('async function saveAppliedDraft', 'async function applySnapshot');
assert.ok(draftSave.includes('await refreshNativePromptManager()'), '通过工坊草稿应用快照后没有刷新主预设列表');

console.log('test.82 回归通过：快照应用与恢复默认都会触发酒馆主预设重绘。');
