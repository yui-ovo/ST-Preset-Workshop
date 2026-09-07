import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const start = source.indexOf('PMM_SWITCH_SNAPSHOTS_TEST52');
const end = source.indexOf('PMM_THEMED_COMPARE_DRAG_LINE_V289', start);
assert.ok(start >= 0 && end > start, '无法定位开关快照模块');
const snapshots = source.slice(start, end);

for (const marker of [
  'function hasAnySnapshotBindings(store = readStore())',
  '!isDefaultSnapshot(snapshot)',
  'function syncChatBindingListener(store = readStore(), scheduleCurrent = false)',
  'if (!hasAnySnapshotBindings(store))',
  'uninstallChatBindingListener();',
  'syncChatBindingListener(store);',
  'syncChatBindingListener(store, true);',
  'function startWorkshopDiscovery()',
  'const roots = workshopDocuments()',
  'for (const node of record.addedNodes || [])',
  'panel = panelInsideNode(node);',
  'function observeWorkshopPanel(panel)',
  "panelObserver.observe(panel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });",
  'panelParentObserver.observe(observedPanelParent, { childList: true });',
  'discoveryObserver?.disconnect();',
  'function disconnectWorkshopObservers()',
]) {
  assert.ok(snapshots.includes(marker), `test.73 缺少快照闲置休眠保护：${marker}`);
}

const installStart = snapshots.indexOf('function install()');
const installEnd = snapshots.indexOf('TOP[API_KEY] =', installStart);
assert.ok(installStart >= 0 && installEnd > installStart, '无法定位快照安装流程');
const install = snapshots.slice(installStart, installEnd);

assert.ok(
  !/^\s*installChatBindingListener\(\);\s*$/m.test(install),
  '没有任何角色／聊天绑定时仍会无条件安装聊天切换监听',
);
assert.ok(
  !snapshots.includes('observer.observe(DOC.documentElement, { childList: true, subtree: true });'),
  '快照模块仍会让整页每次 DOM 变化都触发完整入口扫描',
);
assert.ok(
  snapshots.indexOf('discoveryObserver?.disconnect();') < snapshots.indexOf("panelObserver.observe(panel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });"),
  '工坊出现后必须先停掉整页发现观察器，再仅观察工坊自身',
);

console.log('test.73 回归通过：无绑定时不监听聊天切换，工坊出现后只观察工坊节点。');
