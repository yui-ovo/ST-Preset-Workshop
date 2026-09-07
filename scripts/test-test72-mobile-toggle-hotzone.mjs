import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const start = source.indexOf('PMM_MOBILE_QUICK_TOGGLE_TEST72');
assert.ok(start >= 0, '无法定位手机端快捷开关热区模块');
const compat = source.slice(start);

for (const marker of [
  "const ROOT_SELECTOR = '#preset-manager-main-panel'",
  "const CARD_SELECTOR = '.prompt-card[data-prompt-id],.section-header'",
  "const HOT_ZONE_WIDTH = 72",
  'const MOVE_CANCEL = 10',
  'const CLICK_SUPPRESS_MS = 1000',
  'const CLICK_SUPPRESS_RADIUS = 32',
  "root?.classList?.contains('pmm-mobile-layout-enabled')",
  "card.querySelector('.prompt-card__toggle')",
  "card.querySelectorAll('.section-header__actions > button.section-action')",
  "button.querySelector('.fa-toggle-on,.fa-toggle-off')",
  'function hitsOtherControl(target, toggle)',
  "control.closest?.('.prompt-card__actions,.prompt-item__actions,.section-header__actions,.category-header__actions')",
  'Number(style.opacity) < .5',
  'function actionAreasVisible(card)',
  'actionsVisibleAtStart: actionAreasVisible(info.card)',
  'function movementExceeded(current, point)',
  'function beginNewTouchInteraction()',
  'beginNewTouchInteraction();',
  'Math.hypot(point.x - current.start.x, point.y - current.start.y) > MOVE_CANCEL',
  'event.preventDefault();',
  'event.stopImmediatePropagation();',
  'if (current.actionsVisibleAtStart && hitsOtherControl(event.target, current.toggle)) return;',
  'triggerToggle(current.toggle)',
  'Math.hypot(event.clientX - pending.point.x, event.clientY - pending.point.y) > CLICK_SUPPRESS_RADIUS',
  "DOC.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true })",
  "DOC.addEventListener('pointermove', onPointerMove, { capture: true, passive: true })",
  "DOC.addEventListener('pointerup', onPointerUp, { capture: true, passive: false })",
  "DOC.addEventListener('touchend', onTouchEnd, { capture: true, passive: false })",
]) {
  assert.ok(compat.includes(marker), `test.72 缺少手机快捷开关保护：${marker}`);
}

assert.ok(
  compat.indexOf('function hitsOtherControl(target, toggle)') < compat.indexOf('function candidateFor(target, point)'),
  '必须在命中热区前先保留收藏、复制、编辑等已有操作按钮的优先级',
);
assert.ok(
  compat.includes('actions 真正显示后，收藏／复制／编辑等按钮继续保持自己的点击优先级'),
  '隐藏的 actions 不能抢走首点；显示后也必须让已有操作优先',
);
assert.ok(
  compat.indexOf('movementExceeded(current, point)') < compat.indexOf('triggerToggle(current.toggle)'),
  '必须先确认没有滑动，再触发真实开关，避免滚动误触',
);
assert.ok(
  compat.indexOf('beginNewTouchInteraction();') < compat.indexOf('const point = pointFromPointer(event);'),
  '新一次真实触摸开始时必须先清掉旧的延迟点击保护',
);
assert.ok(
  compat.indexOf('actionsVisibleAtStart: actionAreasVisible(info.card)') < compat.indexOf('triggerToggle(current.toggle)'),
  '必须按按下时的 actions 可见状态判定优先级，避免首点 hover 淡入后重新抢走开关',
);
assert.ok(
  compat.indexOf('if (current.actionsVisibleAtStart && hitsOtherControl(event.target, current.toggle)) return;') < compat.indexOf('triggerToggle(current.toggle)'),
  '松手落到按下时已显示的操作按钮时，必须让该按钮继续优先，不能改为切换开关',
);
assert.ok(
  !compat.includes("classList.add('prompt-card--expanded')") && !compat.includes("classList.add('section-header--editing')"),
  '快捷热区不得以伪造卡片展开／编辑状态的方式实现',
);

console.log('test.72 回归通过：手机端最右侧热区直接转发真实条目／分组开关，滑动与已有操作按钮不会被抢占。');
