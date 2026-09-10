// Window order follows opens. The collapsed entry stays reachable above all workshop windows.
export function createWindowStack() {
  const windows = new Map();
  const order = [];
  const base = 2147482400;
  function paint() {
    order.forEach((key, index) => {
      const value = String(base + index * 20);
      for (const node of windows.get(key) || []) {
        if (node.style.getPropertyValue('z-index') !== value) node.style.setProperty('z-index', value, 'important');
      }
    });
  }
  return {
    open(key, nodes) {
      const surfaces = nodes.filter(Boolean);
      if (!surfaces.length) return;
      windows.set(key, surfaces);
      const previous = order.indexOf(key);
      if (previous >= 0) order.splice(previous, 1);
      order.push(key);
      paint();
    },
    close(key) {
      windows.delete(key);
      const index = order.indexOf(key);
      if (index >= 0) order.splice(index, 1);
      paint();
    },
    destroy() { windows.clear(); order.length = 0; },
  };
}

const TOP = (() => { try { return window.top || window; } catch (_) { return window; } })();
const DOC = TOP.document;
const KEY = '__PMM_WINDOW_STACK__';
TOP[KEY]?.destroy?.();
const stack = createWindowStack();
let main = null;
function syncMain() {
  const next = DOC.getElementById('preset-manager-main-panel');
  if (next === main) return;
  main = next;
  if (main) stack.open('main', [main]);
  else stack.close('main');
}
// The main window mounts directly on body; no subtree, style observer or pointer listener.
const observer = new TOP.MutationObserver(records => {
  if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node.id === 'preset-manager-main-panel'))) syncMain();
});
observer.observe(DOC.body, { childList:true });
syncMain();
const API = { ...stack, destroy() { observer.disconnect(); stack.destroy(); if (TOP[KEY] === API) delete TOP[KEY]; } };
TOP[KEY] = API;
globalThis[KEY] = API;
export default API;
