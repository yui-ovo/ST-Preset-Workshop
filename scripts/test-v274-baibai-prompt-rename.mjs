import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8')).replace(/pmmRuntimeResource\((\w+)\)/g, '$1');

assert.ok(source.includes('function readCurrentPromptNames(presetName)'), '保存后没有读取当前预设的新条目名称');
assert.ok(source.includes('function patchVuePromptNamesDirectly(manager, promptNames)'), '缺少柏宝箱 Vue 条目名称直补逻辑');
assert.ok(source.includes('writeBaiBaiLivePromptNames(promptManager, promptNames)'), '柏宝箱重建前没有更新实时 prompts');
assert.ok(source.includes('&& vueModelHasPromptNames(manager, promptNames)'), '即时刷新结果没有校验条目名称');

const blockStart = source.indexOf(';(()=>{\n  /*\n   * 预设工坊 × ST-BaiBai-Tools 预设分组兼容 V19');
const blockEnd = source.indexOf('\n\n\n;(()=>{\n  const docs=[];', blockStart);
assert.ok(blockStart >= 0 && blockEnd > blockStart, '无法隔离柏宝箱兼容运行块');

let runnable = source.slice(blockStart, blockEnd);
runnable = runnable.replace(
  '  console.info(`[预设工坊×柏宝箱] V${GROUP_SYNC_VERSION} 已加载：分组内条目改名会按稳定 ID 即时同步到柏宝箱当前列表。`);\n})();',
  '  globalThis.__baibaiRenameTest = { normalizePromptNames, syncCurrentBaiBaiRuntimeAndUI, patchVuePromptNamesDirectly, vueModelHasPromptNames };\n})();',
);

const vueManager = {
  state: {
    renderKey: 0,
    items: [
      {
        type: 'group',
        groupId: 'top',
        title: '顶部111',
        children: [
          { type: 'prompt', id: 'inside', name: '👑伊莱亚斯' },
        ],
      },
      { type: 'prompt', id: 'outside', name: '分组外旧名称' },
    ],
  },
  vue: { async nextTick() {} },
};
const promptManager = {
  serviceSettings: {
    prompts: [
      { id: 'inside', name: '👑伊莱亚斯' },
      { id: 'outside', name: '分组外旧名称' },
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
  readPresetExtensionField() {
    return { version: 1, groups: [{ id: 'top', name: '顶部111' }], prompts: { inside: { groupId: 'top' } } };
  },
  async writePresetExtensionField() {},
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
  getPreset: () => ({
    prompts: [
      { id: 'inside', name: '👑伊莱亚斯111' },
      { id: 'outside', name: '分组外新名称' },
    ],
  }),
};
sandbox.globalThis = sandbox;
vm.runInNewContext(runnable, sandbox);

const helper = sandbox.__baibaiRenameTest;
assert.ok(helper, '柏宝箱改名测试接口未暴露');

const promptNames = helper.normalizePromptNames([
  { id: 'inside', name: '👑伊莱亚斯111' },
  { id: 'outside', name: '分组外新名称' },
]);
const result = await helper.syncCurrentBaiBaiRuntimeAndUI(
  presetManager,
  '测试预设',
  { version: 1, groups: [{ id: 'top', name: '顶部111' }], prompts: { inside: { groupId: 'top' } } },
  [],
  [],
  promptNames,
);

assert.equal(vueManager.state.items[0].children[0].name, '👑伊莱亚斯111', '分组内条目仍显示旧名称');
assert.equal(vueManager.state.items[1].name, '分组外新名称', '分组外条目名称被刷新逻辑破坏');
assert.equal(promptManager.serviceSettings.prompts[0].name, '👑伊莱亚斯111', '柏宝箱实时预设仍保存旧名称');
assert.equal(vueManager.state.renderKey, 1, 'Vue 列表没有触发即时重绘');
assert.equal(result.ui, true, '改名后的 Vue 模型没有通过即时同步校验');

vueManager.state.items[0].children[0].name = '👑伊莱亚斯';
promptManager.serviceSettings.prompts[0].name = '👑伊莱亚斯';
assert.equal(await topWindow.__PMM_BAIBAI_COMPAT__.flushPreset('测试预设'), true, '只有条目改名时保存流程没有触发刷新');
assert.equal(vueManager.state.items[0].children[0].name, '👑伊莱亚斯111', '保存流程没有读取当前预设的新名称');

assert.ok(source.includes('V${GROUP_SYNC_VERSION} 已加载：分组内条目改名'), '缺少 v2.74 运行标记');
console.log('v2.74 柏宝箱改名同步测试通过：分组内外条目均按稳定 ID 即时刷新。');
