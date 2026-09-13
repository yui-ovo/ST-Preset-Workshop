import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const source = read('dist/workshop-v3.02.js');
const floating = read('dist/workshop-floating-controller.js');
const layout = read('dist/workshop-layout-controller.js');
const stackSource = read('dist/workshop-window-stack.js');
const between = (text, start, end) => {
  const a = text.indexOf(start), b = text.indexOf(end, a);
  assert(a >= 0 && b > a, `Missing runtime section: ${start}`);
  return text.slice(a, b);
};
function node() {
  const values = new Map(), events = new Map(), children = [];
  return {
    isConnected:true, dataset:{}, children, textContent:'', value:'',
    style:{ getPropertyValue:key => values.get(key) || '', setProperty:(key, value) => values.set(key, String(value)), removeProperty:key => values.delete(key) },
    classList:{ toggle() {}, add() {}, remove() {} },
    addEventListener(type, callback) { const list = events.get(type) || []; list.push(callback); events.set(type, list); },
    removeEventListener(type, callback) { events.set(type, (events.get(type) || []).filter(fn => fn !== callback)); },
    dispatch(type, init = {}) { const event = {type, currentTarget:this, target:this, preventDefault(){}, stopPropagation(){}, ...init}; for (const fn of events.get(type) || []) fn(event); },
    querySelector:() => children[0] || null, querySelectorAll:() => [],
    replaceChildren(...next) { children.splice(0, children.length, ...next); },
    focus() {}, select() {}, setAttribute() {},
  };
}
const createStack = vm.runInNewContext(stackSource.slice(0, stackSource.indexOf('\nconst TOP')).replace('export function', 'function') + '\ncreateWindowStack;');
// All six opening orders, then reopen a window. No pointer events or DOM reparenting needed.
for (const order of [['main','controller','floating'],['main','floating','controller'],['controller','main','floating'],['controller','floating','main'],['floating','main','controller'],['floating','controller','main']]) {
  const stack = createStack(), surfaces = Object.fromEntries(order.map(key => [key, node()])), handle = node();
  for (const key of order) stack.open(key, key === 'floating' ? [surfaces[key], handle] : [surfaces[key]]);
  const z = key => Number(surfaces[key].style.getPropertyValue('z-index'));
  assert(z(order[2]) > z(order[1]) && z(order[1]) > z(order[0]));
  assert.equal(Number(handle.style.getPropertyValue('z-index')), z('floating'));
  stack.open(order[0], [surfaces[order[0]]]);
  assert(z(order[0]) > z(order[2]));
  for (let i = 0; i < 200; i++) stack.open(order[i % 3], [surfaces[order[i % 3]]]);
  assert(Math.max(...order.map(z)) < 2147483500, 'Reopening must not exhaust the z-index range');
  stack.close('floating'); stack.destroy();
}
assert(stackSource.includes('observer.observe(DOC.body, { childList:true })'));
assert(!stackSource.includes('subtree:true') && !stackSource.includes('pointerdown'));
assert(floating.includes("open('floating',[DOC.getElementById('preset-manager-floating-panel'),handle])"));
assert(floating.includes("handle?.style.removeProperty('z-index')"));
assert(source.includes("open('controller',[card])"));

// Actual control handlers: the visible preview is committed once before locking.
function controlHarness(android = false) {
  const row = node(), input = node(), lock = node(), output = node(), label = node();
  input.value = '50';
  row.querySelector = selector => selector === 'input' ? input : selector.includes('row__label') ? label : selector.includes('lock') ? lock : output;
  const state = { values:{splitRatio:50}, customized:{}, lockedControls:{splitRatio:false} };
  const frames = new Map(), updates = [], writes = [], keyboard = []; let id = 0;
  const top = {PointerEvent:class {}, __PMM_FLOATING_STORE__:{update:patch => keyboard.push(patch.keyboardEditing)}};
  top.top = top;
  const view = { requestAnimationFrame(fn) { frames.set(++id, fn); return id; }, cancelAnimationFrame:key => frames.delete(key), setTimeout() {} };
  const make = vm.runInNewContext(`(() => {${between(source, '  function _pmmBindAndroidRangeGestureGuard', '  function cardViewportBounds(')};return makeControl;})()`, {
    state, card:node(), TOP:top, window:top, VIEW:view, DOC:{ createElement:tag => tag === 'div' ? row : node() },
    IS_ANDROID:android, isMobile:() => true, Date,
    currentState:() => state, isControlLocked:key => state.lockedControls[key], valueRange:() => [28,72], clamp:(_key,value) => Math.min(72, Math.max(28, Number(value))),
    applyControlValue:(_control,save) => writes.push({value:state.values.splitRatio, save}), updateOutputs:controls => updates.push(controls.map(control => control.key)), keepCardInBounds() {},
  });
  make({key:'splitRatio', label:'双界面占比', unit:'%', step:.1});
  const flush = () => { const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn()); };
  return { row, input, lock, output, state, frames, writes, updates, keyboard, flush };
}
{
  const e = controlHarness();
  for (let value = 51; value <= 68; value++) { e.input.value = String(value); e.input.dispatch('input'); }
  assert.equal(e.frames.size, 1); assert.equal(e.writes.length, 0);
  e.lock.dispatch('pointerdown'); e.lock.dispatch('click');
  assert.equal(e.state.values.splitRatio, 68); assert.equal(e.state.lockedControls.splitRatio, true);
  assert.equal(e.frames.size, 0); assert.equal(e.writes.length, 1);
  e.flush(); e.input.value = '35'; e.input.dispatch('input'); e.flush(); e.input.dispatch('change');
  assert.equal(e.state.values.splitRatio, 68, 'Delayed range events cannot move a locked value');
  assert(e.updates.every(keys => keys.length === 1 && keys[0] === 'splitRatio'), 'Locking cannot refresh all settings');
  e.lock.dispatch('click'); e.input.value = '60'; e.input.dispatch('input');
  e.row.__pmmControlCleanup(false); e.flush();
  assert.equal(e.state.values.splitRatio, 68, 'Closing a cancelled dialog clears queued previews');
}
{
  const e = controlHarness();
  e.output.dispatch('click'); const editor = e.output.children[0];
  assert.equal(editor.type, 'number'); assert.equal(e.keyboard.at(-1), true);
  for (const text of ['', '6', '61', '61.3']) { editor.value = text; editor.dispatch('input'); }
  assert.equal(e.writes.length, 0, 'Typing keeps a local draft without relaying layout changes');
  editor.dispatch('keydown', {key:'Enter'});
  assert.equal(e.state.values.splitRatio, 61.3); assert.equal(e.writes.length, 1); assert.equal(e.keyboard.at(-1), false);
  e.output.dispatch('click'); const composing = e.output.children[0]; composing.dispatch('compositionstart');
  e.row.__pmmControlCleanup(false);
  assert.equal(e.keyboard.at(-1), false, 'Closing during composition must release keyboard geometry');
}
{
  const e = controlHarness(true);
  const pointer = {pointerId:1, pointerType:'touch', clientX:100, clientY:100};
  e.input.dispatch('pointerdown', pointer); e.input.value = '65'; e.input.dispatch('input');
  e.input.dispatch('pointermove', {...pointer, clientX:150}); e.flush();
  assert.equal(e.state.values.splitRatio, 65);
  e.input.dispatch('pointercancel', pointer); e.flush();
  assert.equal(e.state.values.splitRatio, 50, 'Cancelling a horizontal drag restores its initial value');
}
assert(layout.includes('min-width:44px!important;height:44px!important;min-height:44px!important'));
assert(floating.includes('width:var(--pmm-mobile-floating-width,max-content)'));
// Main and floating feature integrations keep upstream's own transactional APIs and controls.
assert(source.includes("function openSnapshotEditorFromOverlay()"), "Native snapshots use the author lightweight editor");
const syncFloating = between(source, '  function syncRoot(root)', '  function sync()');
for (const name of ['bindSnapshotBranchGuard(root)', 'syncFloatingSnapshotState(root)', 'syncFloatingBranchVisibility(root)']) {
  assert(syncFloating.indexOf(name) < syncFloating.indexOf('if (TOP.__PMM_FLOATING_CONTROLLER__)'));
}
assert(!source.includes("function startWorkshopDiscovery()"), "The lightweight editor needs no legacy main-window discovery observer");
assert(!source.includes('discoveryObserver.observe(root, { childList: true, subtree: true })'));
const teardown = source.slice(source.indexOf('/* ===== PMM_RUNTIME_TEARDOWN:'));
for (const key of ['__PMM_SWITCH_SNAPSHOTS_TEST52__','__PMM_NATIVE_PRESET_ENTRY_TEST80_CLEANUP__','__PMM_MOBILE_QUICK_TOGGLE_TEST72__']) assert(teardown.includes(key));
assert(source.indexOf('/* ===== PMM_MOBILE_QUICK_TOGGLE_TEST72') < source.indexOf('/* ===== PMM_RUNTIME_TEARDOWN:'));

// Resizing the controller must not invalidate the Tavern or the two preset panels.
{
  const root = node(), card = node(), html = node();
  root.style.setProperty = () => { throw Error('Controller preview touched the main panel'); };
  html.style.setProperty = () => { throw Error('Controller preview invalidated the document'); };
  const current = { values:{controllerWidth:500}, customized:{controllerWidth:true} };
  const apply = vm.runInNewContext(`(() => {${between(source, '  function applyControlValue(', '  function _pmmBindAndroidRangeGestureGuard')};return applyControlValue;})()`, {
    root, card, DOC:{documentElement:html}, TOP:{}, currentState:() => current,
  });
  for (let width = 400; width <= 500; width++) { current.values.controllerWidth = width; apply({key:'controllerWidth',unit:'px'}); }
  assert.equal(card.style.getPropertyValue('--pmm-controller-width'), '500px');
}

// A capture save button remains under the author's actions host across repeated layout scans.
{
  const edit = node(), actions = node(), right = node(), left = node(), search = node(), header = node();
  edit.dataset.pmmSnapshotEditStashed = 'true'; edit.parentElement = actions;
  right.children.push(search, actions);
  right.querySelector = () => null;
  header.querySelector = selector => ({':scope > .header-left':left, ':scope > .header-right':right, '.title-edit-btn':edit, '.title-actions':actions, '.pmm-preset-search-btn':search})[selector] || null;
  header.closest = () => ({parentElement:{matches:() => false}});
  const normalize = vm.runInNewContext(`(() => {${between(source, '  function normalizeHeaderActions()', '  function ensureTrigger(')};return normalizeHeaderActions;})()`, {
    root:{querySelectorAll:() => [header]}, MODE_SELECTOR:'split', bindHeaderMemory(){},
    DOC:{createDocumentFragment(){throw Error('Header normalization is moving unchanged DOM repeatedly');}},
  });
  for (let i = 0; i < 100; i++) normalize();
  assert.equal(edit.parentElement, actions);
  assert(!layout.includes('pmm-switch-snapshot-capture-mode'), 'Removed capture UI must not retain local CSS patches');
}

// Native entry discovery is idle when ready and bounded while a lazy toolbar is mounting.
for (const initiallyReady of [true, false]) {
  let ready = initiallyReady, id = 0;
  const frames = new Map(), observers = [], host = node(), doc = node(), presetRow = node();
  const anchor = {parentElement:host};
  host.querySelector = selector => host.children.find(button => selector.includes(`"${button.dataset.pmmNativePresetAction}"`)) || null;
  host.append = button => host.children.push(button);
  doc.body = node(); doc.documentElement = node();
  doc.getElementById = key => key === 'update_oai_preset' ? (ready ? anchor : null) : key === 'settings_preset_openai' ? {parentElement:presetRow} : null;
  doc.querySelectorAll = () => [...host.children];
  doc.createElement = () => { const button = node(); button.remove = () => host.children.splice(host.children.indexOf(button), 1); return button; };
  class Observer {
    constructor(callback) { this.callback = callback; this.targets = []; observers.push(this); }
    observe(target, options) { this.targets.push({target, options}); }
    disconnect() { this.disconnected = true; }
  }
  const top = {document:doc, requestAnimationFrame(fn) { frames.set(++id, fn); return id; }, cancelAnimationFrame:key => frames.delete(key)};
  top.top = top;
  const native = between(source, '/* ===== PMM_NATIVE_PRESET_ENTRY_TEST80', '\n\n;(()=>{');
  vm.runInNewContext(native, {window:top, MutationObserver:Observer, console});
  if (initiallyReady) { assert.equal(host.children.length, 2); assert.equal(observers.length, 0); }
  else {
    assert.equal(host.children.length, 0);
    assert(observers[0].targets.every(({target, options}) => !options.subtree || target === presetRow));
    ready = true;
    for (let i = 0; i < 100; i++) doc.dispatch('click');
    assert.equal(frames.size, 1);
    const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn());
    assert.equal(host.children.length, 2); assert(observers[0].disconnected);
    doc.dispatch('click'); doc.dispatch('focusin'); assert.equal(frames.size, 0);
  }
  top.__PMM_NATIVE_PRESET_ENTRY_TEST80_CLEANUP__();
  assert.equal(host.children.length, 0); assert.equal(frames.size, 0);
}

console.log('upstream 融合回归通过：打开顺序、设备宽度上限、锁定提交、输入草稿、触摸取消、原生快照入口及新模块回收。');

// New author desktop resize must ignore chat/handle churn and release all local scheduling.
for (const desktop of [true, false]) {
  const observers = [], frames = new Map(), events = new Map();
  let id = 0, scans = 0, present = true;
  const root = {}, styles = new Map();
  const doc = {
    body: {}, documentElement: {},
    head: { appendChild(style) { styles.set(style.id, style); } },
    createElement: () => ({ remove() { styles.delete(this.id); } }),
    getElementById: key => key === 'preset-manager-main-panel' ? (present ? root : null) : styles.get(key),
    querySelectorAll: selector => { if (selector.includes('.pm-panel-container')) scans++; return []; },
  };
  const top = { document: doc, innerWidth: 1440, innerHeight: 900,
    matchMedia: () => ({ matches: desktop }),
    requestAnimationFrame: fn => { frames.set(++id, fn); return id; }, cancelAnimationFrame: key => frames.delete(key),
    addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name),
    MutationObserver: class {
      constructor(fn) { this.fn = fn; this.targets = []; observers.push(this); }
      observe(target, options) { this.targets.push({ target, options }); }
      disconnect() { this.disconnected = true; }
    },
  };
  doc.defaultView = top;
  const api = vm.runInNewContext(`(() => {${between(source, "  const API_KEY = '__PMM_DESKTOP_FOUR_CORNER_RESIZE__';", "  console.info('[预设工坊] test.94 已加载")};return TOP[API_KEY];})()`, { window: top, document: doc });
  const flush = () => { const queue = [...frames.values()]; frames.clear(); queue.forEach(fn => fn()); };
  flush();
  const discovery = observers.find(observer => observer.targets.some(({ target }) => target === doc.body));
  assert(discovery);
  assert(observers.every(observer => observer.targets.every(({ target, options }) => target !== doc.body || !options.subtree)));
  const initialScans = scans;
  for (let i = 0; i < 240; i++) discovery.fn([{ addedNodes: [{}], removedNodes: [] }]);
  assert.equal(frames.size, 0, 'Chat/body changes do not queue desktop panel scans');
  assert.equal(scans, initialScans);
  const panel = observers.find(observer => observer.targets.some(({ target }) => target === root));
  if (desktop) {
    assert(panel);
    const handle = { nodeType: 1, matches: () => false, querySelector: () => null };
    const handleRecord = { type: 'childList', addedNodes: [handle], removedNodes: [] };
    for (let i = 0; i < 240; i++) panel.fn([handleRecord]);
    assert.equal(frames.size, 0, 'Creating resize handles cannot start a scan loop');
    const container = { nodeType: 1, matches: () => true, className: 'pm-panel-container pm-panel-container--merge-mode' };
    const modeRecord = { type: 'attributes', attributeName: 'class', target: container, oldValue: 'pm-panel-container' };
    for (let i = 0; i < 240; i++) panel.fn([modeRecord]);
    assert.equal(frames.size, 1, 'Panel mode changes coalesce to one frame');
    flush();
    assert.equal(scans, initialScans + 1);
    panel.fn([modeRecord]);
    assert.equal(frames.size, 1);
  } else assert.equal(panel, undefined, 'Touch-only devices do not watch panel descendants for desktop resizing');
  api.cleanup();
  assert.equal(frames.size, 0);
  assert.equal(events.size, 0);
  assert(observers.every(observer => observer.disconnected));
}
console.log('新增桌面缩放兼容通过：聊天和缩放手柄不触发扫描；240 次结构变化合并一帧；触屏与卸载清理正常。');
