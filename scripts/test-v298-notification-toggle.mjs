import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workshop = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const worldbook = await readFile(new URL('../dist/worldbook-stitch-test3.js', import.meta.url), 'utf8');
const entry = await readFile(new URL('../dist/index.js', import.meta.url), 'utf8');

const tunerStart = workshop.indexOf('PMM_MOBILE_LAYOUT_TUNER_V1');
const tunerEnd = workshop.indexOf('PMM_FLOATING_PANEL_BATCH_V1', tunerStart);
assert.ok(tunerStart >= 0 && tunerEnd > tunerStart, '无法隔离布局调节模块');
const tuner = workshop.slice(tunerStart, tunerEnd);
const footerIndex = tuner.indexOf('<footer class="pmm-layout-card__footer">');
const resetIndex = tuner.indexOf('data-pmm-layout-reset', footerIndex);
const dragIndex = tuner.indexOf('data-pmm-layout-dnd-compat', footerIndex);
const noticeIndex = tuner.indexOf('data-pmm-layout-top-notifications', footerIndex);
const doneIndex = tuner.indexOf('data-pmm-layout-done', footerIndex);

assert.ok(
  resetIndex >= 0 && resetIndex < dragIndex && dragIndex < noticeIndex && noticeIndex < doneIndex,
  '底部按钮没有按“恢复默认、拖拽兼容、顶部通知、完成”排列',
);

for (const snippet of [
  '顶部通知：<span data-pmm-notice-state>开</span>',
  'setTopNotificationsEnabled(!pmmTopNotificationsEnabled())',
  'setTopNotificationsEnabled(true)',
  "button.querySelector('[data-pmm-notice-state]').textContent = enabled ? '开' : '关'",
  'grid-template-columns:1.15fr 1fr 1fr auto!important',
  '.pmm-layout-notice-btn.pmm-layout-notice-btn--active',
]) {
  assert.ok(tuner.includes(snippet), `顶部通知开关缺少关键实现：${snippet}`);
}

const importIndex = workshop.indexOf('import{createPinia');
assert.ok(importIndex > 0, '无法定位工坊业务入口');
const prelude = workshop.slice(0, importIndex);
const values = new Map();
const shown = [];
const logged = [];
const storage = {
  getItem: key => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, String(value)),
};
const hostToastr = {
  success: (...args) => shown.push(['success', ...args]),
  info: (...args) => shown.push(['info', ...args]),
  warning: (...args) => shown.push(['warning', ...args]),
  error: (...args) => shown.push(['error', ...args]),
  options: {},
};
const fakeConsole = {
  debug: (...args) => logged.push(['debug', ...args]),
  info: (...args) => logged.push(['info', ...args]),
  warn: (...args) => logged.push(['warn', ...args]),
  error: (...args) => logged.push(['error', ...args]),
};
const policy = Function('globalThis', 'console', `${prelude}\nreturn { toastr, enabled:pmmTopNotificationsEnabled, set:pmmSetTopNotificationsEnabled };`)(
  { top:{ localStorage:storage, toastr:hostToastr }, localStorage:storage, toastr:hostToastr },
  fakeConsole,
);

assert.equal(policy.enabled(), true, '顶部通知默认没有开启');
policy.toastr.success('默认显示');
assert.equal(shown.length, 1, '默认开启时通知没有显示');
assert.equal(policy.set(false), false, '关闭状态没有持久化');
policy.toastr.error('应被静默');
assert.equal(shown.length, 1, '关闭后仍调用了顶部通知');
assert.equal(logged.at(-1)?.[0], 'error', '关闭通知后错误没有降级写入控制台');
assert.equal(policy.set(true), true, '重新开启状态没有持久化');
policy.toastr.info('重新显示');
assert.equal(shown.length, 2, '重新开启后通知没有恢复');

for (const source of [entry, worldbook]) {
  assert.ok(source.includes("pmm_top_notifications_enabled_v1"), '启动器或世界书没有共用顶部通知设置');
  assert.ok(source.includes("getItem(TOP_NOTIFICATION_STORAGE_KEY) !== '0'"), '启动器或世界书没有读取顶部通知设置');
}

assert.ok(workshop.includes('const toastr = new Proxy'), '工坊没有使用只作用于自身的通知代理');
assert.ok(!workshop.includes('globalThis.toastr ='), '顶部通知开关不应修改酒馆或其他插件的全局 toastr');
assert.ok(workshop.includes('V2.98 已加载：布局页可一键开关预设工坊顶部通知。'), '缺少 v2.98 运行标记');

console.log('v2.98 顶部通知开关测试通过：按钮布局、持久化、静默与恢复均正常，且不会关闭其他插件通知。');
