import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8')).replace(/pmmRuntimeResource\((\w+)\)/g, '$1');
const start = source.indexOf('function selectedBatchContext(editor, panel)');
const end = source.indexOf('function applyTheme(dialog, panel)', start);
assert.ok(start >= 0 && end > start, '无法定位从展开编辑器读取多选面板的桥');

const bridgeSource = source.slice(start, end);
assert.ok(bridgeSource.includes('panel?.__pmmBatchVariableBridge'), '批量检测没有优先读取当前面板的 DOM 直连桥');
assert.ok(bridgeSource.includes('editor?.__vueParentComponent'), '批量检测没有从实际展开编辑器开始');
assert.ok(bridgeSource.includes('panel?.__vueParentComponent'), '批量检测缺少外层面板兜底');
assert.ok(bridgeSource.includes('component.exposed, component.exposeProxy, component.proxy'), '批量检测没有兼容 Vue 的三种暴露入口');
assert.ok(
  source.includes('const selectedBatch = selectedBatchContext(ctx.editor, ctx.panel);'),
  'S 点击处理没有把当前展开编辑器传给批量检测',
);
assert.ok(!source.includes('const selectedBatch = selectedBatchContext(ctx.panel);'), '旧的错误面板入口仍然存在');
assert.ok(source.includes("ref_key:'pmmBatchRoot',ref:_pmmBatchRoot,class:'preset-panel'"), 'PresetPanel 根节点没有注册批量桥引用');
assert.ok(source.includes('__pmmBatchVariableBridge={state:_pmmBatchVariableState,apply:_pmmBatchVariableize,reveal:_pmmRevealPromptForCompare,record:le,'), 'PresetPanel 没有把批量与撤销能力直接绑定到当前面板节点');

const selectedBatchContext = vm.runInNewContext(
  `(() => { ${bridgeSource}; return selectedBatchContext; })()`,
);
const directPanel = {
  __pmmBatchVariableBridge: {
    state: () => ({ active: true, count: 2, ids: ['x', 'y'] }),
    apply: name => ({ name, changed: 2, skipped: 0, total: 2 }),
  },
};
const directContext = selectedBatchContext(null, directPanel);
assert.deepEqual({ ...directContext.state }, { active: true, count: 2, ids: ['x', 'y'] });
assert.deepEqual({ ...directContext.apply('文风框架') }, { name: '文风框架', changed: 2, skipped: 0, total: 2 });

let appliedName = '';
const presetPanelComponent = {
  exposed: {
    batchVariableState: () => ({ active: true, count: 3, ids: ['a', 'b', 'c'] }),
    batchVariableize: name => {
      appliedName = name;
      return { changed: 3, skipped: 0, total: 3 };
    },
  },
  parent: null,
};
const promptEditorComponent = { parent: { parent: presetPanelComponent } };
const editor = { __vueParentComponent: promptEditorComponent };
const misleadingOuterPanel = { __vueParentComponent: { parent: null } };

const context = selectedBatchContext(editor, misleadingOuterPanel);
assert.deepEqual({ ...context.state }, { active: true, count: 3, ids: ['a', 'b', 'c'] });
assert.deepEqual({ ...context.apply('文风框架') }, { changed: 3, skipped: 0, total: 3 });
assert.equal(appliedName, '文风框架');
assert.ok(source.includes('V2.84 已加载：S 从展开编辑器组件链准确识别当前面板多选状态。'), '缺少 v2.84 修复标记');

console.log('v2.84 编辑器桥测试通过：S 会沿展开条目的 Vue 组件链找到当前 PresetPanel 多选状态。');
