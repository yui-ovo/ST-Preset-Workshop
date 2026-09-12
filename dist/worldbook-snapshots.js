import { requestSnapshotName } from './snapshot-name-dialog.js?v=2.98.0';
import { createWorldbookSnapshots, copy } from './worldbook-snapshot-core.js?v=2.98.0';

const SELF = window, TOP = window.parent || window, DOC = TOP.document;
const KEY = '__PMM_WORLDBOOK_SNAPSHOTS__';
const STORAGE = 'pmm.test.worldbook-snapshots.v1';
const PRESET = '__PMM_SWITCH_SNAPSHOTS_TEST52__';
const LAST_WORLD_TAB='pmm.snapshot.last-tab.v1';
const NEW_GROUP_SNAPSHOT='__new_snapshot__';
function lastWorldTab() {
  try {
    const value=JSON.parse(TOP.localStorage.getItem(LAST_WORLD_TAB)||'null');
    return value && ['character','global'].includes(value.page) ? value : null;
  } catch(_) { return null; }
}
function rememberWorldTab(value) { if(['character','global'].includes(value?.page))try { TOP.localStorage.setItem(LAST_WORLD_TAB,JSON.stringify(value)); } catch(_) {} }
const STITCH = '__PMM_WORLDBOOK_STITCH_TEST3__';
TOP[KEY]?.cleanup?.();
const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function makeSnapshotId() {
  try {
    const value=TOP.crypto?.randomUUID?.();
    if(value)return value;
  } catch(_) {}
  try {
    const bytes=new Uint8Array(16);
    TOP.crypto?.getRandomValues?.(bytes);
    if(typeof TOP.crypto?.getRandomValues==='function') {
      bytes[6]=(bytes[6]&15)|64;
      bytes[8]=(bytes[8]&63)|128;
      const hex=[...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
      return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    }
  } catch(_) {}
  return `pmm-wbs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
}
const ctx = () => TOP.SillyTavern?.getContext?.() || {};
function notifyNativeSelect(select) {
  if(!select)return;
  select.dispatchEvent(new TOP.Event('change',{bubbles:true}));
  const jq=TOP.jQuery || TOP.$;
  if(typeof jq==='function')jq(select).trigger('change.select2');
}
function refreshNativeBook(name) {
  const select=DOC.querySelector('#world_editor_select');
  const selected=select?.selectedOptions?.[0];
  if(selected && String(selected.textContent).trim()===String(name).trim()) notifyNativeSelect(select);
}
function helper(name) {
  for (const source of [SELF, SELF.TavernHelper, TOP.TavernHelper]) {
    if (typeof source?.[name] === 'function') return source[name].bind(source);
  }
  throw new Error(`当前酒馆助手缺少 ${name} 接口，请更新酒馆助手`);
}
function optionalHelper(name) {
  for (const source of [SELF, SELF.TavernHelper, TOP.TavernHelper]) {
    if (typeof source?.[name] === 'function') return source[name].bind(source);
  }
  return null;
}
function characters() {
  return Object.entries(ctx().characters || {}).filter(([, c]) => c?.name).map(([id, c]) => ({
    key: String(c.avatar || c.id || id), name: c.name, rawId: id,
  }));
}
function character() {
  const context = ctx();
  if (context.groupId || context.group_id) return null;
  const id = context.characterId ?? context.this_chid;
  if (id === undefined || id === null || id === '' || Number(id) < 0) return null;
  return characters().find(c => c.rawId === String(id)) || null;
}
function chat() {
  if (!character()) return '';
  const context=ctx();
  return String(context.chatId ?? context.chat_id ?? TOP.chat_id ?? SELF.chat_id ?? context.getCurrentChatId?.() ?? '');
}
const CATALOG_BINDING_CONCURRENCY=4;
async function boundedMap(values,limit,mapper) {
  const output=new Array(values.length);let cursor=0;
  const worker=async()=>{
    while(cursor<values.length) {
      const index=cursor++;
      output[index]=await mapper(values[index],index);
    }
  };
  await Promise.all(Array.from({length:Math.min(limit,values.length)},worker));
  return output;
}
async function catalog(scope = '', owner = '') {
  const [rawNames,rawGlobals] = await Promise.all([
    helper('getWorldbookNames')(),
    helper('getGlobalWorldbookNames')(),
  ]);
  const names=(rawNames||[]).map(String),globals=(rawGlobals||[]).map(String);
  const linked = new Map(names.map(name => [name, []]));
  const normalize = name => String(name || '').normalize('NFC').trim().toLocaleLowerCase();
  const lookup = new Map(names.map(name => [normalize(name), name]));
  // The helper reads primary AND additional bindings. Fail closed on partial reads.
  const getBindings = helper('getCharWorldbookNames');
  const candidates=scope==='names' ? [] : scope==='character' ? characters().filter(c=>c.key===owner) : characters();
  const bindingsByCharacter=await boundedMap(candidates,CATALOG_BINDING_CONCURRENCY,async c=>({c,bindings:await getBindings(c.name)}));
  for (const {c,bindings} of bindingsByCharacter) {
    for (const raw of [bindings?.primary, ...(bindings?.additional || [])]) {
      const name = linked.has(raw) ? raw : lookup.get(normalize(raw));
      if (name && !linked.get(name).some(row => row.key === c.key)) linked.get(name).push(c);
    }
  }
  return names.map(name => ({ name, characters: linked.get(name), global: globals.includes(name) }));
}
const engine = createWorldbookSnapshots({
  readStore: () => { const raw = TOP.localStorage.getItem(STORAGE); return raw ? JSON.parse(raw) : null; },
  writeStore: store => TOP.localStorage.setItem(STORAGE, JSON.stringify(store)),
  id: makeSnapshotId, character, chat, catalog,
  globals: () => helper('getGlobalWorldbookNames')(),
  setGlobals: async names => {
    await helper('rebindGlobalWorldbooks')(names);
    notifyNativeSelect(DOC.querySelector('#world_info'));
  },
  load: name => ctx().loadWorldInfo(name),
  exists: async name => (await helper('getWorldbookNames')()).includes(name),
  notice: message => TOP.toastr?.warning?.(message),
  save: (name, data) => ctx().saveWorldInfo(name, data, true),
  hasUnsaved: names => ['top', 'bottom'].some(side => {
    const value = TOP[STITCH]?.state?.[side]; return value?.dirty && names.includes(value.name);
  }),
  changed: async (name, data) => {
    try { await TOP[STITCH]?.refreshSnapshotBook?.(name, data, true); }
    finally { refreshNativeBook(name); }
  },
});

let overlay = null, viewportCleanup = null, themeCleanup = null, busy = false, disposed = false;
let batchOverlay = null, batchViewportCleanup = null, batchBooks = [], batchNames = [], batchSelected = new Set(), batchQuery = '', batchBusy = false, batchBoundExpanded = false;
let page = 'character', section = 'snapshots', book = '', books = [], items = [], draft = null;
let picker = false, pickerReturnBook = '', editGroup = null, groupQuery = '', renameId = '', menuId = '', message = '', lastFocus = null;
let eventSource = null, eventType = '', eventTimer = 0;
let messageTimer=0;
let currentChatKey='', chatInitialized=false, lastNotifiedChatKey='';
const activeChatKey = () => { const c = character(), ch = chat(); return c && ch ? `${c.key}\0${ch}` : ''; };
const TOP_NOTIFICATION_STORAGE_KEY = 'pmm_top_notifications_enabled_v1';
function topNotificationsEnabled() {
  try { return (TOP.localStorage || SELF.localStorage)?.getItem(TOP_NOTIFICATION_STORAGE_KEY) !== '0'; }
  catch (_) { return true; }
}
function notifyBoundChatRestored(name) {
  const text = `已切回绑定聊天快照：${name}`;
  if (!topNotificationsEnabled()) {
    const logger = console.debug || console.info;
    logger?.call(console, '[世界书快照][顶部通知已关闭]', text);
    return;
  }
  if (typeof TOP.toastr?.info === 'function') TOP.toastr.info(text);
  else if (typeof TOP.toastr?.success === 'function') TOP.toastr.success(text);
}
let nativeObserver = null, nativeDiscoveryObserver = null, nativeRoot = null, nativeFrame = 0, nativeCatalogSignature = '', nativeCatalogNames = [];
const NATIVE_ACTION_CLASS = 'pmm-native-worldbook-action';
const style = DOC.createElement('style');
style.id = 'pmm-worldbook-snapshot-style';
style.textContent = `
.pmm-wbs-overlay.pmm-switch-snapshot-overlay .pmm-wbs-dialog button.pmm-wbs-toggle{appearance:none!important;-webkit-appearance:none!important;border:0!important;background:transparent!important;box-shadow:none!important;filter:none!important;padding:0!important;margin:0!important;width:44px!important;height:36px!important;min-width:44px!important;min-height:36px!important;outline:none!important;display:grid!important;place-items:center!important}
.pmm-wbs-overlay .pmm-wbs-dialog button.pmm-wbs-toggle::before,.pmm-wbs-overlay .pmm-wbs-dialog button.pmm-wbs-toggle::after{display:none!important;content:none!important}
.pmm-wbs-overlay .pmm-wbs-dialog button.pmm-wbs-toggle:focus-visible{outline:2px solid currentColor!important;outline-offset:1px!important}
@media(max-width:768px){.pmm-wbs-overlay.pmm-switch-snapshot-overlay{align-items:flex-end!important;padding:max(8px,env(safe-area-inset-top,0px)) max(8px,env(safe-area-inset-right,0px)) max(8px,env(safe-area-inset-bottom,0px)) max(8px,env(safe-area-inset-left,0px))!important}.pmm-wbs-overlay .pmm-wbs-dialog.is-editing{height:min(760px,calc(var(--wbs-visible-height,100dvh) - 16px))!important;max-height:calc(var(--wbs-visible-height,100dvh) - 16px)!important}}

.pmm-snapshot-tabs { display:flex; gap:4px; padding:8px 16px; border-bottom:1px solid var(--pm-border,#343434); flex-shrink:0; }
.pmm-snapshot-tabs button { flex:1; min-width:0; border:0!important; border-radius:9px!important; padding:10px 3px!important; background:transparent!important; color:inherit; font:inherit; font-size:13px!important; cursor:pointer; }
.pmm-snapshot-tabs button[aria-selected="true"] { background:var(--pm-hover-bg,#303030)!important; font-weight:650; }
.pmm-snapshot-tabs button:disabled { opacity:.4; }
.pmm-snapshot-hub-preset .pmm-switch-snapshot-bindings { display:flex!important; }
.pmm-snapshot-hub-preset .pmm-switch-snapshot-row { border-radius:12px!important; }
.pmm-wbs-overlay { box-sizing:border-box; position:fixed; inset:0; z-index:2147483000; background:rgba(0,0,0,.4); backdrop-filter:blur(7px); -webkit-backdrop-filter:blur(7px); display:flex; align-items:center; justify-content:center; padding:16px; color:var(--pm-text-primary,#e7e5e4); font-family:var(--pm-font-family,system-ui,sans-serif); }
.pmm-wbs-dialog { box-sizing:border-box; display:flex; flex-direction:column; width:680px; max-width:100%; max-height:100%; min-height:0; background:var(--pm-panel-bg,#191919); border:1px solid var(--pm-border,#3c3c3c); border-radius:20px; box-shadow:0 20px 70px #0005; overflow:hidden; font-size:14px; }
.pmm-wbs-dialog * { box-sizing:border-box; }
.pmm-wbs-head { display:flex; align-items:center; justify-content:space-between; padding:18px 20px 12px; gap:12px; flex-shrink:0; }
.pmm-wbs-head h2 { font-size:19px; margin:0; color:inherit; }
.pmm-wbs-head p { margin:5px 0 0; font-size:12px; opacity:.65; }
.pmm-wbs-dialog button { color:inherit; background:transparent; border:1px solid var(--pm-border,#414141); border-radius:9px; padding:9px 12px; cursor:pointer; font:inherit; line-height:1.3; min-height:36px; }
.pmm-wbs-dialog button:hover { background:var(--pm-hover-bg,#303030); }
.pmm-wbs-dialog button:disabled { opacity:.4; cursor:default; }
.pmm-wbs-icon { border:0!important; font-size:20px!important; }
.pmm-wbs-body { padding:16px 20px; overflow:auto; min-height:0; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; }
.pmm-wbs-body h3 { font-size:14px; margin:16px 0 10px; }
.pmm-wbs-dialog small { opacity:.65; font-size:12px; display:block; margin-top:5px; overflow-wrap:anywhere; }
.pmm-wbs-source { display:block; text-align:left; width:100%; margin:7px 0; padding:12px!important; }
.pmm-wbs-empty { padding:24px 5px; text-align:center; opacity:.6; line-height:1.8; }
.pmm-wbs-tools { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; align-items:center; }
.pmm-wbs-tools .grow { flex:1; text-align:left; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pmm-wbs-row { border:1px solid var(--pm-border,#363636); border-radius:12px; padding:13px; margin:9px 0; }
.pmm-wbs-row-main { display:flex; gap:10px; align-items:center; }
.pmm-wbs-copy { flex:1; min-width:0; overflow-wrap:anywhere; }
.pmm-wbs-copy strong { font-size:14px; font-weight:550; }
.pmm-wbs-menu { display:flex; flex-wrap:wrap; gap:7px; margin-top:12px; border-top:1px solid var(--pm-border,#363636); padding-top:10px; }
.pmm-wbs-dialog input[type="text"],.pmm-wbs-dialog input[type="search"] { width:100%; background:var(--pm-card-bg,#242424); color:inherit; border:1px solid var(--pm-border,#444); border-radius:10px; padding:11px 12px; font:inherit; font-size:16px!important; min-width:0; margin:7px 0 12px; }
.pmm-wbs-entry { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:13px 4px; border-bottom:1px solid var(--pm-border,#363636); cursor:pointer; }
.pmm-wbs-entry span { overflow-wrap:anywhere; min-width:0; }
.pmm-wbs-entry input { appearance:none; -webkit-appearance:none; width:32px!important; height:19px!important; min-width:32px; border:0; border-radius:20px; background:#7777; position:relative; margin:0; cursor:pointer; }
.pmm-wbs-entry input:before { content:''; position:absolute; top:3px; left:3px; width:13px; height:13px; background:#eee; border-radius:50%; }
.pmm-wbs-entry input:checked { background:var(--pm-accent,#399e82); }
.pmm-wbs-entry input:checked:before { left:16px; }
.pmm-wbs-entry input:focus-visible { outline:2px solid var(--pm-accent,#399e82); outline-offset:3px; }
.pmm-wbs-entry-switch { position:relative; flex:0 0 44px; width:44px; height:36px; margin:-8px 0; display:grid; place-items:center; cursor:pointer; }
.pmm-wbs-entry-switch input.pmm-wbs-entry-switch-input { position:absolute!important; inset:0!important; z-index:2!important; box-sizing:border-box!important; width:100%!important; min-width:0!important; height:100%!important; min-height:0!important; margin:0!important; padding:0!important; opacity:0!important; cursor:pointer!important; }
.pmm-wbs-entry-switch-track { pointer-events:none; box-sizing:border-box; position:relative; display:block; flex:none; width:32px; min-width:32px!important; height:19px; border:1px solid color-mix(in srgb,var(--wbs-ink) 18%,transparent); border-radius:999px; background:color-mix(in srgb,var(--wbs-ink) 18%,transparent); box-shadow:inset 0 1px 2px rgba(0,0,0,.18); transition:background-color .16s ease,border-color .16s ease; }
.pmm-wbs-entry-switch-track:before { content:''; box-sizing:border-box; position:absolute; top:2px; left:2px; width:13px; height:13px; border-radius:50%; background:#f7f7f7; box-shadow:0 1px 3px rgba(0,0,0,.3); transition:left .16s ease; }
.pmm-wbs-entry-switch-input:checked+.pmm-wbs-entry-switch-track { border-color:color-mix(in srgb,var(--pm-accent,#399e82) 82%,transparent); background:var(--pm-accent,#399e82); }
.pmm-wbs-entry-switch-input:checked+.pmm-wbs-entry-switch-track:before { left:15px; }
.pmm-wbs-entry-switch-input:focus-visible+.pmm-wbs-entry-switch-track { outline:2px solid var(--pm-accent,#399e82); outline-offset:3px; }
.pmm-wbs-entry-switch:has(input:disabled) { opacity:.45; cursor:not-allowed; }
.pmm-wbs-foot { display:flex; gap:10px; align-items:center; justify-content:flex-end; padding:12px 20px; border-top:1px solid var(--pm-border,#363636); flex-shrink:0; }
.pmm-wbs-foot small { flex:1; margin:0; }
.pmm-wbs-primary { background:var(--pm-hover-bg,#303030)!important; font-weight:600!important; }
.pmm-wbs-message { padding:8px 20px; color:inherit; font-size:13px; background:var(--pm-hover-bg,#303030); flex-shrink:0; }
.pmm-wbs-dialog [hidden] { display:none!important; }
@media(max-width:600px) { .pmm-wbs-overlay { align-items:flex-end; padding:max(8px,env(safe-area-inset-top)) 8px max(8px,env(safe-area-inset-bottom)); } .pmm-wbs-dialog { width:100%; border-radius:18px; } .pmm-wbs-body { padding:12px; } .pmm-wbs-head { padding:15px 14px 10px; } .pmm-wbs-foot { padding:12px; } }

/* Compact, theme-derived soft surfaces shared by the three snapshot categories. */
.pmm-wbs-overlay,.pmm-snapshot-hub-preset {
  --wbs-base:#202124; --wbs-ink:var(--pm-text-primary,#eee);
  --wbs-surface:color-mix(in srgb,var(--pm-panel-bg,var(--wbs-base)) 92%,var(--wbs-base));
  --wbs-raised:color-mix(in srgb,var(--pm-card-bg,var(--wbs-base)) 88%,var(--wbs-ink) 4%);
  --wbs-line:color-mix(in srgb,var(--wbs-ink) 10%,transparent);
  --wbs-shadow:rgba(0,0,0,.23); --wbs-shine:rgba(255,255,255,.045);
}
[data-wbs-tone="light"] { --wbs-base:#f5f5f5; --wbs-shadow:rgba(35,39,48,.085); --wbs-shine:rgba(255,255,255,.85); }
.pmm-wbs-overlay { background:rgba(0,0,0,.27); }
.pmm-wbs-dialog,.pmm-snapshot-hub-preset .pmm-switch-snapshot-dialog {
  background:linear-gradient(145deg,var(--wbs-shine),transparent 46%),var(--wbs-surface);
  color:var(--wbs-ink); border:1px solid var(--wbs-line); border-radius:28px;
  box-shadow:0 18px 50px var(--wbs-shadow),inset 0 1px 0 var(--wbs-shine);
  font-family:var(--pm-font-family,system-ui,sans-serif); text-shadow:none;
}
.pmm-wbs-dialog { width:600px; }
/* Keep mobile snapshot sheets comfortably tall while allowing content to
   grow a little further before their own list starts scrolling. */
.pmm-wbs-dialog:not(.is-editing):not(.pmm-wbs-batch-dialog),.pmm-snapshot-hub-preset .pmm-switch-snapshot-dialog {
  height:auto!important;
  max-height:60vh!important;
  max-height:min(60dvh,var(--wbs-sheet-max-height,var(--pmm-switch-snapshot-sheet-max-height,60dvh)))!important;
  color:var(--wbs-ink)!important;
}
.pmm-wbs-dialog:not(.is-editing):not(.pmm-wbs-batch-dialog) .pmm-wbs-body,.pmm-snapshot-hub-preset .pmm-switch-snapshot-list { flex:1 1 auto!important; min-height:0!important; max-height:none!important; overflow:auto!important; }
.pmm-snapshot-hub-preset .pmm-switch-snapshot-head,.pmm-snapshot-hub-preset .pmm-switch-snapshot-default,.pmm-snapshot-hub-preset .pmm-switch-snapshot-create,.pmm-snapshot-hub-preset .pmm-switch-snapshot-footer { flex-shrink:0!important; }
.pmm-wbs-source-section[hidden],.pmm-wbs-source[hidden] { display:none!important; }
.pmm-wbs-source-search { position:sticky; top:-10px; z-index:1; background:var(--wbs-surface); padding-top:4px; }
.pmm-wbs-dialog.is-editing { height:min(680px,calc(var(--wbs-visible-height,100dvh) - 32px))!important; }
.pmm-wbs-head { padding:22px 22px 12px; }
.pmm-wbs-heading { display:flex; align-items:center; gap:12px; min-width:0; }
.pmm-wbs-heading>div { min-width:0; }
.pmm-wbs-heading p { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pmm-wbs-head h2 { font-size:19px; font-weight:650; letter-spacing:.015em; }
.pmm-wbs-symbol { display:inline-flex; align-items:center; justify-content:center; flex:none; width:40px; height:40px; border-radius:14px; background:var(--wbs-raised); box-shadow:3px 4px 10px var(--wbs-shadow),inset 0 1px 0 var(--wbs-shine); }
.pmm-wbs-svg { width:20px; height:20px; display:block; flex:none; }
.pmm-wbs-dialog button { border-color:var(--wbs-line); border-radius:999px; }
.pmm-wbs-icon { width:34px; height:34px; min-height:34px!important; padding:8px!important; display:grid; place-items:center; background:var(--wbs-raised)!important; box-shadow:2px 3px 9px var(--wbs-shadow); }
.pmm-snapshot-tabs { border:1px solid var(--wbs-line); border-radius:17px; padding:4px; margin:0 20px 8px; gap:3px; background:color-mix(in srgb,var(--wbs-ink) 3%,transparent); }
.pmm-snapshot-tabs button { display:flex; align-items:center; justify-content:center; gap:6px; border-radius:13px!important; font-size:12px!important; line-height:1.25; padding:10px 3px!important; color:var(--wbs-ink); opacity:.68; }
.pmm-snapshot-tabs .pmm-wbs-svg { width:15px; height:15px; }
.pmm-snapshot-tabs button[aria-selected="true"] { background:var(--wbs-raised)!important; opacity:1; box-shadow:2px 3px 7px var(--wbs-shadow),inset 0 1px 0 var(--wbs-shine); }
.pmm-wbs-body { flex:1; padding:12px 20px 16px; scrollbar-width:thin; }
.pmm-wbs-body h3 { font-weight:550; font-size:12px; margin:14px 3px 9px; opacity:.68; }
.pmm-wbs-source { display:flex; align-items:center; gap:10px; border-radius:17px!important; padding:13px!important; background:var(--wbs-raised)!important; border:1px solid var(--wbs-line)!important; }
.pmm-wbs-source-copy { min-width:0; flex:1; line-height:1.5; }
.pmm-wbs-source-copy>span { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.pmm-wbs-source-copy small { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.pmm-wbs-source>.pmm-wbs-svg { opacity:.5; width:16px; }
.pmm-wbs-tools { flex-wrap:nowrap; gap:8px; margin:3px 0 12px; }
.pmm-wbs-tools button { padding:10px 13px; font-size:12px; }
.pmm-wbs-tools .grow { display:flex; align-items:center; justify-content:space-between; gap:8px; background:var(--wbs-raised); border-radius:13px; }
.pmm-wbs-tools .grow>span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pmm-wbs-primary { background:var(--wbs-ink)!important; color:var(--wbs-base)!important; border-color:transparent!important; box-shadow:0 4px 12px var(--wbs-shadow); }
.pmm-wbs-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:7px; min-height:140px; padding:18px 5px; opacity:1; }
.pmm-wbs-empty .pmm-wbs-symbol { width:48px; height:48px; border-radius:50%; margin-bottom:4px; }
.pmm-wbs-empty strong { font-weight:500; font-size:13px; }
.pmm-wbs-empty small { max-width:240px; line-height:1.7; margin:0; font-size:11px; }
.pmm-wbs-row,.pmm-snapshot-hub-preset .pmm-switch-snapshot-row { border:1px solid var(--wbs-line)!important; background:var(--wbs-raised)!important; border-radius:18px!important; box-shadow:0 3px 9px var(--wbs-shadow),inset 0 1px 0 var(--wbs-shine); }
.pmm-wbs-row-main { gap:9px; }
.pmm-wbs-row .pmm-wbs-symbol { width:32px; height:36px; border-radius:11px; box-shadow:none; }
.pmm-wbs-row .pmm-wbs-copy small { font-size:11px; }
.pmm-wbs-row [data-wbs="menu"] { border:none; padding:6px; font-size:20px; }
.pmm-wbs-menu { border-color:var(--wbs-line); }
.pmm-wbs-row { position:relative; }
.pmm-wbs-overlay > .pmm-wbs-menu { z-index:4; display:flex; flex-direction:column; flex-wrap:nowrap; margin:0; padding:5px; width:156px; max-width:calc(100vw - 32px); max-height:70dvh; overflow:auto; gap:2px; border:1px solid var(--wbs-line); border-radius:10px; background:var(--pm-panel-bg); box-shadow:0 6px 20px var(--wbs-shadow); color:var(--wbs-ink); }
.pmm-wbs-menu button { display:flex; align-items:center; gap:8px; width:100%; padding:6px 9px; min-height:29px; border:0; background:transparent; color:inherit; border-radius:6px; font:inherit; font-size:11px; text-align:left; cursor:pointer; }
.pmm-wbs-menu button:hover { background:var(--wbs-raised); }
.pmm-wbs-menu .pmm-wbs-svg { width:14px; height:14px; opacity:.7; }
.pmm-wbs-message { display:flex; align-items:center; gap:8px; }
.pmm-wbs-message>span { flex:1; }
.pmm-wbs-message button { border:0; min-height:24px; padding:0 5px; }
.pmm-wbs-row { padding:10px 12px; }
.pmm-wbs-row button { font-size:12px; padding:5px 9px; min-height:32px; }
.pmm-wbs-dialog .pmm-wbs-toggle { border:0; background:transparent; padding:6px; min-width:44px; min-height:44px; display:grid; place-items:center; }
.pmm-wbs-toggle span { width:30px; height:18px; border-radius:20px; background:color-mix(in srgb,var(--wbs-ink) 25%,transparent); position:relative; }
.pmm-wbs-toggle span:after { content:''; width:12px; height:12px; position:absolute; top:3px; left:3px; border-radius:50%; background:var(--wbs-base); }
.pmm-wbs-toggle[aria-checked="true"] span { background:var(--wbs-ink); }
.pmm-wbs-toggle[aria-checked="true"] span:after { left:15px; }
.pmm-wbs-copy .pmm-wbs-plan { margin-top:5px; max-width:100%; white-space:normal; text-align:left; font-size:11px; padding:3px 7px; min-height:28px; }
.pmm-wbs-plan-label { display:flex; align-items:center; gap:4px; margin-top:5px; font-size:11px; }
.pmm-wbs-dialog select.pmm-wbs-plan { width:auto; min-width:65px; max-width:100%; margin:0; color:var(--wbs-ink); background:var(--wbs-raised); border:1px solid var(--wbs-line); border-radius:10px; font:inherit; padding:5px 7px; text-overflow:ellipsis; }
.pmm-wbs-plan option { color:var(--wbs-ink); background:var(--pm-panel-bg); }
.pmm-wbs-book { display:block!important; margin:8px 0; border:1px solid var(--wbs-line); border-radius:12px; overflow:hidden; }
.pmm-wbs-book>.pmm-wbs-book-head { display:flex!important; align-items:center; gap:8px; width:100%; min-height:0!important; padding:12px 9px!important; border:0!important; border-radius:0!important; background:var(--wbs-raised)!important; box-shadow:none!important; color:inherit; text-align:left; }
.pmm-wbs-book>.pmm-wbs-book-head .pmm-wbs-svg { width:14px; height:14px; transition:none; }
.pmm-wbs-book>.pmm-wbs-book-head[aria-expanded="true"] .pmm-wbs-svg { transform:rotate(90deg); }
.pmm-wbs-book-title { flex:1; min-width:0; overflow-wrap:anywhere; }
.pmm-wbs-book>.pmm-wbs-book-head small { margin:0; white-space:nowrap; }
.pmm-wbs-book>.pmm-wbs-book-entries[hidden] { display:none!important; }
.pmm-wbs-entry-block { content-visibility:auto; contain-intrinsic-size:auto 50px; }
.pmm-wbs-batch-row { content-visibility:auto; contain-intrinsic-size:auto 44px; }
.pmm-wbs-row { content-visibility:auto; contain-intrinsic-size:auto 70px; }
.pmm-wbs-name-field { position:relative; margin:3px 0 5px; }
.pmm-wbs-dialog .pmm-wbs-name-field input { height:38px!important; min-height:38px!important; margin:0!important; padding:6px 38px 6px 10px!important; border-radius:11px!important; font-size:16px!important; }
.pmm-wbs-name-edit { position:absolute; right:7px; top:50%; transform:translateY(-50%); width:26px; height:26px; min-height:26px!important; padding:5px!important; border:0!important; opacity:.52; }
.pmm-wbs-name-edit:hover,.pmm-wbs-name-edit:focus-visible { opacity:1; }
.pmm-wbs-book-search { width:calc(100% - 18px)!important; height:34px!important; min-height:34px!important; margin:5px 9px 2px!important; padding:5px 9px!important; border-radius:10px!important; font-size:16px!important; }
.pmm-wbs-entry-block { border-bottom:1px solid var(--wbs-line); }
.pmm-wbs-entry-block>.pmm-wbs-entry { border-bottom:0; }
.pmm-wbs-entry { padding:13px 8px; border-color:var(--wbs-line); font-size:13px; }
.pmm-wbs-entry-title { display:flex; align-items:center; gap:7px; flex:1; min-width:0; min-height:28px!important; padding:2px 0!important; border:0!important; border-radius:5px!important; background:transparent!important; box-shadow:none!important; color:inherit; text-align:left; }
.pmm-wbs-entry-title .pmm-wbs-svg { width:11px; height:11px; opacity:.48; transition:transform .12s; }
.pmm-wbs-entry-title[aria-expanded="true"] .pmm-wbs-svg { transform:rotate(90deg); }
.pmm-wbs-entry-title span { flex:1; }
.pmm-wbs-entry-preview { max-height:180px; overflow:auto; margin:0 8px; padding:8px 4px 11px 18px; border-top:1px dashed var(--wbs-line); }
.pmm-wbs-entry-preview small { margin:0 0 5px; font-size:10px; opacity:.52; }
.pmm-wbs-entry-preview-content { white-space:pre-wrap; overflow-wrap:anywhere; user-select:text; font-size:12px; line-height:1.65; opacity:.82; }
.pmm-wbs-dialog input[type="text"],.pmm-wbs-dialog input[type="search"] { border-color:var(--wbs-line); background:var(--wbs-raised); border-radius:14px; }
.pmm-wbs-foot { border-color:var(--wbs-line); padding:12px 20px; background:color-mix(in srgb,var(--wbs-surface) 85%,transparent); }
.pmm-wbs-foot small { font-size:10px; line-height:1.6; }
.pmm-wbs-subnav { padding:3px; border-radius:999px; background:color-mix(in srgb,var(--wbs-ink) 4%,transparent); }
.pmm-wbs-subnav button { flex:1; border:none; padding:7px 9px; }
.pmm-wbs-picker-head { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
.pmm-wbs-picker-head strong { font-size:13px; font-weight:550; }
.pmm-snapshot-hub-preset .pmm-switch-snapshot-head { border-bottom:0!important; }
.pmm-wbs-head .pmm-wbs-symbol { width:22px; height:24px; border-radius:0; background:none; box-shadow:none; color:var(--pm-accent); align-self:flex-start; margin-top:2px; }
.pmm-wbs-head .pmm-wbs-icon { border:0; background:transparent!important; box-shadow:none; width:28px; height:28px; min-height:28px!important; padding:5px!important; }
.pmm-wbs-head h2 { font-size:16px; font-weight:700; }
.pmm-wbs-dialog button { border-radius:8px; }
.pmm-wbs-primary,.pmm-wbs-row [data-wbs="apply"],.pmm-wbs-default button { color:var(--wbs-ink)!important; border:1px solid color-mix(in srgb,var(--pm-accent) 45%,transparent)!important; background:color-mix(in srgb,var(--pm-accent) 12%,transparent)!important; box-shadow:none; }
.pmm-wbs-dialog [data-wbs="new"],.pmm-wbs-dialog [data-wbs="new-group"] { justify-content:center; font-weight:600; border-radius:999px!important; padding:9px!important; border-color:color-mix(in srgb,var(--pm-accent) 45%,transparent)!important; background:color-mix(in srgb,var(--pm-accent) 10%,transparent)!important; }
.pmm-wbs-subnav .pmm-wbs-primary { border:0!important; border-radius:999px; background:var(--wbs-raised)!important; box-shadow:0 2px 5px var(--wbs-shadow); font-weight:600; }
.pmm-wbs-default.pmm-wbs-row { border-radius:0!important; box-shadow:none; background:color-mix(in srgb,var(--pm-accent) 7%,transparent)!important; border-width:1px 0!important; }
.pmm-wbs-row [data-wbs="group-menu"] { border:0; background:transparent; padding:6px; font-size:20px; }
.pmm-wbs-dialog select.pmm-wbs-plan { border-radius:8px; padding:4px 7px; background:color-mix(in srgb,var(--pm-accent) 8%,transparent); }
.pmm-wbs-character-list { min-height:80px; overflow:auto; padding:8px; }
.pmm-wbs-character-context { padding:2px 18px 0; font-size:10px; opacity:.62; }
.pmm-wbs-character-default .pmm-wbs-svg { width:10px; height:10px; }
.pmm-wbs-character-default .pmm-switch-snapshot-reset-all .pmm-wbs-svg { width:13px; height:13px; }
.pmm-wbs-character-snapshot .pmm-switch-snapshot-bindings { min-width:auto!important; }
.pmm-wbs-character-snapshot .pmm-switch-snapshot-actions { margin-left:auto; }
.pmm-wbs-character-snapshot .pmm-switch-snapshot-lock { min-height:27px!important; }
.pmm-wbs-character-snapshot .pmm-switch-snapshot-actions>button:first-child,.pmm-wbs-character-snapshot .pmm-switch-snapshot-more { min-height:28px!important; }
.pmm-wbs-character-snapshot [data-wbs="apply"].is-current { opacity:1!important; cursor:default; font-weight:650; border-color:color-mix(in srgb,var(--pm-accent) 70%,transparent)!important; background:color-mix(in srgb,var(--pm-accent) 22%,transparent)!important; }
.pmm-wbs-body.is-character-snapshots { padding:0!important; }
.pmm-wbs-body.is-draft { padding-top:0!important; }
.pmm-wbs-body.is-group-home { padding-top:0!important; }
.pmm-wbs-body.is-group-home>[data-wbs="new-group"] { margin-top:0; }
.pmm-wbs-body.is-group-editor { display:flex; flex-direction:column; overflow:hidden; padding-top:0!important; }
.pmm-wbs-group-editor { display:flex; flex:1; min-height:0; flex-direction:column; }
.pmm-wbs-group-editor-head { flex:0 0 auto; padding-bottom:4px; background:transparent; }
.pmm-wbs-group-editor-head label { display:block; }
.pmm-wbs-group-editor-head small { margin-top:2px; line-height:1.4; }
.pmm-wbs-group-name-field { position:relative; }
.pmm-wbs-dialog .pmm-wbs-group-name-field input { height:34px!important; min-height:34px!important; margin:2px 0 4px!important; padding:5px 38px 5px 10px!important; border-radius:10px!important; font-size:16px!important; }
.pmm-wbs-group-name-edit { top:calc(50% - 1px); }
.pmm-wbs-dialog .pmm-wbs-group-search { height:34px!important; min-height:34px!important; margin:4px 0 2px!important; padding:5px 9px!important; border-radius:10px!important; font-size:16px!important; }
.pmm-wbs-group-editor-list { flex:1; min-height:0; overflow:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; padding-right:2px; }
.pmm-wbs-snapshot-back { justify-content:flex-start!important; }
.pmm-wbs-dialog select.pmm-wbs-plan { min-width:58px; max-width:min(210px,55vw); }
.pmm-wbs-default-actions { display:flex; align-items:center; gap:6px; }
.pmm-wbs-default-actions .pmm-switch-snapshot-reset-all { width:32px; min-width:32px; min-height:32px!important; padding:5px!important; display:grid; place-items:center; }
.pmm-wbs-default-actions .pmm-switch-snapshot-reset-all .pmm-wbs-svg { width:14px; height:14px; }
.pmm-switch-snapshot-dialog .pmm-wbs-foot { opacity:1!important; }
.pmm-switch-snapshot-dialog .pmm-wbs-foot>small { opacity:.55!important; }
.pmm-native-worldbook-actions { margin-left:auto; display:flex; align-items:center; gap:3px; flex:none; }
.pmm-native-worldbook-action { width:30px!important; height:30px!important; min-width:30px!important; min-height:30px!important; margin:0!important; padding:0!important; display:grid!important; place-items:center; border-radius:8px!important; }
.pmm-native-worldbook-action i { pointer-events:none; }
.pmm-wbs-batch-dialog { height:min(560px,calc(var(--wbs-batch-visible-height,100dvh) - 32px))!important; max-height:calc(var(--wbs-batch-visible-height,100dvh) - 32px)!important; }
.pmm-wbs-batch-tools { display:flex; gap:8px; align-items:center; margin-bottom:10px; }
.pmm-wbs-dialog .pmm-wbs-batch-search { margin:0!important; height:36px!important; min-height:36px!important; }
.pmm-wbs-batch-select-all { flex:none; white-space:nowrap; min-height:36px!important; padding:7px 11px!important; }
.pmm-wbs-batch-list { display:flex; flex-direction:column; gap:6px; }
.pmm-wbs-batch-section+.pmm-wbs-batch-section { margin-top:15px; }
.pmm-wbs-batch-section-title { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:2px 3px 7px; font-size:12px; font-weight:650; opacity:.68; }
.pmm-wbs-batch-section-toggle { width:100%; min-height:38px!important; margin-top:2px; padding:7px 10px!important; display:flex!important; align-items:center; justify-content:space-between; gap:10px; border-radius:11px!important; font-weight:650!important; }
.pmm-wbs-batch-section-toggle span { display:flex; align-items:center; gap:7px; }
.pmm-wbs-batch-section-toggle i { transition:transform .16s ease; }
.pmm-wbs-batch-section-toggle[aria-expanded="true"] i { transform:rotate(180deg); }
.pmm-wbs-batch-row { display:flex!important; align-items:center; gap:10px; width:100%; min-height:40px!important; padding:8px 10px!important; text-align:left; border-radius:11px!important; }
.pmm-wbs-batch-row>span { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pmm-wbs-batch-row>span small { margin:2px 0 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pmm-wbs-batch-check { width:18px; flex:none; text-align:center; color:var(--pm-accent,currentColor); }
.pmm-wbs-danger { color:#ef6b6b!important; }
@media(max-width:600px) {
  .pmm-wbs-dialog:not(.is-editing):not(.pmm-wbs-batch-dialog),.pmm-snapshot-hub-preset .pmm-switch-snapshot-dialog {
    min-height:50vh!important;
    min-height:min(50dvh,var(--wbs-sheet-min-height,var(--pmm-switch-snapshot-sheet-min-height,50dvh)))!important;
  }
  .pmm-wbs-head { padding:18px 16px 12px; } .pmm-wbs-body { padding:10px 14px 14px; } .pmm-snapshot-tabs { margin:0 14px 8px; } .pmm-wbs-foot { padding:10px 15px; } .pmm-wbs-dialog { border-radius:26px; }
}
`;
DOC.head.append(style);
const tabLabels = { character: '角色世界书', global: '全局世界书' };
function icon(name) {
  const paths = {
    camera: '<path d="M8 5l1-2h6l1 2h4v14H4V5z"/><circle cx="12" cy="12" r="4"/>',
    preset: '<path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/>',
    character: '<circle cx="12" cy="8" r="4"/><path d="M5 21v-3a7 7 0 0114 0v3"/>',
    global: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18z"/>',
    book: '<path d="M4 4h7l1 2 1-2h7v16h-7l-1 1-1-1H4zM12 6v15"/>',
    arrow: '<path d="M9 5l7 7-7 7"/>', back: '<path d="M15 5l-7 7 7 7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    edit: '<path d="M4 16L16 4l4 4L8 20H4zM13 7l4 4"/>',
    trash: '<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  };
  return `<svg class="pmm-wbs-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.camera}</svg>`;
}
function tabs(active, locked = false) {
  return `<nav class="pmm-snapshot-tabs" aria-label="快照分类">${Object.entries(tabLabels).map(([key, label]) => `<button type="button" data-hub-tab="${key}" aria-selected="${key === active}"${locked ? ' disabled' : ''}>${icon(key)}<span>${label}</span></button>`).join('')}</nav>`;
}
function decoratePreset(root) {
  const dialog = root?.querySelector('.pmm-switch-snapshot-dialog');
  if (!dialog) return;
  root.classList.add('pmm-snapshot-hub-preset');
  theme(root);
  dialog.querySelector('.pmm-snapshot-tabs')?.remove();
}
function theme(target = overlay) {
  if (!target) return;
  const main = DOC.querySelector('#preset-manager-main-panel .pmm-wb-inline-panel') || DOC.querySelector('#preset-manager-main-panel .preset-panel');
  const floating = DOC.querySelector('#preset-manager-floating-panel .floating-panel-root') || DOC.querySelector('#preset-manager-floating-panel .panel-wrapper')
    || SELF.document.querySelector('.floating-panel-root');
  const source = main || floating || DOC.body;
  const view = source.ownerDocument.defaultView;
  const css = view.getComputedStyle(source);
  const useFloating = !main && !!floating;
  let mode = ''; try { mode = TOP.localStorage.getItem('preset-manager-theme-mode') || ''; } catch (_) {}
  const defaults = mode === 'dark'
    ? { ink:'#e6e8ed', surface:'#20232b', card:'#282d36', border:'#424752' }
    : { ink:'#35363b', surface:'#fafafa', card:'#f3f4f6', border:'#dadce1' };
  // Resolve in the source tree: --fp-* and magic-theme references do not exist on a body-mounted modal.
  const probe = source.ownerDocument.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
  source.append(probe);
  const resolve = (expression, fallback) => {
    probe.style.setProperty('color', fallback, 'important');
    probe.style.setProperty('color', expression, 'important');
    return view.getComputedStyle(probe).color;
  };
  const fields = [
    ['--pm-text-primary','--fp-text-color','--SmartThemeBodyColor',defaults.ink],
    ['--pm-panel-bg','--fp-glass-bg','--SmartThemeBlurTintColor',defaults.surface],
    ['--pm-card-bg','--fp-card-bg','--SmartThemeBlurTintColor',defaults.card],
    ['--pm-border','--fp-border-color','--SmartThemeBorderColor',defaults.border],
    ['--pm-accent','--fp-accent-color','--SmartThemeQuoteColor',defaults.ink],
    ['--pm-hover-bg','--fp-glass-hover-bg','--SmartThemeBlurTintColor',defaults.card],
  ];
  for (const [key, fp, smart, fallback] of fields) {
    const primary = useFloating ? fp : key;
    const expression = `var(${primary},var(${smart},${fallback}))`;
    target.style.setProperty(key, resolve(expression, fallback));
  }
  // Explicit day/night mode also works before either workshop surface is mounted.
  if (!main && !floating && ['light','dark'].includes(mode)) {
    target.style.setProperty('--pm-text-primary',defaults.ink);
    target.style.setProperty('--pm-panel-bg',defaults.surface);
    target.style.setProperty('--pm-card-bg',defaults.card);
  }
  const font = css.getPropertyValue('--pm-font-family') || css.fontFamily;
  target.style.setProperty('--pm-font-family',font);
  const rgb = target.style.getPropertyValue('--pm-text-primary').match(/[\d.]+/g)?.slice(0,3).map(Number);
  probe.remove();
  const dark = rgb?.length === 3 ? .2126*rgb[0] + .7152*rgb[1] + .0722*rgb[2] > 145 : mode === 'dark';
  target.dataset.wbsTone = dark ? 'dark' : 'light';
}
function watchTheme() {
  themeCleanup?.();
  let frame = 0;
  const update = () => { if (!frame) frame = TOP.requestAnimationFrame(() => { frame = 0; theme(); }); };
  const observer = new TOP.MutationObserver(update);
  const sources = [DOC.documentElement, DOC.body, DOC.getElementById('preset-manager-main-panel'), DOC.querySelector('#preset-manager-main-panel .pm-panel-container'), DOC.querySelector('#preset-manager-main-panel .preset-panel'), DOC.querySelector('#preset-manager-floating-panel .floating-panel-root')];
  sources.filter(Boolean).forEach(node => observer.observe(node, { attributes:true, attributeFilter:['class','style','data-theme'] }));
  TOP.addEventListener('storage', update);
  themeCleanup = () => { observer.disconnect(); TOP.removeEventListener('storage', update); if (frame) TOP.cancelAnimationFrame(frame); };
}
function bindViewport() {
  const vv = TOP.visualViewport;
  let frame = 0;
  const update = () => {
    frame = 0;
    if (!overlay) return;
    const visibleHeight=Math.max(1,Number(vv?.height || TOP.innerHeight || 1));
    const values={position:'fixed',inset:'auto',left:`${vv?.offsetLeft || 0}px`,top:`${vv?.offsetTop || 0}px`,right:'auto',bottom:'auto',width:`${vv?.width || TOP.innerWidth}px`,height:`${visibleHeight}px`};
    for(const [name,value] of Object.entries(values))overlay.style.setProperty(name,value,'important');
    overlay.style.setProperty('--wbs-visible-height', `${visibleHeight}px`);
    overlay.style.setProperty('--wbs-sheet-min-height', `${Math.max(1,Math.floor(visibleHeight*.5))}px`);
    overlay.style.setProperty('--wbs-sheet-max-height', `${Math.max(1,Math.floor(visibleHeight*.6))}px`);
  };
  const schedule = event => {
    if(menuId && ['resize','orientationchange','scroll'].includes(event?.type)) {
      menuId='';overlay?.querySelectorAll('.pmm-wbs-menu').forEach(node=>node.remove());
    }
    if (!frame) frame = TOP.requestAnimationFrame(update);
  };
  const targets = [[TOP, 'resize'], [TOP, 'scroll'], [TOP, 'orientationchange'], [vv, 'resize'], [vv, 'scroll'], [overlay, 'focusin'], [overlay, 'focusout']];
  targets.forEach(([target, name]) => target?.addEventListener(name, schedule, { passive: true }));
  update();
  viewportCleanup = () => { targets.forEach(([target, name]) => target?.removeEventListener(name, schedule)); if (frame) TOP.cancelAnimationFrame(frame); };
}
function bindBatchViewport() {
  batchViewportCleanup?.(); batchViewportCleanup = null;
  const node = batchOverlay;
  if (!node) return;
  const vv = TOP.visualViewport;
  let frame = 0, settleTimer = 0;
  const positive = (...values) => values.map(Number).find(value => Number.isFinite(value) && value > 0) || 1;
  const offset = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const update = () => {
    frame = 0;
    if (batchOverlay !== node || !node.isConnected) return;
    const width = positive(vv?.width, TOP.innerWidth, DOC.documentElement?.clientWidth);
    const height = positive(vv?.height, TOP.innerHeight, DOC.documentElement?.clientHeight);
    const values = {
      position:'fixed', inset:'auto', left:`${offset(vv?.offsetLeft)}px`, top:`${offset(vv?.offsetTop)}px`, right:'auto', bottom:'auto',
      width:`${width}px`, height:`${height}px`,
    };
    for (const [name, value] of Object.entries(values)) node.style.setProperty(name, value, 'important');
    node.style.setProperty('--wbs-batch-visible-height', `${height}px`);
  };
  const schedule = () => { if (!frame) frame = TOP.requestAnimationFrame(update); };
  const settle = () => {
    schedule();
    TOP.clearTimeout(settleTimer);
    settleTimer = TOP.setTimeout(schedule, 180);
  };
  const targets = [[TOP, 'resize'], [TOP, 'scroll'], [TOP, 'orientationchange'], [vv, 'resize'], [vv, 'scroll'], [node, 'focusin'], [node, 'focusout']];
  targets.forEach(([target, name]) => target?.addEventListener(name, settle, { passive:true }));
  update();
  batchViewportCleanup = () => {
    targets.forEach(([target, name]) => target?.removeEventListener(name, settle));
    if (frame) TOP.cancelAnimationFrame(frame);
    TOP.clearTimeout(settleTimer);
  };
}
function say(text,sticky=false) {
  TOP.clearTimeout(messageTimer); messageTimer=0;
  message = text;
  const node = overlay?.querySelector('[data-message]');
  if (node) { node.innerHTML = '<span>'+h(text)+'</span>'+button('dismiss-message','×','aria-label="关闭提示"'); node.hidden = !text; }
  if(text && !sticky)messageTimer=TOP.setTimeout(()=>say(''),3000);
}
function report(error) { console.warn('[世界书快照]', error); say(error.message || String(error),true); }
async function run(action) {
  if (busy) return;
  busy = true;
  const controls = [...(overlay?.querySelectorAll('button,input,select') || [])].map(node => [node, node.disabled]);
  controls.forEach(([node]) => { node.disabled = true; });
  overlay?.setAttribute('aria-busy', 'true');
  try { await action(); }
  catch (error) { report(error); try { render(); } catch (_) {} }
  finally { busy = false; controls.forEach(([node, disabled]) => { if (node.isConnected) node.disabled = disabled; }); overlay?.removeAttribute('aria-busy'); }
}
async function reconcileCatalogNames(names = null) {
  const current = (names || await helper('getWorldbookNames')()).map(String);
  nativeCatalogSignature = JSON.stringify(current);
  nativeCatalogNames = current;
  const result = await engine.reconcileBooks(current);
  if (result.changed && overlay && !busy && !draft && !editGroup && !renameId) {
    books = await catalog();
    await loadItems();
    render();
  }
  return { names: current, result };
}
async function refresh(full = false) {
  const current=character();
  books = await (full ? catalog() : current ? catalog('character',current.key) : catalog('names'));
  await engine.reconcileBooks(books.map(row => row.name));
}
function batchVisibleNames() {
  const query=batchQuery.trim().toLocaleLowerCase();
  return batchBooks.filter(row=>(!row.characters.length || batchBoundExpanded) && (!query || row.name.toLocaleLowerCase().includes(query))).map(row=>row.name);
}
function renderBatch(preserveScroll=false) {
  if(!batchOverlay)return;
  const currentBody=batchOverlay.querySelector('.pmm-wbs-body');
  const previousScroll=preserveScroll&&currentBody?currentBody.scrollTop:null;
  const rowMarkup=row=>`<button type="button" class="pmm-wbs-batch-row" data-batch-action="toggle" data-book="${h(row.name)}" data-book-title="${h(row.name.toLocaleLowerCase())}" role="checkbox" aria-checked="${batchSelected.has(row.name)}"><i class="pmm-wbs-batch-check fa-${batchSelected.has(row.name)?'solid fa-square-check':'regular fa-square'}"></i><span title="${h(row.name)}">${h(row.name)}${row.characters.length?`<small>角色：${h(row.characters.map(character=>character.name).join('、'))}</small>`:''}</span></button>`;
  const bound=batchBooks.filter(row=>row.characters.length),unbound=batchBooks.filter(row=>!row.characters.length);
  const openSection=`<section class="pmm-wbs-batch-section" data-batch-section="unbound"><div class="pmm-wbs-batch-section-title"><span>非角色绑定世界书</span><span>${unbound.length} 本</span></div>${unbound.map(rowMarkup).join('')}</section>`;
  const boundSection=`<section class="pmm-wbs-batch-section" data-batch-section="bound"><button type="button" class="pmm-wbs-batch-section-toggle" data-batch-action="toggle-bound" aria-expanded="${batchBoundExpanded}"><span>角色绑定世界书 · ${bound.length} 本</span><i class="fa-solid fa-chevron-down"></i></button><div class="pmm-wbs-batch-bound-list" ${batchBoundExpanded?'':'hidden'}>${bound.map(rowMarkup).join('')}</div></section>`;
  batchOverlay.innerHTML=`<section class="pmm-wbs-dialog pmm-wbs-batch-dialog" role="dialog" aria-modal="true" aria-label="批量管理世界书">
    <header class="pmm-wbs-head"><div><h2><i class="fa-solid fa-list-check"></i> 批量管理世界书</h2><p>搜索、多选并删除世界书</p></div><button type="button" class="pmm-wbs-icon" data-batch-action="close" aria-label="关闭"><i class="fa-solid fa-xmark"></i></button></header>
    <div class="pmm-wbs-body"><div class="pmm-wbs-batch-tools"><input class="pmm-wbs-batch-search" type="search" value="${h(batchQuery)}" placeholder="搜索世界书" aria-label="搜索世界书"><button type="button" class="pmm-wbs-batch-select-all" data-batch-action="select-all">全选</button></div>
      <div class="pmm-wbs-batch-list">${openSection}${boundSection}<div class="pmm-wbs-empty pmm-wbs-batch-empty" hidden>没有匹配的世界书</div></div></div>
    <footer class="pmm-wbs-foot"><small>已选择 ${batchSelected.size} 本；删除不可撤销</small><button type="button" data-batch-action="close">取消</button><button type="button" class="pmm-wbs-danger" data-batch-action="delete" ${batchSelected.size&&!batchBusy?'':'disabled'}>${batchBusy?'正在删除…':'批量删除'}</button></footer>
  </section>`;
  batchOverlay.setAttribute('aria-busy',String(batchBusy));
  filterBatchRows();
  if(previousScroll!==null)batchOverlay.querySelector('.pmm-wbs-body').scrollTop=previousScroll;
}
function updateBatchRow(name) {
  if(!batchOverlay)return;
  const selected=batchSelected.has(name);
  const row=batchOverlay.querySelector(`.pmm-wbs-batch-row[data-book="${CSS.escape(name)}"]`);
  if(!row)return;
  row.setAttribute('aria-checked',String(selected));
  const icon=row.querySelector('.pmm-wbs-batch-check');
  if(icon){icon.className='pmm-wbs-batch-check fa-'+(selected?'solid fa-square-check':'regular fa-square');}
}
function updateBatchFooter() {
  if(!batchOverlay)return;
  const foot=batchOverlay.querySelector('.pmm-wbs-foot small');
  if(foot)foot.textContent='已选择 '+batchSelected.size+' 本；删除不可撤销';
  const del=batchOverlay.querySelector('[data-batch-action="delete"]');
  if(del)del.disabled=!batchSelected.size||batchBusy;
  const names=batchVisibleNames(),all=names.length>0&&names.every(n=>batchSelected.has(n));
  const selectAll=batchOverlay.querySelector('[data-batch-action="select-all"]');
  if(selectAll){selectAll.disabled=!names.length;selectAll.textContent=all?'取消全选':'全选';}
}
function revealBatchBoundStart() {
  TOP.requestAnimationFrame(()=>{
    const body=batchOverlay?.querySelector('.pmm-wbs-body'),toggle=batchOverlay?.querySelector('[data-batch-action="toggle-bound"]');
    if(!body || !toggle || !batchBoundExpanded)return;
    body.scrollTop+=toggle.getBoundingClientRect().top-body.getBoundingClientRect().top-6;
  });
}
function filterBatchRows() {
  if(!batchOverlay)return;
  const query=batchQuery.trim().toLocaleLowerCase(),rows=[...batchOverlay.querySelectorAll('.pmm-wbs-batch-row')];
  let matches=0;
  for(const row of rows){const matched=!query||row.dataset.bookTitle.includes(query);row.hidden=!matched || (row.closest('[data-batch-section="bound"]')&&!batchBoundExpanded);if(matched)matches++;}
  const unbound=batchOverlay.querySelector('[data-batch-section="unbound"]'),bound=batchOverlay.querySelector('[data-batch-section="bound"]');
  if(unbound)unbound.hidden=![...unbound.querySelectorAll('.pmm-wbs-batch-row')].some(row=>!query||row.dataset.bookTitle.includes(query));
  if(bound)bound.hidden=![...bound.querySelectorAll('.pmm-wbs-batch-row')].some(row=>!query||row.dataset.bookTitle.includes(query));
  batchOverlay.querySelector('.pmm-wbs-batch-empty').hidden=matches!==0;
  const names=batchVisibleNames(),all=names.length>0&&names.every(name=>batchSelected.has(name));
  const selectAll=batchOverlay.querySelector('[data-batch-action="select-all"]');
  if(selectAll){selectAll.disabled=!names.length;selectAll.textContent=all?'取消全选':'全选';}
}
function closeBatch() {
  batchViewportCleanup?.(); batchViewportCleanup=null;
  batchOverlay?.remove(); batchOverlay=null; batchBooks=[]; batchNames=[]; batchSelected.clear(); batchQuery=''; batchBusy=false;batchBoundExpanded=false;
}
async function deleteBatchSelection() {
  if(batchBusy || !batchSelected.size)return;
  const names=[...batchSelected];
  if(['top','bottom'].some(side=>TOP[STITCH]?.state?.[side]?.dirty && names.includes(TOP[STITCH].state[side].name))) {
    TOP.toastr?.warning?.('所选世界书中有尚未保存的编辑，请先保存或取消编辑'); return;
  }
  const preview=names.slice(0,8).join('、')+(names.length>8?` 等 ${names.length} 本`:'');
  if(!TOP.confirm(`确定删除：${preview}？\n\n删除不可撤销；它们也会从世界书分组、分组默认方案和命名快照中移除。`))return;
  const remove=optionalHelper('deleteWorldbook');
  if(!remove) { TOP.toastr?.error?.('当前酒馆助手缺少批量删除世界书接口，请更新酒馆助手'); return; }
  batchBusy=true;renderBatch(true);
  const failed=[];
  try {
    for(const name of names) {
      try { if(await remove(name)===false)failed.push(name); }
      catch(_) { failed.push(name); }
    }
    batchBooks=await catalog();batchNames=batchBooks.map(row=>row.name);
    await reconcileCatalogNames(batchNames);
    batchSelected=new Set(failed.filter(name=>batchNames.includes(name)));
    if(failed.length) TOP.toastr?.warning?.(`有 ${failed.length} 本世界书删除失败：${failed.join('、')}`);
    else TOP.toastr?.success?.(`已删除 ${names.length} 本世界书，并同步清理分组引用`);
  } finally { batchBusy=false; renderBatch(true); }
}
async function openBatch() {
  if(batchOverlay)return;
  batchBooks=await catalog();batchNames=batchBooks.map(row=>row.name);batchSelected.clear();batchQuery='';batchBoundExpanded=false;
  batchOverlay=DOC.createElement('div');batchOverlay.className='pmm-wbs-overlay pmm-wbs-batch-overlay';
  batchOverlay.addEventListener('input',event=>{ if(event.target.matches('.pmm-wbs-batch-search')) { batchQuery=event.target.value;filterBatchRows(); } });
  batchOverlay.addEventListener('click',event=>{
    const target=event.target.closest('[data-batch-action]');if(!target || target.disabled)return;
    event.preventDefault();event.stopPropagation();
    const action=target.dataset.batchAction;
    if(action==='close')closeBatch();
    else if(action==='toggle') { const name=target.dataset.book;batchSelected.has(name)?batchSelected.delete(name):batchSelected.add(name);updateBatchRow(name);updateBatchFooter(); }
    else if(action==='toggle-bound') {
      const expanding=!batchBoundExpanded;batchBoundExpanded=expanding;
      if(!batchBoundExpanded)for(const row of batchBooks.filter(row=>row.characters.length))batchSelected.delete(row.name);
      renderBatch(!expanding);if(expanding)revealBatchBoundStart();
    }
    else if(action==='select-all') { const visible=batchVisibleNames(),all=visible.length&&visible.every(name=>batchSelected.has(name));for(const name of visible){all?batchSelected.delete(name):batchSelected.add(name);updateBatchRow(name);}updateBatchFooter(); }
    else if(action==='delete')void deleteBatchSelection();
  });
  batchOverlay.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();closeBatch();}});
  DOC.body.append(batchOverlay);theme(batchOverlay);bindBatchViewport();renderBatch();
}
function makeNativeWorldbookButton(action,label,iconName) {
  const button=DOC.createElement('button');button.type='button';
  button.className=`menu_button menu_button_icon interactable ${NATIVE_ACTION_CLASS}`;
  button.dataset.pmmNativeWorldbookAction=action;button.title=label;button.setAttribute('aria-label',label);
  button.innerHTML=`<i class="fa-solid ${iconName}" aria-hidden="true"></i>`;
  for(const type of ['pointerdown','mousedown','touchstart'])button.addEventListener(type,event=>event.stopPropagation(),{passive:true});
  button.addEventListener('click',event=>{
    event.preventDefault();event.stopPropagation();
    if(action==='snapshot'){closeBatch();void open('global','',true);}
    else void openBatch();
  });
  return button;
}
function syncNativeWorldbookTools() {
  nativeFrame=0;
  const root=DOC.getElementById('WorldInfo');
  if(!root)return;
  if(root!==nativeRoot) {
    nativeRoot=root;nativeObserver?.disconnect();
    nativeObserver=new TOP.MutationObserver(scheduleNativeWorldbookSync);
    nativeObserver.observe(root,{childList:true,subtree:true});
    nativeDiscoveryObserver?.disconnect();nativeDiscoveryObserver=null;
  }
  const heading=[...root.children].find(node=>node.matches?.('.flex-container.alignitemscenter'));
  if(heading) {
    let actions=heading.querySelector('.pmm-native-worldbook-actions');
    if(!actions){actions=DOC.createElement('div');actions.className='pmm-native-worldbook-actions';heading.append(actions);}
    if(!actions.querySelector('[data-pmm-native-worldbook-action="batch"]'))actions.append(makeNativeWorldbookButton('batch','批量管理世界书','fa-list-check'));
    if(!actions.querySelector('[data-pmm-native-worldbook-action="snapshot"]'))actions.append(makeNativeWorldbookButton('snapshot','全局世界书快照','fa-camera'));
  }
  try {
    const names=helper('getWorldbookNames')().map(String),signature=JSON.stringify(names);
    if(signature!==nativeCatalogSignature) {
      const shouldReconcile=!nativeCatalogSignature || names.length<nativeCatalogNames.length;
      nativeCatalogSignature=signature;nativeCatalogNames=names;
      if(shouldReconcile)void reconcileCatalogNames(names).catch(error=>console.warn('[世界书快照] 同步已删除世界书失败',error));
    }
  } catch(_) {}
}
function scheduleNativeWorldbookSync() {
  if(nativeFrame || disposed)return;
  nativeFrame=TOP.requestAnimationFrame(syncNativeWorldbookTools);
}
function installNativeWorldbookTools() {
  syncNativeWorldbookTools();
  if(nativeRoot)return;
  nativeDiscoveryObserver=new TOP.MutationObserver(scheduleNativeWorldbookSync);
  nativeDiscoveryObserver.observe(DOC.documentElement,{childList:true,subtree:true});
}
function button(action, label, extra = '') {
  const glyph={'edit-group':'edit','manage-snapshots':'camera','edit-snapshot':'edit',rename:'edit','delete-group':'trash',delete:'trash'}[action];
  return `<button type="button" data-wbs="${action}" ${extra}>${glyph?icon(glyph):''}${label}</button>`;
}
function scopeOwner() { return page === 'character' ? character()?.key || '' : book; }
function bundleScope() { return page === 'character' ? 'character' : 'group'; }
async function beginNewSnapshot() {
  if (TOP[PRESET]?.isCapturing?.()) throw new Error('请先完成预设快照');
  say('正在读取世界书开关…',true); engine.setCapturing(true);
  try {
    render();
    await new Promise(resolve=>scheduleBookEntryRender(resolve));
    const scope=bundleScope(),owner=scopeOwner();
    const captured=await engine.captureBundle(scope,owner);
    const label=page==='character'?character().name:engine.read().groups.find(g=>g.id===owner)?.name;
    if(!label)throw new Error('分组已不存在');
    draft={...captured,scope,owner,name:`${label} 开关`,expanded:Object.fromEntries(Object.keys(captured.data).map(name=>[name,Object.keys(captured.data).length===1])),queries:{},previews:{}};
    say('');
  } catch(error) { engine.setCapturing(false); await engine.transition(); throw error; }
}
function sourceMarkup() {
  return '<h3>选择世界书分组</h3>' + engine.read().groups.map(g => button('choose', h(g.name), 'class="pmm-wbs-source" data-book="'+h(g.id)+'"')).join('')
    + button('back-sources','返回');
}
function currentCharacterSnapshotId(store=engine.read()) {
  const key=JSON.stringify([character()?.key || '',chat() || '']);
  return store.session?.bundle && store.session.key===key ? String(store.session.chosen || '') : '';
}
function snapshotMarkup() {
  const store=engine.read(), owner=scopeOwner(), scope=bundleScope(), c=character();
  if (page==='character' && (!c || !chat())) return '<div class="pmm-wbs-empty"><strong>进入角色聊天后使用</strong><small>这里只显示当前角色绑定的世界书，不再浏览全部角色。</small></div>';
  const ownerGroup=page==='global'?store.groups.find(g=>g.id===owner):null;
  const names=page==='character' ? books.filter(row=>row.characters.some(c=>c.key===owner)).map(row=>row.name)
    : ownerGroup?.books || [];
  const list=store.snapshots.filter(s=>s.bundle && s.scope===scope && s.owner===owner);
  const baseline=store.defaults?.find(s=>s.scope===scope && s.owner===owner);
  const label=page==='character' ? c.name : ownerGroup?.name;
  if(page==='global' && !ownerGroup) return button('back-groups',icon('back')+'<span>返回世界书分组</span>','class="pmm-wbs-source pmm-wbs-snapshot-back"')+'<p class="pmm-wbs-empty">该分组已不存在</p>';
  if(page==='character') {
    const currentId=currentCharacterSnapshotId(store);
    const defaultMarkup=baseline?'<section class="pmm-switch-snapshot-default is-saved pmm-wbs-character-default"><div class="pmm-switch-snapshot-default-copy"><div><i class="fa-solid fa-house"></i>默认方案</div><small>'+Object.keys(baseline.books).length+' 本世界书</small></div><div class="pmm-switch-snapshot-default-actions">'
      +button('restore-default','<i class="fa-solid fa-rotate-left"></i>恢复默认')+button('update-default','<i class="fa-solid fa-rotate"></i>更新默认')+button('reset-bundle',icon('trash'),'class="pmm-switch-snapshot-reset-all" title="重置当前角色的世界书快照" aria-label="重置当前角色的世界书快照"')+'</div></section>':'';
    const rows=list.map(item=>{
      const attrs='data-id="'+h(item.id)+'"',count=Object.values(item.books).reduce((n,s)=>n+Object.keys(s).length,0),bound=item.chat===chat(),current=currentId===item.id;
      return '<article class="pmm-switch-snapshot-row pmm-wbs-character-snapshot"><div class="pmm-switch-snapshot-copy"><div class="pmm-switch-snapshot-name">'+h(item.name)+'</div><div class="pmm-switch-snapshot-meta">'+Object.keys(item.books).length+' 本 · '+count+' 条</div></div><div class="pmm-switch-snapshot-bindings"><div class="pmm-switch-snapshot-locks">'
        +button('bind','<i class="fa-solid '+(bound?'fa-lock':'fa-lock-open')+'"></i><span>聊天</span>',attrs+' class="pmm-switch-snapshot-lock is-chat'+(bound?' is-bound':'')+'" aria-pressed="'+bound+'"')+'</div></div><div class="pmm-switch-snapshot-actions">'
        +button('apply',current?'当前':'应用',attrs+(current?' class="is-current" disabled aria-current="true" aria-label="'+h(item.name)+'，当前正在应用"':' aria-current="false"'))+button('menu','<i class="fa-solid fa-ellipsis"></i>',attrs+' class="pmm-switch-snapshot-more" aria-label="更多操作"')+'</div>'
        +(menuId===item.id?'<div class="pmm-wbs-menu">'+button('edit-snapshot','编辑开关',attrs)+button('rename','改名',attrs)+button('delete','删除',attrs)+'</div>':'')+'</article>';
    }).join('');
    return defaultMarkup+'<div class="pmm-switch-snapshot-create">'+button('new','<i class="fa-solid fa-plus"></i>新建开关快照',names.length?'':'disabled')+'</div>'
      +(names.length?'<div class="pmm-wbs-character-context">'+h(names.join('、'))+'</div>':'<p class="pmm-wbs-empty">当前角色没有绑定世界书</p>')
      +'<div class="pmm-switch-snapshot-list pmm-wbs-character-list">'+rows+(!list.length&&names.length?'<div class="pmm-wbs-empty"><strong>还没有快照</strong><small>第一次新建前会自动保存默认开关。</small></div>':'')+'</div>';
  }
  return button('back-groups',icon('back')+'<span>'+h(label)+' · 分组快照</span>','class="pmm-wbs-source pmm-wbs-snapshot-back"')
    + button('new','＋ 新快照','class="pmm-wbs-source" '+(names.length?'':'disabled'))
    + (names.length ? '<small>'+h(names.join('、'))+'</small>' : '<p class="pmm-wbs-empty">请先创建并选择一个世界书分组</p>')
    + (baseline ? '<div class="pmm-wbs-row pmm-wbs-default"><div class="pmm-wbs-row-main"><div class="pmm-wbs-copy"><strong>默认方案</strong><small>'+Object.keys(baseline.books).length+' 本世界书</small></div><div class="pmm-wbs-default-actions">'+button('update-default','更新默认')+button('delete-group-default',icon('trash'),'class="pmm-switch-snapshot-reset-all" title="删除分组默认方案" aria-label="删除分组默认方案"')+'</div></div></div>' : '')
    + list.map(item=>{
      const attrs='data-id="'+h(item.id)+'"';
      const count=Object.values(item.books).reduce((n,s)=>n+Object.keys(s).length,0);
      return '<article class="pmm-wbs-row"><div class="pmm-wbs-row-main"><div class="pmm-wbs-copy"><strong>'+h(item.name)+'</strong><small>'+Object.keys(item.books).length+' 本 · '+count+' 条</small></div>'
        +button('menu','⋯',attrs+' aria-label="更多操作"')+'</div>'
        +(menuId===item.id?'<div class="pmm-wbs-menu">'+button('edit-snapshot','编辑开关',attrs)+button('rename','改名',attrs)+button('delete','删除',attrs)+'</div>':'')+'</article>';
    }).join('')
    +(!list.length && names.length?'<div class="pmm-wbs-empty"><strong>还没有快照</strong><small>第一次新建前会自动保存默认开关。</small></div>':'')
    +(store.snapshots.some(s=>!s.bundle)?'<small>旧版单书快照仍保留在本地，未自动合并到新方案。</small>':'');
}
function groupMarkup() {
  const store=engine.read();
  return button('new-group','＋ 新建分组','class="pmm-wbs-source"')+store.groups.map(group=>{
    const attrs='data-id="'+h(group.id)+'"';
    const plans=store.snapshots.filter(s=>s.bundle && s.scope==='group' && s.owner===group.id);
    return '<article class="pmm-wbs-row"><div class="pmm-wbs-row-main"><div class="pmm-wbs-copy"><strong>'+h(group.name)+'</strong><small>'+h(group.books.join('、'))+'</small>'
      +'<label class="pmm-wbs-plan-label">方案：<select class="pmm-wbs-plan" data-group-plan="'+h(group.id)+'" aria-label="'+h(group.name)+'方案"><option value="">默认</option>'+plans.map(s=>'<option value="'+h(s.id)+'" '+(group.snapshot===s.id?'selected':'')+'>'+h(s.name)+'</option>').join('')+'<option value="'+NEW_GROUP_SNAPSHOT+'">＋ 新建分组快照</option></select></label></div>'
      +button('toggle-group','<span></span>',attrs+' class="pmm-wbs-toggle" role="switch" aria-label="'+h(group.name)+'开关" aria-checked="'+group.enabled+'"')
      +button('group-menu','⋯',attrs+' aria-label="分组更多操作"')+'</div>'
      +(menuId===group.id?'<div class="pmm-wbs-menu">'+button('edit-group','编辑分组',attrs)+button('manage-snapshots','管理分组快照',attrs)+button('delete-group','删除分组',attrs)+'</div>':'')+'</article>';
  }).join('');
}
const BOOK_ENTRY_INITIAL_BATCH_SIZE=2;
const BOOK_ENTRY_RENDER_BATCH_SIZE=8;
let bookEntryRenderId=0;
function orderedBookEntries(data) {
  return Object.values(data?.entries||{}).sort((a,b)=>Number(a.displayIndex??a.uid)-Number(b.displayIndex??b.uid));
}
function bookEntriesMarkup(name, entries) {
  return entries.map(entry=>{
    const title=entry.comment||entry.key?.[0]||'条目 '+entry.uid,shown=!!draft.previews?.[name]?.[String(entry.uid)];
    return '<div class="pmm-wbs-entry-block" data-entry-title="'+h(String(title).toLocaleLowerCase())+'"><div class="pmm-wbs-entry">'+button('preview-entry',icon('arrow')+'<span>'+h(title)+'</span>','class="pmm-wbs-entry-title" data-preview-entry data-preview-book="'+h(name)+'" data-preview-uid="'+h(entry.uid)+'" aria-expanded="'+shown+'"')+'<label class="pmm-wbs-entry-switch"><input class="pmm-wbs-entry-switch-input" type="checkbox" data-toggle="'+h(entry.uid)+'" data-toggle-book="'+h(name)+'" aria-label="'+h(title)+'" style="opacity:0!important" '+(entry.disable?'':'checked')+'><span class="pmm-wbs-entry-switch-track" aria-hidden="true"></span></label></div><div class="pmm-wbs-entry-preview" hidden></div></div>';
  }).join('');
}
function scheduleBookEntryRender(callback) {
  if(typeof TOP.requestAnimationFrame==='function')TOP.requestAnimationFrame(callback);
  else TOP.setTimeout(callback,16);
}
function ensureBookEntries(bookBlock) {
  if(!draft || !bookBlock)return;
  const name=bookBlock.dataset.draftBook;
  const container=bookBlock.querySelector('.pmm-wbs-book-entries');
  const data=draft.data[name];
  if(!container || !data || container.dataset.rendered || container.dataset.rendering)return;
  const entries=orderedBookEntries(data),renderId=String(++bookEntryRenderId);
  let offset=Math.min(Number(container.dataset.renderedCount)||0,entries.length);
  container.dataset.rendering=renderId;
  const stop=()=>{if(container.dataset.rendering===renderId)delete container.dataset.rendering;};
  const renderBatch=batchSize=>{
    if(!draft || draft.data[name]!==data || !overlay?.contains(container) || container.dataset.rendering!==renderId){stop();return;}
    if(!draft.expanded[name]){stop();return;}
    if(!entries.length)container.insertAdjacentHTML('beforeend','<small>这本世界书暂无条目</small>');
    else {
      const next=Math.min(offset+batchSize,entries.length);
      container.insertAdjacentHTML('beforeend',bookEntriesMarkup(name,entries.slice(offset,next)));
      offset=next;container.dataset.renderedCount=String(offset);
    }
    if(offset>=entries.length) {
      container.dataset.rendered='1';stop();filterDraft(name);return;
    }
    filterDraft(name);scheduleBookEntryRender(()=>renderBatch(BOOK_ENTRY_RENDER_BATCH_SIZE));
  };
  renderBatch(BOOK_ENTRY_INITIAL_BATCH_SIZE);
}
function draftMarkup() {
  return '<small>共 '+Object.keys(draft.data).length+' 本世界书 · 点击书名展开或收起</small><div data-entries>'
    +Object.entries(draft.data).map(([name,data])=>{
      const isOpen=!!draft.expanded[name];
      return '<section class="pmm-wbs-book" data-draft-book="'+h(name)+'" data-open="'+isOpen+'"><button type="button" class="pmm-wbs-book-head" data-wbs="toggle-draft-book" data-book="'+h(name)+'" aria-expanded="'+isOpen+'">'+icon('arrow')+'<span class="pmm-wbs-book-title">'+h(name)+'</span><small>'+Object.keys(data.entries).length+' 条</small></button><div class="pmm-wbs-book-entries" '+(isOpen?'':'hidden')+'><input class="pmm-wbs-book-search" type="search" data-filter-book="'+h(name)+'" value="'+h(draft.queries?.[name]||'')+'" placeholder="搜索条目名称" aria-label="搜索 '+h(name)+' 的条目"></div></section>';
    }).join('')+'</div>';
}
function groupEditorMarkup() {
  const rows = books.filter(row => !row.characters.length);
  return `<div class="pmm-wbs-group-editor"><div class="pmm-wbs-group-editor-head"><small>可选择尚未挂全局的世界书，开启分组时一起挂载。</small><input class="pmm-wbs-group-search" type="search" data-group-filter value="${h(groupQuery)}" placeholder="搜索世界书" aria-label="搜索可选世界书"></div><div class="pmm-wbs-group-editor-list">${rows.map(row => `<label class="pmm-wbs-entry" data-group-book-row data-group-book-title="${h(row.name.toLocaleLowerCase())}"><span>${h(row.name)}${row.global ? '<small>已挂全局</small>' : ''}</span><input type="checkbox" data-group-book="${h(row.name)}" ${editGroup.books.includes(row.name) ? 'checked' : ''}></label>`).join('')}</div></div>`;
}
function filterGroupBooks() {
  if(!editGroup || !overlay)return;
  const query=groupQuery.trim().toLocaleLowerCase();
  for(const row of overlay.querySelectorAll('[data-group-book-row]'))row.hidden=!row.dataset.groupBookTitle.includes(query);
}
function syncGroupSave() {
  const save=overlay?.querySelector('[data-wbs="save-group"]');
  if(!save || !editGroup)return;
  save.disabled=!editGroup.books.length;
  save.title=save.disabled?'请至少选择一本世界书':'';
}
function sizeGroupPlanSelects() {
  const selects=overlay?.querySelectorAll('[data-group-plan]');
  if(!selects?.length)return;
  const probe=DOC.createElement('span');
  probe.style.cssText='position:fixed;left:-10000px;top:0;visibility:hidden;white-space:pre;pointer-events:none';
  overlay.append(probe);
  const max=Math.min(210,(TOP.visualViewport?.width || TOP.innerWidth)*.55);
  for(const select of selects) {
    const text=select.selectedOptions[0]?.textContent || '默认',css=TOP.getComputedStyle(select);
    probe.style.font=css.font; probe.textContent=text;
    select.style.width=Math.max(58,Math.min(max,Math.ceil(probe.getBoundingClientRect().width)+32))+'px';
    select.title=text;
  }
  probe.remove();
}
function render() {
  if (!overlay) return;
  const editing = draft || editGroup || renameId;
  if(!editing)rememberWorldTab({page,section,book});
  const rename = renameId && engine.read().snapshots.find(item => item.id === renameId);
  const content = draft ? draftMarkup() : editGroup ? groupEditorMarkup() : rename
    ? `<label>快照名称<input type="text" data-rename value="${h(rename.name)}" maxlength="100"></label>`
    : picker ? sourceMarkup() : section === 'groups' ? groupMarkup() : snapshotMarkup();
  overlay.innerHTML = `<section class="pmm-wbs-dialog pmm-switch-snapshot-dialog${editing ? ' is-editing' : ''}" role="dialog" aria-modal="true" aria-label="世界书快照">
    <header class="pmm-wbs-head pmm-switch-snapshot-head"><div><h2><i class="fa-solid fa-camera"></i>${draft ? '调整开关' : editGroup ? '世界书分组' : '世界书快照'}</h2><p>${h(character()?.name || '酒馆主页')}</p></div>${button('close', '<i class="fa-solid fa-xmark"></i>', 'class="pmm-wbs-icon pmm-switch-snapshot-close" aria-label="关闭"')}</header>
    ${tabs(page, !!editing)}<div class="pmm-wbs-message" data-message role="status" ${message ? '' : 'hidden'}><span>${h(message)}</span>${button('dismiss-message','×','aria-label="关闭提示"')}</div>
    <div class="pmm-wbs-body${page==='character'&&!editing&&!picker?' is-character-snapshots':''}${draft?' is-draft':''}${page==='global'&&section==='groups'&&!editing&&!picker?' is-group-home':''}${editGroup?' is-group-editor':''}">${content}</div>
    <footer class="pmm-wbs-foot"><small>${draft ? (page==='character'?'只保存开关；聊天锁或“应用”才会应用。':'保存方案不挂载世界书；请在分组中选用。') : page==='global' ? '可一键全局挂载世界书分组；也可为分组世界书创建快照。' : '聊天锁自动应用 · 返回主页恢复进入前状态'}</small>${editing ? button('cancel-edit', '取消') + button(draft ? 'save-draft' : editGroup ? 'save-group' : 'save-rename', '保存', 'class="pmm-wbs-primary"') : ''}</footer>
    </section>`;
  filterDraft();
  filterGroupBooks();
  syncGroupSave();
  sizeGroupPlanSelects();
  positionMenu();
  if(draft)for(const bookBlock of overlay.querySelectorAll('[data-draft-book][data-open="true"]'))ensureBookEntries(bookBlock);
}
function positionMenu() {
  const menu=overlay?.querySelector('.pmm-wbs-menu');
  const trigger=menu?.parentElement?.querySelector('[data-wbs="menu"],[data-wbs="group-menu"]');
  if(!menu || !trigger)return;
  menu.style.cssText='position:fixed;left:-10000px;top:0;visibility:hidden';
  overlay.append(menu);
  TOP.requestAnimationFrame(()=>{
    if(!menu.isConnected || !trigger.isConnected)return;
    const r=trigger.getBoundingClientRect(),d=overlay.querySelector('.pmm-wbs-dialog').getBoundingClientRect();
    const row=trigger.closest('.pmm-wbs-row-main,.pmm-switch-snapshot-row')?.getBoundingClientRect() || r;
    const bottom=overlay.querySelector('footer').getBoundingClientRect().top;
    const h=menu.scrollHeight,w=menu.getBoundingClientRect().width;
    const up=bottom-row.bottom-6<h && row.top-d.top>bottom-row.bottom;
    menu.style.left=Math.max(d.left+8,Math.min(r.right-w,d.right-w-8))+'px';
    menu.style.top=Math.max(d.top+8,Math.min(up?row.top-h-6:row.bottom+6,bottom-h-8))+'px';
    menu.style.visibility='visible';menu.dataset.direction=up?'up':'down';
  });
}
async function loadItems() {
  items = [];
}
async function open(scope = 'character', selected = '', restore = true) {
  if (disposed) return;
  if (TOP[PRESET]?.isCapturing?.()) { TOP.toastr?.info?.('请先保存或取消预设快照'); return; }
  if (overlay) return;
  const last=restore?lastWorldTab():null;
  TOP[PRESET]?.close?.();
  page=last?.page || (scope==='global'?'global':'character');
  section=last?.page===page && ['groups','snapshots'].includes(last.section)?last.section:page==='global'?'groups':'snapshots';
  book=page==='global' && last?.page===page?String(last.book||''):'';message='';picker=false;pickerReturnBook='';
  if(page==='global' && section==='snapshots' && !engine.read().groups.some(group=>group.id===book)) { section='groups'; book=''; }
  lastFocus = DOC.activeElement;
  overlay = DOC.createElement('div'); overlay.className = 'pmm-wbs-overlay pmm-switch-snapshot-overlay';
  overlay.addEventListener('click', onClick);
  overlay.addEventListener('input', onInput);
  overlay.addEventListener('change', onChange);
  overlay.addEventListener('scroll', event=>{
    if(menuId && event.target.classList?.contains('pmm-wbs-body')) {
      menuId='';overlay.querySelectorAll('.pmm-wbs-menu').forEach(node=>node.remove());
    }
  },true);
  overlay.addEventListener('keydown', onKey);
  DOC.body.append(overlay); theme(); watchTheme(); bindViewport(); render();
  overlay.querySelector('[data-wbs="close"]')?.focus({ preventScroll: true });
  await run(async () => {
    await refresh();
    await loadItems(); render();
  });
}
async function cancelEdit() {
  const returnToGroups=page==='global' && section==='groups' && draft?.scope==='group';
  draft = null; editGroup = null; groupQuery=''; renameId = ''; engine.setCapturing(false);
  if(returnToGroups)book='';
  await engine.transition();
  await refresh(); await loadItems(); render();
}
async function close(force = false) {
  if (!force && busy) return;
  if (!force && (draft || editGroup || renameId) && !TOP.confirm('放弃尚未保存的编辑并关闭？')) return;
  draft = null; editGroup = null; groupQuery=''; renameId = ''; menuId = '';
  TOP.clearTimeout(messageTimer);messageTimer=0;message='';
  engine.setCapturing(false);
  viewportCleanup?.(); viewportCleanup = null;
  themeCleanup?.(); themeCleanup = null;
  overlay?.remove(); overlay = null;
  lastFocus?.isConnected && lastFocus.focus?.({ preventScroll: true });
  if (!force) try { await engine.transition(); } catch (error) { TOP.toastr?.warning?.(error.message); }
}
function onInput(event) {
  if (editGroup && event.target.matches('[data-group-filter]')) { groupQuery=event.target.value; filterGroupBooks(); }
  if (draft && event.target.matches('[data-filter-book]')) {
    draft.queries ||= {};
    draft.queries[event.target.dataset.filterBook]=event.target.value;
    filterDraft(event.target.dataset.filterBook);
  }
}
function filterDraft(onlyBook='') {
  if(!draft || !overlay) return;
  for(const block of overlay.querySelectorAll('[data-draft-book]')) {
    const name=block.dataset.draftBook;
    if(onlyBook && name!==onlyBook)continue;
    const query=(draft.queries?.[name]||'').trim().toLocaleLowerCase();
    for(const row of block.querySelectorAll('[data-entry-title]')) {
      row.hidden=!row.dataset.entryTitle.includes(query);
    }
  }
}
function onChange(event) {
  if(event.target.matches('[data-group-plan]')) {
    if(busy)return;
    const groupId=event.target.dataset.groupPlan,value=event.target.value;
    if(value===NEW_GROUP_SNAPSHOT) {
      event.target.value=engine.read().groups.find(group=>group.id===groupId)?.snapshot || '';
      void run(async()=>{
        say(''); book=groupId; section='groups'; picker=false; pickerReturnBook=''; menuId='';
        await beginNewSnapshot(); render();
      });
      return;
    }
    void run(async()=>{
      await conflictAction(force=>engine.selectGroupPlan(groupId,value,force));
      say(engine.read().groups.find(g=>g.id===groupId)?.enabled?'分组方案已应用':'分组方案已选择；开启时生效');
      render();
    });
    return;
  }
  if (draft && event.target.matches('[data-toggle]')) {
    const entry = Object.values(draft.data[event.target.dataset.toggleBook]?.entries || {}).find(entry => String(entry.uid) === event.target.dataset.toggle);
    if (entry) entry.disable = !event.target.checked;
  }
  if (editGroup && event.target.matches('[data-group-book]')) {
    const name = event.target.dataset.groupBook;
    editGroup.books = editGroup.books.filter(book => book !== name);
    if (event.target.checked) editGroup.books.push(name);
    syncGroupSave();
  }
}
function onKey(event) {
  if(event.key==='Escape' && event.target.matches('select'))return;
  if (event.key === 'Escape') { event.stopPropagation(); void close(); }
  if (event.key !== 'Tab') return;
  const nodes = [...overlay.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')].filter(node => node.getClientRects().length);
  const first = nodes[0], last = nodes.at(-1);
  if (event.shiftKey && DOC.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && DOC.activeElement === last) { event.preventDefault(); first?.focus(); }
}
function onClick(event) {
  if(menuId && !event.target.closest('.pmm-wbs-menu,[data-wbs="menu"],[data-wbs="group-menu"]')) {
    menuId='';overlay.querySelectorAll('.pmm-wbs-menu').forEach(node=>node.remove());
  }
  const target = event.target.closest('button');
  if (!target || target.disabled || busy) return;
  const action = target.dataset.wbs, id = target.dataset.id;
  if(action==='toggle-draft-book' && draft) {
    event.preventDefault();
    const name=target.dataset.book,bookBlock=target.closest('[data-draft-book]');
    const expanded=!draft.expanded[name];draft.expanded[name]=expanded;
    target.setAttribute('aria-expanded',String(expanded));
    if(bookBlock)bookBlock.dataset.open=String(expanded);
    const entries=bookBlock?.querySelector('.pmm-wbs-book-entries');
    if(entries)entries.hidden=!expanded;
    if(expanded)ensureBookEntries(bookBlock);
    return;
  }
  if(action==='preview-entry' && draft) {
    const name=target.dataset.previewBook,uid=target.dataset.previewUid;
    draft.previews ||= {}; draft.previews[name] ||= {};
    const shown=!draft.previews[name][uid]; draft.previews[name][uid]=shown;
    target.setAttribute('aria-expanded',String(shown));
    const preview=target.closest('.pmm-wbs-entry-block')?.querySelector('.pmm-wbs-entry-preview');
    if(preview) {
      if(shown && !preview.dataset.loaded) {
        const entry=Object.values(draft.data[name]?.entries||{}).find(e=>String(e.uid)===uid);
        const content=String(entry?.content??'');
        preview.innerHTML='<small>当前世界书正文（只读）</small><div class="pmm-wbs-entry-preview-content">'+h(content.trim()?content:'（正文为空）')+'</div>';
        preview.dataset.loaded='1';
      }
      preview.hidden=!shown;
    }
    return;
  }
  if (action === 'close') { void close(); return; }
  if (action === 'dismiss-message') { say(''); return; }
  if(['choose','sources','back-sources','snapshots','groups','back-groups','manage-snapshots'].includes(action))say('');
  void run(async () => {
    if (target.dataset.hubTab) {
      if (draft || editGroup || renameId) return;
      if (!['character','global'].includes(target.dataset.hubTab)) return;
      say('');
      page = target.dataset.hubTab; book = ''; pickerReturnBook=''; menuId = ''; section = page === 'global' ? 'groups' : 'snapshots'; picker = false; items = [];
    } else if (action === 'choose') {
      book = target.dataset.book; pickerReturnBook=''; section = 'snapshots'; picker = false;
    } else if (action === 'sources') { pickerReturnBook=book; picker = true; }
    else if (action === 'back-sources') { book=pickerReturnBook; pickerReturnBook=''; picker = false; }
    else if (action === 'manage-snapshots') { book=id; section='snapshots'; picker=false; pickerReturnBook=''; menuId=''; }
    else if (action === 'back-groups') { section='groups'; book=''; picker=false; pickerReturnBook=''; menuId=''; }
    else if (action === 'snapshots' || action === 'groups') { section = action; book=''; pickerReturnBook=''; picker = false; }
    else if (action === 'new') await beginNewSnapshot();
    else if (action === 'edit-snapshot') {
      engine.setCapturing(true);say('正在读取世界书开关…',true);
      try {
        render();
        await new Promise(resolve=>scheduleBookEntryRender(resolve));
        const captured=await engine.editBundle(id);
        draft={...captured,expanded:Object.fromEntries(Object.keys(captured.data).map(name=>[name,Object.keys(captured.data).length===1])),queries:{},previews:{}};
        say('');
      } catch(error) { engine.setCapturing(false);throw error; }
    } else if (action === 'save-draft') {
      const editingDraft = draft;
      const name = await requestSnapshotName(overlay, draft.name);
      if (name === null || draft !== editingDraft) return;
      draft.name = name;
      const returnToGroups=page==='global' && section==='groups' && draft.scope==='group';
      const editing=!!draft.id;
      if(editing) {
        const active=engine.read().groups.some(g=>g.enabled && g.snapshot===draft.id);
        const sync=active && TOP.confirm('该快照正被开启的分组选用。确定同步应用修改？取消则只保存方案，不改当前开关。');
        await conflictAction(force=>engine.updateBundle(draft,sync,force));
      } else await engine.createBundle(draft);
      draft = null; engine.setCapturing(false); if(returnToGroups)book=''; await engine.transition(); say(editing?'快照修改已保存':page==='character'?'快照已保存，请手动应用或绑定当前聊天':'分组快照已保存，请在分组中选择方案');
    } else if (action === 'cancel-edit') { await cancelEdit(); return; }
    else if (action === 'apply') { await engine.applyBundle(id); say('已应用快照'); }
    else if (action === 'restore-default') { await engine.applyBundle('',bundleScope(),scopeOwner()); say('已恢复默认方案'); }
    else if (action === 'update-default') { if(TOP.confirm('以当前世界书开关覆盖默认方案？')) { await engine.updateDefault(bundleScope(),scopeOwner()); say('默认已更新'); } }
    else if (action === 'delete-group-default') {
      const group=engine.read().groups.find(group=>group.id===book);
      if(group?.enabled) { say('请先关闭该分组，再删除默认方案'); return; }
      if(TOP.confirm('删除该分组保存的默认方案？\n\n不会修改世界书内容或当前开关；下次开启分组或新建快照时会自动重新生成。')) {
        await engine.removeDefault('group',book); say('分组默认方案已删除');
      }
    }
    else if (action === 'reset-bundle') {
      const count=engine.read().snapshots.filter(s=>s.bundle && s.scope==='character' && s.owner===scopeOwner()).length;
      if(TOP.confirm(`确定重置当前角色的世界书快照吗？\n\n将恢复默认并删除默认方案和 ${count} 个快照，删除后不可撤销。`)) {
        await engine.resetBundle('character',scopeOwner());
        say('当前角色的世界书快照已重置');
      }
    }
    else if (action === 'menu') menuId = menuId === id ? '' : id;
    else if (action === 'rename') renameId = id;
    else if (action === 'save-rename') { await engine.rename(renameId, overlay.querySelector('[data-rename]').value); renameId = ''; }
    else if (action === 'delete') { if (TOP.confirm('删除这份快照？绑定也会取消。')) { await engine.remove(id); await loadItems(); } }
    else if (action === 'bind') {
      syncListener();
      if (!eventSource) throw new Error('当前酒馆缺少角色切换事件，暂时只能手动应用快照');
      const enabled = await engine.bindChat(id);
      say(enabled ? '已绑定当前聊天并应用；返回主页恢复进入前状态' : '已解除聊天绑定，当前开关保持不变');
      await loadItems();
    }
    else if (action === 'group-menu') menuId=menuId===id?'':id;
    else if (action === 'new-group' || action === 'edit-group') {
      if(action==='edit-group' && !await prepareGroupChange(id,'编辑'))return;
      await refresh(true); groupQuery=''; editGroup = action === 'new-group' ? { name: '', books: [] } : copy(engine.read().groups.find(group => group.id === id));
    } else if (action === 'save-group') {
      const pending = editGroup;
      const name = await requestSnapshotName(overlay, pending.name, 100, 'group');
      if (name === null || editGroup !== pending) return;
      pending.name = name;
      await engine.saveGroup(pending); editGroup = null; groupQuery='';
    }
    else if (action === 'toggle-group') { await conflictAction(force=>engine.toggleGroup(id,force)); await refresh(); }
    else if (action === 'delete-group') {
      const group=engine.read().groups.find(g=>g.id===id);
      if(TOP.confirm(group?.enabled?'此分组正在开启。确认先关闭并删除分组？将一并删除该分组的默认方案和快照，但不删除世界书文件。':'删除这个分组？将一并删除该分组的默认方案和快照，但不删除世界书文件。')) {
        if(group?.enabled)await engine.toggleGroup(id);
        await engine.removeGroup(id); await refresh(); say('分组及其快照数据已删除，世界书文件保留');
      }
    }
    render();
  });
}
async function prepareGroupChange(id,label) {
  const group=engine.read().groups.find(g=>g.id===id);
  if(!group)throw new Error('分组已不存在');
  if(group.enabled) {
    if(!TOP.confirm('分组正在开启。先关闭分组再'+label+'？完成后需手动重新开启。'))return false;
    await engine.toggleGroup(id);
    say('分组已关闭，编辑完成后请重新开启');
  }
  return true;
}
async function conflictAction(action) {
  try { await action(false); }
  catch(error) {
    if(error.code!=='GROUP_CONFLICT') throw error;
    if(!TOP.confirm(error.message+'\n确定使用当前方案？取消则保持原样。')) throw new Error('已取消，原方案保持不变');
    await action(true);
  }
}
function onChatChanged(immediate = false) {
  TOP.clearTimeout(eventTimer);
  const run = async () => {
    eventTimer = 0;
    if (disposed) return;
    if (draft) { say('角色已切换，当前草稿已保留。请取消草稿后继续。'); return; }
    const prevKey = currentChatKey;
    const nextKey = activeChatKey();
    currentChatKey = nextKey;
    try {
      const result = await engine.transition();
      if (!chatInitialized) {
        chatInitialized = true;
      } else if (prevKey && nextKey && prevKey !== nextKey && result?.autoBound && (result?.changed ?? 0) > 0) {
        if (lastNotifiedChatKey !== nextKey) {
          lastNotifiedChatKey = nextKey;
          notifyBoundChatRestored(result.autoBound.name);
        }
      } else if (prevKey !== nextKey) {
        lastNotifiedChatKey = '';
      }
      if (overlay && !busy && !editGroup && !renameId) { await refresh(); await loadItems(); render(); }
    } catch (error) { report(error); TOP.toastr?.warning?.(`世界书快照：${error.message}`); }
  };
  if (immediate === true) return run();
  eventTimer = TOP.setTimeout(run, 180);
}
function syncListener() {
  // No polling: only subscribe to context changes. Also observe during a draft to prevent stale saves.
  if (eventSource) return;
  const context = ctx();
  eventSource = context.eventSource;
  eventType = context.eventTypes?.CHAT_CHANGED || context.event_types?.CHAT_CHANGED;
  if (eventSource && eventType) eventSource.on(eventType, onChatChanged);
  else eventSource = null;
}
function cleanup() {
  disposed = true; TOP.clearTimeout(eventTimer);
  currentChatKey = ''; chatInitialized = false; lastNotifiedChatKey = '';
  if (eventSource && eventType) {
    if (eventSource.off) eventSource.off(eventType, onChatChanged);
    else eventSource.removeListener?.(eventType, onChatChanged);
  }
  nativeObserver?.disconnect();nativeObserver=null;
  nativeDiscoveryObserver?.disconnect();nativeDiscoveryObserver=null;nativeRoot=null;
  if(nativeFrame){TOP.cancelAnimationFrame(nativeFrame);nativeFrame=0;}
  DOC.querySelectorAll?.(`.${NATIVE_ACTION_CLASS},.pmm-native-worldbook-actions`).forEach(node=>node.remove());
  closeBatch();void close(true); style.remove();
  if (TOP[KEY]?.engine === engine) delete TOP[KEY];
}
TOP[KEY] = { open, openBatch, decoratePreset, engine, cleanup, onChatChanged };
syncListener();
installNativeWorldbookTools();
// The persisted return journal also handles a browser refresh while inside a character.
onChatChanged();
SELF.addEventListener('pagehide', cleanup, { once: true });
