import { readFile } from 'node:fs/promises';

const entry = await readFile(new URL('../dist/index.js', import.meta.url), 'utf8');
const source = await readFile(new URL('../dist/worldbook-stitch-test3.js', import.meta.url), 'utf8');
const workshop = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

for (const marker of [
  '__PMM_WORLDBOOK_STITCH_TEST3__',
  'getWorldInfoNames',
  'loadWorldInfo',
  'saveWorldInfo',
  "topType: 'preset'",
  'pmm-worldbook-mode',
  'pm-panel-container--merge-mode',
  'pmm-wb-native-hidden',
  'data-pmm-wb-kind-switch',
  'worldToPreset',
  'presetToWorld',
  'worldToWorld',
  "[4, '@D 插入聊天深度']",
  "entry.constant === true ? 'is-blue' : 'is-green'",
  'entry.disable = entry.disable !== true',
  'batch-delete',
  'entry-search',
  'source-picker',
  'resetSide(state.top, true)',
  'resetSide(state.bottom, true)',
]) {
  if (!source.includes(marker)) throw new Error(`test.3 内嵌世界书缺少实现标记：${marker}`);
}

if (source.includes('position:fixed;inset:0;z-index:2147483000')) {
  throw new Error('test.3 仍残留旧版全屏独立窗口');
}

if (!source.includes("const atDepth = Number(entry.position) === 4") ||
    !source.includes("${atDepth ? `<label><span>深度</span>")) {
  throw new Error('深度字段没有按 @D 位置条件显示');
}

if (!entry.includes('worldbook-stitch-test3.js')
  || !entry.includes('__PMM_LOAD_WORLDBOOK_STITCH__')
  || !workshop.includes("const LOADER_KEY = '__PMM_LOAD_WORLDBOOK_STITCH__'")
  || !workshop.includes('await openWorldbook()')) {
  throw new Error('世界书工具栏入口尚未接通 test.3 内嵌模式');
}

const closedState = source.slice(source.indexOf('function resetClosedState()'), source.indexOf('function close()'));
if (!closedState.includes('resetSide(state.top, true)')
  || !closedState.includes('resetSide(state.bottom, true)')
  || closedState.includes('state.topType =')) {
  throw new Error('退出世界书工作区没有保留上卡类型与世界书选择');
}

const legacyStart = source.indexOf('  async function getLegacyWorldInfoNames()');
const compatibleStart = source.indexOf('  async function getWorldInfoNamesCompatible()', legacyStart);
const refreshStart = source.indexOf('  async function refreshWorldNames()', compatibleStart);
const legacy = source.slice(legacyStart, compatibleStart);
const compatible = source.slice(compatibleStart, refreshStart);
const refresh = source.slice(refreshStart, source.indexOf('  function helperFunction(', refreshStart));
for (const marker of [
  "await TOP.fetch('/api/settings/get'",
  'headers: context.getRequestHeaders()',
  'Array.isArray(data?.world_names) ? data.world_names : []',
]) {
  if (!legacy.includes(marker)) throw new Error(`旧版酒馆世界书列表读取缺少实现：${marker}`);
}
for (const marker of [
  "if (typeof context?.getWorldInfoNames === 'function')",
  'return await context.getWorldInfoNames();',
  'return await getLegacyWorldInfoNames();',
]) {
  if (!compatible.includes(marker)) throw new Error(`新旧酒馆世界书枚举严格分流缺少实现：${marker}`);
}
if (compatible.includes('worldNames.length')) throw new Error('不得因 1.18 暂时返回空列表而误切换旧版接口');
if (refresh.match(/await getWorldInfoNamesCompatible\(\)/g)?.length !== 2) throw new Error('初次读取和原生刷新后没有统一使用兼容入口');

console.log('test.3 世界书原生双卡片静态回归检查通过。');
