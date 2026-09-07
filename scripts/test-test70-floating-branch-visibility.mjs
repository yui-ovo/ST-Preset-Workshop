import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位入口分支显示片段：${startMarker}`);
  return source.slice(start, end);
}

const toolbar = section("const BRANCH_TOOLBAR_STYLE_ID = 'pmm-branch-toolbar-style-v2'", 'function ensureWorkshopControls(doc)');
assert.ok(toolbar.includes("const BRANCH_ENTRY_TOGGLE_CLASS = 'pmm-floating-branch-visibility-toggle'"), '分支页缺少入口显示开关');
assert.ok(toolbar.includes("container.classList.contains('pm-panel-container--branch-mode')"), '入口显示开关没有限定在分支页');
assert.ok(toolbar.includes('setBranchEntryEnabled(!branchEntryIsEnabled())'), '分支页开关不能切换入口显示状态');
assert.ok(toolbar.includes('setBranchEntrySwitchVisual(button, branchEntryIsEnabled())'), '分支页开关没有同步持久化状态');
assert.ok(source.includes("label.textContent = '分支入口'"), '电脑分支页开关没有显示清晰文字');
assert.ok(source.includes("const desktop = !isMobile();"), '分支页开关没有区分电脑与手机显示方式');
assert.ok(toolbar.includes('LEGACY_BRANCH_FULLSCREEN_BUTTON_CLASS'), '没有清理旧版分支全屏按钮');
assert.ok(toolbar.includes('button.remove()'), '旧版分支全屏按钮仍可能残留');
assert.ok(!toolbar.includes("button.innerHTML = '<div class=\"card-icon\"><i class=\"fa-solid fa-expand\""), '分支页仍会新建全屏按钮');

const floating = section('/* ===== PMM_FLOATING_PANEL_BATCH_V1', ';(()=>{\n  /* 预设工坊 × 柏宝箱');
assert.ok(floating.includes("const BRANCH_ENTRY_VISIBILITY_KEY = 'pmm_floating_branch_visible_v1'"), '入口分支显示状态没有独立存储键');
assert.ok(floating.includes("return storage?.getItem(BRANCH_ENTRY_VISIBILITY_KEY) === '1'"), '入口分支没有默认隐藏');
assert.ok(floating.includes("section.classList.toggle('pmm-floating-branch-hidden', !visible)"), '关闭开关后没有只隐藏分支区段');
assert.ok(floating.includes('#preset-manager-floating-panel .pmm-floating-branch-hidden{display:none!important}'), '入口分支隐藏样式缺失');
assert.ok(floating.includes('syncFloatingBranchVisibility(root);'), '浮动入口重绘后没有恢复分支显示偏好');
assert.ok(floating.includes('setBranchVisibility: setFloatingBranchEnabled'), '入口 API 无法同步分支显示偏好');
assert.ok(!floating.includes("select.closest?.('.panel-section')?.remove()"), '隐藏分支不应删除原生选择器');

const scan = section('function scan(doc)', 'docs.forEach(doc =>');
assert.ok(scan.includes('ensureWorkshopControls(doc);'), '扫描时没有同步分支页开关');
assert.ok(scan.indexOf('ensureWorkshopControls(doc);') < scan.indexOf('if (!isMobile()) return;'), '桌面在同步分支页开关前提前返回');

console.log('test.70 回归通过：入口分支默认隐藏，主动打开后记住选择；电脑与手机都会稳定显示分支页开关，关闭只隐藏选择区。');
