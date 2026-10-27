import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8')).replace(/pmmRuntimeResource\((\w+)\)/g,'$1');

const floatingStart = source.indexOf('PMM_FLOATING_PANEL_BATCH_V1');
assert.ok(floatingStart >= 0, '缺少手机悬浮入口模块');
const floatingNextModule = source.indexOf('/* =====', floatingStart + 30);
const floatingPatch = source.slice(floatingStart, floatingNextModule > floatingStart ? floatingNextModule : undefined);
assert.ok(floatingPatch.includes("listen('mousedown'"), '手机入口没有隔离原组件的鼠标展开状态');
assert.ok(floatingPatch.includes("listen('mousedown'"), '手机入口没有拦截原生 mousedown 切换');
assert.ok(floatingPatch.includes("if (!usesTouchFloatingEntry()) return;"), '入口状态隔离没有限制在手机环境');
assert.ok(floatingPatch.includes('event.stopImmediatePropagation();'), '手机入口仍可能触发原组件的第二套展开状态');
assert.ok(
  floatingPatch.indexOf("listen('mousedown'") < floatingPatch.indexOf("listen('click'"),
  '必须先隔离原组件状态，再由手机 click 展开',
);

assert.ok(
  source.includes('__pmmBatchVariableBridge={state:_pmmBatchVariableState,apply:_pmmBatchVariableize,reveal:_pmmRevealPromptForCompare,record:le,'),
  '主面板没有向编辑控件暴露已有撤销历史入口',
);

const undoStart = source.indexOf('PMM_EDIT_UNDO_V291');
assert.ok(undoStart >= 0, '缺少 v2.91 编辑撤销适配模块');
const nextModule = source.indexOf('/* =====', undoStart + 30);
const undoPatch = source.slice(undoStart, nextModule > undoStart ? nextModule : undefined);

for (const selector of [
  'inline-editor__name-input',
  'prompt-editor__name-input',
  'full-editor__name-input',
  'inline-editor__textarea',
  'prompt-editor__textarea',
  'full-editor__textarea',
  'section-header__input',
]) {
  assert.ok(undoPatch.includes(selector), `编辑撤销缺少 ${selector}`);
}

assert.ok(undoPatch.includes("bridge.record('重命名分组')"), '分组改名没有写入撤销历史');
assert.ok(undoPatch.includes("['inline-editor__name-input', '编辑条目标题']"), '条目标题没有独立撤销说明');
assert.ok(undoPatch.includes("['inline-editor__textarea', '编辑条目正文']"), '条目正文没有独立撤销说明');
assert.ok(undoPatch.includes('const recordedFields = new WeakSet();'), '编辑输入没有按单次聚焦合并撤销记录');
assert.ok(undoPatch.includes("on(documentObject, 'input', recordFieldBeforeVueUpdate);"), '没有在 Vue 保存前记录标题或正文');
assert.ok(undoPatch.includes("on(documentObject, 'blur', finishFieldSession);"), '编辑结束后没有释放单次撤销标记');
assert.ok(undoPatch.includes("event.key === 'Enter'"), '回车确认分组改名时没有记录撤销');
assert.ok(undoPatch.includes('.section-action--confirm'), '点击确认分组改名时没有记录撤销');
assert.ok(!undoPatch.includes('MutationObserver'), '编辑撤销不应靠持续 DOM 扫描实现');
assert.ok(!undoPatch.includes('setInterval'), '编辑撤销不应引入轮询');

assert.ok(source.includes('if(n>=4000000)return 2;'), '超大预设没有保留历史数量上限');
assert.ok(source.includes('return n>=1000000?3:n>=350000?6:20;'), '历史快照没有按预设体积限流');

const listeners = new Map();
const fakeDocument = {
  addEventListener(type, listener) {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(listener);
  },
  removeEventListener() {},
};
const recordedLabels = [];
const panel = { __pmmBatchVariableBridge: { record: label => recordedLabels.push(label) } };
const makeTarget = (className, value = '') => ({
  value,
  classList: { contains: candidate => candidate === className },
  closest: selector => selector.includes('preset-panel') ? panel : null,
});
const dispatch = (type, event) => {
  for (const listener of listeners.get(type) || []) listener(event);
};

vm.runInNewContext(source.slice(source.indexOf(';(() => {', undoStart), nextModule), {
    pmmRuntimeResource:target=>target,
  document: fakeDocument,
  top: null,
  setTimeout: callback => callback(),
  console: { info() {} },
});

const titleInput = makeTarget('full-editor__name-input');
dispatch('input', { target: titleInput });
dispatch('input', { target: titleInput });
assert.deepEqual(recordedLabels, ['编辑条目标题'], '连续输入不应每个字符都创建历史快照');
dispatch('blur', { target: titleInput });
dispatch('input', { target: titleInput });
assert.deepEqual(recordedLabels, ['编辑条目标题', '编辑条目标题'], '重新聚焦编辑后应创建新的撤销记录');

const sectionInput = makeTarget('section-header__input', '旧分组');
dispatch('focusin', { target: sectionInput });
sectionInput.value = '新分组';
dispatch('keydown', { target: sectionInput, key: 'Enter' });
dispatch('blur', { target: sectionInput });
assert.deepEqual(
  recordedLabels,
  ['编辑条目标题', '编辑条目标题', '重命名分组'],
  '一次分组改名只能创建一条撤销记录',
);

console.log('v2.91 回归测试通过：手机入口单状态展开，标题、正文和分组改名均按一次编辑写入一次撤销。');
