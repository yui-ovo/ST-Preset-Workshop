import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const entry = await readFile(new URL('../dist/index.js', import.meta.url), 'utf8');

const requiredMarkers = [
  '__PMM_WORLDBOOK_SLOT_TEST1__',
  'data-pmm-worldbook-placeholder',
  "button.className = 'panel-btn pmm-worldbook-placeholder'",
  "icon.className = 'fa-solid fa-book-atlas'",
  "label.textContent = '世界书'",
  "DOC.querySelectorAll('.side-panel-root .panel-buttons')",
  'toolbar.append(button)',
  'event.preventDefault()',
  'event.stopPropagation()',
  "const LOADER_KEY = '__PMM_LOAD_WORLDBOOK_STITCH__'",
  'await openWorldbook()',
  "data-pmm-worldbook-loading",
];

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) {
    throw new Error(`世界书占位入口缺少实现标记：${marker}`);
  }
}

if (!source.includes('.side-panel-root .panel-btn {') || !source.includes('flex: 1 1 0 !important;')) {
  throw new Error('底部工具栏没有保留固定外框内的按钮均分布局');
}

for (const marker of [
  "const worldbookLoaderKey = '__PMM_LOAD_WORLDBOOK_STITCH__'",
  'window[loaderKey] = () => {',
  "script.type = 'module'",
  'script.src = source',
]) {
  if (!entry.includes(marker)) throw new Error(`世界书按需加载器缺少实现标记：${marker}`);
}

if (entry.includes('<script type="module" src="${worldbookStitchUrl}"></script>')) {
  throw new Error('世界书模块仍在扩展启动时被静态载入');
}

console.log('test.1 世界书占位入口检查通过。');
