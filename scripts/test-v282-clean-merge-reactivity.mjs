import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8')).replace(/pmmRuntimeResource\((\w+)\)/g, '$1');

assert.ok(!source.includes('function _pmmTogglePromptEnabledImmutable'), 'v2.79 的尝试性开关辅助函数不应进入当前运行版');
assert.ok(!source.includes('function _pmmToggleMergePromptEnabled'), 'v2.80 的跨作用域辅助函数不应进入当前运行版');

const mergeStart = source.indexOf("mn=n('merge'");
const mergeEnd = source.indexOf('var un=', mergeStart);
assert.ok(mergeStart >= 0 && mergeEnd > mergeStart, '无法定位 merge store');
const mergeStore = source.slice(mergeStart, mergeEnd);

assert.ok(
  mergeStore.includes("toggleEnabled:function(e){const n=a.value.find(n=>n.id===e);n&&(n.enabled=!n.enabled)}"),
  '下方开关应恢复 v2.42/v2.78 的同作用域直接更新链路',
);
assert.ok(!mergeStore.includes('_pmmToggleMergePromptEnabled'), 'merge store 不能再调用组件内部函数');

const deStart = source.indexOf('function De(e)');
const deEnd = source.indexOf('function Ue(e)', deStart);
assert.ok(deStart >= 0 && deEnd > deStart, '无法定位分组视图同步逻辑');
const sectionSync = source.slice(deStart, deEnd);

assert.ok(
  sectionSync.includes("String(e.name||'')+'\\u0000'+(e.enabled===!1?'0':'1')"),
  '分组视图签名必须同时监听条目名称与开关状态',
);
assert.ok(!sectionSync.includes('_pmmLiveNameTimer'), '分组刷新不能继续依赖后台 iframe 可能延迟的计时器');
assert.ok(!sectionSync.includes('setTimeout('), '开关和拖入后的分组刷新应在 Vue post-flush 直接完成');
assert.ok(sectionSync.includes('o.setPromptsForPreset(n.value.map(e=>({...e})),e),r.value++'), '列表变化后必须立即同步分组副本并刷新');

const crossDropStart = source.indexOf('function qe(e)');
const crossDropEnd = source.indexOf('function Fe(e)', crossDropStart);
const crossDrop = source.slice(crossDropStart, crossDropEnd);
assert.ok(crossDrop.includes('m.splice(d,0,...p),n.value=m'), '跨预设拖入必须先替换 rightPrompts 数组');
assert.ok(crossDrop.includes('o.setPromptsForPreset?.(n.value,A.value)'), '拖入后必须同步分组渲染仓库');

assert.ok(source.includes('V2.82 已加载：从 v2.78 干净基线恢复缝合交互'), '缺少 v2.82 加载标记');

console.log('v2.82 干净回归通过：撤销 v2.79–v2.81 workaround，旧版开关链路与即时拖入刷新同时保留。');
