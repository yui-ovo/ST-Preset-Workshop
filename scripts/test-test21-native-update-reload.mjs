import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const entry = await readFile(new URL('../dist/index.js', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));

assert.equal(manifest.hooks?.update, 'onUpdate', 'manifest 必须注册酒馆官方 update 钩子');
for (const marker of [
  'export function onUpdate()',
  'scheduleNativeSingleUpdateReload()',
  'deferNativeSingleUpdateReload()',
  'handlePendingExtensionManagerClose',
  "target.closest('.popup-button-ok')",
  "dialog?.querySelector('.extensions_info')",
  'waitForExtensionManagerClose(dialog)',
  "block.querySelector('.btn_update .fa-spin, .btn_update.fa-spin')",
  'bulkExtensionUpdateInProgress = true',
  "[...toolbar.querySelectorAll('button')].slice(0, 2)",
  'UPDATE_MANAGER_SETTLE_DELAY = 1_500',
  'UPDATE_MANAGER_CLOSE_POLL_INTERVAL = 50',
  'RAPID_VERSION_CHECK_INTERVAL = 750',
  "document.addEventListener('click', handleNativeExtensionManagerClick, true)",
  'if (versionCheckBusy || bulkExtensionUpdateInProgress',
]) {
  assert.ok(entry.includes(marker), `test.21 即时更新刷新缺少实现：${marker}`);
}

const hookStart = entry.indexOf('export function onUpdate()');
const hookEnd = entry.indexOf('function startVersionWatcher()', hookStart);
assert.ok(hookStart >= 0 && hookEnd > hookStart, '无法定位 update 钩子');
const hookBody = entry.slice(hookStart, hookEnd);
assert.ok(!hookBody.includes('notify('), 'update 钩子不应重复制造提示，应保留酒馆原生成功提示');

const checkStart = entry.indexOf('async function checkForInstalledUpdate()');
const checkEnd = entry.indexOf('\nfunction handleVisibilityChange()', checkStart);
const checkBody = entry.slice(checkStart, checkEnd);
assert.ok(
  checkBody.includes('nativeUpdateReloadPending || singleExtensionUpdatePending'),
  'update 钩子先进入等待后，尚未结束的版本检测也必须继续等待关闭，不能竞态刷新',
);
assert.ok(
  /if \(followsNativeSingleUpdate\) \{\s*deferNativeSingleUpdateReload\(\);\s*return;/u.test(checkBody),
  '检测到单独更新后必须进入等待关闭流程，并在立即刷新代码前返回',
);

const deferStart = entry.indexOf('function deferNativeSingleUpdateReload()');
const deferEnd = entry.indexOf('\nfunction scheduleNativeSingleUpdateReload()', deferStart);
const deferBody = entry.slice(deferStart, deferEnd);
assert.ok(
  deferBody.includes("document.addEventListener('click', handlePendingExtensionManagerClose, true)"),
  '单独更新完成后必须持续监听扩展管理器关闭按钮',
);
assert.ok(
  deferBody.includes('!activeExtensionManagerDialog()'),
  '只有扩展管理器未能重新出现时才允许兜底刷新',
);

const scheduleStart = entry.indexOf('function scheduleNativeSingleUpdateReload()');
const scheduleEnd = entry.indexOf('\nfunction handleNativeExtensionManagerClick', scheduleStart);
const scheduleBody = entry.slice(scheduleStart, scheduleEnd);
assert.ok(!scheduleBody.includes('setTimeout'), '官方 update 钩子不应再按固定延迟直接刷新');
assert.ok(!scheduleBody.includes('markExtensionUpdateReload'), '官方 update 钩子不应绕过关闭按钮直接刷新');

console.log('test.21 回归通过：单独更新保留酒馆原生提示，等待扩展管理器关闭后刷新；批量更新不抢先刷新，并保留快速与定时检测兜底。');
