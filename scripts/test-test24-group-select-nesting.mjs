import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const runtime = await readFile(new URL('../patches/test24-group-select-nesting.js', import.meta.url), 'utf8');

for (const marker of [
  '_pmmSourceSection=t.sections.find(e=>m.every(n=>e.itemIds.includes(n)))',
  '_pmmCanNest=!!_pmmSourceSection&&m.length<_pmmSourceSection.itemIds.length',
  "_pmmChild.parentSectionId=String(_pmmParent.parentSectionId||_pmmParent.id||'')",
  '_pmmChild.itemIds.every(n=>e.itemIds.includes(n))',
  'parentSectionId:_pmmParentSectionId',
  'parentBeforeItemId:_pmmParentBeforeItemId',
  "'data-parent-section-id':A.section.parentSectionId||''",
  "'data-item-count':A.section.items.length",
  "'data-selected-count':A.section.items.filter(e=>Y(e.id)).length",
  'PMM_GROUP_SELECT_NESTING_TEST24',
  'test.24 已加载：多选模式支持组内全选',
]) {
  assert.ok(source.includes(marker), `test.24 业务入口缺少实现：${marker}`);
}

for (const marker of [
  "groupId(group).startsWith('baibai_')",
  'dissolve.hidden = isNativeGroup(group)',
  "actions.prepend(select)",
  "dissolve.before(select)",
  "fa-solid fa-check-double",
  "${SELECT_CLASS}.${SELECT_CLASS}--checked",
  "const targets = [group, ...descendants(group, children)]",
  "const shouldSelect = !(total > 0 && selected >= total)",
  'pmm-nested-section-slot',
  'promptItemById(content',
  "parent.parentElement !== host",
]) {
  assert.ok(runtime.includes(marker), `test.24 运行补丁缺少实现：${marker}`);
}

assert.ok(runtime.includes('if (!multiSelectActive(group))'), '组内全选按钮必须只在多选模式显示');
assert.ok(runtime.includes("group?.querySelector?.('.prompt-item--multi-select')"), '手机端必须按条目的真实多选布局识别组内全选');
assert.ok(runtime.includes('for (const item of collapsed) clickHeader(item)'), '折叠分组应能临时展开后完成全选');
assert.ok(runtime.includes('for (const item of collapsed.reverse())'), '全选后应恢复原折叠状态');
assert.ok(runtime.includes('isNativeGroup(group) ? `${enabled}/${total}` : String(total)'), '外层主预设分组计数应包含子组');

console.log('test.24 回归通过：主预设分组与工坊分组使用对应按钮，同组范围可原位形成一层子分组。');
