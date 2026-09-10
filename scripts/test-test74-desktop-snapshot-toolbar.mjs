import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位电脑主页快照工具栏：${startMarker}`);
  return source.slice(start, end);
}

const trigger = section('function mountTrigger()', 'function handleDocumentClick(event)');
for (const marker of [
  'const actionsHost = normalTitleActions()',
  'const host = actionsHost',
  "const titleContent = actionsHost?.closest?.('.title-content') || actionsHost?.closest?.('.pm-header')?.querySelector('.header-left .title-content') || null",
  'const captureActive = isCaptureMode()',
  "const importButton = actionsHost?.querySelector?.('[title=\"导入\"]')",
  'if (host === actionsHost && importButton) host.insertBefore(button, importButton)',
  'else host.appendChild(button)',
  'moveDesktopCaptureSaveToActions(currentEditButton, button, actionsHost)',
]) {
  assert.ok(trigger.includes(marker), `快照入口没有恢复到第二排导入之前：${marker}`);
}

for (const marker of [
  'function moveDesktopCaptureSaveToActions(button, triggerButton, actionsHost)',
  "const desktop = Boolean(TOP.matchMedia?.('(min-width:769px)')?.matches ?? ((TOP.innerWidth || 0) > 768));",
  '不再沿用第一排铅笔／相机的测量宽度，避免取消按钮被压扁。',
  "button.dataset.pmmSnapshotCaptureMoved = 'true'",
  'actionsHost.insertBefore(button, triggerButton.nextSibling)',
  'if (titleRow && button.parentElement !== titleRow) titleRow.appendChild(button)',
  `.title-content.\${CAPTURE_TITLE_CLASS} .title-actions>[title="保存开关"],.title-content.\${CAPTURE_TITLE_CLASS} .title-actions>[title^="同步开关"]{display:none!important}`,
]) {
  assert.ok(source.includes(marker), `电脑快照模式第二排没有按“取消＋快照保存”整理：${marker}`);
}

const style = section('function installStyle()', 'function scheduleMount()');
assert.ok(style.includes(`.title-action-btn.\${TRIGGER_CLASS}{display:flex!important}`), '快照入口基础显示样式丢失');
for (const marker of [
  "const DESKTOP_HOME_TITLE_HOST_CLASS = 'pmm-desktop-home-title-host'",
  "const DESKTOP_HOME_PANEL_CLASS = 'pmm-desktop-home-panel-expanded'",
  "const titleHost = titleContent?.closest?.('.header-left') || null",
  "const desktopHomeContainer = actionsHost?.closest?.('.pm-panel-container') || null",
  'titleHost?.classList.add(DESKTOP_HOME_TITLE_HOST_CLASS)',
  'desktopHomeContainer?.classList.add(DESKTOP_HOME_PANEL_CLASS)',
  `.pm-panel-container.\${DESKTOP_HOME_PANEL_CLASS}>.pm-main-wrapper{flex:0 0 620px!important;width:620px!important;min-width:620px!important;max-width:620px!important}`,
  `.pm-panel-container.\${DESKTOP_HOME_PANEL_CLASS}>.pm-main-wrapper>.preset-panel{width:100%!important;min-width:0!important;max-width:100%!important}`,
  `.header-left.\${DESKTOP_HOME_TITLE_HOST_CLASS}{flex:0 0 208px!important;width:208px!important;min-width:208px!important;max-width:208px!important}`,
  `.header-left.\${DESKTOP_HOME_TITLE_HOST_CLASS} .title-card{width:100%!important;min-width:0!important;max-width:100%!important}`,
  `.title-content.\${HOME_TITLE_CLASS}{min-width:0!important;width:100%!important;max-width:100%!important}`,
  `.title-content.\${HOME_TITLE_CLASS}>.title-actions{margin-left:-30px!important;gap:6px!important}`,
  `.title-content.\${HOME_TITLE_CLASS}>.title-actions>.title-action-btn{flex:0 0 auto!important;white-space:nowrap!important}`,
  `.title-content.\${HOME_TITLE_CLASS}>.title-row>.title-edit-btn{display:flex!important;visibility:visible!important;flex:0 0 20px!important;width:20px!important;min-width:20px!important}`,
  "TOP.localStorage?.removeItem('pmm.desktop-title-card-width.v1')",
  'const DESKTOP_DEFAULT_SPLIT_RATIO = 52',
  "desktop:makeLayoutState(saved?.desktop?.values, saved?.desktop?.customized, false, true)",
  "if (desktop && key === 'splitRatio' && savedCustomized?.[key] !== true)",
  'isMobile() ? DEFAULTS.splitRatio : DESKTOP_DEFAULT_SPLIT_RATIO',
  '@media (min-width:1024px){',
  'max-width:1312px!important;margin-left:auto!important;margin-right:auto!important',
  'max-width:none!important;justify-self:stretch!important;',
  'flex:0 0 220px!important;width:220px!important;min-width:220px!important;max-width:220px!important;',
  '让名称、铅笔和第二排动作与普通桌面酒馆一致，不再把动作文字逐字换行。',
  '@media screen and (min-width:769px){',
  '.pm-panel-container--merge-mode > .pm-main-wrapper > .preset-panel .header-left .title-card>.title-content',
  'width:calc(100% - 14px)!important;min-width:0!important;max-width:calc(100% - 14px)!important',
  '.pm-panel-container--branch-mode > .preset-panel .pm-header,',
  '.pm-panel-container--favorite-mode > .preset-panel .pm-header{justify-content:flex-start!important}',
  '.pm-panel-container--favorite-mode .pm-header>.header-right{flex:0 0 auto!important;margin-left:12px!important}',
  '快照录制的取消与保存均放在标题卡片第二排中央，避免 Tauri 将取消按钮压成细条。',
  'justify-content:center!important;width:100%!important;margin-left:0!important;gap:7px!important',
  'flex:0 0 28px!important;width:28px!important;min-width:28px!important;max-width:28px!important;height:24px!important;min-height:24px!important',
]) {
  assert.ok(source.includes(marker), `桌面工具栏或宽屏分屏限宽样式缺失：${marker}`);
}
assert.ok(!source.includes('function beginDesktopTitleWidthDrag(event)'), '电脑主页仍保留三横线拖动逻辑');
assert.ok(!source.includes("handle.addEventListener('dblclick'"), '电脑主页仍保留三横线双击逻辑');

console.log('test.74 回归通过：电脑快照模式第二排的取消与快照保存居中且同尺寸；普通主页主面板小幅加宽，电脑宽屏分屏默认左侧略宽、轨道整体居中限宽，Tauri 与浏览器分屏名称框统一，分屏标题与工具按钮紧凑排列。');
