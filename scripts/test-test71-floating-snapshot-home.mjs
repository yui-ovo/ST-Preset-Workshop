import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const start = source.indexOf('/* ===== PMM_FLOATING_PANEL_BATCH_V1');
const end = source.indexOf(';(()=>{\n  /* 预设工坊 × 柏宝箱', start);
assert.ok(start >= 0 && end > start, '无法定位悬浮快照入口');
const floating = source.slice(start, end);

const clickStart = floating.indexOf("button.addEventListener('click', event =>", floating.indexOf("button.className = 'pmm-floating-snapshot-trigger'"));
const clickEnd = floating.indexOf('presetSection.insertBefore(button, presetSelect)', clickStart);
assert.ok(clickStart >= 0 && clickEnd > clickStart, '无法定位悬浮相机点击流程');
const cameraClick = floating.slice(clickStart, clickEnd);
assert.ok(cameraClick.includes("api.open({ source:'floating' })"), '悬浮相机不能直接打开轻量快照页面');
assert.ok(!cameraClick.includes('openWorkshopHome()'), '仅查看快照时不应加载工坊主页面');

const homeStart = floating.indexOf('async function waitForWorkshopHome(');
const homeEnd = floating.indexOf('function bindAutoCollapseOnEdit(', homeStart);
assert.ok(homeStart >= 0 && homeEnd > homeStart, '无法定位返回主页流程');
const homeFlow = floating.slice(homeStart, homeEnd);
assert.ok(floating.includes('currentWindow.frames?.length'), '未遍历酒馆嵌套 frame，可能只找到错误的顶层页面');
assert.ok(floating.includes('currentWindow.parent && currentWindow.parent !== currentWindow'), '未向上查找承载实际工坊的父页面');
assert.ok(homeFlow.includes("main?.classList?.contains('pmm-worldbook-mode')"), '世界书页面不会在打开快照前退出');
assert.ok(homeFlow.includes(".panel-btn.panel-btn--active:not([data-pmm-worldbook-placeholder=\"1\"])"), '缝合、分支或收藏页面不会通过当前按钮退出');
assert.ok(homeFlow.includes('function workshopStore(main, storeName)'), '没有找到工坊挂载的 Pinia 状态机');
assert.ok(homeFlow.includes('function clickWorkshopAction(action, preserveNativeDrawer = false)'), '缺少保留酒馆主预设返回页的程序化点击边界');
assert.ok(homeFlow.includes("action.addEventListener('click', stopOuterBubble)"), '打开工坊时没有截断酒馆抽屉外部点击冒泡');
assert.ok(homeFlow.includes("{ store:'merge', active:'isMergeMode', exit:'exitMergeMode' }"), '缝合分屏没有走工坊原生退出状态');
assert.ok(homeFlow.includes("{ store:'branch', active:'isBranchMode', exit:'exitBranchMode' }"), '分支分屏没有走工坊原生退出状态');
assert.ok(homeFlow.includes("{ store:'favorite', active:'isFavoriteMode', exit:'exitFavoriteMode' }"), '收藏分屏没有走工坊原生退出状态');
assert.ok(homeFlow.includes('const exitedByState = exitWorkshopStateModes(main);'), '退出分屏时没有优先调用工坊状态机');
assert.ok(homeFlow.includes('return leaveWorkshopSpecialMode(options);'), '已打开的特殊页面仍会被关闭重开');
assert.ok(homeFlow.includes('return waitForWorkshopHome();'), '工坊新打开后没有确认主页渲染完成');
assert.ok(homeFlow.includes('if (!await waitForWorkshopMain()) return false'), '工坊关闭时没有先等待主面板挂载');
assert.ok(homeFlow.includes('if (workshopHomeVisible()) return true;\n    return leaveWorkshopSpecialMode(options);'), '新打开工坊仍会停留在上次记忆的分屏页面');
assert.ok(
  homeFlow.indexOf('if (workshopMainExists())') < homeFlow.indexOf('const action = floatingEditAction();'),
  '工坊已打开在分屏时不应依赖已经收起的悬浮入口按钮',
);

const snapshotStart = source.indexOf('/* ===== PMM_SWITCH_SNAPSHOTS_TEST52');
const snapshotEnd = source.indexOf('/* ===== PMM_THEMED_COMPARE_DRAG_LINE_V289', snapshotStart);
assert.ok(snapshotStart >= 0 && snapshotEnd > snapshotStart, '无法定位开关快照流程');
const snapshot = source.slice(snapshotStart, snapshotEnd);
assert.ok(snapshot.includes('async function enterCaptureModeFromOverlay()'), '保存默认后缺少进入快照模式流程');
assert.ok(snapshot.includes('function workshopDocuments()'), '快照模块未跨嵌套页面寻找实际工坊');
assert.ok(snapshot.includes("if (blockWhileBranchActive('新建快照')) return;"), '只有实际应用的命名分支才应阻止新建快照');
assert.ok(!snapshot.includes("if (isBranchMode() || blockWhileBranchActive('新建快照')) return;"), '空分支工具页不应阻止新建快照');
assert.ok(snapshot.includes("const preserveNativeDrawer = entryContext?.source === 'native-preset'"), '原生小相机入口没有记住酒馆主预设返回页');
assert.ok(snapshot.includes('if (!await entryApi.openWorkshopHome({ preserveNativeDrawer }))'), '保存并进入或新建快照时没有保留来源页打开工坊主页');
assert.ok(snapshot.includes("无法返回主预设首页，请先关闭分屏后重试"), '返回首页失败时仍在使用误导性的旧提示');
assert.ok(snapshot.includes("if (saveDefaultSnapshot({ silent: true })) void enterCaptureModeFromOverlay();"), '首次保存默认后没有按需进入工坊主页');

const readBranchStart = floating.indexOf('function readAppliedBranchName(');
const readBranchEnd = floating.indexOf('function activeSnapshotForFloatingPreset(', readBranchStart);
assert.ok(readBranchStart >= 0 && readBranchEnd > readBranchStart, '无法定位实际应用分支读取逻辑');
const readBranch = floating.slice(readBranchStart, readBranchEnd);
assert.ok(readBranch.includes('pm_v2_settings?.bookmarks'), '快照分支限制没有读取实际应用状态');
assert.ok(!readBranch.includes('select?.value'), '不能把仅打开的空分支工具页误判为已应用分支');

console.log('test.71 回归通过：入口相机只打开轻量快照页；跨嵌套页面退出空分支、收藏、缝合或世界书并返回主预设首页。');
