import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWorldbookSnapshots, emptyStore, copy } from '../dist/worldbook-snapshot-core.js';

// 1. Static source assertions
const coreSource = await readFile(new URL('../dist/worldbook-snapshot-core.js', import.meta.url), 'utf8');
const workshopSource = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

// Ensure updateBundle checks activeCharacter
assert.ok(coreSource.includes('activeCharacter='), 'updateBundle 必须检测当前正在应用的角色快照状态');
assert.ok(coreSource.includes('store.session.chosen===id'), '当前应用判断必须依据 session.chosen');
assert.ok(coreSource.includes('(sync && activeGroup) || activeCharacter'), '当前应用的角色快照编辑必须自动同步写入世界书');

// Ensure preset snapshot maintains blockWhileSnapshotActive protection
assert.ok(workshopSource.includes("blockWhileSnapshotActive('覆盖快照')"), '预设快照必须维持应用期间禁止覆盖的保护');

// 2. Functional core test suite
function setupFixture() {
  let store = emptyStore(), curChar = null, curChat = '', seq = 0;
  let saveCalls = 0;
  let failSave = false;

  const world = () => ({
    entries: {
      1: { uid: 1, comment: '条目一', disable: false },
      2: { uid: 2, comment: '条目二', disable: false },
      3: { uid: 3, comment: '条目三', disable: true },
    }
  });

  const data = { 'roleBook': world(), 'extraBook': world() };
  const catalogList = [
    { name: 'roleBook', characters: [{ key: 'charA' }], global: false },
    { name: 'extraBook', characters: [{ key: 'charA' }], global: false },
  ];

  const host = {
    readStore: () => copy(store),
    writeStore: s => { store = copy(s); },
    id: () => String(++seq),
    character: () => curChar ? { key: curChar } : null,
    chat: () => curChat,
    catalog: async () => catalogList,
    load: async name => copy(data[name]),
    save: async (name, d) => {
      saveCalls++;
      if (failSave) throw new Error('写入世界书失败');
      data[name] = copy(d);
    },
    exists: async name => !!data[name],
    globals: async () => [],
    setGlobals: async () => {},
  };

  const engine = createWorldbookSnapshots(host);

  return {
    engine, data,
    setChar: (c, ch) => { curChar = c; curChat = ch; },
    getStore: () => copy(store),
    getSaveCalls: () => saveCalls,
    resetSaveCalls: () => { saveCalls = 0; },
    setFailSave: v => { failSave = v; },
  };
}

// Scenario 1: 当前角色快照 S 已应用 → 编辑 S 的条目 开 → 关 → 保存 → 真实世界书立即变为关
// Scenario 2: 当前角色快照 S 已应用 → 编辑 关 → 开 → 保存 → 真实世界书立即变为开
// Scenario 3: S 同时绑定当前聊天 → 编辑并保存 → 聊天绑定保持不变，仍显示当前
// Scenario 4: 编辑当前快照后，离开聊天 → 仍正确恢复进入聊天前的原始世界书状态
// Scenario 5: 再切回绑定聊天 → 仍正确应用编辑后的新版 S
{
  const f = setupFixture();
  f.setChar('charA', 'chatA');

  // Baseline in chatA before any snapshot: entry 1 is false (开), entry 2 is false (开)
  assert.equal(f.data.roleBook.entries[1].disable, false);
  assert.equal(f.data.roleBook.entries[2].disable, false);

  // Create Snapshot S
  const captured = await f.engine.captureBundle('character', 'charA');
  const snapS = await f.engine.createBundle({ ...captured, scope: 'character', owner: 'charA', name: '初恋u' });

  // Bind to chatA and apply
  await f.engine.bindChat(snapS.id);
  assert.equal(f.getStore().session.chosen, snapS.id, 'S 应为当前应用快照');
  assert.equal(f.getStore().snapshots.find(s => s.id === snapS.id).chat, 'chatA', 'S 绑定到 chatA');

  // Step 1: Edit S: entry 1 开 (false) -> 关 (true), save
  const editDraft1 = await f.engine.editBundle(snapS.id);
  editDraft1.data.roleBook.entries[1].disable = true; // turn OFF
  await f.engine.updateBundle(editDraft1);

  // Verify: real worldbook immediately becomes OFF (disable: true)
  assert.equal(f.data.roleBook.entries[1].disable, true, '编辑保存后，真实世界书对应条目必须立即同步为关闭');
  // Snapshot data updated
  assert.equal(f.getStore().snapshots.find(s => s.id === snapS.id).books.roleBook[1], true);
  // Still chosen / active
  assert.equal(f.getStore().session.chosen, snapS.id, '编辑后继续保持当前应用状态');
  assert.equal(f.getStore().snapshots.find(s => s.id === snapS.id).chat, 'chatA', '聊天锁继续保持绑定');

  // Step 2: Edit S: entry 1 关 (true) -> 开 (false), save
  const editDraft2 = await f.engine.editBundle(snapS.id);
  editDraft2.data.roleBook.entries[1].disable = false; // turn ON
  await f.engine.updateBundle(editDraft2);
  assert.equal(f.data.roleBook.entries[1].disable, false, '再次编辑保存后，真实世界书对应条目必须立即同步为开启');

  // Edit S: turn entry 2 to true (OFF) for departure test
  const editDraft3 = await f.engine.editBundle(snapS.id);
  editDraft3.data.roleBook.entries[2].disable = true;
  await f.engine.updateBundle(editDraft3);
  assert.equal(f.data.roleBook.entries[2].disable, true);

  // Step 4: Leave chatA -> switch to chatB
  f.setChar('charA', 'chatB');
  await f.engine.transition();
  // Must restore original baseline before entering chatA (entry 2 was false)
  assert.equal(f.data.roleBook.entries[2].disable, false, '离开聊天后必须正确恢复进入前的原始世界书状态');
  assert.equal(f.getStore().session, null, '离开聊天后 session 被安全清空');

  // Step 5: Switch back to chatA (bound to S)
  f.setChar('charA', 'chatA');
  const transRes = await f.engine.transition();
  assert.equal(transRes.autoBound?.name, '初恋u');
  assert.equal(f.data.roleBook.entries[2].disable, true, '再切回绑定聊天后，必须应用最新编辑后的新版 S 开关');
}

// Scenario 6: 编辑一个非当前角色快照 → 保存只更新快照，不修改真实世界书
{
  const f = setupFixture();
  f.setChar('charA', 'chatA');

  const cap1 = await f.engine.captureBundle('character', 'charA');
  const snapActive = await f.engine.createBundle({ ...cap1, scope: 'character', owner: 'charA', name: '快照A' });
  const snapInactive = await f.engine.createBundle({ ...cap1, scope: 'character', owner: 'charA', name: '快照B' });

  // Apply snapActive
  await f.engine.bindChat(snapActive.id);
  assert.equal(f.getStore().session.chosen, snapActive.id);
  assert.equal(f.data.roleBook.entries[1].disable, false);

  // Edit snapInactive (turning entry 1 to true)
  const editDraft = await f.engine.editBundle(snapInactive.id);
  editDraft.data.roleBook.entries[1].disable = true;
  f.resetSaveCalls();
  await f.engine.updateBundle(editDraft);

  // Verify: real worldbook was NOT touched
  assert.equal(f.data.roleBook.entries[1].disable, false, '编辑非当前快照绝不能修改真实世界书');
  assert.equal(f.getSaveCalls(), 0, '非当前快照保存不得产生世界书写盘');
  assert.equal(f.getStore().snapshots.find(s => s.id === snapInactive.id).books.roleBook[1], true, '快照数据本身已正常更新');
}

// Scenario 7: 编辑当前角色快照但实际开关没有变化 → 不产生多余写入
{
  const f = setupFixture();
  f.setChar('charA', 'chatA');

  const cap = await f.engine.captureBundle('character', 'charA');
  const snap = await f.engine.createBundle({ ...cap, scope: 'character', owner: 'charA', name: '快照S' });
  await f.engine.bindChat(snap.id);

  // Edit without changing any switches
  const editDraft = await f.engine.editBundle(snap.id);
  editDraft.name = '快照S_改名';
  f.resetSaveCalls();
  await f.engine.updateBundle(editDraft);

  assert.equal(f.getSaveCalls(), 0, '开关无变化时不产生多余世界书写入');
  assert.equal(f.getStore().snapshots.find(s => s.id === snap.id).name, '快照S_改名');
}

// Scenario 8: 保存过程失败 → 不允许出现半完成状态
{
  const f = setupFixture();
  f.setChar('charA', 'chatA');

  const cap = await f.engine.captureBundle('character', 'charA');
  const snap = await f.engine.createBundle({ ...cap, scope: 'character', owner: 'charA', name: '快照S' });
  await f.engine.bindChat(snap.id);

  const prevBooks = copy(f.getStore().snapshots.find(s => s.id === snap.id).books);
  const prevWorld1 = f.data.roleBook.entries[1].disable;

  const editDraft = await f.engine.editBundle(snap.id);
  editDraft.data.roleBook.entries[1].disable = !prevWorld1;

  // Make save fail
  f.setFailSave(true);
  await assert.rejects(() => f.engine.updateBundle(editDraft), /写入世界书失败/);

  // State must not be partially saved
  assert.equal(f.data.roleBook.entries[1].disable, prevWorld1, '写入失败后真实世界书保持原样');
  assert.deepEqual(f.getStore().snapshots.find(s => s.id === snap.id).books, prevBooks, '写入失败后快照数据未被污染');
}

// Scenario 9: UI-level test verifying that editing the active snapshot:
// - Updates the real worldbook
// - Retains "当前" status in UI
// - Does NOT trigger '已切回绑定聊天快照' top notification
{
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

  const worldUI = () => ({ entries: { 1: { uid: 1, comment: '状态栏（自改）', disable: false } } });
  let uiWorldData = { 'wb_ui': worldUI() };

  let currentContext = {
    characterId: '0',
    chatId: 'chat_test',
    characters: [{ name: '邵央', avatar: 'shaoyang.png' }],
    eventTypes: { CHAT_CHANGED: 'chat_changed' },
    eventSource: { on() {}, off() {}, removeListener() {} },
    loadWorldInfo: async n => JSON.parse(JSON.stringify(uiWorldData[n])),
    saveWorldInfo: async (n, d) => { uiWorldData[n] = JSON.parse(JSON.stringify(d)); },
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
      getWorldbookNames: async () => ['wb_ui'],
      getGlobalWorldbookNames: async () => [],
      getCharWorldbookNames: async () => ({ primary: 'wb_ui', additional: [] }),
      rebindGlobalWorldbooks: async () => {},
    },
  };
  globalThis.window.parent = globalThis.window;
  globalThis.DOC = mockDocument;

  await import('../dist/worldbook-snapshots.js');
  const snapshotsAPI = globalThis.window.__PMM_WORLDBOOK_SNAPSHOTS__;

  // Create snapshot and bind
  const d = await snapshotsAPI.engine.captureBundle('character', 'shaoyang.png');
  const snapActive = await snapshotsAPI.engine.createBundle({ ...d, scope: 'character', owner: 'shaoyang.png', name: '初恋u' });
  await snapshotsAPI.engine.bindChat(snapActive.id);

  assert.equal(uiWorldData.wb_ui.entries[1].disable, false);

  // Edit the currently active snapshot: toggle entry 1 from false to true (开 -> 关)
  const editDraft = await snapshotsAPI.engine.editBundle(snapActive.id);
  editDraft.data.wb_ui.entries[1].disable = true;

  toastrCalls = [];
  await snapshotsAPI.engine.updateBundle(editDraft);

  // Real worldbook is immediately updated!
  assert.equal(uiWorldData.wb_ui.entries[1].disable, true, '编辑当前正在应用的快照后，真实世界书必须立即变为关闭');

  // Verify no switch-back notification was triggered
  assert.equal(toastrCalls.some(t => t.msg.includes('已切回绑定聊天快照')), false, '保存编辑绝不能误触发自动切回通知');
}

console.log('test.93 回归通过：当前应用角色快照编辑开关立即同步真实世界书，离开恢复与切回链路完全正确。');
