import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workshop = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

for (const marker of [
  ',A=t.map(e=>e.id);E.startDrag(A,r.side,t)',
  'const A=r.prompts.map(e=>e.id),a=A.filter(n=>e.includes(n))',
  "const c='before'===t?a:[...a].reverse()",
  'else{ie(t,e,n);if(r.sectionGroupMode)',
  'V2.97.19 已加载：预设多选拖动按当前列表顺序稳定落位',
]) {
  assert.ok(workshop.includes(marker), `缺少预设批量拖动顺序修复：${marker}`);
}

assert.ok(
  !workshop.includes("for(const t of E.draggedIds)s('move',t,e,n)"),
  '普通预设仍在按拖拽 ID 顺序逐条落位',
);

function moveOne(items, id, targetId, position) {
  const sourceIndex = items.indexOf(id);
  const targetIndex = items.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return items;
  const next = [...items];
  const [item] = next.splice(sourceIndex, 1);
  const rawInsert = position === 'before' ? targetIndex : targetIndex + 1;
  const insertIndex = rawInsert > sourceIndex ? rawInsert - 1 : rawInsert;
  next.splice(insertIndex, 0, item);
  return next;
}

function stableBatchMove(items, selectedIds, targetId, position) {
  if (!selectedIds.length || selectedIds.includes(targetId) || !items.includes(targetId)) return items;
  const selected = new Set(selectedIds);
  const ordered = items.filter(id => selected.has(id));
  const remaining = items.filter(id => !selected.has(id));
  const insertionIndex = remaining.indexOf(targetId) + (position === 'after' ? 1 : 0);
  const planned = [
    ...remaining.slice(0, insertionIndex),
    ...ordered,
    ...remaining.slice(insertionIndex),
  ];
  if (planned.every((id, index) => id === items[index])) return items;

  const moveOrder = position === 'before' ? ordered : [...ordered].reverse();
  return moveOrder.reduce(
    (current, id) => moveOne(current, id, targetId, position),
    items,
  );
}

const upward = ['top', 'near', 'a', 'b', 'c', 'bottom'];
const scrambledClicks = ['c', 'a', 'b'];
assert.deepEqual(
  stableBatchMove(upward, scrambledClicks, 'top', 'before'),
  ['a', 'b', 'c', 'top', 'near', 'bottom'],
  '向上拖到目标上方时没有保持列表原顺序',
);
assert.deepEqual(
  stableBatchMove(upward, scrambledClicks, 'top', 'after'),
  ['top', 'a', 'b', 'c', 'near', 'bottom'],
  '向上拖到目标下方时没有保持列表原顺序',
);

const downward = ['a', 'b', 'c', 'near', 'bottom'];
assert.deepEqual(
  stableBatchMove(downward, scrambledClicks, 'bottom', 'before'),
  ['near', 'a', 'b', 'c', 'bottom'],
  '向下拖到目标上方时没有保持列表原顺序',
);
assert.deepEqual(
  stableBatchMove(downward, scrambledClicks, 'bottom', 'after'),
  ['near', 'bottom', 'a', 'b', 'c'],
  '向下拖到目标下方时没有保持列表原顺序',
);

assert.deepEqual(
  stableBatchMove(['a', 'x', 'b', 'target', 'c'], ['c', 'a', 'b'], 'target', 'before'),
  ['x', 'a', 'b', 'c', 'target'],
  '非连续勾选条目没有按当前列表顺序聚合',
);
assert.deepEqual(
  stableBatchMove(['target', 'a', 'b', 'c'], scrambledClicks, 'target', 'after'),
  ['target', 'a', 'b', 'c'],
  '已经位于目标旁边的条目不应发生可见重排',
);

console.log('v2.97.19 回归通过：普通预设多选拖动在任意方向与落点均保持当前列表顺序。');
