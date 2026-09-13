import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

for (const marker of [
  'sectionFlatView:{type:Boolean}',
  "'section-flat-view':e.sectionGroupMode&&z.value",
  'chooseFlatMoveAssignment',
  'unassign: intent.unassign === true',
  "_pmmRemovingFromBaiBai",
  "A?.queue?.({presetName:r.presetName,targetId:e,targetPosition:n,targetSectionId:i||'',unassign:!i,newIds:l})",
  "e?.queue?.({presetName:r.presetName,targetId:c.id,targetPosition:d,unassign:!0,newIds:t})",
  'V2.98.8 已加载：平铺跨分组拖拽可选择归属',
]) {
  assert.ok(source.includes(marker), `缺少平铺跨分组拖拽修复：${marker}`);
}

const blockStart = source.indexOf(';(()=>{\n  /*\n   * 预设工坊 × ST-BaiBai-Tools 预设分组兼容 V19');
const blockEnd = source.indexOf('\n\nconsole.info(\'[预设工坊] V2.74 已加载', blockStart);
assert.ok(blockStart >= 0 && blockEnd > blockStart, '无法隔离柏宝箱兼容运行块');

let runnable = source.slice(blockStart, blockEnd);
runnable = runnable.replace(
  '  console.info(`[预设工坊×柏宝箱] V${GROUP_SYNC_VERSION} 已加载：分组内条目改名会按稳定 ID 即时同步到柏宝箱当前列表。`);\n})();',
  '  globalThis.__flatGroupDropTest = { queue, flushPreset, resolveFlatDropSection };\n})();',
);

let persistedState = {
  version: 1,
  groups: [
    { id: 'upper', name: '标题/行动选项/防秒射' },
    { id: 'lower', name: '系统的' },
  ],
  prompts: {
    movable: { groupId: 'upper' },
    upperTail: { groupId: 'upper' },
    lowerHead: { groupId: 'lower' },
  },
};

const vueManager = {
  state: {
    renderKey: 0,
    items: [
      {
        type: 'group',
        groupId: 'upper',
        title: '标题/行动选项/防秒射',
        children: [
          { type: 'prompt', id: 'movable', name: '前置文档', groupId: 'upper' },
          { type: 'prompt', id: 'upperTail', name: '上组末项', groupId: 'upper' },
        ],
      },
      {
        type: 'group',
        groupId: 'lower',
        title: '系统的',
        children: [
          { type: 'prompt', id: 'lowerHead', name: 'Persona Description', groupId: 'lower' },
        ],
      },
    ],
  },
  vue: { async nextTick() {} },
};

const promptManager = {
  serviceSettings: {
    prompts: [
      { id: 'upperTail', name: '上组末项' },
      { id: 'movable', name: '前置文档' },
      { id: 'lowerHead', name: 'Persona Description' },
    ],
    extensions: {},
  },
  async renderPromptManagerListItems() {},
};

const extensionState = {
  __baiBaiToolkitPresetVueListManager: vueManager,
  __baiBaiToolkitPresetVueListRenderPatch: { manager: promptManager },
};

const presetManager = {
  getSelectedPresetName() { return '测试预设'; },
  readPresetExtensionField() { return structuredClone(persistedState); },
  async writePresetExtensionField({ value }) { persistedState = structuredClone(value); },
};

const fakeDocument = {};
const topWindow = { document: fakeDocument, __baiBaiToolkitExtensionInstalled: extensionState };
const sandbox = {
  console,
  structuredClone,
  document: fakeDocument,
  setTimeout,
  clearTimeout,
  toastr: { success() {}, info() {}, warning() {} },
};
sandbox.window = {
  top: topWindow,
  parent: topWindow,
  document: fakeDocument,
  SillyTavern: { getContext: () => ({ getPresetManager: () => presetManager }) },
  getPreset: () => ({ prompts: promptManager.serviceSettings.prompts }),
};
sandbox.globalThis = sandbox;
vm.runInNewContext(runnable, sandbox);

const helper = sandbox.__flatGroupDropTest;
assert.ok(helper, '柏宝箱平铺拖拽测试接口未暴露');

const boundary = helper.resolveFlatDropSection({
  presetName: '测试预设',
  targetId: 'lowerHead',
  targetPosition: 'before',
  orderedIds: ['upperTail', 'lowerHead'],
});
assert.equal(boundary.ambiguous, true, '两个分组的交界处没有触发归属选择');
assert.equal(boundary.previous.sectionId, 'baibai_upper');
assert.equal(boundary.next.sectionId, 'baibai_lower');

assert.equal(helper.queue({
  presetName: '测试预设',
  targetId: 'lowerHead',
  targetSectionId: 'baibai_lower',
  targetPosition: 'after',
  newIds: ['movable'],
}), true);
assert.equal(helper.queue({
  presetName: '测试预设',
  targetId: 'lowerHead',
  targetPosition: 'before',
  unassign: true,
  newIds: ['movable'],
}), true);
assert.equal(await helper.flushPreset('测试预设'), true, '移出柏宝箱分组的保存流程失败');

assert.equal(persistedState.prompts.movable, undefined, '保存后条目仍绑定原柏宝箱分组');
assert.deepEqual(
  vueManager.state.items.map(item => item.type === 'group' ? `group:${item.groupId}` : item.id),
  ['group:upper', 'movable', 'group:lower'],
  '柏宝箱当前列表没有把条目放到两个分组之间',
);
assert.equal(vueManager.state.items[0].children.some(item => item.id === 'movable'), false);
assert.equal(vueManager.state.renderKey, 1, '柏宝箱当前列表没有触发重绘');

console.log('v2.98.8 回归通过：平铺跨分组拖拽可明确选择归属，并能持久化为未分组条目。');
