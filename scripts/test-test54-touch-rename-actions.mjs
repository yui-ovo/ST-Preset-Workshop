import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const start = source.indexOf('PMM_TOUCH_RENAME_ACTIONS_TEST54');
const end = source.indexOf('个人测试通道：底部工具栏“世界书”入口', start);
assert.ok(start >= 0 && end > start, '无法定位 test.54 外层改名铅笔触屏兼容模块');
const compat = source.slice(start, end);

for (const marker of [
  "const ROOT_SELECTOR = '#preset-manager-main-panel'",
  "button.title-edit-btn[title=\"编辑预设名\"]",
  "button.title-edit-btn[title=\"编辑分支名\"]",
  "button.category-action[title=\"重命名分类\"]",
  "button.section-action[title=\"重命名分组\"]",
  "event.pointerType === 'touch' || event.pointerType === 'pen'",
  "dragHost.setAttribute('draggable', 'false')",
  'event.preventDefault()',
  'event.stopImmediatePropagation()',
  'action.click()',
  'event.isTrusted',
  "DOC.addEventListener('pointerdown', beginAction, { capture: true, passive: false })",
  "DOC.addEventListener('touchstart', beginAction, { capture: true, passive: false })",
]) {
  assert.ok(compat.includes(marker), `test.54 缺少外层改名铅笔触屏兜底：${marker}`);
}

assert.ok(
  compat.indexOf("dragHost.setAttribute('draggable', 'false')") < compat.indexOf('action.click()'),
  '必须先关闭外层标题的拖拽，再在真实按下阶段触发原改名处理器',
);
assert.ok(
  compat.includes("else dragHost.setAttribute('draggable', draggable)"),
  '触摸操作结束后没有恢复标题区原始 draggable 状态',
);
assert.ok(
  !compat.includes('prompt-editor') && !compat.includes('prompt-item') && !compat.includes('prompt-card'),
  '外层铅笔兜底不得改动已经正常的预设条目编辑区域',
);
assert.ok(
  !compat.includes('删除分类') && !compat.includes('解散分组'),
  '触摸兜底不得自动触发删除或解散操作',
);

console.log('test.54 回归通过：四类外层改名铅笔在触屏按下阶段直接生效，条目编辑与鼠标路径保持原样。');
