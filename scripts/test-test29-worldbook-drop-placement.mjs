import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/worldbook-stitch-test3.js', import.meta.url), 'utf8');

for (const marker of [
  'function worldDropPlacement(event, sideName)',
  "position: Number(event.clientY) < rect.top + rect.height / 2 ? 'before' : 'after'",
  'showWorldDropIndicator(targetSide, worldDropPlacement(event, targetSide))',
  'const placement = nativeList ? nativeDropPlacement(event) : worldDropPlacement(event, targetSide);',
  "card.classList.add(placement?.position === 'before' ? 'pmm-wb-entry--drop-before' : 'pmm-wb-entry--drop-after')",
  '.pmm-wb-entry--drop-before::before,.pmm-wb-entry--drop-after::after',
  '.pmm-wb-list.pmm-wb-list--drop-empty::before',
  'return transferWorldToWorld(fromName, move, forcedKeys, placement);',
  "insertWorldEntries(state.bottom, 'preset', entries, placement);",
  'const entries = source.entries.filter(entry => wanted.has(entryKey(entry))).map(clone);',
  'test.29 已加载：世界书条目按蓝色落点线插入目标位置',
]) {
  assert.ok(source.includes(marker), `test.29 世界书定点插入缺少实现：${marker}`);
}

assert.ok(
  !source.includes('.pmm-wb-inline-panel.pmm-wb-panel--drop-target'),
  '世界书拖入时不应继续把整张目标卡片边框变色',
);

for (const marker of [
  '.section-card--drop-before,.section-card--drop-after,.section-card--drop-into',
  '.section-group--drop-before,.section-group--drop-after,.section-group--drop-into',
  'function endNativePresetDragState()',
  'new TOP.DragEvent(\'dragend\', { bubbles:true, cancelable:false })',
  'card.dispatchEvent(event);',
  'function scheduleDropIndicatorCleanup()',
  'scheduleDropIndicatorCleanup() {\n    endNativePresetDragState();',
  'for (const delay of [0, 80, 240])',
  '.finally(scheduleDropIndicatorCleanup)',
  'state.nativeTop = nativeTop;\n    endNativePresetDragState();',
  'function resetClosedState() {\n    endNativePresetDragState();',
  'function close(force = false) {\n    if (!state.open) return;',
]) {
  assert.ok(source.includes(marker), `test.29 缺少拖拽结束后的蓝线清理：${marker}`);
}
const closeBody = source.slice(source.indexOf('function close(force = false)'), source.indexOf('function cleanup()'));
assert.ok(closeBody.includes('endNativePresetDragState();'), '确认关闭后仍应清理拖拽状态');

const helperStart = source.indexOf('  function entriesFromWorld(data)');
const helperEnd = source.indexOf('  function setStatus(text)', helperStart);
const insertStart = source.indexOf('  function insertWorldEntries(target, sourceKind, entries, placement = null)');
const insertEnd = source.indexOf('  function pushUndo(owner, label, options = {})', insertStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, '无法隔离世界书排序与 UID 逻辑');
assert.ok(insertStart >= 0 && insertEnd > insertStart, '无法隔离世界书定点插入逻辑');
const logic = `${source.slice(helperStart, helperEnd)}\n${source.slice(insertStart, insertEnd)}`;
const api = vm.runInNewContext(
  `(() => {
    const WORLD_DEFAULTS = {};
    const clone = value => JSON.parse(JSON.stringify(value));
    ${logic}
    return { insertWorldEntries };
  })()`,
  { JSON, Object, String, Number, Math, Date },
);

function makeTarget() {
  return {
    data: {
      entries: {
        0: { uid:0, displayIndex:0, comment:'A' },
        1: { uid:1, displayIndex:1, comment:'B' },
        2: { uid:2, displayIndex:2, comment:'C' },
      },
    },
    entries: [],
  };
}

const target = makeTarget();
const additions = api.insertWorldEntries(
  target,
  'world',
  [
    { uid:90, displayIndex:90, comment:'X', content:'x' },
    { uid:91, displayIndex:91, comment:'Y', content:'y' },
  ],
  { targetKey:'1', position:'before' },
);

assert.deepEqual(
  Array.from(target.entries, entry => entry.comment),
  ['A', 'X', 'Y', 'B', 'C'],
  '多选条目没有作为连续整体插到目标条目前',
);
assert.deepEqual(
  Array.from(target.entries, entry => entry.displayIndex),
  [0, 1, 2, 3, 4],
  '插入后没有按可见顺序重新整理 displayIndex',
);
assert.equal(new Set(Array.from(additions, entry => entry.uid)).size, 2, '复制条目没有取得互不冲突的新 UID');

const appended = makeTarget();
api.insertWorldEntries(appended, 'world', [{ uid:92, comment:'末尾' }]);
assert.deepEqual(
  Array.from(appended.entries, entry => entry.comment),
  ['A', 'B', 'C', '末尾'],
  '拖到列表空白区域时没有保留追加到末尾的行为',
);

console.log('test.29 回归通过：世界书只显示条目间蓝线，单条或多选按落点插入，空白区域仍追加到末尾。');
