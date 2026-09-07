import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/worldbook-stitch-test3.js', import.meta.url), 'utf8');
const editor = await readFile(new URL('../dist/preset-content-editor.js', import.meta.url), 'utf8');
const entry = await readFile(new URL('../dist/index.js', import.meta.url), 'utf8');

assert.doesNotThrow(() => new Function(editor), '独立预设正文编辑器存在语法错误');
for (const marker of [
  "const API_KEY = '__PMM_PRESET_CONTENT_EDITOR_V1__'",
  'function openPresetContentEditor(button)',
  "event.target.closest?.('.prompt-editor__expand-btn')",
  'event.stopImmediatePropagation?.();',
  "sourceField.dispatchEvent(new TOP.Event('input', { bubbles: true }))",
  "sourceField.dispatchEvent(new TOP.Event('change', { bubbles: true }))",
  "DOC.addEventListener('click', onPresetExpandClick, true);",
  'width:min(92%,660px);height:min(82%,680px)',
  'width:94%;height:82%;max-height:calc(100dvh - 24px)',
]) {
  assert.ok(editor.includes(marker), `test.11 独立预设正文编辑器缺少实现：${marker}`);
}
assert.ok(!/worldbook|data-wb|pmm-wb/iu.test(editor), '独立预设编辑器不得提前载入世界书功能');

for (const marker of [
  "const presetContentEditorUrl = appendRuntimeVersion(new URL('./preset-content-editor.js', import.meta.url).href);",
  '<script type="module" src="${presetContentEditorUrl}"></script>',
  'globalThis.__PMM_PRESET_CONTENT_EDITOR_V1__?.cleanup?.();',
  'window[loaderKey] = () =>',
]) {
  assert.ok(entry.includes(marker), `test.11 首次打开预设前缺少独立加载保障：${marker}`);
}
assert.ok(
  entry.indexOf('<script type="module" src="${presetContentEditorUrl}"></script>')
    < entry.indexOf('<script type="module" src="${workshopUrl}"></script>'),
  '独立预设编辑器应在工坊可交互前完成事件接管',
);

for (const marker of [
  'function openTextEditor({ host, title, original, sourceField, themeNodes, ariaLabel, onSave, searchable = false })',
  'function openPresetContentEditor(button)',
  "event.target.closest?.('.prompt-editor__expand-btn')",
  'event.stopImmediatePropagation?.();',
  "sourceField.dispatchEvent(new TOP.Event('input', { bubbles: true }))",
  "sourceField.dispatchEvent(new TOP.Event('change', { bubbles: true }))",
  "DOC.addEventListener('click', onPresetExpandClick, true);",
  "DOC.removeEventListener('click', onPresetExpandClick, true);",
  'width:min(92%,660px);height:min(82%,680px)',
  'width:94%;height:82%;max-height:calc(100dvh - 24px)',
]) {
  assert.ok(source.includes(marker), `test.11 预设正文放大编辑缺少实现：${marker}`);
}

assert.ok(
  source.indexOf("DOC.addEventListener('click', onPresetExpandClick, true);")
    < source.indexOf("DOC.addEventListener('click', onDocumentClick, true);"),
  '预设放大入口应先于通用点击处理，以拦截原生全屏编辑器',
);

console.log('test.11 回归通过：预设与世界书共用只含正文的留边编辑框，并保留保存与撤销链路。');
