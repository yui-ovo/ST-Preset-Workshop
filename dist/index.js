const EXTENSION_NAME = '🧩预设工坊';
const EXTENSION_VERSION = '2.98.2-page0x00.3';
const RUNTIME_ID = 'TH-script--🧩预设工坊（GitHub 扩展）--2f53f6af-3c9e-4c71-bc52-9f635be25300';
const LEGACY_IFRAME_PREFIX = 'TH-script--🧩预设工坊';
const EXTENSION_FOLDER_NAME = 'ST-Preset-Workshop';
const HELPER_WAIT_TIMEOUT = 60_000;
const LEGACY_GRACE_PERIOD = 3_000;
const VERSION_CHECK_INTERVAL = 30_000;
const RAPID_VERSION_CHECK_INTERVAL = 750;
const RAPID_VERSION_CHECK_TIMEOUT = 65_000;
const NATIVE_UPDATE_RELOAD_DELAY = 1_000;
const TOP_NOTIFICATION_STORAGE_KEY = 'pmm_top_notifications_enabled_v1';

let versionCheckTimer = null;
let versionCheckBusy = false;
let rapidVersionCheckTimer = null;
let rapidVersionCheckStopTimer = null;
let nativeUpdateReloadTimer = null;
let singleExtensionUpdatePending = false;
let bulkExtensionUpdateInProgress = false;
let updateReloadDeferred = false;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function topNotificationsEnabled() {
  try { return globalThis.localStorage?.getItem(TOP_NOTIFICATION_STORAGE_KEY) !== '0'; }
  catch (_) { return true; }
}

function notify(type, message) {
  if (!topNotificationsEnabled()) {
    const logger = type === 'error' ? console.error : type === 'warning' ? console.warn : (console.debug || console.info);
    logger?.call(console, `[${EXTENSION_NAME}][顶部通知已关闭]`, message);
    return;
  }
  const toast = globalThis.toastr?.[type];
  if (typeof toast === 'function') {
    toast(message, EXTENSION_NAME);
  }
}

async function readInstalledVersion() {
  const manifestUrl = new URL('../manifest.json', import.meta.url);
  manifestUrl.searchParams.set('_pmm_version_check', String(Date.now()));
  const response = await fetch(manifestUrl, { cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error(`读取扩展版本失败：HTTP ${response.status}`);
  }
  const manifest = await response.json();
  return String(manifest?.version || '').trim();
}

async function checkForInstalledUpdate() {
  if (versionCheckBusy || bulkExtensionUpdateInProgress || document.visibilityState === 'hidden') return;
  versionCheckBusy = true;
  try {
    const nextVersion = await readInstalledVersion();
    if (!nextVersion || nextVersion === EXTENSION_VERSION) return;

    /* 给扩展更新器一点时间写完全部文件，再确认一次，避免在更新中途刷新。 */
    await sleep(900);
    if (document.visibilityState === 'hidden') return;
    if (await readInstalledVersion() !== nextVersion) return;

    const followsNativeSingleUpdate = singleExtensionUpdatePending;
    stopVersionWatcher();
    if (followsNativeSingleUpdate) {
      /* 单独更新时酒馆会自己弹成功提示，留一秒给原生提示显示，不再重复弹第二条。 */
      await sleep(NATIVE_UPDATE_RELOAD_DELAY);
    } else {
      notify('info', `扩展已更新至 v${nextVersion}`);
      await sleep(450);
    }
    markExtensionUpdateReload();
  } catch (error) {
    console.debug(`[${EXTENSION_NAME}] 暂未检测到可自动载入的新版本。`, error);
  } finally {
    versionCheckBusy = false;
  }
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') void checkForInstalledUpdate();
}

function extensionBlockName(block) {
  return String(block?.dataset?.name || '').replace(/^\/+/, '').trim();
}

function isOwnExtensionBlock(block) {
  return extensionBlockName(block).endsWith(EXTENSION_FOLDER_NAME);
}

function isOwnSingleUpdateSpinning() {
  return [...document.querySelectorAll('.extension_block')].some(block => (
    isOwnExtensionBlock(block)
    && Boolean(block.querySelector('.btn_update .fa-spin, .btn_update.fa-spin'))
  ));
}

function stopRapidVersionCheck(resetPending = true) {
  if (rapidVersionCheckTimer !== null) {
    globalThis.clearInterval(rapidVersionCheckTimer);
    rapidVersionCheckTimer = null;
  }
  if (rapidVersionCheckStopTimer !== null) {
    globalThis.clearTimeout(rapidVersionCheckStopTimer);
    rapidVersionCheckStopTimer = null;
  }
  if (resetPending) singleExtensionUpdatePending = false;
}

function startRapidVersionCheck() {
  stopRapidVersionCheck(false);
  singleExtensionUpdatePending = true;
  void checkForInstalledUpdate();
  rapidVersionCheckTimer = globalThis.setInterval(
    () => void checkForInstalledUpdate(),
    RAPID_VERSION_CHECK_INTERVAL,
  );
  rapidVersionCheckStopTimer = globalThis.setTimeout(
    () => stopRapidVersionCheck(),
    RAPID_VERSION_CHECK_TIMEOUT,
  );
}

function canAutoReloadAfterUpdate() {
  // Context is a live snapshot, so check again immediately before every reload.
  // Never attempt to "flush" an empty/loading chat by calling a chat save API here.
  try {
    const context = globalThis.SillyTavern?.getContext?.();
    if (!context || !Array.isArray(context.chat)) return false;
    const selected = value => value !== undefined && value !== null && value !== '';
    if (selected(context.chatId) || selected(context.characterId) || selected(context.groupId)) return false;
    if (context.chat.length || context.streamingProcessor) return false;
    if (document.activeElement?.matches?.('input,textarea,[contenteditable="true"]')) return false;
    return true;
  } catch (_) { return false; }
}

function markExtensionUpdateReload() {
  nativeUpdateReloadTimer = null;
  if (!canAutoReloadAfterUpdate()) {
    if (!updateReloadDeferred) {
      updateReloadDeferred = true;
      notify('info', '扩展更新已完成；为避免中断聊天，请在聊天保存完成后手动刷新。');
    }
    return false;
  }
  globalThis.__PMM_PERFORMANCE_GUARD_V275__?.markReloadReason?.('extension-update');
  globalThis.location.reload();
  return true;
}

function scheduleNativeSingleUpdateReload() {
  if (bulkExtensionUpdateInProgress || nativeUpdateReloadTimer !== null) return false;
  if (!singleExtensionUpdatePending && !isOwnSingleUpdateSpinning()) return false;

  stopVersionWatcher();
  nativeUpdateReloadTimer = globalThis.setTimeout(
    markExtensionUpdateReload,
    NATIVE_UPDATE_RELOAD_DELAY,
  );
  return true;
}

function handleNativeExtensionManagerClick(event) {
  const target = event?.target;
  if (!target || typeof target.closest !== 'function') return;

  const toolbar = target.closest('.extensions_toolbar');
  const toolbarButton = target.closest('button');
  if (toolbar && toolbarButton) {
    const updateButtons = [...toolbar.querySelectorAll('button')].slice(0, 2);
    if (updateButtons.includes(toolbarButton)) {
      bulkExtensionUpdateInProgress = true;
      stopRapidVersionCheck();
      return;
    }
  }

  const updateButton = target.closest('.btn_update');
  const extensionBlock = updateButton?.closest('.extension_block');
  if (updateButton && isOwnExtensionBlock(extensionBlock)) {
    bulkExtensionUpdateInProgress = false;
    startRapidVersionCheck();
  }
}

/**
 * SillyTavern 官方扩展更新钩子：仅在单独点击本扩展更新按钮时安排刷新。
 * 批量更新继续交给酒馆完成全部任务后统一刷新。
 */
export function onUpdate() {
  scheduleNativeSingleUpdateReload();
}

function startVersionWatcher() {
  if (versionCheckTimer !== null) return;
  void checkForInstalledUpdate();
  versionCheckTimer = globalThis.setInterval(() => void checkForInstalledUpdate(), VERSION_CHECK_INTERVAL);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  document.addEventListener('click', handleNativeExtensionManagerClick, true);
}

function stopVersionWatcher() {
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  document.removeEventListener('click', handleNativeExtensionManagerClick, true);
  stopRapidVersionCheck();
  if (versionCheckTimer !== null) {
    globalThis.clearInterval(versionCheckTimer);
    versionCheckTimer = null;
  }
}

function findLegacyRuntime() {
  return [...document.querySelectorAll('iframe[id]')].find(
    iframe => iframe.id !== RUNTIME_ID && iframe.id.startsWith(LEGACY_IFRAME_PREFIX),
  );
}

async function waitForLegacyRuntime() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < LEGACY_GRACE_PERIOD) {
    const legacyRuntime = findLegacyRuntime();
    if (legacyRuntime) {
      return legacyRuntime;
    }
    await sleep(100);
  }
  return null;
}

async function waitForTavernHelper() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < HELPER_WAIT_TIMEOUT) {
    if (globalThis.TavernHelper?._bind && globalThis._ && globalThis.$) {
      return true;
    }
    await sleep(250);
  }
  return false;
}

function buildRuntimeDocument() {
  const appendRuntimeVersion = source => {
    const url = new URL(source);
    url.searchParams.set('pmm-version', EXTENSION_VERSION);
    return url.href;
  };
  const parentJqueryUrl = appendRuntimeVersion(new URL('../bridge/parent-jquery.js', import.meta.url).href);
  const predefineUrl = appendRuntimeVersion(new URL('../bridge/predefine.js', import.meta.url).href);
  const workshopUrl = appendRuntimeVersion(new URL('./workshop-v3.02.js', import.meta.url).href);
  const windowStackUrl = appendRuntimeVersion(new URL('./workshop-window-stack.js', import.meta.url).href);
  const floatingStoreUrl = appendRuntimeVersion(new URL('./workshop-floating-store.js', import.meta.url).href);
  const themeSystemUrl = appendRuntimeVersion(new URL('./workshop-theme-system.js', import.meta.url).href);
  const floatingControllerUrl = appendRuntimeVersion(new URL('./workshop-floating-controller.js', import.meta.url).href);
  const layoutControllerUrl = appendRuntimeVersion(new URL('./workshop-layout-controller.js', import.meta.url).href);
  const presetContentEditorUrl = appendRuntimeVersion(new URL('./preset-content-editor.js', import.meta.url).href);
  const worldbookStitchUrl = appendRuntimeVersion(new URL('./worldbook-stitch-test3.js', import.meta.url).href);
  const worldbookSnapshotsUrl = appendRuntimeVersion(new URL('./worldbook-snapshots.js', import.meta.url).href);
  const worldbookLoaderKey = '__PMM_LOAD_WORLDBOOK_STITCH__';

  return `<!DOCTYPE html>
<html>
<head>
<base href="${location.origin}/">
<script src="https://testingcf.jsdelivr.net/npm/vue/dist/vue.runtime.global.prod.min.js"></script>
<script src="https://testingcf.jsdelivr.net/npm/vue-router/dist/vue-router.global.prod.min.js"></script>
<script src="${parentJqueryUrl}"></script>
<script src="${predefineUrl}"></script>
<script src="https://testingcf.jsdelivr.net/gh/N0VI028/JS-Slash-Runner/src/iframe/node_modules/log.js"></script>
</head>
<body>
<script>
(() => {
  window.addEventListener('pagehide', () => {
    for (const key of ['__PMM_FLOATING_CONTROLLER__','__PMM_LAYOUT_CONTROLLER__','__PMM_THEME_SYSTEM__','__PMM_FLOATING_STORE__','__PMM_WINDOW_STACK__']) {
      const api = window[key];
      if (api && window.parent[key] === api) {
        try { api.destroy?.(); } catch (_) {}
        if (window.parent[key] === api) delete window.parent[key];
      }
    }
  }, { once:true });
  const source = ${JSON.stringify(worldbookStitchUrl)};
  const loaderKey = ${JSON.stringify(worldbookLoaderKey)};
  const apiKey = '__PMM_WORLDBOOK_STITCH_TEST3__';
  let loading = null;

  const currentApi = () => {
    try { return window.parent?.[apiKey] || null; } catch (_) { return null; }
  };

  window[loaderKey] = () => {
    const ready = currentApi();
    if (typeof ready?.open === 'function') return Promise.resolve(ready);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = source;
      script.addEventListener('load', () => {
        const api = currentApi();
        if (typeof api?.open === 'function') resolve(api);
        else reject(new Error('世界书模块没有提供打开接口'));
      }, { once: true });
      script.addEventListener('error', () => reject(new Error('世界书模块载入失败')), { once: true });
      document.head.append(script);
    }).catch(error => {
      loading = null;
      throw error;
    });
    return loading;
  };
})();
</script>
<script type="module" src="${presetContentEditorUrl}"></script>
<script type="module" src="${worldbookSnapshotsUrl}"></script>
<script type="module" src="${windowStackUrl}"></script>
<script type="module" src="${workshopUrl}"></script>
<script type="module" src="${floatingStoreUrl}"></script>
<script type="module" src="${themeSystemUrl}"></script>
<script type="module" src="${floatingControllerUrl}"></script>
<script type="module" src="${layoutControllerUrl}"></script>
</body>
</html>`;
}

export async function startPresetWorkshop() {
  startVersionWatcher();
  const currentRuntime = document.getElementById(RUNTIME_ID);
  if (currentRuntime) {
    return currentRuntime;
  }

  const legacyRuntime = findLegacyRuntime();
  if (legacyRuntime) {
    console.warn(`[${EXTENSION_NAME}] 检测到旧版酒馆助手脚本，扩展运行实例未重复启动。`);
    notify('warning', '检测到旧版脚本，请先停用旧版后再使用扩展版');
    return null;
  }

  if (!(await waitForTavernHelper())) {
    const message = '未检测到酒馆助手，请先安装并启用酒馆助手';
    console.error(`[${EXTENSION_NAME}] ${message}`);
    notify('error', message);
    return null;
  }

  const delayedLegacyRuntime = await waitForLegacyRuntime();
  if (delayedLegacyRuntime) {
    console.warn(`[${EXTENSION_NAME}] 检测到稍后启动的旧版酒馆助手脚本，扩展运行实例未重复启动。`);
    notify('warning', '检测到旧版脚本，请先停用旧版后再使用扩展版');
    return null;
  }

  const iframe = document.createElement('iframe');
  iframe.id = RUNTIME_ID;
  iframe.name = RUNTIME_ID;
  iframe.hidden = true;
  iframe.srcdoc = buildRuntimeDocument();
  document.body.appendChild(iframe);

  iframe.addEventListener('load', () => {
    console.info(`[${EXTENSION_NAME}] GitHub 扩展运行环境已启动（v${EXTENSION_VERSION}）`);
  }, { once: true });

  return iframe;
}

export function stopPresetWorkshop() {
  stopVersionWatcher();
  if (nativeUpdateReloadTimer !== null) {
    globalThis.clearTimeout(nativeUpdateReloadTimer);
    nativeUpdateReloadTimer = null;
  }
  try { globalThis.__PMM_PRESET_CONTENT_EDITOR_V1__?.cleanup?.(); } catch (_) {}
  const runtime = document.getElementById(RUNTIME_ID);
  if (runtime) {
    // Android WebViews do not reliably dispatch pagehide when an iframe is removed.
    try { runtime.contentWindow.dispatchEvent(new runtime.contentWindow.Event('pagehide')); } catch (_) {}
    runtime.remove();
  }
}

globalThis.__ST_PRESET_WORKSHOP__ = {
  start: startPresetWorkshop,
  stop: stopPresetWorkshop,
  version: EXTENSION_VERSION,
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void startPresetWorkshop(), { once: true });
} else {
  void startPresetWorkshop();
}
