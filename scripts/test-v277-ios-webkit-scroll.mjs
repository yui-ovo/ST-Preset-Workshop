import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8')).replace(/pmmRuntimeResource\((\w+)\)/g,'$1');
const marker = '/* ===== PMM_MOBILE_PERFORMANCE_GUARD_V275';
const nextMarker = '/* ===== PMM_VARIABLE_MACRO_ASSISTANT_V263';
const start = source.indexOf(marker);
const end = source.indexOf(nextMarker, start);
const guardSource = source.slice(start, end);

assert.ok(start >= 0 && end > start, '无法隔离移动端性能保护模块');
assert.ok(guardSource.includes("classList.toggle('pmm-ios-webkit-smooth', IS_IOS_WEBKIT)"), '没有自动标记 iOS WebKit 环境');
assert.ok(guardSource.includes('content-visibility: visible !important'), 'iOS 没有覆盖 WebKit 卡顿的离屏绘制');
assert.ok(guardSource.includes('contain: none !important'), 'iOS 没有关闭会反复布局的 contain');
assert.ok(guardSource.includes('.prompt-editor__textarea'), 'iOS 正文编辑器没有稳定滚动样式');
assert.ok(guardSource.includes('if (changed) setRootClasses()'), '重复滚动事件仍会重复刷新根节点样式');
assert.ok(source.includes('V2.77 已加载：iOS／WKWebView 自动使用稳定滚动模式'), '缺少 v2.77 加载标记');

function bootGuard({ userAgent, platform, maxTouchPoints }) {
  const listeners = new Map();
  const rootClasses = new Set();
  const documentClasses = new Set();
  const scrollTarget = {};
  let injectedStyle = null;

  const classList = target => ({
    toggle(name, enabled) {
      if (enabled) target.add(name);
      else target.delete(name);
      return Boolean(enabled);
    },
    remove(name) { target.delete(name); },
  });

  const root = {
    isConnected: true,
    contains: target => target === scrollTarget,
    classList: classList(rootClasses),
  };
  const documentElement = {
    classList: classList(documentClasses),
    appendChild(node) { injectedStyle = node; },
  };
  const body = {};
  const fakeDocument = {
    head: { appendChild(node) { injectedStyle = node; } },
    body,
    documentElement,
    defaultView: null,
    querySelector: selector => selector === '#preset-manager-main-panel' ? root : null,
    getElementById: id => injectedStyle?.id === id ? injectedStyle : null,
    createElement: tag => ({ tagName: tag.toUpperCase(), id: '', textContent: '' }),
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type, handler) { if (listeners.get(type) === handler) listeners.delete(type); },
  };
  const session = new Map();
  class FakePerformanceObserver {
    constructor(callback) { this.callback = callback; }
    observe() {}
    disconnect() {}
  }
  const fakeWindow = {
    document: fakeDocument,
    navigator: { userAgent, platform, maxTouchPoints },
    setTimeout,
    clearTimeout,
    queueMicrotask,
    requestIdleCallback: callback => setTimeout(callback, 0),
    addEventListener(type, handler) { listeners.set(`window:${type}`, handler); },
    removeEventListener(type, handler) { if (listeners.get(`window:${type}`) === handler) listeners.delete(`window:${type}`); },
    sessionStorage: {
      getItem: key => session.get(key) ?? null,
      setItem: (key, value) => session.set(key, value),
      removeItem: key => session.delete(key),
    },
    performance: { getEntriesByType: () => [{ type: 'navigate' }] },
    PerformanceObserver: FakePerformanceObserver,
  };
  fakeWindow.top = fakeWindow;
  fakeDocument.defaultView = fakeWindow;

  vm.runInNewContext(guardSource, {
    pmmRuntimeResource:target=>target,
    window: fakeWindow,
    document: fakeDocument,
    console: { info() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    queueMicrotask,
    Promise,
  }, { filename: 'performance-guard-v277.js' });

  return {
    api: fakeWindow.__PMM_PERFORMANCE_GUARD_V275__,
    documentClasses,
    injectedStyle,
    listeners,
    rootClasses,
    scrollTarget,
  };
}

const ios = bootGuard({
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  platform: 'iPhone',
  maxTouchPoints: 5,
});
assert.ok(ios.documentClasses.has('pmm-ios-webkit-smooth'), 'iPhone 没有自动进入 WebKit 流畅模式');
assert.ok(ios.injectedStyle?.textContent.includes('contain-intrinsic-size: none !important'), 'iOS 覆盖样式没有注入');
ios.listeners.get('scroll')({ target: ios.scrollTarget });
assert.equal(ios.api.isBusy(), true, 'iOS 滚动时没有继续错峰后台扫描');
assert.equal(ios.api.snapshot().iosWebKitSmoothMode, true, 'iOS 诊断状态没有记录流畅模式');
assert.equal(ios.rootClasses.has('pmm-perf-busy'), false, 'iOS 滚动仍在切换整片卡片视觉状态');
assert.equal(ios.rootClasses.has('pmm-perf-scrolling'), false, 'iOS 滚动仍在添加全局滚动样式');
ios.listeners.get('dragstart')({ target: ios.scrollTarget });
assert.ok(ios.rootClasses.has('pmm-perf-busy'), 'iOS 真正拖拽时没有保留性能保护');
assert.ok(ios.rootClasses.has('pmm-perf-dragging'), 'iOS 真正拖拽时没有保留拖拽状态');
ios.listeners.get('dragend')({ target: ios.scrollTarget });
await new Promise(resolve => setTimeout(resolve, 230));
ios.api.cleanup();
assert.equal(ios.documentClasses.has('pmm-ios-webkit-smooth'), false, '卸载后没有清理 iOS 流畅模式标记');

const android = bootGuard({
  userAgent: 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36',
  platform: 'Linux armv8l',
  maxTouchPoints: 5,
});
assert.equal(android.documentClasses.has('pmm-ios-webkit-smooth'), false, '安卓被误判为 iOS WebKit');
android.listeners.get('scroll')({ target: android.scrollTarget });
assert.equal(android.api.snapshot().iosWebKitSmoothMode, false, '安卓诊断状态被误标为 iOS');
assert.ok(android.rootClasses.has('pmm-perf-busy'), '安卓原有滚动性能保护被关闭');
assert.ok(android.rootClasses.has('pmm-perf-scrolling'), '安卓原有滚动状态被关闭');
await new Promise(resolve => setTimeout(resolve, 230));
android.api.cleanup();

console.log('v2.77 iOS WebKit 滚动测试通过：苹果端关闭离屏绘制与滚动重绘，安卓保持原有优化。');
