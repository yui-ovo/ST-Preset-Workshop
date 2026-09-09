import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位快照快捷入口片段：${startMarker}`);
  return source.slice(start, end);
}

const floating = section('/* ===== PMM_FLOATING_PANEL_BATCH_V1', ';(()=>{\n  /* 预设工坊 × 柏宝箱');
assert.ok(floating.includes("const ENTRY_API_KEY = '__PMM_FLOATING_SNAPSHOT_ENTRY_TEST69__'"), '悬浮入口没有开放快照导航接口');
assert.ok(floating.includes("button.className = 'pmm-floating-snapshot-trigger'"), '悬浮工具栏缺少相机按钮');
assert.ok(floating.includes("button.innerHTML = '<i class=\"fa-solid fa-camera\"></i>'"), '快捷按钮没有使用相机图标');
assert.ok(floating.includes('presetSection.insertBefore(button, presetSelect)'), '相机没有放在滑杆图标与预设选择框之间');
assert.ok(floating.includes("button.classList.toggle('is-branch-blocked', blocked)"), '应用分支后相机不会变暗');
assert.ok(floating.includes('请先切回默认分支后使用开关快照'), '分支状态下点击相机没有简短提示');
assert.ok(floating.includes("api.open({ source:'floating' })"), '相机没有直接打开现有开关快照面板');
assert.ok(floating.includes("event.stopImmediatePropagation()"), '悬浮分支下拉框没有在活动快照期间中止原生切换');
assert.ok(floating.includes('openWorkshopHome'), '快捷面板的新建动作不能返回主预设首页');

const branchCore = section('async function applyBranchState(presetName,sectionGroupState,prompts=[])', 'async function restoreMainState');
assert.ok(branchCore.includes('__PMM_SWITCH_SNAPSHOTS_TEST52__'), '工坊分支核心没有检查当前应用快照');
assert.ok(branchCore.includes("blocked.code='PMM_SNAPSHOT_BRANCH_CONFLICT'"), '分支核心没有以明确冲突状态中止应用');
assert.ok(branchCore.includes("await setter('in_use',{prompts:clone(promptsForPreset(presetName))})"), '底层分支拦截后没有还原主预设草稿');

const snapshot = section('/* ===== PMM_SWITCH_SNAPSHOTS_TEST52', '/* ===== PMM_THEMED_COMPARE_DRAG_LINE_V289');
assert.ok(snapshot.includes('function activeBranchName('), '快照模块不能识别工坊外正在应用的分支');
assert.ok(snapshot.includes('function blockWhileBranchActive('), '快照操作缺少统一分支互斥保护');
assert.ok(snapshot.includes("if (blockWhileBranchActive('应用快照')) return false"), '应用快照仍可能覆盖当前分支');
assert.ok(snapshot.includes('async function enterCaptureModeFromOverlay()'), '快捷面板新建快照没有导航流程');
assert.ok(snapshot.includes('await entryApi.openWorkshopHome()'), '新建快照没有自动打开主预设首页');
assert.ok(snapshot.includes("else if (action === 'new') void enterCaptureModeFromOverlay()"), '新建按钮仍会在隐藏页面直接进入录制');
assert.ok(snapshot.includes('activeForPreset: presetName =>'), '分支侧无法读取当前应用快照');

console.log('test.69 回归通过：悬浮入口可直达开关快照，分支与快照双向互斥，快捷新建会返回主预设首页。');
