import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位原生入口应用刷新片段：${startMarker}`);
  return source.slice(start, end);
}

const refresh = section('async function refreshNativePromptManager', 'async function syncRuntimeSwitches');
assert.ok(refresh.includes('let refreshed = false'), '原生列表刷新没有合并事件与直接重建结果');
assert.ok(refresh.includes('await context.eventSource.emit(eventType)'), '没有保留旧版酒馆事件刷新兼容');
assert.ok(refresh.includes("new URL('/scripts/openai.js'"), '没有加载当前酒馆的 OpenAI 单例模块');
assert.ok(refresh.includes('await promptManager.renderPromptManagerListItems()'), '相机入口应用后没有立即重建原生开关列表');
assert.ok(refresh.includes('promptManager.render(false)'), '旧版列表方法不可用时没有完整重绘兜底');
assert.ok(refresh.includes('return refreshed'), '刷新结果没有向调用链返回');

const persist = section('async function persistPromptsDirectly', 'async function saveAppliedDraft');
assert.ok(persist.includes("await setPreset('in_use', { prompts: clone(prompts) })"), '原生入口应用没有先同步运行态');
assert.ok(persist.includes('await refreshNativePromptManager()'), '原生入口应用没有在写入后立即刷新列表');

console.log('test.84 回归通过：从原生相机入口应用快照后会立即重建酒馆条目列表，无需切换预设。');
