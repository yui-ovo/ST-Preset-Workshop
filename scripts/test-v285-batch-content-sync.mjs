import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8')).replace(/pmmRuntimeResource\((\w+)\)/g, '$1');
const start = source.indexOf('function De(e)');
const end = source.indexOf('function Ue(e)', start);
assert.ok(start >= 0 && end > start, '无法定位分组视图同步逻辑');

const sectionSyncSource = source.slice(start, end);
assert.ok(
  sectionSyncSource.includes("()=>n.value.map(e=>e.content)"),
  '分组视图必须把正文变化作为独立监听源',
);
assert.ok(
  sectionSyncSource.includes('条目名称/开关/正文实时同步失败'),
  '正文同步失败时应给出准确日志',
);

const watchCalls = [];
let syncedPrompts = null;
const sectionStore = {
  presetStates: new Map(),
  setPromptsForPreset(prompts) {
    syncedPrompts = prompts;
  },
};
const context = {
  ze: () => sectionStore,
  i: {
    ref: value => ({ value }),
    watch: (sources, callback, options) => watchCalls.push({ sources, callback, options }),
    computed: getter => ({ getter }),
  },
  h: { info() {}, warn() {} },
};
const useSectionGroup = vm.runInNewContext(
  `(() => { ${sectionSyncSource}; return De; })()`,
  context,
);

const prompts = {
  value: [{ id: 'a', name: '文风A', enabled: true, content: '普通正文' }],
};
useSectionGroup({
  prompts,
  presetName: { value: '测试预设' },
  onUpdatePrompts() {},
});

assert.equal(watchCalls.length, 2, '应注册初始化监听和实时同步监听');
const liveSync = watchCalls[1];
assert.equal(liveSync.sources.length, 3, '实时同步必须分别监听预设名、结构状态与正文');
assert.deepEqual([...liveSync.sources[2]()], ['普通正文']);

prompts.value[0] = {
  ...prompts.value[0],
  content: '{{setvar::文风框架::普通正文}}',
};
liveSync.callback([
  '测试预设',
  liveSync.sources[1](),
  liveSync.sources[2](),
]);

assert.equal(syncedPrompts?.[0]?.content, '{{setvar::文风框架::普通正文}}');
assert.notEqual(syncedPrompts?.[0], prompts.value[0], '分组仓库应收到独立条目副本');
assert.ok(source.includes('V2.85 已加载：批量变量化后的正文会立即同步到当前分组视图。'), '缺少 v2.85 修复标记');

console.log('v2.85 正文同步测试通过：批量变量化写回后，分组视图会立即取得新正文。');
