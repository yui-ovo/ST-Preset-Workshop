import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8')).replace(/pmmRuntimeResource\((\w+)\)/g, '$1');

const bridgeStart = source.indexOf('function _pmmBatchVariableState()');
const bridgeEnd = source.indexOf('return n({openFullEditor:', bridgeStart);
assert.ok(bridgeStart >= 0 && bridgeEnd > bridgeStart, '无法定位 PresetPanel 批量变量桥');
const bridge = source.slice(bridgeStart, bridgeEnd);

assert.ok(bridge.includes('Array.from(A.selectedIds||[])'), '批量变量必须使用当前面板的已选条目');
assert.ok(bridge.includes('active:!!m.value'), '只有进入多选模式后才能触发批量变量');
assert.ok(bridge.includes("le(`批量变量化 ${r.length} 条`)"), '整批转换必须只建立一次撤销快照');
assert.ok(
  bridge.includes("a('update',e.id,{content:`{{setvar::${n}::${String(e.content??'')}}}`})"),
  '批量转换必须走 PresetPanel 原有 update 链路，并且只修改正文',
);
assert.ok(bridge.includes('setvar::[^:{}\\r\\n]+?::'), '已有 setvar 条目必须被识别并跳过');
assert.ok(
  source.includes('batchVariableState:_pmmBatchVariableState,batchVariableize:_pmmBatchVariableize'),
  'PresetPanel 没有向正文 S 助手暴露批量变量能力',
);

const setStart = source.indexOf('async function handleSetButton(group)');
const getStart = source.indexOf('async function handleGetButton(group)', setStart);
const badgeStart = source.indexOf('async function handleStripButton', getStart);
assert.ok(setStart >= 0 && getStart > setStart && badgeStart > getStart, '无法定位 S/G 按钮处理器');
const setHandler = source.slice(setStart, getStart);
const getHandler = source.slice(getStart, badgeStart);

assert.ok(setHandler.includes('const selectedBatch = selectedBatchContext(ctx.editor, ctx.panel)'), 'S 没有读取当前面板多选状态');
assert.ok(setHandler.includes('selectedBatch?.state?.active && selectedBatch.state.count > 0'), 'S 没有限定多选且已勾选时才批量处理');
assert.ok(setHandler.indexOf('selectedBatchContext') < setHandler.indexOf('const existing = extractSetVariables'), '批量分支必须先于原单条 S 菜单');
assert.ok(source.includes('条目名称、开关与排序不变'), '批量确认弹窗缺少不改其他字段的说明');
const batchHandler = source.slice(source.indexOf('async function batchVariableizeSelected('), source.indexOf('async function batchRenameSelectedVariables('));
assert.ok(setHandler.includes('batchVariableizeSelected(ctx, selectedBatch)'), 'S must dispatch to the current batch handler');
assert.ok(batchHandler.includes('addVariables(ctx.panel, [name], { quiet: true })'), '批量生成的变量名没有加入本次新增变量记录');
assert.ok(!getHandler.includes('selectedBatchContext'), 'G 不应被批量变量功能改变');
assert.ok(source.includes('V2.83 已加载：多选模式复用条目 S 批量变量化，G 保持不变。'), '缺少 v2.83 加载标记');

function simulateBatch(prompts, selectedIds, name) {
  const selected = new Set(selectedIds);
  let changed = 0;
  let skipped = 0;
  const next = prompts.map(prompt => {
    if (!selected.has(prompt.id)) return prompt;
    if (/[{][{]\s*setvar::[^:{}\r\n]+?::/iu.test(String(prompt.content ?? ''))) {
      skipped++;
      return prompt;
    }
    changed++;
    return { ...prompt, content: `{{setvar::${name}::${String(prompt.content ?? '')}}}` };
  });
  return { next, changed, skipped };
}

const original = [
  { id: 'a', name: '玻璃城', enabled: false, content: '都市叙事正文' },
  { id: 'b', name: '醒不来', enabled: true, content: '意识流正文' },
  { id: 'c', name: '尼龙线', enabled: false, content: '{{setvar::旧变量::原有变量正文}}' },
  { id: 'd', name: '未选条目', enabled: true, content: '保持不变' },
];
const result = simulateBatch(original, ['a', 'b', 'c'], '文风框架');
assert.equal(result.changed, 2);
assert.equal(result.skipped, 1);
assert.equal(result.next[0].content, '{{setvar::文风框架::都市叙事正文}}');
assert.equal(result.next[1].content, '{{setvar::文风框架::意识流正文}}');
assert.equal(result.next[2].content, original[2].content);
assert.equal(result.next[3].content, original[3].content);
assert.equal(result.next[0].name, original[0].name);
assert.equal(result.next[0].enabled, original[0].enabled);

console.log('v2.83 批量变量测试通过：多选时复用 S，逐条保留正文，跳过已有变量，G 与其他字段不变。');
