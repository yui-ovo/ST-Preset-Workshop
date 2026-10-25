import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/worldbook-stitch-test3.js', import.meta.url), 'utf8');

for (const marker of [
  'const WORLD_PICKER_THEME_VARS = [',
  'function worldPickerThemeSource()',
  "element?.classList?.contains('pm-overlay')",
  'function syncWorldPickerTheme(overlay)',
  "overlay.style.setProperty(name, value, 'important');",
  'function startWorldPickerThemeSync(overlay)',
  "pmmRuntimeResource(observer).observe(source, { attributes: true, attributeFilter: ['style'] });",
  'startWorldPickerThemeSync(overlay);',
  'const expandedSections = new Set();',
  'const queryCollapsedSections = new Set();',
  'data-wb-picker-section="${key}"',
  "const boundExpanded = query ? !queryCollapsedSections.has('bound') : expandedSections.has('bound');",
  "const unboundExpanded = query ? !queryCollapsedSections.has('unbound') : expandedSections.has('unbound');",
  "const targetSet = input.value.trim() ? queryCollapsedSections : expandedSections;",
  '.pmm-wb-picker-section.is-expanded .pmm-wb-picker-section-title',
]) {
  assert.ok(source.includes(marker), `test.32 世界书搜索主题／折叠缺少实现：${marker}`);
}

const pickerStart = source.indexOf('  function openSourcePicker(sideName)');
const pickerEnd = source.indexOf('  async function switchTopKind(kind)', pickerStart);
const picker = source.slice(pickerStart, pickerEnd);

assert.ok(
  picker.includes("expanded ? `<div class=\"pmm-wb-picker-section-body\">${rows.map(rowMarkup).join('')}</div>` : ''"),
  '分类收起时仍然渲染了全部世界书条目',
);
assert.ok(
  picker.indexOf('pmmRuntimeResource(state.host).append(overlay);') < picker.indexOf('startWorldPickerThemeSync(overlay);'),
  '搜索弹窗尚未挂载就开始读取主题',
);

const expandedSections = new Set();
const queryCollapsedSections = new Set();
const isExpanded = (key, query) => query
  ? !queryCollapsedSections.has(key)
  : expandedSections.has(key);

assert.equal(isExpanded('bound', ''), false, '打开弹窗时角色绑定分类没有默认收起');
assert.equal(isExpanded('unbound', ''), false, '打开弹窗时未绑定分类没有默认收起');
expandedSections.add('bound');
assert.equal(isExpanded('bound', ''), true, '点击分类后没有展开');
assert.equal(isExpanded('unbound', '角色名'), true, '搜索时有结果的分类没有自动展开');
queryCollapsedSections.add('unbound');
assert.equal(isExpanded('unbound', '角色名'), false, '搜索状态下无法手动收起分类');

console.log('test.32 回归通过：世界书搜索跟随主题，分类默认收起并可按需展开。');
