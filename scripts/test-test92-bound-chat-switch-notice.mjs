import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// 1. Static code structure checks
const coreSource = await readFile(new URL('../dist/worldbook-snapshot-core.js', import.meta.url), 'utf8');
const snapshotsSource = await readFile(new URL('../dist/worldbook-snapshots.js', import.meta.url), 'utf8');

// Ensure notification is NOT placed in generic applyCharacter or bindChat
assert.ok(!coreSource.includes('已切回绑定聊天快照'), '已切回通知不得直接放入核心 applyCharacter 或 bindChat');

// Ensure notifyBoundChatRestored does NOT call say() inside the snapshot dialog
const notifyFuncBody = snapshotsSource.slice(snapshotsSource.indexOf('function notifyBoundChatRestored')).split('\n}')[0];
assert.ok(!notifyFuncBody.includes('say('), 'notifyBoundChatRestored 不得调用面板内部提示 say()，避免双重提示');
assert.ok(snapshotsSource.includes('topNotificationsEnabled()'), '切回通知必须遵循顶部通知开关');

// Ensure the notification format is exact and uses dynamic name
assert.ok(snapshotsSource.includes('`已切回绑定聊天快照：${'), '通知文案格式必须为 已切回绑定聊天快照：{快照名称} 且动态读取');

// Ensure transition return contains autoBound and changed count
assert.ok(coreSource.includes('autoBound: bound'), 'transition 必须返回 autoBound');
assert.ok(coreSource.includes('changed: applied?.changed'), 'transition 必须传递实际开关变化数 changed');

// Ensure onChatChanged checks previous chat, new chat, difference, and deduplication
assert.ok(snapshotsSource.includes('prevKey && nextKey && prevKey !== nextKey'), '切回判断必须确认聊天真实从另一个 chat 切换到当前 chat');
assert.ok(snapshotsSource.includes('(result?.changed ?? 0) > 0'), '切回判断必须以开关实际需要恢复/发生变化为准');
assert.ok(snapshotsSource.includes('lastNotifiedChatKey !== nextKey'), '同一轮切换必须按 chat 身份去重');
assert.ok(snapshotsSource.includes('!chatInitialized'), '页面刷新或初始化加载不得误判为切回');

// 2. Dynamic end-to-end execution test in a simulated environment
const storage = new Map();
const mockLocalStorage = {
  getItem: k => storage.has(k) ? storage.get(k) : null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: k => storage.delete(k),
};

const mockDocument = {
  createElement: () => ({
    id: '', textContent: '', style: {},
    setAttribute() {}, removeAttribute() {},
    querySelector: () => null, querySelectorAll: () => [],
    append() {}, remove() {},
  }),
  body: { append: () => {} },
  head: { append: () => {} },
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
};

let toastrCalls = [];
const mockToastr = {
  info: msg => toastrCalls.push({ type: 'info', msg }),
  success: msg => toastrCalls.push({ type: 'success', msg }),
  warning: msg => toastrCalls.push({ type: 'warning', msg }),
  error: msg => toastrCalls.push({ type: 'error', msg }),
};

const world = () => ({ entries: { 1: { uid: 1, disable: false }, 2: { uid: 2, disable: true } } });
let worldData = { 'wb1': world() };

let currentContext = {
  characterId: '0',
  chatId: 'chatA',
  characters: [{ name: '小雨', avatar: 'rain.png' }],
  eventTypes: { CHAT_CHANGED: 'chat_changed' },
  eventSource: { on() {}, off() {}, removeListener() {} },
  loadWorldInfo: async n => JSON.parse(JSON.stringify(worldData[n])),
  saveWorldInfo: async (n, d) => { worldData[n] = JSON.parse(JSON.stringify(d)); },
};

globalThis.document = mockDocument;
globalThis.window = {
  parent: null,
  document: mockDocument,
  localStorage: mockLocalStorage,
  toastr: mockToastr,
  MutationObserver: class { observe() {} disconnect() {} },
  crypto: { randomUUID: () => 'uuid-' + Math.random() },
  clearTimeout: id => clearTimeout(id),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  cancelAnimationFrame: () => {},
  requestAnimationFrame: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  SillyTavern: { getContext: () => currentContext },
  TavernHelper: {
    getWorldbookNames: async () => ['wb1'],
    getGlobalWorldbookNames: async () => [],
    getCharWorldbookNames: async () => ({ primary: 'wb1', additional: [] }),
    rebindGlobalWorldbooks: async () => {},
  },
};
globalThis.window.parent = globalThis.window;
globalThis.DOC = mockDocument;

// Import worldbook-snapshots.js
await import('../dist/worldbook-snapshots.js');

const snapshotsAPI = globalThis.window.__PMM_WORLDBOOK_SNAPSHOTS__;
assert.ok(snapshotsAPI?.engine, '必须挂载 engine');
assert.ok(typeof snapshotsAPI?.onChatChanged === 'function', '必须暴露 onChatChanged');

// Case A: Initial load in chatA with a bound snapshot
// Create a snapshot and bind to chatA
const draft = await snapshotsAPI.engine.captureBundle('character', 'rain.png');
draft.data.wb1.entries[1].disable = true; // entry 1 disabled
const snap = await snapshotsAPI.engine.createBundle({ ...draft, scope: 'character', owner: 'rain.png', name: '探索模式' });

// First manual bind in chatA
toastrCalls = [];
await snapshotsAPI.engine.bindChat(snap.id);
assert.equal(toastrCalls.some(t => t.msg.includes('已切回绑定聊天快照')), false, '第一次手动点击聊天锁进行绑定不得触发切回通知');

// Initial load / page refresh simulation: onChatChanged runs for the first time
toastrCalls = [];
await snapshotsAPI.onChatChanged(true);
assert.equal(toastrCalls.some(t => t.msg.includes('已切回绑定聊天快照')), false, '页面刷新或初始化加载不得触发切回通知');

// Case B: Duplicate CHAT_CHANGED inside chatA
toastrCalls = [];
await snapshotsAPI.onChatChanged(true);
assert.equal(toastrCalls.some(t => t.msg.includes('已切回绑定聊天快照')), false, '同一个聊天里的重复 CHAT_CHANGED 不得触发通知');

// Case C: Switch to chatB (unbound chat)
currentContext.chatId = 'chatB';
toastrCalls = [];
await snapshotsAPI.onChatChanged(true);
assert.equal(toastrCalls.some(t => t.msg.includes('已切回绑定聊天快照')), false, '切换到没有绑定快照的聊天不得触发通知');
assert.equal(worldData.wb1.entries[1].disable, false, '切到 chatB 应恢复 baseline 开关');

// Case D: Switch back to chatA (Auto switch-back truly occurs)
currentContext.chatId = 'chatA';
toastrCalls = [];
await snapshotsAPI.onChatChanged(true);
assert.equal(worldData.wb1.entries[1].disable, true, '切回 chatA 应重新应用快照开关');
const switchNotices = toastrCalls.filter(t => t.msg.includes('已切回绑定聊天快照'));
assert.equal(switchNotices.length, 1, '真正发生自动切回时必须显示一次通知');
assert.equal(switchNotices[0].msg, '已切回绑定聊天快照：探索模式', '通知名称必须为动态绑定的快照名称');

// Case E: Deduplication on duplicate event / listener during the same switch
await snapshotsAPI.onChatChanged(true);
const repeatNotices = toastrCalls.filter(t => t.msg.includes('已切回绑定聊天快照'));
assert.equal(repeatNotices.length, 1, '同一轮切换中的重复事件必须去重，不得出现第二次通知');

// Case F: Switch away to chatB, but switches in wb1 already match chatA's snapshot
currentContext.chatId = 'chatB';
await snapshotsAPI.onChatChanged(true);
worldData.wb1.entries[1].disable = true; // wb1 already has entry 1 disable: true

currentContext.chatId = 'chatA';
toastrCalls = [];
await snapshotsAPI.onChatChanged(true);
assert.equal(toastrCalls.some(t => t.msg.includes('已切回绑定聊天快照')), false, '当前世界书开关本来就已经与快照一致且未发生变化时不得触发通知');

// Case G: Failure during auto switch-back
currentContext.chatId = 'chatB';
worldData.wb1.entries[1].disable = false;
await snapshotsAPI.onChatChanged(true);

// Simulate failure during worldbook loading
const originalLoad = currentContext.loadWorldInfo;
currentContext.loadWorldInfo = async () => { throw new Error('模拟读取失败'); };

currentContext.chatId = 'chatA';
toastrCalls = [];
await snapshotsAPI.onChatChanged(true);
assert.equal(toastrCalls.some(t => t.msg.includes('已切回绑定聊天快照')), false, '自动切回失败时不得显示成功切回通知');
assert.ok(toastrCalls.some(t => t.type === 'warning' && t.msg.includes('模拟读取失败')), '自动切回失败时必须沿用现有错误通知');

// Restore loadWorldInfo
currentContext.loadWorldInfo = originalLoad;

// Case H: Top notification toggle check
// When pmm_top_notifications_enabled_v1 is '0', top notification must be suppressed
storage.set('pmm_top_notifications_enabled_v1', '0');
currentContext.chatId = 'chatB';
worldData.wb1.entries[1].disable = false;
await snapshotsAPI.onChatChanged(true);

currentContext.chatId = 'chatA';
toastrCalls = [];
await snapshotsAPI.onChatChanged(true);
assert.equal(toastrCalls.some(t => t.msg.includes('已切回绑定聊天快照')), false, '顶部通知总开关关闭时必须静默通知');

// Turn top notifications back on ('1')
storage.set('pmm_top_notifications_enabled_v1', '1');
currentContext.chatId = 'chatB';
worldData.wb1.entries[1].disable = false;
await snapshotsAPI.onChatChanged(true);

currentContext.chatId = 'chatA';
toastrCalls = [];
await snapshotsAPI.onChatChanged(true);
assert.ok(toastrCalls.some(t => t.msg === '已切回绑定聊天快照：探索模式'), '顶部通知总开关开启时必须恢复通知');

console.log('test.92 回归通过：角色世界书聊天锁自动切回通知仅在实际恢复开关时触发一次，去重与初始化保护均已覆盖。');
