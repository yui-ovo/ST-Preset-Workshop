import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8')).replace(/pmmRuntimeResource\((\w+)\)/g, '$1');
const start = source.indexOf('async function _pmmImportBaiBaiGroups');
const end = source.indexOf('function _pmmScheduleDeferredRender', start);

assert.notEqual(start, -1, '找不到柏宝箱分组导入函数');
assert.notEqual(end, -1, '找不到柏宝箱分组导入函数结尾');

let presetReads = 0;
const sandbox = {
  console,
  structuredClone,
  h: { info() {}, warn() {} },
  SillyTavern: {
    getContext: () => ({
      getPresetManager: () => ({
        readPresetExtensionField() {
          presetReads += 1;
          throw new Error('分支面板不应该查询真实预设');
        },
      }),
    }),
  },
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.top = sandbox;

vm.runInNewContext(
  `${source.slice(start, end)}; globalThis.importBranchGroups = _pmmImportBaiBaiGroups;`,
  sandbox,
  { filename: 'workshop-v2.55.branch-render.js' },
);

const state = {
  sections: [
    { id: 'baibai_writing', displayName: '写作指导', itemIds: ['p1', 'p2'] },
    { id: 'baibai_rules', displayName: '规则', itemIds: ['p3'] },
  ],
  collapsedSections: ['baibai_writing'],
  disabledSections: ['baibai_rules'],
  originalEnabledStates: { baibai_rules: { p3: true } },
  groupSource: 'baibai',
  hasAutoClassified: true,
  manualNoGroups: false,
};

const result = await sandbox.importBranchGroups(
  'branch:测试预设:新分支',
  [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
  state,
);

assert.equal(result, true, '分支快照应被直接接纳');
assert.equal(presetReads, 0, '分支键不得用于查询真实酒馆预设');
assert.equal(state.sections.length, 2, '分支分组不得被清空');
assert.deepEqual([...state.collapsedSections], ['baibai_writing']);
assert.deepEqual([...state.disabledSections], ['baibai_rules']);
assert.equal(state.groupSource, 'baibai');
assert.equal(state.isInitialized, true);

console.log('v2.55 分支面板测试通过：直接读取柏宝箱快照，且不会误查真实预设或清空分组。');
