/* 个人测试通道 test.3：把世界书缝合嵌入工坊原有双卡片布局。 */
(() => {
  'use strict';

  const SELF = window;
  const TOP = window.parent || window;
  const DOC = TOP.document;
  const API_KEY = '__PMM_WORLDBOOK_STITCH_TEST3__';
  const STYLE_ID = 'pmm-worldbook-stitch-test3-style';
  const PAGE_SIZE = 240;
  const HISTORY_LIMIT = 20;
  const MULTI_DRAG_FLOAT_WIDTH = 198;
  const MULTI_DRAG_FLOAT_HEIGHT = 58;
  const TOP_NOTIFICATION_STORAGE_KEY = 'pmm_top_notifications_enabled_v1';
  const IS_ANDROID = /Android/i.test(String(TOP.navigator?.userAgent || SELF.navigator?.userAgent || ''));
  const MODE_CLASSES = ['pm-panel-container--merge-mode', 'pm-panel-container--branch-mode', 'pm-panel-container--favorite-mode'];
  const POSITION_OPTIONS = [
    [0, '角色定义之前'], [1, '角色定义之后'], [5, '示例消息之前'], [6, '示例消息之后'],
    [2, '作者注释顶部'], [3, '作者注释底部'], [4, '@D 插入聊天深度'], [7, 'Outlet'],
  ];
  const ROLE_OPTIONS = [[0, '系统'], [1, '用户'], [2, '助手']];
  const WORLD_DEFAULTS = {
    key: [], keysecondary: [], comment: '', content: '', constant: true,
    vectorized: false, selective: true, selectiveLogic: 0, addMemo: false,
    order: 100, position: 0, disable: false, ignoreBudget: false,
    excludeRecursion: false, preventRecursion: false, matchPersonaDescription: false,
    matchCharacterDescription: false, matchCharacterPersonality: false,
    matchCharacterDepthPrompt: false, matchScenario: false, matchCreatorNotes: false,
    delayUntilRecursion: 0, probability: 100, useProbability: true, depth: 4,
    outletName: '', group: '', groupOverride: false, groupWeight: 100,
    scanDepth: null, caseSensitive: null, matchWholeWords: null,
    useGroupScoring: null, automationId: '', role: 0, sticky: null,
    cooldown: null, delay: null, triggers: [],
  };

  function emptyWorldSide() {
    return {
      kind: 'world', name: '', data: null, savedData: null, dirty: false, entries: [], selected: new Set(), expanded: new Set(),
      limit: PAGE_SIZE, multi: false, query: '', searchOpen: false, searchScope: 'all', searchIndex: 0,
      replaceOpen: false, replaceValue: '',
      scrollTop: 0, history: [],
    };
  }

  const state = {
    open: false,
    busy: false,
    status: '已同步',
    topType: 'preset',
    worldNames: [],
    worldBindings: new Map(),
    top: emptyWorldSide(),
    bottom: emptyWorldSide(),
    host: null,
    container: null,
    mainWrapper: null,
    nativeTop: null,
    bottomCard: null,
    topCard: null,
  };

  let context = null;
  let operationTail = Promise.resolve();
  let hostObserver = null;
  let renderFrame = 0;
  let dragPayload = null;
  let worldMultiDragFloat = null;
  let worldMultiDragGhost = null;
  let worldMultiDragFrame = 0;
  let worldMultiDragPoint = null;

  function topNotificationsEnabled() {
    try { return (TOP.localStorage || SELF.localStorage)?.getItem(TOP_NOTIFICATION_STORAGE_KEY) !== '0'; }
    catch (_) { return true; }
  }

  function notify(type, message) {
    if (!topNotificationsEnabled()) {
      const logger = type === 'error' ? console.error : type === 'warning' ? console.warn : (console.debug || console.info);
      logger?.call(console, '[世界书缝合][顶部通知已关闭]', message);
      return;
    }
    const toast = TOP.toastr?.[type] || SELF.toastr?.[type];
    if (typeof toast === 'function') toast(message, '世界书缝合');
    else console[type === 'error' ? 'error' : 'info'](`[世界书缝合] ${message}`);
  }

  function clone(value) {
    if (typeof structuredClone === 'function') {
      try { return structuredClone(value); } catch (_) {}
    }
    return JSON.parse(JSON.stringify(value));
  }

  function h(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
  }

  function safeId(value) { return encodeURIComponent(String(value ?? '')); }
  function decodeId(value) {
    try { return decodeURIComponent(String(value ?? '')); } catch (_) { return String(value ?? ''); }
  }

  function getContext() {
    return SELF.SillyTavern?.getContext?.() || TOP.SillyTavern?.getContext?.() || null;
  }

  function getLoadedPresetNameSafe() {
    try { return String(SELF.getLoadedPresetName?.() || ''); } catch (_) { return ''; }
  }

  function entriesFromWorld(data) {
    const entries = data?.entries && typeof data.entries === 'object' ? Object.values(data.entries) : [];
    return entries.filter(entry => entry && typeof entry === 'object')
      .sort((a, b) => Number(a.displayIndex ?? a.uid) - Number(b.displayIndex ?? b.uid));
  }

  function entryKey(entry) { return String(entry.uid); }
  function entryTitle(entry) {
    return String(entry.comment || entry.key?.[0] || `世界书条目 ${entry.uid}`);
  }

  function worldSearchScope(value) {
    return ['all', 'title', 'content'].includes(value) ? value : 'all';
  }

  function getWorldThemeMode() {
    let mode = '';
    for (const owner of [TOP, SELF]) {
      try {
        const candidate = String(owner?.localStorage?.getItem('preset-manager-theme-mode') || '');
        if (['light', 'dark', 'auto'].includes(candidate)) {
          mode = candidate;
          break;
        }
      } catch (_) {}
    }
    return mode;
  }

  function parseWorldThemeRgb(value) {
    const source = String(value || '').trim();
    const hex = source.match(/^#([0-9a-f]{3,8})$/i)?.[1];
    if (hex) {
      const expanded = hex.length <= 4 ? [...hex].map(char => char + char).join('') : hex;
      const alpha = expanded.length >= 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1;
      if (alpha < .25) return null;
      return {
        r: Number.parseInt(expanded.slice(0, 2), 16),
        g: Number.parseInt(expanded.slice(2, 4), 16),
        b: Number.parseInt(expanded.slice(4, 6), 16),
      };
    }
    const rgb = source.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
    if (!rgb || (rgb[4] != null && Number(rgb[4]) < .25)) return null;
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  }

  function worldThemeLuminance(rgb) {
    return .2126 * rgb.r + .7152 * rgb.g + .0722 * rgb.b;
  }

  function resolveWorldMultiDragTone() {
    const mode = getWorldThemeMode();
    if (mode === 'dark' || mode === 'light') return mode;
    const nodes = [
      state.host,
      state.host?.querySelector?.('.pm-panel-container'),
      DOC.getElementById('preset-manager-main-panel'),
      DOC.body,
      DOC.documentElement,
    ].filter(Boolean);
    for (const node of nodes) {
      try {
        const style = TOP.getComputedStyle(node);
        const text = parseWorldThemeRgb(style.getPropertyValue('--pm-text-primary') || style.color);
        if (text) return worldThemeLuminance(text) > 145 ? 'dark' : 'light';
        const surface = parseWorldThemeRgb(
          style.getPropertyValue('--pm-card-bg') || style.getPropertyValue('--pm-panel-bg') || style.backgroundColor,
        );
        if (surface) return worldThemeLuminance(surface) < 130 ? 'dark' : 'light';
      } catch (_) {}
    }
    return TOP.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
  }

  function syncWorldSearchHighlightTheme() {
    if (!state.host) return;
    const mode = getWorldThemeMode();
    if (mode === 'light') state.host.setAttribute('data-pmm-wb-search-theme', 'light');
    else state.host.removeAttribute('data-pmm-wb-search-theme');
  }

  function worldSearchMatches(text, query) {
    const source = String(text ?? '');
    const needle = String(query ?? '').toLocaleLowerCase();
    if (!needle) return [];
    const lowered = source.toLocaleLowerCase();
    const matches = [];
    let start = 0;
    while (start <= lowered.length) {
      const found = lowered.indexOf(needle, start);
      if (found < 0) break;
      matches.push({ start: found, end: found + needle.length });
      start = found + Math.max(needle.length, 1);
    }
    return matches;
  }

  function collectWorldSearch(side) {
    const query = String(side?.query || '').trim();
    const scope = worldSearchScope(side?.searchScope);
    if (!query) return { query: '', scope, entries: side?.entries || [], matches: [], byKey: new Map() };
    const matches = [];
    const byKey = new Map();
    const entries = [];
    for (const entry of side.entries) {
      const key = entryKey(entry);
      const entryMatches = [];
      if (scope !== 'content') {
        for (const range of worldSearchMatches(entryTitle(entry), query)) {
          entryMatches.push({ key, entry, field: 'title', ...range });
        }
      }
      if (scope !== 'title') {
        for (const range of worldSearchMatches(entry.content, query)) {
          entryMatches.push({ key, entry, field: 'content', ...range });
        }
      }
      if (!entryMatches.length) continue;
      entries.push(entry);
      byKey.set(key, entryMatches);
      matches.push(...entryMatches);
    }
    return { query, scope, entries, matches, byKey };
  }

  function highlightedWorldSearchText(value, query, currentMatch = null, fieldName = '') {
    const source = String(value ?? '');
    const matches = worldSearchMatches(source, query);
    if (!matches.length) return h(source);
    let cursor = 0;
    return matches.map(({ start, end }) => {
      const before = h(source.slice(cursor, start));
      const isCurrent = currentMatch?.field === fieldName
        && currentMatch.start === start
        && currentMatch.end === end;
      const hit = `<mark class="pmm-wb-search-highlight${isCurrent ? ' is-current' : ''}">${h(source.slice(start, end))}</mark>`;
      cursor = end;
      return before + hit;
    }).join('') + h(source.slice(cursor));
  }

  function replaceWorldSearchText(value, query, replacement) {
    const source = String(value ?? '');
    const matches = worldSearchMatches(source, query);
    if (!matches.length) return { value: source, count: 0 };
    let cursor = 0;
    const next = matches.map(({ start, end }) => {
      const before = source.slice(cursor, start);
      cursor = end;
      return before + replacement;
    }).join('') + source.slice(cursor);
    return { value: next, count: matches.length };
  }

  function replaceOneWorldSearchText(value, match, replacement) {
    const source = String(value ?? '');
    if (!match || match.start < 0 || match.end < match.start || match.end > source.length) return { value: source, count: 0 };
    return { value: source.slice(0, match.start) + replacement + source.slice(match.end), count: 1 };
  }

  function setWorldSearchTitle(entry, value) {
    if (String(entry.comment ?? '')) {
      entry.comment = value;
      return;
    }
    if (Array.isArray(entry.key) && entry.key.length) {
      entry.key = [...entry.key];
      entry.key[0] = value;
      return;
    }
    entry.comment = value;
  }

  function replaceWorldSearchMatch(entry, match, replacement) {
    if (!entry || !match) return 0;
    if (match.field === 'title') {
      const result = replaceOneWorldSearchText(entryTitle(entry), match, replacement);
      if (result.count) setWorldSearchTitle(entry, result.value);
      return result.count;
    }
    const result = replaceOneWorldSearchText(entry.content, match, replacement);
    if (result.count) entry.content = result.value;
    return result.count;
  }

  function replaceAllWorldSearchMatches(entry, scope, query, replacement) {
    let count = 0;
    if (scope !== 'content') {
      const result = replaceWorldSearchText(entryTitle(entry), query, replacement);
      if (result.count) {
        setWorldSearchTitle(entry, result.value);
        count += result.count;
      }
    }
    if (scope !== 'title') {
      const result = replaceWorldSearchText(entry.content, query, replacement);
      if (result.count) {
        entry.content = result.value;
        count += result.count;
      }
    }
    return count;
  }

  function freeWorldUid(data) {
    const used = new Set(Object.keys(data?.entries || {}).map(Number).filter(Number.isInteger));
    let uid = 0;
    while (used.has(uid)) uid += 1;
    return uid;
  }

  function newPromptId() {
    return `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function worldToPreset(entry) {
    return {
      id: newPromptId(),
      name: entryTitle(entry),
      content: String(entry.content || ''),
      enabled: entry.disable !== true,
      role: 'system',
      position: { type: 'relative' },
    };
  }

  function presetToWorld(prompt, data) {
    const uid = freeWorldUid(data);
    return {
      uid, ...clone(WORLD_DEFAULTS),
      comment: String(prompt.name || prompt.id || `预设条目 ${uid}`),
      content: String(prompt.content || ''),
      disable: prompt.enabled === false,
    };
  }

  function worldToWorld(entry, data) {
    return { ...clone(entry), uid: freeWorldUid(data) };
  }

  function worldInsertionIndex(entries, placement = null) {
    if (!placement?.targetKey) return entries.length;
    const targetIndex = entries.findIndex(entry => entryKey(entry) === String(placement.targetKey));
    if (targetIndex < 0) return entries.length;
    return targetIndex + (placement.position === 'after' ? 1 : 0);
  }

  function setStatus(text) {
    state.status = text;
    DOC.querySelectorAll('#preset-manager-main-panel .pmm-wb-status').forEach(node => {
      node.textContent = text;
    });
  }

  function enqueue(label, task) {
    operationTail = operationTail.then(async () => {
      state.busy = true;
      setStatus(`${label}…`);
      try {
        await task();
        syncWorldDraftStatus();
      } catch (error) {
        console.error(`[世界书缝合] ${label}失败`, error);
        setStatus('同步失败');
        notify('error', `${label}失败：${error?.message || error}`);
      } finally {
        state.busy = false;
      }
    });
    return operationTail;
  }

  async function getLegacyWorldInfoNames() {
    if (typeof context?.getRequestHeaders !== 'function') {
      throw new Error('旧版酒馆缺少世界书列表读取所需的请求接口');
    }
    const response = await TOP.fetch('/api/settings/get', {
      method: 'POST',
      headers: context.getRequestHeaders(),
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      throw new Error(`旧版酒馆世界书列表读取失败（HTTP ${response.status}）`);
    }
    const data = await response.json();
    return Array.isArray(data?.world_names) ? data.world_names : [];
  }

  async function getWorldInfoNamesCompatible() {
    if (typeof context?.getWorldInfoNames === 'function') {
      return await context.getWorldInfoNames();
    }
    return await getLegacyWorldInfoNames();
  }

  async function refreshWorldNames() {
    context = getContext();
    if (!context?.loadWorldInfo || !context?.saveWorldInfo) {
      throw new Error('当前酒馆没有提供世界书读写接口');
    }
    let names = await getWorldInfoNamesCompatible();
    state.worldNames = [...(names || [])].map(String);
    if (!state.worldNames.length && context.updateWorldInfoList) {
      await context.updateWorldInfoList();
      names = await getWorldInfoNamesCompatible();
      state.worldNames = [...(names || [])].map(String);
    }
    if (!state.bottom.name || !state.worldNames.includes(state.bottom.name)) {
      state.bottom.name = state.worldNames[0] || '';
    }
    if (!state.top.name || !state.worldNames.includes(state.top.name)) {
      state.top.name = state.worldNames.find(name => name !== state.bottom.name) || state.worldNames[0] || '';
    }
    refreshCharacterWorldBindings();
  }

  function helperFunction(name) {
    const candidates = [
      [SELF, SELF?.[name]],
      [SELF?.TavernHelper, SELF?.TavernHelper?.[name]],
      [TOP?.TavernHelper, TOP?.TavernHelper?.[name]],
    ];
    const match = candidates.find(([, fn]) => typeof fn === 'function');
    return match ? match[1].bind(match[0]) : null;
  }

  function normalizeWorldBindingName(value) {
    return String(value ?? '').normalize('NFC').trim().toLocaleLowerCase();
  }

  function refreshCharacterWorldBindings() {
    const byExactName = new Map(state.worldNames.map(name => [String(name), name]));
    const byNormalizedName = new Map();
    for (const name of state.worldNames) {
      const normalizedName = normalizeWorldBindingName(name);
      if (normalizedName && !byNormalizedName.has(normalizedName)) byNormalizedName.set(normalizedName, name);
    }
    const bindings = new Map(state.worldNames.map(name => [name, new Set()]));
    const addBinding = (worldName, characterName) => {
      const rawWorldName = String(worldName ?? '');
      const actualName = byExactName.get(rawWorldName)
        || byNormalizedName.get(normalizeWorldBindingName(rawWorldName));
      const visibleCharacterName = String(characterName || '').trim();
      if (!actualName || !visibleCharacterName) return;
      bindings.get(actualName)?.add(visibleCharacterName);
    };

    /* 主绑定的兼容兜底：酒馆当前上下文通常已经带有全部角色摘要。 */
    for (const character of context?.characters || []) {
      addBinding(character?.data?.extensions?.world, character?.name);
    }

    /* 酒馆助手会同时返回主要绑定和额外绑定。读取失败的单个角色不会影响列表。 */
    const getCharacterNames = helperFunction('getCharacterNames');
    const getCharWorldbookNames = helperFunction('getCharWorldbookNames');
    if (getCharacterNames && getCharWorldbookNames) {
      let characterNames = [];
      try { characterNames = getCharacterNames() || []; } catch (_) {}
      for (const characterName of characterNames) {
        try {
          const linked = getCharWorldbookNames(characterName) || {};
          addBinding(linked.primary, characterName);
          for (const extraName of linked.additional || []) addBinding(extraName, characterName);
        } catch (error) {
          console.warn(`[世界书缝合] 读取角色“${characterName}”的世界书绑定失败`, error);
        }
      }
    }

    state.worldBindings = bindings;
  }

  function boundCharacterNames(worldName) {
    return [...(state.worldBindings.get(worldName) || [])]
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  }

  const WORLD_PICKER_THEME_VARS = [
    '--pm-toolbar-bg', '--pm-panel-bg', '--pm-card-bg', '--pm-text-primary',
    '--pm-text-secondary', '--pm-border', '--pm-accent', '--pm-hover-bg',
    '--pm-selected-bg', '--pm-quote-color', '--pm-glass-bg',
    '--pm-glass-hover-bg', '--pm-control-bg', '--pm-button-bg',
    '--pm-card-bg-translucent', '--pm-font-family', '--pm-font-weight',
    '--pm-text-shadow', '--pm-font-size', '--pm-line-height',
  ];

  function worldPickerThemeSource() {
    const root = state.host;
    if (!root) return null;
    return Array.from(root.children || []).find(element => element?.classList?.contains('pm-overlay'))
      || root.querySelector?.('.pm-overlay')
      || state.nativeTop
      || null;
  }

  function syncWorldPickerTheme(overlay) {
    const source = worldPickerThemeSource();
    if (!source || !overlay) return false;
    let computed = null;
    try { computed = TOP.getComputedStyle?.(source) || null; } catch (_) {}
    let copied = 0;
    for (const name of WORLD_PICKER_THEME_VARS) {
      let value = '';
      try { value = source.style?.getPropertyValue?.(name)?.trim?.() || ''; } catch (_) {}
      if (!value && computed) {
        try { value = computed.getPropertyValue(name)?.trim?.() || ''; } catch (_) {}
      }
      if (!value) continue;
      overlay.style.setProperty(name, value, 'important');
      copied++;
    }
    return copied > 0;
  }

  function startWorldPickerThemeSync(overlay) {
    syncWorldPickerTheme(overlay);
    const source = worldPickerThemeSource();
    if (!source || !overlay) return;
    try {
      const Observer = TOP.MutationObserver || MutationObserver;
      const observer = new Observer(() => {
        if (!overlay.isConnected) return observer.disconnect();
        syncWorldPickerTheme(overlay);
      });
      observer.observe(source, { attributes: true, attributeFilter: ['style'] });
      overlay.__pmmWorldPickerThemeObserver = observer;
    } catch (_) {}
  }

  function removeSourcePicker(overlay) {
    try { overlay?.__pmmWorldPickerThemeObserver?.disconnect?.(); } catch (_) {}
    overlay?.remove?.();
  }

  function resetSide(side, keepName = true) {
    const name = keepName ? side.name : '';
    Object.assign(side, emptyWorldSide(), { name });
  }

  async function loadWorldSide(side) {
    side.selected.clear();
    side.expanded.clear();
    side.limit = PAGE_SIZE;
    side.scrollTop = 0;
    if (!side.name) {
      side.data = null;
      side.savedData = null;
      side.dirty = false;
      side.entries = [];
      return;
    }
    applyWorldData(side, await context.loadWorldInfo(side.name));
    side.savedData = clone(side.data);
    side.dirty = false;
  }

  function applyWorldData(side, data) {
    side.data = clone(data);
    side.entries = entriesFromWorld(side.data);
  }

  function worldDraftChanged(side) {
    if (!side?.data || !side?.savedData) return Boolean(side?.dirty);
    return JSON.stringify(side.data) !== JSON.stringify(side.savedData);
  }

  function refreshWorldDraftState(side) {
    if (!side) return false;
    side.dirty = worldDraftChanged(side);
    return side.dirty;
  }

  function worldSideName(side) {
    return side === state.top ? 'top' : side === state.bottom ? 'bottom' : '';
  }

  function mirrorSameWorldDraft(side) {
    if (state.topType !== 'world' || !side?.name) return;
    const other = side === state.top ? state.bottom : state.top;
    if (!other || other.name !== side.name) return;
    other.data = clone(side.data);
    other.savedData = clone(side.savedData);
    other.entries = entriesFromWorld(other.data);
    other.dirty = side.dirty;
  }

  function hasWorldDraftChanges() {
    return [state.top, state.bottom].some(side => side?.dirty);
  }

  function syncWorldSaveButton(sideName) {
    const side = state[sideName];
    const button = state.host?.querySelector?.(`[data-pmm-wb-panel="${sideName}"] [data-wb-action="save"]`);
    if (!side || !button) return false;
    button.toggleAttribute('data-wb-dirty', side.dirty === true);
    button.classList.toggle('is-dirty', side.dirty === true);
    return true;
  }

  function syncWorldDraftStatus() {
    setStatus(hasWorldDraftChanges() ? '' : '已同步');
  }

  function markWorldDraftDirty(side) {
    if (!side?.data) return;
    side.dirty = side.savedData ? worldDraftChanged(side) : true;
    mirrorSameWorldDraft(side);
    const sideName = worldSideName(side);
    if (sideName) syncWorldSaveButton(sideName);
    const otherName = sideName === 'top' ? 'bottom' : 'top';
    if (state[otherName]?.name === side.name) syncWorldSaveButton(otherName);
    syncWorldDraftStatus();
  }

  function discardWorldDraft(side) {
    if (!side?.dirty) return;
    if (side.savedData) {
      side.data = clone(side.savedData);
      side.entries = entriesFromWorld(side.data);
    }
    side.dirty = false;
    side.selected.clear();
    side.history.length = 0;
    mirrorSameWorldDraft(side);
    syncWorldSaveButton('top');
    syncWorldSaveButton('bottom');
    syncWorldDraftStatus();
  }

  async function reloadOpenNativeWorldbook(name) {
    const worldName = String(name || '').trim();
    if (!worldName || nativeWorldEditorSelectedName() !== worldName) return false;
    try {
      const select = DOC.querySelector('#world_editor_select');
      const option = [...(select?.options || [])].find(item => String(item.textContent || '').trim() === worldName);
      if (!select || !option) return false;
      // This is the exact native SillyTavern reload path.  Do not rely on
      // TavernHelper's optional context bridge: some host versions expose the
      // method but do not repaint an already-open editor through that bridge.
      select.value = option.value;
      const jQuery = TOP.jQuery || TOP.$;
      if (typeof jQuery === 'function') {
        jQuery(select).trigger('change');
      } else {
        select.dispatchEvent(new TOP.Event('change', { bubbles: true }));
      }
      return true;
    } catch (error) {
      console.warn(`[世界书缝合] 已保存“${worldName}”，但原生世界书页面刷新失败`, error);
      return false;
    }
  }

  async function saveWorldSide(side) {
    if (!side.data?.entries) throw new Error('世界书数据尚未载入');
    await context.saveWorldInfo(side.name, clone(side.data), true);
    side.savedData = clone(side.data);
    side.dirty = false;
    mirrorSameWorldDraft(side);
    await reloadOpenNativeWorldbook(side.name);
    syncWorldSaveButton(worldSideName(side));
    syncWorldDraftStatus();
  }

  async function savePresetEntries(name, prompts) {
    if (!name) throw new Error('没有识别到上方预设');
    const next = clone(prompts);
    let saved = false;
    if (typeof SELF.setPreset === 'function') {
      await SELF.setPreset(name, { prompts: next });
      saved = true;
    }
    if (name === getLoadedPresetNameSafe() && typeof SELF.updatePresetWith === 'function') {
      await SELF.updatePresetWith('in_use', preset => {
        preset.prompts = next;
        return preset;
      });
      saved = true;
    }
    if (!saved) {
      throw new Error('当前酒馆没有提供预设保存接口');
    }
    syncVisiblePresetEntries(name, next);
  }

  function findEntry(side, key) {
    return side.entries.find(entry => entryKey(entry) === String(key));
  }

  function removeWorldEntries(side, keys) {
    for (const key of keys.map(String)) {
      delete side.data.entries[key];
      if (Array.isArray(side.data.originalData?.entries)) {
        side.data.originalData.entries = side.data.originalData.entries.filter(entry => String(entry?.uid) !== key);
      }
    }
    side.entries = entriesFromWorld(side.data);
  }

  function insertWorldEntries(target, sourceKind, entries, placement = null) {
    target.data.entries ||= {};
    const ordered = entriesFromWorld(target.data);
    const insertionIndex = worldInsertionIndex(ordered, placement);
    const added = [];
    for (const entry of entries) {
      const addition = sourceKind === 'world'
        ? worldToWorld(entry, target.data)
        : presetToWorld(entry, target.data);
      target.data.entries[addition.uid] = addition;
      added.push(addition);
    }
    ordered.splice(insertionIndex, 0, ...added);
    ordered.forEach((entry, index) => {
      entry.displayIndex = index;
      target.data.entries[String(entry.uid)] = entry;
    });
    target.entries = ordered;
    return added;
  }

  // `displayIndex` controls only the editor's card order. It deliberately
  // does not touch `order`, which is SillyTavern's prompt-insertion priority.
  function reorderWorldEntriesForDisplay(entries, keys, placement = null) {
    const ordered = Array.isArray(entries) ? entries.slice() : [];
    const wanted = new Set((keys || []).map(String));
    const moving = ordered.filter(entry => wanted.has(entryKey(entry)));
    if (!moving.length) return null;
    if (placement?.targetKey && wanted.has(String(placement.targetKey))) return null;
    const remaining = ordered.filter(entry => !wanted.has(entryKey(entry)));
    const insertionIndex = worldInsertionIndex(remaining, placement);
    const next = [
      ...remaining.slice(0, insertionIndex),
      ...moving,
      ...remaining.slice(insertionIndex),
    ];
    if (next.every((entry, index) => entry === ordered[index])) return null;
    const displayIndexes = ordered
      .map(entry => Number(entry.displayIndex))
      .filter(Number.isFinite);
    const firstDisplayIndex = displayIndexes.length ? Math.min(...displayIndexes) : 0;
    return next.map((entry, index) => ({ ...entry, displayIndex:firstDisplayIndex + index }));
  }

  async function reorderWorldEntries(sideName, keys, placement = null) {
    const side = state[sideName];
    if (!side?.data?.entries) return;
    await enqueue('调整世界书显示顺序', async () => {
      const next = reorderWorldEntriesForDisplay(side.entries, keys, placement);
      if (!next) return;
      pushUndo(side, '调整世界书显示顺序', { worldSides:[side] });
      side.entries = next;
      for (const entry of next) side.data.entries[String(entry.uid)] = entry;
      markWorldDraftDirty(side);
      renderPanels();
    });
  }

  function pushUndo(owner, label, options = {}) {
    if (!owner) return;
    const worlds = [];
    const worldNames = new Set();
    for (const side of options.worldSides || []) {
      if (!side?.name || !side.data?.entries || worldNames.has(side.name)) continue;
      worldNames.add(side.name);
      worlds.push({ name:side.name, data:clone(side.data) });
    }
    const presets = [];
    const presetNames = new Set();
    for (const snapshot of options.presetSnapshots || []) {
      if (!snapshot?.name || !Array.isArray(snapshot.prompts) || presetNames.has(snapshot.name)) continue;
      presetNames.add(snapshot.name);
      presets.push({ name:snapshot.name, prompts:clone(snapshot.prompts) });
    }
    if (!worlds.length && !presets.length) return;
    owner.history.push({ label, worlds, presets });
    if (owner.history.length > HISTORY_LIMIT) owner.history.splice(0, owner.history.length - HISTORY_LIMIT);
  }

  async function undoWorldOperation(side) {
    const snapshot = side?.history?.[side.history.length - 1];
    if (!snapshot) return notify('info', '目前没有可以撤销的世界书操作');
    await enqueue(`撤销${snapshot.label ? `：${snapshot.label}` : ''}`, async () => {
      for (const preset of snapshot.presets) await savePresetEntries(preset.name, preset.prompts);
      for (const target of [state.top, state.bottom]) {
        const restored = snapshot.worlds.find(world => world.name === target.name);
        if (!restored) continue;
        target.data = clone(restored.data);
        target.entries = entriesFromWorld(target.data);
        target.selected.clear();
        refreshWorldDraftState(target);
      }
      side.history.pop();
      mirrorSameWorldDraft(side);
      syncWorldSaveButton('top');
      syncWorldSaveButton('bottom');
      renderPanels();
      notify('success', `已撤销：${snapshot.label || '上一步世界书操作'}`);
    });
  }

  function componentArray(value) {
    const raw = value?.value ?? value;
    return Array.isArray(raw) ? raw : null;
  }

  function componentSet(value) {
    const raw = value?.value ?? value;
    return raw instanceof Set || (raw && typeof raw.has === 'function' && typeof raw[Symbol.iterator] === 'function')
      ? new Set([...raw].map(String))
      : new Set();
  }

  // `state.nativeTop` is the outer preset-panel element. On some mobile WebViews
  // Vue only leaves its component reference on a child. A BaiBai card may belong
  // to BaiBai's own Vue app, so always prefer PMM's PromptPanel: it owns the
  // cross-panel-drop listener that can preserve the target section id.
  function nativePresetDropDispatcher() {
    const panel = currentNativePresetPanel();
    if (!panel) return null;
    const seen = new Set();
    const roots = [panel, ...panel.querySelectorAll('.prompt-panel, .prompt-panel *')];
    let promptPanelFallback = null;
    for (const root of roots) {
      for (let element = root; element && panel.contains(element); element = element.parentElement) {
        let component = element.__vueParentComponent || null;
        for (let depth = 0; component && depth < 24; depth++, component = component.parent) {
          if (seen.has(component)) continue;
          seen.add(component);
          if (typeof component.emit !== 'function') continue;
          const props = [component.vnode?.props, component.props, component.attrs].filter(Boolean);
          const handlers = props.flatMap(source => [
            source.onCrossPanelDrop,
            source['onCross-panel-drop'],
            source.onCrossPanelDropOnce,
          ]).flat().filter(handler => typeof handler === 'function');
          const name = String(component.type?.__name || component.vnode?.type?.__name || '');
          if (handlers.length) {
            return {
              component,
              drop: async (...args) => {
                for (const handler of handlers) await handler(...args);
              },
            };
          }
          if (!promptPanelFallback && name === 'PromptPanel') promptPanelFallback = component;
        }
      }
    }
    return promptPanelFallback ? { component:promptPanelFallback, drop:null } : null;
  }

  function nativePresetPanelComponent() {
    return nativePresetDropDispatcher()?.component || null;
  }

  function currentNativePresetPanel() {
    const live = DOC.querySelector('#preset-manager-main-panel .pm-main-wrapper > .preset-panel');
    if (live) state.nativeTop = live;
    return state.nativeTop?.isConnected === false ? null : state.nativeTop;
  }

  function nativePresetSnapshot() {
    const panel = currentNativePresetPanel();
    if (!panel) return { name: '', prompts: [], selected: new Set(), runtimePrompts: null, panelComponent: null, panelDropHandler: null };
    let prompts = null;
    let runtimePrompts = null;
    let panelComponent = null;
    let selected = new Set();
    let component = panel.__vueParentComponent || null;
    for (let depth = 0; component && depth < 14; depth++, component = component.parent) {
      const foundPrompts = componentArray(component.props?.prompts)
        || componentArray(component.vnode?.props?.prompts)
        || componentArray(component.setupState?.prompts);
      if (!runtimePrompts && foundPrompts) runtimePrompts = foundPrompts;
      prompts ||= foundPrompts;
      if (!panelComponent && foundPrompts && typeof component.emit === 'function') panelComponent = component;
      const candidate = component.props?.selectedIds
        ?? component.vnode?.props?.selectedIds
        ?? component.setupState?.selectedIds;
      const found = componentSet(candidate);
      if (found.size) selected = found;
      if (prompts && selected.size) break;
    }
    const dispatcher = nativePresetDropDispatcher();
    panelComponent = dispatcher?.component || panelComponent;
    prompts = clone(prompts || []);
    if (!selected.size) {
      panel.querySelectorAll('.prompt-item[data-prompt-id],.prompt-card[data-prompt-id]').forEach(item => {
        if (item.querySelector('.prompt-item__checkbox .fa-square-check,.prompt-card__checkbox .fa-square-check')) {
          selected.add(String(item.dataset.promptId || ''));
        }
      });
    }
    const select = panel.querySelector('.title-select');
    const name = String(select?.value || select?.selectedOptions?.[0]?.textContent || getLoadedPresetNameSafe() || '').trim();
    // The core owns unsaved additions. Rendered component props can still describe
    // the previous frame after a worldbook switch; never use those to reject a new ID.
    const bridge = SELF.__PMM_WORLDBOOK_PRESET_DROP_BRIDGE__ || TOP.__PMM_WORLDBOOK_PRESET_DROP_BRIDGE__;
    const draft = bridge?.snapshot?.();
    if (draft?.name === name && Array.isArray(draft.prompts)) prompts = clone(draft.prompts);
    return { name, prompts, selected, runtimePrompts, panelComponent, panelDropHandler:dispatcher?.drop || null };
  }

  async function emitNativePresetDrop(target, additions, placement = null) {
    const targetSectionId = String(placement?.targetSectionId || '');
    let component = placement?.targetPanelComponent || target?.panelComponent;
    let dropHandler = placement?.targetDropHandler || target?.panelDropHandler;
    const bridgePayload = {
      entries: additions,
      targetId: placement?.targetId || '',
      targetName: placement?.targetName || '',
      position: placement?.position || 'after',
      targetSectionId,
    };
    let bridge = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      bridge = SELF.__PMM_WORLDBOOK_PRESET_DROP_BRIDGE__;
      try {
        bridge = bridge || TOP.__PMM_WORLDBOOK_PRESET_DROP_BRIDGE__;
      } catch (_) {}
      if (typeof bridge?.drop === 'function') break;
      if (attempt < 2) await wait(50 * (attempt + 1));
    }
    if (typeof bridge?.drop === 'function' && additions.length) {
      try {
        const result = await bridge.drop(bridgePayload);
        if (result?.ok !== false) return true;
        if (targetSectionId && result?.reason === 'target-not-resolved') {
          const sectionResult = await bridge.drop({
            ...bridgePayload,
            targetId: '',
            targetName: '',
            position: 'after',
          });
          if (sectionResult?.ok !== false) {
            console.info('[世界书缝合] 目标卡片已刷新，条目已通过工坊原生处理器追加到目标分组末尾');
            return true;
          }
        }
      } catch (error) {
        console.warn(
          targetSectionId
            ? '[世界书缝合] 分组原生桥调用失败，尝试组件事件'
            : '[世界书缝合] 工坊显式拖入桥调用失败，尝试组件事件',
          error,
        );
      }
    }
    const currentDispatcher = nativePresetDropDispatcher();
    component = currentDispatcher?.component || component;
    dropHandler = currentDispatcher?.drop || dropHandler;
    if (targetSectionId) {
      if (((!component || typeof component.emit !== 'function') && typeof dropHandler !== 'function') || !additions.length) {
        console.warn('[世界书缝合] 未取得目标分组对应的工坊原生桥或预设面板，已取消拖入以免条目掉到组外');
        return false;
      }
      try {
        const args = [
          additions,
          placement?.targetId || '',
          placement?.position || 'after',
          targetSectionId,
          undefined,
          false,
        ];
        if (typeof dropHandler === 'function') await dropHandler(...args);
        else component.emit('cross-panel-drop', ...args);
        return true;
      } catch (error) {
        console.warn('[世界书缝合] 分组拖入组件事件不可用，取消直接保存以免条目掉到分组外', error);
        return false;
      }
    }
    if (!component || typeof component.emit !== 'function' || !additions.length) return false;
    try {
      component.emit(
        'cross-panel-drop',
        additions,
        placement?.targetId || '',
        placement?.position || 'after',
        targetSectionId || undefined,
        undefined,
        false,
      );
      return true;
    } catch (error) {
      console.warn('[世界书缝合] 原生预设拖入链路不可用，改用直接保存兜底', error);
      return false;
    }
  }

  function syncVisiblePresetEntries(name, prompts) {
    const visible = nativePresetSnapshot();
    if (!name || visible.name !== name || !Array.isArray(visible.runtimePrompts)) return false;
    try {
      visible.runtimePrompts.splice(0, visible.runtimePrompts.length, ...clone(prompts));
      TOP.setTimeout(scheduleDecorate, 0);
      return true;
    } catch (error) {
      console.warn('[世界书缝合] 预设已保存，但当前卡片即时刷新失败', error);
      return false;
    }
  }

  function insertPresetEntries(prompts, additions, placement = null) {
    const next = clone(prompts);
    if (!placement?.targetId) {
      next.push(...additions);
      return next;
    }
    const targetIndex = next.findIndex(prompt => String(prompt.id) === String(placement.targetId));
    if (targetIndex < 0) {
      next.push(...additions);
      return next;
    }
    const insertionIndex = targetIndex + (placement.position === 'after' ? 1 : 0);
    next.splice(insertionIndex, 0, ...additions);
    return next;
  }

  async function transferFromNativeTop(move, forcedIds = null, placement = null) {
    const source = nativePresetSnapshot();
    const ids = forcedIds?.length ? forcedIds.map(String) : [...source.selected];
    if (!ids.length) return notify('warning', '请先在上方预设勾选需要缝合的条目');
    const wanted = new Set(ids);
    const entries = source.prompts.filter(prompt => wanted.has(String(prompt.id))).map(clone);
    if (!entries.length) return notify('warning', '没有读取到已勾选的预设条目');
    await enqueue(move ? '移动到下方世界书' : '复制到下方世界书', async () => {
      pushUndo(state.bottom, move ? '从预设移动到世界书' : '从预设拖入世界书', {
        worldSides:[state.bottom],
        presetSnapshots:move ? [source] : [],
      });
      insertWorldEntries(state.bottom, 'preset', entries, placement);
      markWorldDraftDirty(state.bottom);
      if (move) {
        await savePresetEntries(source.name, source.prompts.filter(prompt => !wanted.has(String(prompt.id))));
      }
      renderPanels();
      notify('success', `已${move ? '移动' : '复制'} ${entries.length} 条`);
    });
  }

  async function transferToNativeTop(move, forcedKeys = null, placement = null) {
    const source = state.bottom;
    const keys = forcedKeys?.length ? forcedKeys.map(String) : [...source.selected];
    if (!keys.length) return notify('warning', '请先在下方世界书勾选需要缝合的条目');
    const entries = keys.map(key => findEntry(source, key)).filter(Boolean).map(clone);
    if (!entries.length) return;
    await enqueue(move ? '移动到上方预设' : '复制到上方预设', async () => {
      const target = nativePresetSnapshot();
      const additions = entries.map(worldToPreset);
      if (await emitNativePresetDrop(target, additions, placement)) {
        if (move) {
          pushUndo(source, '从世界书移动到预设', { worldSides:[source] });
          removeWorldEntries(source, keys);
          markWorldDraftDirty(source);
        }
        source.selected.clear();
        renderPanels();
        return;
      }
      if (placement?.targetSectionId) {
        notify('error', '目标分组已识别，但未取得工坊拖入处理器；已取消拖入以避免条目掉到组外');
        return;
      }
      pushUndo(source, move ? '从世界书移动到预设' : '从世界书拖入预设', {
        worldSides:move ? [source] : [],
        presetSnapshots:[target],
      });
      await savePresetEntries(target.name, insertPresetEntries(target.prompts, additions, placement));
      if (move) {
        removeWorldEntries(source, keys);
        markWorldDraftDirty(source);
      }
      source.selected.clear();
      renderPanels();
      notify('success', `已${move ? '移动' : '复制'} ${entries.length} 条`);
    });
  }

  async function transferWorldToWorld(fromName, move, forcedKeys = null, placement = null) {
    const source = state[fromName];
    const target = state[fromName === 'top' ? 'bottom' : 'top'];
    const keys = forcedKeys?.length ? forcedKeys.map(String) : [...source.selected];
    if (!keys.length) return notify('warning', '请先勾选需要缝合的世界书条目');
    if (move && source.name === target.name) return notify('warning', '同一本世界书内不需要移动');
    await enqueue(move ? '移动世界书条目' : '复制世界书条目', async () => {
      const wanted = new Set(keys);
      const entries = source.entries.filter(entry => wanted.has(entryKey(entry))).map(clone);
      if (!entries.length) throw new Error('没有从来源世界书读取到所选条目');
      pushUndo(source, move ? '在世界书之间移动条目' : '在世界书之间拖入条目', {
        worldSides:move ? [source, target] : [target],
      });
      insertWorldEntries(target, 'world', entries, placement);
      markWorldDraftDirty(target);
      if (move) {
        removeWorldEntries(source, keys);
        markWorldDraftDirty(source);
      }
      source.selected.clear();
      renderPanels();
      notify('success', `已${move ? '移动' : '复制'} ${entries.length} 条`);
    });
  }

  async function transfer(fromName, move, forcedKeys = null, placement = null) {
    if (fromName === 'top' && state.topType === 'preset') {
      return transferFromNativeTop(move, forcedKeys, placement);
    }
    if (fromName === 'bottom' && state.topType === 'preset') {
      return transferToNativeTop(move, forcedKeys, placement);
    }
    return transferWorldToWorld(fromName, move, forcedKeys, placement);
  }

  function positionRoleOptions(entry) {
    const currentPosition = Number(entry.position);
    const currentRole = Number(entry.role) || 0;
    return POSITION_OPTIONS.flatMap(([position, label]) => {
      if (position !== 4) {
        return `<option value="${position}:0"${currentPosition === position ? ' selected' : ''}>${h(label)}</option>`;
      }
      return ROLE_OPTIONS.map(([role, roleLabel]) => {
        const roleIcon = ['⚙️', '👤', '🤖'][role] || '⚙️';
        const selected = currentPosition === 4 && currentRole === role ? ' selected' : '';
        return `<option value="4:${role}"${selected}>@D ${roleIcon} [${h(roleLabel)}]在深度</option>`;
      }).join('');
    }).join('');
  }

  function field(sideName, key, fieldName, value, options = {}) {
    const type = options.type || 'text';
    const extra = options.extra || '';
    if (type === 'textarea') {
      return `<textarea data-wb-side="${sideName}" data-wb-key="${safeId(key)}" data-wb-field="${fieldName}" ${extra}>${h(value)}</textarea>`;
    }
    return `<input type="${type}" value="${h(value)}" data-wb-side="${sideName}" data-wb-key="${safeId(key)}" data-wb-field="${fieldName}" ${extra}>`;
  }

  function renderDetails(sideName, entry, key, search = null) {
    const atDepth = Number(entry.position) === 4;
    const outlet = Number(entry.position) === 7;
    const green = entry.constant !== true;
    const content = String(entry.content || '');
    const currentMatch = search?.current?.key === key ? search.current : null;
    const contentSearchActive = Boolean(search?.query
      && search.scope !== 'title'
      && worldSearchMatches(content, search.query).length);
    const contentField = contentSearchActive
      ? `<div class="pmm-wb-content-search-wrap" data-wb-action="content-search-edit" data-wb-side="${sideName}" data-wb-key="${safeId(key)}" title="点击编辑正文"><div class="pmm-wb-content-search-preview" aria-hidden="true">${highlightedWorldSearchText(content, search.query, currentMatch, 'content')}</div>${field(sideName, key, 'content', content, { type: 'textarea' })}</div>`
      : field(sideName, key, 'content', content, { type: 'textarea' });
    return `<div class="pmm-wb-details">
      <div class="pmm-wb-detail-row pmm-wb-title-row">
        <label><span><i class="fa-solid fa-tag"></i> 条目名称</span>${field(sideName, key, 'comment', entry.comment || '')}</label>
        <button class="pmm-wb-strategy ${green ? 'is-green' : 'is-blue'}" data-wb-action="strategy" data-wb-side="${sideName}" data-wb-key="${safeId(key)}" title="${green ? '关键词触发（绿灯）' : '常驻触发（蓝灯）'}"><span></span>${green ? '绿灯' : '蓝灯'}</button>
      </div>
      <div class="pmm-wb-meta-grid ${atDepth ? 'has-depth' : ''}">
        <label class="is-position"><span><i class="fa-solid fa-sliders"></i> 位置</span><select data-wb-side="${sideName}" data-wb-key="${safeId(key)}" data-wb-field="positionRole">${positionRoleOptions(entry)}</select></label>
        <label><span>顺序</span>${field(sideName, key, 'order', Number(entry.order ?? 100), { type: 'number', extra: 'step="1"' })}</label>
        ${atDepth ? `<label><span>深度</span>${field(sideName, key, 'depth', Number(entry.depth ?? 4), { type: 'number', extra: 'min="0" max="999" step="1"' })}</label>` : ''}
        ${outlet ? `<label class="is-outlet"><span>Outlet 名称</span>${field(sideName, key, 'outletName', entry.outletName || '')}</label>` : ''}
      </div>
      ${green ? `<label class="pmm-wb-wide-field"><span>关键词</span>${field(sideName, key, 'key', Array.isArray(entry.key) ? entry.key.join(', ') : '')}</label>` : ''}
      <div class="pmm-wb-wide-field pmm-wb-content-field">
        <div class="pmm-wb-field-head"><span><i class="fa-solid fa-align-left"></i> 内容正文</span><span class="pmm-wb-content-tools"><small>${content.length} 字符</small><button type="button" data-wb-action="content-expand" data-wb-side="${sideName}" data-wb-key="${safeId(key)}" title="放大编辑正文" aria-label="放大编辑正文"><i class="fa-solid fa-expand"></i></button></span></div>
        ${contentField}
      </div>
    </div>`;
  }

  function openTextEditor({ host, title, original, sourceField, themeNodes, ariaLabel, onSave, searchable = false }) {
    if (!host || !sourceField) return;
    installStyle();
    host.querySelector('.pmm-wb-editor-overlay')?.remove();
    const text = String(original || '');
    const styles = [...(themeNodes || []), sourceField, host].filter(Boolean).map(node => TOP.getComputedStyle(node));
    const visibleColor = value => {
      const normalized = String(value || '').replace(/\s+/g, '').toLowerCase();
      return normalized && normalized !== 'transparent' && normalized !== 'rgba(0,0,0,0)';
    };
    const pickStyle = (property, fallback, requireVisible = false) => {
      for (const style of styles) {
        const value = style?.[property];
        if (value && (!requireVisible || visibleColor(value))) return value;
      }
      return fallback;
    };
    const overlay = DOC.createElement('div');
    overlay.className = 'pmm-wb-editor-overlay';
    overlay.style.setProperty('--pmm-wb-editor-bg', pickStyle('backgroundColor', '#fff', true));
    overlay.style.setProperty('--pmm-wb-editor-bg-image', pickStyle('backgroundImage', 'none'));
    overlay.style.setProperty('--pmm-wb-editor-field-bg', sourceField ? TOP.getComputedStyle(sourceField).backgroundColor : pickStyle('backgroundColor', 'rgba(127,127,127,.05)', true));
    overlay.style.setProperty('--pmm-wb-editor-text', pickStyle('color', '#222', true));
    overlay.style.setProperty('--pmm-wb-editor-border', sourceField ? TOP.getComputedStyle(sourceField).borderColor : pickStyle('borderColor', 'rgba(127,127,127,.22)', true));
    overlay.style.setProperty('--pmm-wb-editor-accent', styles.map(style => style.getPropertyValue('--pm-quote-color').trim()).find(Boolean) || pickStyle('color', '#3485f6', true));
    overlay.innerHTML = `<section class="pmm-wb-editor-dialog" role="dialog" aria-modal="true" aria-label="${h(ariaLabel || '放大编辑正文')}">
      <header><strong>${h(title)}</strong><span data-wb-editor-count>${text.length} 字符</span>${searchable ? '<button type="button" data-wb-editor-search-toggle title="搜索和替换此条正文" aria-label="搜索和替换此条正文" aria-expanded="false"><i class="fa-solid fa-magnifying-glass"></i></button>' : ''}<button type="button" data-wb-editor-undo title="暂无可撤销输入" aria-label="撤销本次编辑" disabled><i class="fa-solid fa-rotate-left"></i></button><button type="button" data-wb-editor-cancel title="取消"><i class="fa-solid fa-xmark"></i></button><button type="button" data-wb-editor-save title="完成"><i class="fa-solid fa-check"></i></button></header>
      ${searchable ? `<div class="pmm-wb-editor-search" data-wb-editor-search hidden><div class="pmm-wb-editor-search-primary"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><span class="pmm-wb-editor-search-input-wrap"><input type="search" data-wb-editor-search-input placeholder="搜索此条正文" autocomplete="off" enterkeyhint="next"></span><span class="pmm-wb-editor-search-count" data-wb-editor-search-count>0/0</span><button type="button" data-wb-editor-replace-toggle title="展开替换" aria-label="展开替换" aria-expanded="false"><i class="fa-solid fa-repeat"></i></button><button type="button" data-wb-editor-search-previous title="上一个结果" aria-label="上一个结果" disabled><i class="fa-solid fa-chevron-up"></i></button><button type="button" data-wb-editor-search-next title="下一个结果" aria-label="下一个结果" disabled><i class="fa-solid fa-chevron-down"></i></button></div><div class="pmm-wb-editor-replace-row" data-wb-editor-replace-row aria-hidden="true"><input type="text" data-wb-editor-replace-input placeholder="要替换的内容" autocomplete="off"><button type="button" data-wb-editor-replace-current title="替换当前命中">替换</button><button type="button" data-wb-editor-replace-all title="替换此条正文中的全部命中">替换全部</button></div></div>` : ''}
      <div class="pmm-wb-editor-body">${searchable ? '<div class="pmm-wb-editor-search-preview" aria-hidden="true"></div>' : ''}<textarea spellcheck="false">${h(text)}</textarea></div>
    </section>`;
    const textarea = overlay.querySelector('textarea');
    const counter = overlay.querySelector('[data-wb-editor-count]');
    const undoButton = overlay.querySelector('[data-wb-editor-undo]');
    const searchToggle = overlay.querySelector('[data-wb-editor-search-toggle]');
    const searchBar = overlay.querySelector('[data-wb-editor-search]');
    const searchInput = overlay.querySelector('[data-wb-editor-search-input]');
    const searchCount = overlay.querySelector('[data-wb-editor-search-count]');
    const searchPrevious = overlay.querySelector('[data-wb-editor-search-previous]');
    const searchNext = overlay.querySelector('[data-wb-editor-search-next]');
    const replaceToggle = overlay.querySelector('[data-wb-editor-replace-toggle]');
    const replaceRow = overlay.querySelector('[data-wb-editor-replace-row]');
    const replaceInput = overlay.querySelector('[data-wb-editor-replace-input]');
    const replaceCurrent = overlay.querySelector('[data-wb-editor-replace-current]');
    const replaceAll = overlay.querySelector('[data-wb-editor-replace-all]');
    const editorBody = overlay.querySelector('.pmm-wb-editor-body');
    const searchPreview = overlay.querySelector('.pmm-wb-editor-search-preview');
    const undoStack = [];
    let previousValue = text;
    let lastInputAt = 0;
    let editorSearchOpen = false;
    let editorReplaceOpen = false;
    let editorSearchIndex = 0;
    const updateUndoButton = () => {
      const available = undoStack.length > 0;
      undoButton.disabled = !available;
      undoButton.title = available ? '撤销本次编辑' : '暂无可撤销输入';
    };
    const selectedEditorSearchMatch = () => {
      const query = String(searchInput?.value || '').trim();
      const matches = query ? worldSearchMatches(textarea.value, query) : [];
      if (!matches.length) editorSearchIndex = 0;
      else editorSearchIndex = Math.min(Math.max(editorSearchIndex, 0), matches.length - 1);
      const match = matches.length ? { ...matches[editorSearchIndex], field: 'content' } : null;
      return { query, matches, match };
    };
    const syncEditorSearch = ({ reveal = false } = {}) => {
      if (!searchable) return { query: '', matches: [], match: null };
      const result = selectedEditorSearchMatch();
      if (searchBar) searchBar.hidden = !editorSearchOpen;
      if (searchToggle) {
        searchToggle.classList.toggle('is-active', editorSearchOpen);
        searchToggle.setAttribute('aria-expanded', String(editorSearchOpen));
        searchToggle.title = editorSearchOpen ? '收起搜索和替换' : '搜索和替换此条正文';
      }
      if (searchCount) searchCount.textContent = result.query ? `${result.matches.length ? editorSearchIndex + 1 : 0}/${result.matches.length}` : '0/0';
      for (const button of [searchPrevious, searchNext]) {
        if (button) button.disabled = !result.matches.length;
      }
      if (replaceRow) {
        replaceRow.classList.toggle('is-open', editorReplaceOpen);
        replaceRow.setAttribute('aria-hidden', String(!editorReplaceOpen));
      }
      if (replaceToggle) {
        replaceToggle.classList.toggle('is-active', editorReplaceOpen);
        replaceToggle.setAttribute('aria-expanded', String(editorReplaceOpen));
        replaceToggle.title = editorReplaceOpen ? '收起替换' : '展开替换';
      }
      const showPreview = editorSearchOpen && Boolean(result.query);
      editorBody?.classList.toggle('is-search-active', showPreview);
      if (searchPreview) {
        searchPreview.innerHTML = result.query
          ? highlightedWorldSearchText(textarea.value, result.query, result.match, 'content')
          : h(textarea.value);
        searchPreview.scrollTop = textarea.scrollTop;
        searchPreview.scrollLeft = textarea.scrollLeft;
      }
      if (reveal && result.match && searchPreview) {
        const revealMatch = () => {
          const mark = searchPreview.querySelector('.pmm-wb-search-highlight.is-current');
          mark?.scrollIntoView?.({ block: 'center', inline: 'nearest' });
          textarea.scrollTop = searchPreview.scrollTop;
          textarea.scrollLeft = searchPreview.scrollLeft;
        };
        if (typeof TOP.requestAnimationFrame === 'function') TOP.requestAnimationFrame(revealMatch);
        else TOP.setTimeout(revealMatch, 0);
      }
      return result;
    };
    const syncEditorValue = () => {
      counter.textContent = `${textarea.value.length} 字符`;
      updateUndoButton();
      syncEditorSearch();
    };
    const setEditorValue = (next, selectionStart = null, selectionEnd = selectionStart) => {
      const value = String(next ?? '');
      if (value === textarea.value) return false;
      undoStack.push(textarea.value);
      textarea.value = value;
      previousValue = value;
      lastInputAt = 0;
      syncEditorValue();
      if (Number.isFinite(selectionStart)) {
        const start = Math.min(Math.max(0, selectionStart), value.length);
        const end = Math.min(Math.max(start, Number.isFinite(selectionEnd) ? selectionEnd : start), value.length);
        textarea.setSelectionRange(start, end);
      }
      return true;
    };
    const closeEditor = () => overlay.remove();
    const saveEditor = () => {
      const next = String(textarea.value || '');
      overlay.remove();
      if (next !== text) onSave(next);
    };
    textarea.addEventListener('input', () => {
      const now = Date.now();
      if (!undoStack.length || now - lastInputAt > 450) undoStack.push(previousValue);
      previousValue = textarea.value;
      lastInputAt = now;
      syncEditorValue();
    });
    textarea.addEventListener('scroll', () => {
      if (!searchPreview) return;
      searchPreview.scrollTop = textarea.scrollTop;
      searchPreview.scrollLeft = textarea.scrollLeft;
    }, { passive: true });
    undoButton.addEventListener('click', () => {
      if (!undoStack.length) return;
      const start = textarea.selectionStart;
      textarea.value = undoStack.pop();
      previousValue = textarea.value;
      lastInputAt = 0;
      syncEditorValue();
      textarea.focus();
      const cursor = Math.min(Number.isFinite(start) ? start : textarea.value.length, textarea.value.length);
      textarea.setSelectionRange(cursor, cursor);
    });
    searchToggle?.addEventListener('click', () => {
      editorSearchOpen = !editorSearchOpen;
      if (!editorSearchOpen) editorReplaceOpen = false;
      syncEditorSearch();
      if (editorSearchOpen) TOP.setTimeout(() => searchInput?.focus(), 0);
      else textarea.focus();
    });
    searchInput?.addEventListener('input', () => {
      editorSearchIndex = 0;
      syncEditorSearch({ reveal: true });
    });
    searchInput?.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const result = selectedEditorSearchMatch();
      if (!result.matches.length) return;
      editorSearchIndex = (editorSearchIndex + (event.shiftKey ? -1 : 1) + result.matches.length) % result.matches.length;
      syncEditorSearch({ reveal: true });
    });
    searchPrevious?.addEventListener('click', () => {
      const result = selectedEditorSearchMatch();
      if (!result.matches.length) return;
      editorSearchIndex = (editorSearchIndex - 1 + result.matches.length) % result.matches.length;
      syncEditorSearch({ reveal: true });
    });
    searchNext?.addEventListener('click', () => {
      const result = selectedEditorSearchMatch();
      if (!result.matches.length) return;
      editorSearchIndex = (editorSearchIndex + 1) % result.matches.length;
      syncEditorSearch({ reveal: true });
    });
    replaceToggle?.addEventListener('click', () => {
      editorReplaceOpen = !editorReplaceOpen;
      syncEditorSearch();
      if (editorReplaceOpen) TOP.setTimeout(() => replaceInput?.focus(), 0);
    });
    replaceCurrent?.addEventListener('click', () => {
      const { query, match } = selectedEditorSearchMatch();
      if (!query) return notify('warning', '请先输入要查找的文字');
      if (!match) return notify('info', '此条正文中没有可替换的命中');
      const replacement = String(replaceInput?.value ?? '');
      const result = replaceOneWorldSearchText(textarea.value, match, replacement);
      if (!result.count) return notify('info', '当前命中已变化，请重新查找');
      const cursor = match.start + replacement.length;
      setEditorValue(result.value, cursor, cursor);
      syncEditorSearch({ reveal: true });
      notify('success', replacement ? '已替换 1 处' : '已删除 1 处匹配文字');
    });
    replaceAll?.addEventListener('click', () => {
      const { query, matches } = selectedEditorSearchMatch();
      if (!query) return notify('warning', '请先输入要查找的文字');
      if (!matches.length) return notify('info', '此条正文中没有可替换的命中');
      const replacement = String(replaceInput?.value ?? '');
      if (!replacement && typeof TOP.confirm === 'function' && !TOP.confirm(`将在此条正文中删除 ${matches.length} 处“${query}”，确定继续吗？`)) return;
      const result = replaceWorldSearchText(textarea.value, query, replacement);
      if (!result.count) return notify('info', '当前命中已变化，请重新查找');
      editorSearchIndex = 0;
      setEditorValue(result.value, 0, 0);
      syncEditorSearch();
      notify('success', replacement ? `已替换 ${result.count} 处` : `已删除 ${result.count} 处匹配文字`);
    });
    overlay.querySelector('[data-wb-editor-cancel]').addEventListener('click', closeEditor);
    overlay.querySelector('[data-wb-editor-save]').addEventListener('click', saveEditor);
    overlay.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (editorSearchOpen) {
          editorSearchOpen = false;
          editorReplaceOpen = false;
          syncEditorSearch();
          textarea.focus();
          return;
        }
        closeEditor();
      }
    });
    host.append(overlay);
    TOP.setTimeout(() => textarea.focus(), 20);
  }

  function openContentEditor(sideName, key) {
    const side = state[sideName];
    const entry = side ? findEntry(side, key) : null;
    if (!entry || !state.host) return;
    const panel = state.host.querySelector(`[data-pmm-wb-panel="${sideName}"]`);
    const sourceField = panel?.querySelector(`[data-wb-key="${safeId(key)}"][data-wb-field="content"]`);
    const sourceEntry = sourceField?.closest('.pmm-wb-entry');
    openTextEditor({
      host: state.host,
      title: entryTitle(entry),
      original: entry.content,
      sourceField,
      themeNodes: [panel, sourceEntry],
      ariaLabel: '放大编辑世界书正文',
      searchable: true,
      onSave(next) {
        pushUndo(side, '编辑世界书正文', { worldSides:[side] });
        entry.content = next;
        side.data.entries[String(entry.uid)] = entry;
        markWorldDraftDirty(side);
        renderPanels();
      },
    });
  }

  function focusWorldSearchContent(sideName, key) {
    const panel = state.host?.querySelector?.(`[data-pmm-wb-panel="${sideName}"]`);
    const textarea = panel?.querySelector?.(`[data-wb-key="${safeId(key)}"][data-wb-field="content"]`);
    textarea?.closest?.('.pmm-wb-content-search-wrap')?.classList?.add('is-editing');
    textarea?.focus?.({ preventScroll: true });
    keepWorldContentEditorVisible(textarea);
  }

  function clearWorldContentEditorShift(textarea) {
    const card = textarea?.closest?.('.pmm-wb-inline-panel');
    if (!card) return;
    card.removeAttribute('data-pmm-wb-keyboard-shift');
    card.style.removeProperty('--pmm-wb-keyboard-shift');
  }

  function shiftWorldContentEditorAboveKeyboard(textarea) {
    const card = textarea?.closest?.('.pmm-wb-inline-panel');
    if (!card || !textarea?.isConnected) return;
    clearWorldContentEditorShift(textarea);
    const viewport = TOP.visualViewport;
    const viewportTop = Number(viewport?.offsetTop) || 0;
    const viewportHeight = Number(viewport?.height) || Number(TOP.innerHeight) || 0;
    if (!viewportHeight) return;
    const rect = textarea.getBoundingClientRect();
    const visibleBottom = viewportTop + viewportHeight - 18;
    if (rect.top >= viewportTop + 12 && rect.bottom <= visibleBottom) return;
    const desiredTop = viewportTop + Math.max(70, Math.min(viewportHeight * .4, (viewportHeight - Math.min(rect.height, 180)) / 2));
    const shift = Math.round(desiredTop - rect.top);
    if (shift >= 0) return;
    card.style.setProperty('--pmm-wb-keyboard-shift', `${shift}px`);
    card.setAttribute('data-pmm-wb-keyboard-shift', '');
    textarea.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
  }

  function keepWorldContentEditorVisible(textarea) {
    if (!textarea) return;
    const adjust = () => {
      if (!state.open || !textarea.isConnected || DOC.activeElement !== textarea) return;
      shiftWorldContentEditorAboveKeyboard(textarea);
    };
    adjust();
    for (const delay of [80, 240, 520]) TOP.setTimeout(adjust, delay);
  }

  function openPresetContentEditor(button) {
    const editor = button.closest('.prompt-editor');
    const sourceField = editor?.querySelector('.prompt-editor__textarea');
    const host = button.closest('#preset-manager-main-panel') || DOC.getElementById('preset-manager-main-panel');
    if (!editor || !sourceField || !host) return;
    const item = editor.closest('.prompt-item');
    const panel = editor.closest('.preset-panel');
    const title = editor.querySelector('.prompt-editor__name-input')?.value
      || item?.querySelector('.prompt-card__name,.prompt-card__title')?.textContent?.trim()
      || '预设条目';
    openTextEditor({
      host,
      title,
      original: sourceField.value,
      sourceField,
      themeNodes: [panel, item, editor],
      ariaLabel: '放大编辑预设正文',
      onSave(next) {
        sourceField.value = next;
        sourceField.dispatchEvent(new TOP.Event('input', { bubbles: true }));
        sourceField.dispatchEvent(new TOP.Event('change', { bubbles: true }));
      },
    });
  }

  function onPresetExpandClick(event) {
    const button = event.target.closest?.('.prompt-editor__expand-btn');
    if (!button || !button.closest('#preset-manager-main-panel')) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    openPresetContentEditor(button);
  }

  function selectedWorldEntryKeys(side) {
    if (!side?.selected?.size) return [];
    return side.entries.filter(entry => side.selected.has(entryKey(entry))).map(entryKey);
  }

  function worldMultiCandidates(side) {
    const search = collectWorldSearch(side);
    return search.query ? search.entries : side.entries;
  }

  function multiSelectionMarkup(sideName, side) {
    const candidates = worldMultiCandidates(side);
    const keys = candidates.map(entryKey);
    const allSelected = keys.length > 0 && keys.every(key => side.selected.has(key));
    const scope = String(side.query || '').trim() ? `搜索结果 ${keys.length}` : `全部 ${keys.length}`;
    return `<div class="pmm-wb-multi-bar"><button type="button" data-wb-action="select-all" data-wb-side="${sideName}" ${keys.length ? '' : 'disabled'} title="${allSelected ? '取消全选' : '全选'}${scope}"><i class="fa-${allSelected ? 'solid' : 'regular'} fa-square${allSelected ? '-check' : ''}"></i>${allSelected ? '取消全选' : '全选'}</button><span>已选 ${side.selected.size}/${side.entries.length}</span></div>`;
  }

  function toggleWorldSelectAll(sideName) {
    const side = state[sideName];
    if (!side) return;
    const keys = worldMultiCandidates(side).map(entryKey);
    if (!keys.length) return;
    const allSelected = keys.every(key => side.selected.has(key));
    for (const key of keys) {
      if (allSelected) side.selected.delete(key);
      else side.selected.add(key);
    }
    renderPanels();
  }

  function renderEntry(sideName, side, entry, search = null) {
    const key = entryKey(entry);
    const expanded = side.expanded.has(key);
    const selected = side.selected.has(key);
    const enabled = entry.disable !== true;
    const entryMatches = search?.byKey?.get(key) || [];
    const currentMatch = search?.current;
    const isCurrent = currentMatch?.key === key;
    const title = search?.scope !== 'content'
      ? highlightedWorldSearchText(entryTitle(entry), search?.query, isCurrent ? currentMatch : null, 'title')
      : h(entryTitle(entry));
    return `<article class="pmm-wb-entry${expanded ? ' is-expanded' : ''}${isCurrent ? ' pmm-wb-entry--search-current' : ''}${side.multi && selected ? ' pmm-wb-entry--selected' : ''}" data-wb-entry="${safeId(key)}" draggable="true" data-wb-drag-side="${sideName}" data-wb-drag-key="${safeId(key)}">
      <div class="pmm-wb-entry-head">
        ${side.multi ? `<button class="pmm-wb-check${selected ? ' is-selected' : ''}" data-wb-action="select" data-wb-side="${sideName}" data-wb-key="${safeId(key)}" aria-label="选择条目"><i class="fa-${selected ? 'solid' : 'regular'} fa-square${selected ? '-check' : ''}"></i></button>` : ''}
        <button class="pmm-wb-expand" data-wb-action="expand" data-wb-side="${sideName}" data-wb-key="${safeId(key)}" aria-label="展开条目"><i class="fa-solid fa-gear"></i></button>
        <span class="pmm-wb-dot ${entry.constant === true ? 'is-blue' : 'is-green'}" title="${entry.constant === true ? '蓝灯：常驻' : '绿灯：关键词触发'}"></span>
        <button class="pmm-wb-entry-title" data-wb-action="expand" data-wb-side="${sideName}" data-wb-key="${safeId(key)}">${title}</button>
        ${entryMatches.length ? `<span class="pmm-wb-search-hit" title="找到 ${entryMatches.length} 处">${entryMatches.length}</span>` : ''}
        ${expanded ? `<span class="pmm-wb-entry-actions" aria-label="条目操作">
          <button type="button" class="pmm-wb-entry-action" data-wb-action="duplicate-entry" data-wb-side="${sideName}" data-wb-key="${safeId(key)}" title="复制条目" aria-label="复制条目"><i class="fa-solid fa-copy"></i></button>
          <button type="button" class="pmm-wb-entry-action" data-wb-action="delete-entry" data-wb-side="${sideName}" data-wb-key="${safeId(key)}" title="删除条目" aria-label="删除条目"><i class="fa-solid fa-trash"></i></button>
        </span>` : ''}
        <button class="pmm-wb-toggle${enabled ? ' is-on' : ''}" data-wb-action="toggle" data-wb-side="${sideName}" data-wb-key="${safeId(key)}" title="${enabled ? '已启用' : '已停用'}"><span></span></button>
      </div>
      ${expanded ? renderDetails(sideName, entry, key, search) : ''}
    </article>`;
  }

  function toolbarButton(action, title, icon, extra = '') {
    return `<button type="button" class="pmm-wb-tool" data-wb-action="${action}" title="${title}" ${extra}><i class="fa-solid ${icon}"></i></button>`;
  }

  function typeSwitchMarkup() {
    return `<span class="pmm-wb-kind-switch pmm-wb-kind-switch--toolbar" data-pmm-wb-kind-switch>
      <button type="button" data-wb-action="top-kind" data-wb-kind="preset" class="${state.topType === 'preset' ? 'is-active' : ''}" title="上方显示预设"><i class="fa-solid fa-sliders"></i></button>
      <button type="button" data-wb-action="top-kind" data-wb-kind="world" class="${state.topType === 'world' ? 'is-active' : ''}" title="上方显示世界书"><i class="fa-solid fa-book-atlas"></i></button>
    </span>`;
  }

  function themeToolbarSlotMarkup() {
    return '<span class="pmm-wb-theme-slot" data-pmm-theme-toolbar-slot></span>';
  }

  function sourceOptions(side) {
    return state.worldNames.map(name => `<option value="${h(name)}"${name === side.name ? ' selected' : ''}>${h(name)}</option>`).join('');
  }

  function worldSourceTitleMarkup(sideName, side) {
    const row = `<span class="pmm-wb-title-row">
      <select class="title-select pmm-wb-source-select" data-wb-action="select-source" data-wb-side="${sideName}" aria-label="选择世界书">${sourceOptions(side)}</select>
      <button class="pmm-preset-search-btn pmm-wb-source-action" data-wb-action="source-picker" data-wb-side="${sideName}" title="搜索世界书"><i class="fa-solid fa-magnifying-glass"></i></button>
      <button class="pmm-wb-source-action" data-wb-action="rename-source" data-wb-side="${sideName}" title="重命名世界书"><i class="fa-solid fa-pencil"></i></button>
    </span>`;
    return sideName === 'top'
      ? `<div class="header-card title-card title-card--interactive pmm-wb-title-card">${row}</div>`
      : row;
  }

  function searchScopeButton(sideName, side, scope, label) {
    return `<button type="button" class="${worldSearchScope(side.searchScope) === scope ? 'is-active' : ''}" data-wb-action="search-scope" data-wb-side="${sideName}" data-wb-search-scope="${scope}" title="${label}">${label}</button>`;
  }

  function worldSearchView(side) {
    const search = collectWorldSearch(side);
    const resultIndex = search.matches.length ? Math.min(Math.max(Number(side.searchIndex) || 0, 0), search.matches.length - 1) : -1;
    side.searchIndex = resultIndex < 0 ? 0 : resultIndex;
    search.current = resultIndex < 0 ? null : search.matches[resultIndex];
    const filtered = search.query ? search.entries : side.entries;
    const visible = filtered.slice(0, side.limit);
    const remaining = filtered.length - visible.length;
    const searchSummary = search.query ? `${search.matches.length ? resultIndex + 1 : 0}/${search.matches.length}` : `${side.entries.length}/${side.entries.length}`;
    return { search, visible, remaining, searchSummary };
  }

  function renderWorldListMarkup(sideName, side, view) {
    return `${side.name
      ? (view.visible.length
        ? view.visible.map(entry => renderEntry(sideName, side, entry, view.search)).join('')
        : '<div class="pmm-wb-empty">没有找到匹配条目</div>')
      : '<div class="pmm-wb-empty">暂无可用世界书</div>'}
      ${view.remaining > 0 ? `<button class="pmm-wb-more" data-wb-action="more" data-wb-side="${sideName}">继续显示 ${Math.min(PAGE_SIZE, view.remaining)} 条（剩余 ${view.remaining}）</button>` : ''}`;
  }

  function renderWorldCard(sideName, side) {
    const view = worldSearchView(side);
    return `<section class="preset-panel pmm-wb-inline-panel" data-pmm-wb-panel="${sideName}">
      <div class="pmm-wb-main-content">
        <header class="pmm-wb-header">
          <div class="pmm-wb-header-left${sideName === 'top' ? ' header-left' : ''}">
            ${worldSourceTitleMarkup(sideName, side)}
          </div>
          <div class="pmm-wb-header-right">
             <span class="pmm-wb-status">${h(state.status)}</span>
             ${sideName === 'top' ? typeSwitchMarkup() : ''}
             ${sideName === 'top' ? themeToolbarSlotMarkup() : ''}
             ${toolbarButton('multi', side.multi ? '退出多选' : '多选', 'fa-check-double', `data-wb-side="${sideName}"`)}
            ${side.multi
              ? toolbarButton('batch-delete', '删除所选', 'fa-trash', `data-wb-side="${sideName}" ${side.selected.size ? '' : 'disabled'}`)
              : toolbarButton('undo', side.history.length ? `撤销：${side.history[side.history.length - 1].label}` : '暂无可撤销操作', 'fa-rotate-left', `data-wb-side="${sideName}" ${side.history.length ? '' : 'disabled'}`)}
            ${toolbarButton('entry-search', '搜索条目', 'fa-magnifying-glass', `data-wb-side="${sideName}"`)}
            ${toolbarButton('save', '保存', 'fa-floppy-disk', `data-wb-side="${sideName}"${side.dirty ? ' data-wb-dirty="true"' : ''}`)}
            ${toolbarButton(sideName === 'top' ? 'close-main' : 'exit', '关闭', 'fa-xmark')}
          </div>
        </header>
        ${side.searchOpen ? `<div class="pmm-wb-search-bar"><div class="pmm-wb-search-primary"><i class="fa-solid fa-magnifying-glass"></i><span class="pmm-wb-search-input-wrap"><input type="search" value="${h(side.query)}" data-wb-action="search-input" data-wb-side="${sideName}" placeholder="搜索条目" autocomplete="off"><span class="pmm-wb-search-count">${view.searchSummary}</span></span><button type="button" class="pmm-wb-replace-toggle${side.replaceOpen ? ' is-active' : ''}" data-wb-action="replace-toggle" data-wb-side="${sideName}" title="${side.replaceOpen ? '收起替换' : '展开替换'}" aria-expanded="${side.replaceOpen}"><i class="fa-solid fa-repeat"></i></button><button type="button" class="pmm-wb-search-nav" data-wb-action="search-previous" data-wb-side="${sideName}" title="上一个结果" ${view.search.matches.length ? '' : 'disabled'}><i class="fa-solid fa-chevron-up"></i></button><button type="button" class="pmm-wb-search-nav" data-wb-action="search-next" data-wb-side="${sideName}" title="下一个结果" ${view.search.matches.length ? '' : 'disabled'}><i class="fa-solid fa-chevron-down"></i></button><span class="pmm-wb-search-scope" role="group" aria-label="搜索范围">${searchScopeButton(sideName, side, 'all', '全')}${searchScopeButton(sideName, side, 'title', '仅标题')}${searchScopeButton(sideName, side, 'content', '仅内容')}</span></div><div class="pmm-wb-replace-row${side.replaceOpen ? ' is-open' : ''}" data-wb-replace-row="${sideName}" aria-hidden="${!side.replaceOpen}"><input type="text" value="${h(side.replaceValue)}" data-wb-action="replace-input" data-wb-side="${sideName}" placeholder="要替换的内容" autocomplete="off"><button type="button" class="pmm-wb-replace-action" data-wb-action="replace-current" data-wb-side="${sideName}" title="替换当前命中">替换</button><button type="button" class="pmm-wb-replace-action" data-wb-action="replace-all" data-wb-side="${sideName}" title="替换当前范围内的全部命中">替换全部</button></div></div>` : ''}
        ${side.multi ? multiSelectionMarkup(sideName, side) : ''}
        <div class="pmm-wb-content">
          <div class="pmm-wb-list" data-wb-list="${sideName}">
            ${renderWorldListMarkup(sideName, side, view)}
          </div>
        </div>
      </div>
    </section>`;
  }

  function refreshWorldSearchResults(sideName) {
    const side = state[sideName];
    const panel = state.host?.querySelector?.(`[data-pmm-wb-panel="${sideName}"]`);
    const list = panel?.querySelector?.(`[data-wb-list="${sideName}"]`);
    if (!side || !panel || !list) return false;
    const view = worldSearchView(side);
    list.innerHTML = renderWorldListMarkup(sideName, side, view);
    const count = panel.querySelector('.pmm-wb-search-count');
    if (count) count.textContent = view.searchSummary;
    for (const button of panel.querySelectorAll('[data-wb-action="search-previous"],[data-wb-action="search-next"]')) {
      button.disabled = !view.search.matches.length;
    }
    for (const button of panel.querySelectorAll('[data-wb-action="search-scope"]')) {
      button.classList.toggle('is-active', button.dataset.wbSearchScope === worldSearchScope(side.searchScope));
    }
    return true;
  }

  function createCard(sideName, side) {
    const holder = DOC.createElement('div');
    holder.innerHTML = renderWorldCard(sideName, side);
    return holder.firstElementChild;
  }

  function saveScrolls() {
    for (const name of ['top', 'bottom']) {
      const list = state.host?.querySelector?.(`[data-wb-list="${name}"]`);
      if (list) state[name].scrollTop = list.scrollTop;
    }
  }

  function restoreScrolls() {
    for (const name of ['top', 'bottom']) {
      const list = state.host?.querySelector?.(`[data-wb-list="${name}"]`);
      if (list) list.scrollTop = state[name].scrollTop || 0;
    }
  }

  function decorateNativeTop() {
    const panel = state.nativeTop;
    if (!panel) return;
    panel.classList.toggle('pmm-wb-native-hidden', state.topType !== 'preset');
    let switcher = panel.querySelector('[data-pmm-wb-kind-switch]');
    if (!switcher) {
      const headerRight = panel.querySelector('.header-right');
      if (headerRight) {
        const holder = DOC.createElement('span');
        holder.innerHTML = typeSwitchMarkup();
        switcher = holder.firstElementChild;
        headerRight.prepend(switcher);
      }
    } else {
      switcher.querySelectorAll('[data-wb-kind]').forEach(button => {
        button.classList.toggle('is-active', button.dataset.wbKind === state.topType);
      });
    }
    if (switcher) {
      let themeSlot = panel.querySelector('[data-pmm-theme-toolbar-slot]');
      if (!themeSlot) {
        themeSlot = DOC.createElement('span');
        themeSlot.className = 'pmm-wb-theme-slot';
        themeSlot.setAttribute('data-pmm-theme-toolbar-slot', '');
      }
      if (switcher.nextElementSibling !== themeSlot) switcher.after(themeSlot);
    }
    panel.querySelector('[data-pmm-wb-native-transfer]')?.remove();
  }

  function placeThemeToolbarButton(themeToggle = state.host?.querySelector?.('.pmm-mobile-theme-toggle')) {
    if (!themeToggle) return;
    const target = state.topType === 'world'
      ? state.topCard?.querySelector?.('[data-pmm-theme-toolbar-slot]')
      : state.nativeTop?.querySelector?.('[data-pmm-theme-toolbar-slot]');
    if (target && themeToggle.parentElement !== target) target.append(themeToggle);
  }

  function renderPanels() {
    if (!state.open || !state.host?.isConnected) return;
    syncWorldSearchHighlightTheme();
    saveScrolls();
    const themeToggle = state.host.querySelector('.pmm-mobile-theme-toggle');
    state.topCard?.remove();
    state.bottomCard?.remove();
    state.topCard = null;
    state.bottomCard = null;
    decorateNativeTop();
    if (state.topType === 'world') {
      state.topCard = createCard('top', state.top);
      state.mainWrapper.insertBefore(state.topCard, state.mainWrapper.querySelector('.side-panel-root'));
    }
    state.bottomCard = createCard('bottom', state.bottom);
    state.container.append(state.bottomCard);
    placeThemeToolbarButton(themeToggle);
    markWorldbookButton();
    restoreScrolls();
  }

  function scheduleDecorate() {
    if (renderFrame || !state.open) return;
    renderFrame = TOP.requestAnimationFrame(() => {
      renderFrame = 0;
      syncWorldSearchHighlightTheme();
      decorateNativeTop();
      placeThemeToolbarButton();
      markWorldbookButton();
    });
  }

  function markWorldbookButton() {
    state.host?.querySelectorAll?.('.panel-btn').forEach(button => {
      button.classList.toggle('panel-btn--active', button.matches('[data-pmm-worldbook-placeholder="1"]'));
    });
  }

  function parseFieldValue(target, fieldName) {
    if (fieldName === 'key') return String(target.value || '').split(',').map(value => value.trim()).filter(Boolean);
    if (['position', 'order', 'depth', 'role'].includes(fieldName)) return Number(target.value) || 0;
    return String(target.value ?? '');
  }

  async function updateField(target) {
    const sideName = target.dataset.wbSide;
    const side = state[sideName];
    const key = decodeId(target.dataset.wbKey);
    const fieldName = target.dataset.wbField;
    const entry = findEntry(side, key);
    if (!entry || !fieldName) return;
    pushUndo(side, '编辑世界书条目', { worldSides:[side] });
    if (fieldName === 'positionRole') {
      const [positionValue, roleValue] = String(target.value || '0:0').split(':');
      entry.position = Number(positionValue) || 0;
      if (entry.position === 4) entry.role = Number(roleValue) || 0;
    } else {
      entry[fieldName] = parseFieldValue(target, fieldName);
    }
    side.data.entries[String(entry.uid)] = entry;
    markWorldDraftDirty(side);
    renderPanels();
  }

  async function deleteSelected(sideName) {
    const side = state[sideName];
    const keys = [...side.selected];
    if (!keys.length) return;
    if (!TOP.confirm?.(`确定删除所选的 ${keys.length} 条世界书条目吗？`)) return;
    await enqueue('批量删除', async () => {
      pushUndo(side, '批量删除世界书条目', { worldSides:[side] });
      removeWorldEntries(side, keys);
      markWorldDraftDirty(side);
      side.selected.clear();
      renderPanels();
      notify('success', `已删除 ${keys.length} 条`);
    });
  }

  async function duplicateWorldEntry(sideName, key) {
    const side = state[sideName];
    const sourceEntry = findEntry(side, key);
    if (!sourceEntry) return;
    await enqueue('复制世界书条目', async () => {
      pushUndo(side, '复制世界书条目', { worldSides:[side] });
      const [copy] = insertWorldEntries(side, 'world', [sourceEntry], { targetKey:key, position:'after' });
      if (copy) side.expanded.add(entryKey(copy));
      markWorldDraftDirty(side);
      renderPanels();
    });
  }

  async function deleteWorldEntry(sideName, key) {
    const side = state[sideName];
    if (!findEntry(side, key)) return;
    await enqueue('删除世界书条目', async () => {
      pushUndo(side, '删除世界书条目', { worldSides:[side] });
      removeWorldEntries(side, [key]);
      side.selected.delete(String(key));
      side.expanded.delete(String(key));
      markWorldDraftDirty(side);
      renderPanels();
      notify('success', '已删除条目，可撤销');
    });
  }

  function nativeWorldEditorSelectedName() {
    const select = DOC.querySelector('#world_editor_select');
    // SillyTavern stores the option's numeric list index in `value`; the
    // visible option text is the actual world-book filename.  Comparing the
    // index to a filename silently skipped the native-editor reload on save.
    return String(select?.selectedOptions?.[0]?.textContent ?? select?.options?.[select.selectedIndex]?.textContent ?? '').trim();
  }

  function watchNativeWorldRename(oldName) {
    let attempts = 0;
    const watch = async () => {
      if (!state.open || attempts++ > 80) return;
      const selectedName = nativeWorldEditorSelectedName();
      if (selectedName && selectedName !== oldName) {
        await refreshWorldNames();
        if (state.worldNames.includes(selectedName) && !state.worldNames.includes(oldName)) {
          for (const side of [state.top, state.bottom]) {
            if (side.name === oldName) side.name = selectedName;
          }
          await loadWorldSide(state.bottom);
          if (state.topType === 'world') await loadWorldSide(state.top);
          renderPanels();
          return;
        }
      }
      TOP.setTimeout(() => { void watch(); }, 400);
    };
    TOP.setTimeout(() => { void watch(); }, 400);
  }

  async function renameWorldSource(sideName) {
    const side = state[sideName];
    if (!side?.name) return notify('warning', '请先选择世界书');
    if (!context?.reloadWorldInfoEditor) return notify('warning', '当前酒馆没有提供安全重命名接口');
    const oldName = side.name;
    context.reloadWorldInfoEditor(oldName, true);
    for (let attempt = 0; attempt < 12 && nativeWorldEditorSelectedName() !== oldName; attempt++) await wait(40);
    const renameButton = DOC.querySelector('#world_popup_name_button');
    if (!renameButton) return notify('warning', '酒馆原生世界书重命名尚未就绪，请稍后再试');
    renameButton.click();
    watchNativeWorldRename(oldName);
  }

  function selectedWorldSearchMatch(side) {
    const search = collectWorldSearch(side);
    if (!search.matches.length) return { search, match: null };
    const index = Math.min(Math.max(Number(side.searchIndex) || 0, 0), search.matches.length - 1);
    side.searchIndex = index;
    return { search, match: search.matches[index] };
  }

  function revealWorldSearchMatch(sideName, focusContent = true) {
    const side = state[sideName];
    const { match } = selectedWorldSearchMatch(side);
    if (!match) return;
    side.expanded.add(match.key);
    refreshWorldSearchResults(sideName);
    TOP.setTimeout(() => {
      const panel = state.host?.querySelector?.(`[data-pmm-wb-panel="${sideName}"]`);
      const card = panel?.querySelector?.(`[data-wb-entry="${safeId(match.key)}"]`);
      card?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      if (focusContent && match.field === 'content') {
        const activeHighlight = card?.querySelector?.('.pmm-wb-content-search-preview .pmm-wb-search-highlight.is-current');
        if (activeHighlight) {
          activeHighlight.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
        } else {
          const textarea = card?.querySelector?.('[data-wb-field="content"]');
          if (!textarea) return;
          textarea.focus?.({ preventScroll: true });
          textarea.setSelectionRange?.(match.start, match.end);
        }
      }
    }, 40);
  }

  function resetWorldSearch(sideName, options = {}) {
    const side = state[sideName];
    if (!side) return;
    side.searchIndex = 0;
    const currentList = state.host?.querySelector?.(`[data-wb-list="${sideName}"]`);
    if (currentList) currentList.scrollTop = 0;
    const { match } = selectedWorldSearchMatch(side);
    if (match?.field === 'content') side.expanded.add(match.key);
    refreshWorldSearchResults(sideName);
    if (options.refocus) {
      TOP.setTimeout(() => {
        const input = state.host?.querySelector?.(`[data-pmm-wb-panel="${sideName}"] [data-wb-action="search-input"]`);
        if (input) {
          input.focus();
          const end = String(input.value || '').length;
          input.setSelectionRange?.(end, end);
        }
      }, 20);
    }
  }

  function moveWorldSearch(sideName, direction) {
    const side = state[sideName];
    const search = collectWorldSearch(side);
    if (!search.matches.length) return;
    const start = Number(side.searchIndex) || 0;
    side.searchIndex = (start + direction + search.matches.length) % search.matches.length;
    revealWorldSearchMatch(sideName, true);
  }

  function updateWorldReplaceVisibility(sideName) {
    const side = state[sideName];
    const panel = state.host?.querySelector?.(`[data-pmm-wb-panel="${sideName}"]`);
    const row = panel?.querySelector?.(`[data-wb-replace-row="${sideName}"]`);
    const toggle = panel?.querySelector?.('[data-wb-action="replace-toggle"]');
    if (!side || !row || !toggle) return false;
    row.classList.toggle('is-open', side.replaceOpen);
    row.setAttribute('aria-hidden', String(!side.replaceOpen));
    toggle.classList.toggle('is-active', side.replaceOpen);
    toggle.setAttribute('aria-expanded', String(side.replaceOpen));
    toggle.setAttribute('title', side.replaceOpen ? '收起替换' : '展开替换');
    return true;
  }

  function replacementScopeLabel(scope) {
    return scope === 'title' ? '条目名称' : scope === 'content' ? '条目正文' : '条目名称和正文';
  }

  function refreshAfterWorldReplacement(sideName) {
    const side = state[sideName];
    if (!side) return;
    syncWorldUndoButton(sideName);
    if (selectedWorldSearchMatch(side).match) revealWorldSearchMatch(sideName, false);
    else refreshWorldSearchResults(sideName);
    const otherName = sideName === 'top' ? 'bottom' : 'top';
    const other = state[otherName];
    if (state.topType === 'world' && other?.name === side.name) refreshWorldSearchResults(otherName);
  }

  function syncWorldUndoButton(sideName) {
    const side = state[sideName];
    const button = state.host?.querySelector?.(`[data-pmm-wb-panel="${sideName}"] [data-wb-action="undo"]`);
    if (!side || !button) return false;
    const snapshot = side.history[side.history.length - 1];
    const available = Boolean(snapshot);
    button.disabled = !available;
    button.setAttribute('aria-disabled', String(!available));
    button.title = available ? `撤销：${snapshot.label}` : '暂无可撤销操作';
    return true;
  }

  async function replaceCurrentWorldSearch(sideName) {
    const side = state[sideName];
    const { search, match } = selectedWorldSearchMatch(side);
    if (!search.query) return notify('warning', '请先输入要查找的文字');
    if (!match) return notify('info', '当前范围内没有可替换的命中');
    const replacement = String(side.replaceValue ?? '');
    await enqueue('替换当前命中', async () => {
      const entry = findEntry(side, match.key);
      if (!entry) return notify('info', '当前命中已变化，请重新查找');
      const value = match.field === 'title' ? entryTitle(entry) : String(entry.content ?? '');
      const stillMatches = worldSearchMatches(value, search.query)
        .some(range => range.start === match.start && range.end === match.end);
      if (match.start < 0 || match.end < match.start || match.end > value.length || !stillMatches) {
        return notify('info', '当前命中已变化，请重新查找');
      }
      pushUndo(side, replacement ? '替换 1 处' : '删除 1 处匹配文字', { worldSides:[side] });
      const changed = replaceWorldSearchMatch(entry, match, replacement);
      if (!changed) return notify('info', '当前命中已变化，请重新查找');
      side.data.entries[String(entry.uid)] = entry;
      markWorldDraftDirty(side);
      refreshAfterWorldReplacement(sideName);
      notify('success', replacement ? '已替换 1 处' : '已删除 1 处匹配文字');
    });
  }

  async function replaceAllWorldSearchEntries(sideName) {
    const side = state[sideName];
    const search = collectWorldSearch(side);
    if (!search.query) return notify('warning', '请先输入要查找的文字');
    if (!search.matches.length) return notify('info', '当前范围内没有可替换的命中');
    const replacement = String(side.replaceValue ?? '');
    const scope = worldSearchScope(side.searchScope);
    if (!replacement && typeof TOP.confirm === 'function' && !TOP.confirm(`将在${replacementScopeLabel(scope)}中删除 ${search.matches.length} 处“${search.query}”，确定继续吗？`)) return;
    await enqueue('替换全部命中', async () => {
      pushUndo(side, replacement ? `替换全部（${search.matches.length} 处）` : `删除全部匹配（${search.matches.length} 处）`, { worldSides:[side] });
      let changed = 0;
      for (const entry of side.entries) {
        const replaced = replaceAllWorldSearchMatches(entry, scope, search.query, replacement);
        if (!replaced) continue;
        changed += replaced;
        side.data.entries[String(entry.uid)] = entry;
      }
      if (!changed) return notify('info', '当前命中已变化，请重新查找');
      markWorldDraftDirty(side);
      refreshAfterWorldReplacement(sideName);
      notify('success', replacement ? `已替换 ${changed} 处` : `已删除 ${changed} 处匹配文字`);
    });
  }

  function openSourcePicker(sideName) {
    const side = state[sideName];
    refreshCharacterWorldBindings();
    removeSourcePicker(state.host.querySelector('.pmm-wb-source-picker'));
    const overlay = DOC.createElement('div');
    overlay.className = 'pmm-wb-source-picker';
    overlay.innerHTML = `<div class="pmm-wb-picker-dialog"><div class="pmm-wb-picker-head"><input type="search" placeholder="搜索世界书或角色名" autocomplete="off"><button type="button"><i class="fa-solid fa-xmark"></i></button></div><div class="pmm-wb-picker-list"></div></div>`;
    const input = overlay.querySelector('input');
    const list = overlay.querySelector('.pmm-wb-picker-list');
    const expandedSections = new Set();
    const queryCollapsedSections = new Set();
    const rowMarkup = ({ name, characters }) => `<button type="button" data-wb-picker-name="${h(name)}" class="${name === side.name ? 'is-current' : ''}"><span class="pmm-wb-picker-name">${h(name)}</span>${characters.length ? `<small>绑定角色：${h(characters.join('、'))}</small>` : ''}</button>`;
    const sectionMarkup = (key, title, icon, rows, expanded) => rows.length ? `<section class="pmm-wb-picker-section${expanded ? ' is-expanded' : ''}"><button type="button" class="pmm-wb-picker-section-title" data-wb-picker-section="${key}" aria-expanded="${expanded ? 'true' : 'false'}"><span><i class="fa-solid ${expanded ? 'fa-chevron-down' : 'fa-chevron-right'}"></i><i class="fa-solid ${icon}"></i>${title}</span><small>${rows.length}</small></button>${expanded ? `<div class="pmm-wb-picker-section-body">${rows.map(rowMarkup).join('')}</div>` : ''}</section>` : '';
    const draw = () => {
      const query = input.value.trim().toLocaleLowerCase();
      const rows = state.worldNames
        .map(name => ({ name, characters: boundCharacterNames(name) }))
        .filter(row => !query
          || row.name.toLocaleLowerCase().includes(query)
          || row.characters.some(name => name.toLocaleLowerCase().includes(query)));
      const boundRows = rows.filter(row => row.characters.length > 0);
      const unboundRows = rows.filter(row => row.characters.length === 0);
      const boundExpanded = query ? !queryCollapsedSections.has('bound') : expandedSections.has('bound');
      const unboundExpanded = query ? !queryCollapsedSections.has('unbound') : expandedSections.has('unbound');
      list.innerHTML = rows.length
        ? sectionMarkup('bound', '角色绑定世界书', 'fa-user-group', boundRows, boundExpanded)
          + sectionMarkup('unbound', '未绑定角色的世界书', 'fa-book', unboundRows, unboundExpanded)
        : '<div class="pmm-wb-empty">没有找到对应的世界书或角色</div>';
    };
    input.addEventListener('input', () => {
      queryCollapsedSections.clear();
      draw();
    });
    overlay.querySelector('.pmm-wb-picker-head button').addEventListener('click', () => removeSourcePicker(overlay));
    overlay.addEventListener('click', event => {
      if (event.target === overlay) return removeSourcePicker(overlay);
      const sectionButton = event.target.closest('[data-wb-picker-section]');
      if (sectionButton) {
        const key = sectionButton.dataset.wbPickerSection;
        const targetSet = input.value.trim() ? queryCollapsedSections : expandedSections;
        if (targetSet.has(key)) targetSet.delete(key);
        else targetSet.add(key);
        draw();
        return;
      }
      const button = event.target.closest('[data-wb-picker-name]');
      if (!button) return;
      if (side.name !== button.dataset.wbPickerName) {
        discardWorldDraft(side);
        side.history.length = 0;
      }
      side.name = button.dataset.wbPickerName;
      removeSourcePicker(overlay);
      void enqueue('载入世界书', async () => { await loadWorldSide(side); renderPanels(); });
    });
    state.host.append(overlay);
    startWorldPickerThemeSync(overlay);
    draw();
    TOP.setTimeout(() => input.focus(), 30);
  }

  async function switchTopKind(kind) {
    if (!['preset', 'world'].includes(kind) || state.topType === kind) return;
    state.topType = kind;
    if (kind === 'world') {
      await enqueue('切换到世界书', async () => {
        await refreshWorldNames();
        await loadWorldSide(state.top);
        renderPanels();
      });
    } else {
      discardWorldDraft(state.top);
      resetSide(state.top, true);
      renderPanels();
    }
  }

  async function handleAction(button) {
    const action = button.dataset.wbAction;
    const sideName = button.dataset.wbSide;
    const side = sideName ? state[sideName] : null;
    if (action === 'top-kind') return switchTopKind(button.dataset.wbKind);
    if (action === 'source-picker') return openSourcePicker(sideName);
    if (action === 'rename-source') return renameWorldSource(sideName);
    if (action === 'select-source') return;
    if (action === 'entry-search') {
      side.searchOpen = !side.searchOpen;
      if (!side.searchOpen) {
        side.query = '';
        side.searchIndex = 0;
        side.replaceOpen = false;
        side.replaceValue = '';
      }
      renderPanels();
      if (side.searchOpen) {
        TOP.setTimeout(() => state.host?.querySelector?.(`[data-pmm-wb-panel="${sideName}"] [data-wb-action="search-input"]`)?.focus?.(), 20);
      }
      return;
    }
    if (action === 'replace-toggle') {
      side.replaceOpen = !side.replaceOpen;
      if (!updateWorldReplaceVisibility(sideName)) renderPanels();
      return;
    }
    if (action === 'replace-current') return replaceCurrentWorldSearch(sideName);
    if (action === 'replace-all') return replaceAllWorldSearchEntries(sideName);
    if (action === 'content-search-edit') return focusWorldSearchContent(sideName, decodeId(button.dataset.wbKey));
    if (action === 'search-scope') {
      side.searchScope = worldSearchScope(button.dataset.wbSearchScope);
      return resetWorldSearch(sideName, { refocus: true });
    }
    if (action === 'search-previous') return moveWorldSearch(sideName, -1);
    if (action === 'search-next') return moveWorldSearch(sideName, 1);
    if (action === 'multi') {
      side.multi = !side.multi;
      if (!side.multi) side.selected.clear();
      return renderPanels();
    }
    if (action === 'select-all') return toggleWorldSelectAll(sideName);
    if (action === 'undo') return undoWorldOperation(side);
    if (action === 'transfer-copy') return transfer(sideName, false);
    if (action === 'transfer-move') return transfer(sideName, true);
    if (action === 'batch-delete') return deleteSelected(sideName);
    if (action === 'save') {
      if (!side?.dirty) return;
      return enqueue('保存世界书', async () => {
        await saveWorldSide(side);
        renderPanels();
      });
    }
    if (action === 'exit') return close();
    if (action === 'close-main') {
      const nativeClose = state.nativeTop?.querySelector('.header-right .fa-xmark')?.closest('button');
      close();
      nativeClose?.click();
      return;
    }
    if (action === 'more') {
      side.limit += PAGE_SIZE;
      return renderPanels();
    }
    const key = decodeId(button.dataset.wbKey);
    const entry = side ? findEntry(side, key) : null;
    if (!entry) return;
    if (action === 'duplicate-entry') return duplicateWorldEntry(sideName, key);
    if (action === 'delete-entry') return deleteWorldEntry(sideName, key);
    if (action === 'select') {
      side.selected.has(key) ? side.selected.delete(key) : side.selected.add(key);
      return renderPanels();
    }
    if (action === 'expand') {
      side.expanded.has(key) ? side.expanded.delete(key) : side.expanded.add(key);
      return renderPanels();
    }
    if (action === 'content-expand') return openContentEditor(sideName, key);
    if (action === 'toggle') {
      pushUndo(side, '切换世界书条目开关', { worldSides:[side] });
      entry.disable = entry.disable !== true;
      side.data.entries[String(entry.uid)] = entry;
      markWorldDraftDirty(side);
      return renderPanels();
    }
    if (action === 'strategy') {
      pushUndo(side, '切换世界书蓝绿灯', { worldSides:[side] });
      entry.constant = entry.constant !== true;
      if (entry.constant) entry.vectorized = false;
      side.data.entries[String(entry.uid)] = entry;
      markWorldDraftDirty(side);
      return renderPanels();
    }
  }

  function nativePromptIdFromDrag(target) {
    const card = target?.closest?.('.prompt-item[data-prompt-id],.prompt-card[data-prompt-id],[data-pm-identifier]');
    return String(card?.dataset?.promptId || card?.dataset?.pmIdentifier || '');
  }

  function nativeDropSectionFromNode(node) {
    const section = node?.closest?.('[data-section-id],[data-preset-group-id]');
    const savedSectionId = String(section?.dataset?.sectionId || '');
    const rawBaiBaiGroupId = String(section?.dataset?.presetGroupId || '');
    const targetSectionId = savedSectionId || (rawBaiBaiGroupId
      ? (rawBaiBaiGroupId.startsWith('baibai_') ? rawBaiBaiGroupId : `baibai_${rawBaiBaiGroupId}`)
      : '');
    return { section, targetSectionId };
  }

  function normalizedNativePromptText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function nativeDropTargetName(node) {
    if (!node) return '';
    const prompts = nativePresetSnapshot().prompts;
    const names = [...new Set(prompts
      .map(prompt => normalizedNativePromptText(prompt?.name))
      .filter(Boolean))];
    const directCandidates = [
      node.dataset?.promptName,
      node.dataset?.pmName,
      node.dataset?.name,
      node.getAttribute?.('data-prompt-name'),
      node.getAttribute?.('data-pm-name'),
      ...Array.from(node.querySelectorAll?.('[data-prompt-name],[data-pm-name],.prompt-item__name,.prompt-card__name,.prompt-card__title,.completion_prompt_manager_prompt_name,.prompt_name,.name') || [])
        .map(item => item.dataset?.promptName || item.dataset?.pmName || item.textContent),
    ].map(normalizedNativePromptText).filter(Boolean);
    const candidates = [...directCandidates, normalizedNativePromptText(node.textContent)].filter(Boolean);
    for (const candidate of candidates) {
      if (names.includes(candidate)) return candidate;
      const contained = names.filter(name => candidate.includes(name));
      if (contained.length === 1) return contained[0];
      if (contained.length > 1) {
        contained.sort((left, right) => right.length - left.length);
        if (contained[0].length > contained[1].length) return contained[0];
      }
    }
    return directCandidates[0] || '';
  }

  function nativeDropTargetId(id, node = null) {
    const candidate = String(id || '');
    if (!candidate) return '';
    const prompts = nativePresetSnapshot().prompts;
    const nativeIds = new Set(prompts.map(prompt => String(prompt?.id || '')));
    // A BaiBai row can expose a UI-only id. Passing that to PMM's handler makes
    // it stop before inserting, whereas an empty target correctly appends in
    // the confirmed section.
    if (nativeIds.has(candidate)) return candidate;
    const targetName = nativeDropTargetName(node);
    const nameMatches = targetName
      ? prompts.filter(prompt => normalizedNativePromptText(prompt?.name) === targetName)
      : [];
    return nameMatches.length === 1 ? String(nameMatches[0]?.id || '') : '';
  }

  function nativeDropPlacement(event) {
    const card = event.target?.closest?.('.prompt-item[data-prompt-id],.prompt-card[data-prompt-id],[data-pm-identifier]');
    const { section, targetSectionId } = nativeDropSectionFromNode(card || event.target);
    const targetDispatcher = nativePresetDropDispatcher();
    const targetPanelComponent = targetDispatcher?.component || null;
    const cardName = nativeDropTargetName(card);
    const cardId = nativeDropTargetId(card?.dataset?.promptId || card?.dataset?.pmIdentifier || '', card);
    if (cardId || cardName) {
      const rect = card.getBoundingClientRect();
      return {
        targetId: cardId,
        targetName: cardName,
        position: Number(event.clientY) < rect.top + rect.height / 2 ? 'before' : 'after',
        targetSectionId,
        targetPanelComponent,
        targetDropHandler: targetDispatcher?.drop || null,
      };
    }
    if (!targetSectionId) return null;
    const cards = Array.from(section.querySelectorAll('.prompt-item[data-prompt-id],.prompt-card[data-prompt-id],[data-pm-identifier]'))
      .filter(item => nativeDropSectionFromNode(item).section === section);
    const lastCard = cards[cards.length - 1];
    return {
      targetId: nativeDropTargetId(lastCard?.dataset?.promptId || lastCard?.dataset?.pmIdentifier || '', lastCard),
      targetName: nativeDropTargetName(lastCard),
      position: 'after',
      targetSectionId,
      targetPanelComponent,
      targetDropHandler: targetDispatcher?.drop || null,
    };
  }

  function worldDropPlacement(event, sideName) {
    const list = event.target?.closest?.(`[data-wb-list="${sideName}"]`);
    if (!list) return null;
    const cards = Array.from(list.children).filter(node => node.matches?.('.pmm-wb-entry[data-wb-entry]'));
    if (!cards.length) return { targetKey:'', position:'after' };
    const directCard = event.target?.closest?.('.pmm-wb-entry[data-wb-entry]');
    if (directCard && directCard.parentElement === list) {
      const rect = directCard.getBoundingClientRect();
      return {
        targetKey: decodeId(directCard.dataset.wbEntry),
        position: Number(event.clientY) < rect.top + rect.height / 2 ? 'before' : 'after',
      };
    }
    const y = Number(event.clientY);
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (y < rect.top + rect.height / 2) {
        return { targetKey:decodeId(card.dataset.wbEntry), position:'before' };
      }
    }
    return { targetKey:decodeId(cards[cards.length - 1].dataset.wbEntry), position:'after' };
  }

  function clearNativeDropIndicators() {
    state.nativeTop?.querySelectorAll('.prompt-item--drop-before,.prompt-item--drop-after,.prompt-card--drop-before,.prompt-card--drop-after,.section-card--drop-before,.section-card--drop-after,.section-card--drop-into,.section-group--drop-before,.section-group--drop-after,.section-group--drop-into,.prompt-panel__list--drop-target').forEach(node => {
      node.classList.remove('prompt-item--drop-before', 'prompt-item--drop-after', 'prompt-card--drop-before', 'prompt-card--drop-after', 'section-card--drop-before', 'section-card--drop-after', 'section-card--drop-into', 'section-group--drop-before', 'section-group--drop-after', 'section-group--drop-into', 'prompt-panel__list--drop-target');
    });
  }

  function clearWorldDropIndicators() {
    state.host?.querySelectorAll?.('.pmm-wb-entry--drop-before,.pmm-wb-entry--drop-after,.pmm-wb-list--drop-empty,.pmm-wb-list--drop-target,.pmm-wb-panel--drop-target').forEach(node => {
      node.classList.remove('pmm-wb-entry--drop-before', 'pmm-wb-entry--drop-after', 'pmm-wb-list--drop-empty', 'pmm-wb-list--drop-target', 'pmm-wb-panel--drop-target');
    });
  }

  function endNativePresetDragState() {
    const card = state.nativeTop?.querySelector?.('.prompt-card[draggable="true"],.prompt-card,.prompt-item[draggable="true"]');
    if (!card) return false;
    try {
      let event;
      try {
        event = new TOP.DragEvent('dragend', { bubbles:true, cancelable:false });
      } catch (_) {
        event = new TOP.Event('dragend', { bubbles:true, cancelable:false });
      }
      card.dispatchEvent(event);
      return true;
    } catch (error) {
      console.warn('[世界书缝合] 原生预设拖拽状态结束信号发送失败', error);
      return false;
    }
  }

  function scheduleDropIndicatorCleanup() {
    endNativePresetDragState();
    clearNativeDropIndicators();
    clearWorldDropIndicators();
    for (const delay of [0, 80, 240]) {
      TOP.setTimeout(() => {
        clearNativeDropIndicators();
        clearWorldDropIndicators();
      }, delay);
    }
  }

  function removeWorldMultiDragFloat() {
    if (worldMultiDragFrame !== 0) {
      if (typeof TOP.cancelAnimationFrame === 'function') TOP.cancelAnimationFrame(worldMultiDragFrame);
      else TOP.clearTimeout(worldMultiDragFrame);
      worldMultiDragFrame = 0;
    }
    worldMultiDragPoint = null;
    worldMultiDragFloat?.remove();
    worldMultiDragFloat = null;
    worldMultiDragGhost?.remove();
    worldMultiDragGhost = null;
  }

  function positionWorldMultiDragFloat(event) {
    if (!worldMultiDragFloat) return;
    const x = Number(event?.clientX);
    const y = Number(event?.clientY);
    if (!Number.isFinite(x) || !Number.isFinite(y) || (!x && !y)) return;
    worldMultiDragPoint = { x, y };
    if (worldMultiDragFrame !== 0) return;
    const render = () => {
      worldMultiDragFrame = 0;
      const point = worldMultiDragPoint;
      worldMultiDragPoint = null;
      const chip = worldMultiDragFloat;
      if (!chip || !point) return;
      // Keep the finger at the centre of the badge.  Deliberately allow the
      // badge to extend off-screen at the edges, rather than flipping sides.
      const horizontal = point.x - MULTI_DRAG_FLOAT_WIDTH / 2;
      const vertical = point.y - MULTI_DRAG_FLOAT_HEIGHT / 2;
      chip.style.transform = `translate3d(${horizontal}px, ${vertical}px, 0)`;
    };
    worldMultiDragFrame = typeof TOP.requestAnimationFrame === 'function'
      ? TOP.requestAnimationFrame(render)
      : TOP.setTimeout(render, 16);
  }

  function showWorldMultiDragFloat(event, count, options = {}) {
    removeWorldMultiDragFloat();
    if (!Number.isFinite(count) || count < 1 || (count < 2 && !options.force)) return;
    const chip = DOC.createElement('div');
    chip.className = 'pmm-wb-multi-drag-float';
    chip.setAttribute('aria-hidden', 'true');
    chip.dataset.pmmWbMultiDragTone = resolveWorldMultiDragTone();
    if (options.forbiddenOnly) chip.dataset.pmmWbMultiDragForbiddenOnly = 'true';
    if (IS_ANDROID) chip.dataset.pmmWbMultiDragPerf = 'lite';
    const back = DOC.createElement('span');
    back.className = 'pmm-wb-multi-drag-float-back';
    const face = DOC.createElement('span');
    face.className = 'pmm-wb-multi-drag-float-face';
    const icon = DOC.createElement('i');
    icon.className = 'fa-solid fa-up-down';
    const label = DOC.createElement('span');
    label.textContent = `拖动 ${count} 条`;
    const badge = DOC.createElement('b');
    badge.textContent = String(count);
    face.append(icon, label, badge);
    chip.append(back, face);
    DOC.body.append(chip);
    worldMultiDragFloat = chip;
    positionWorldMultiDragFloat(event);
    const transfer = event.dataTransfer;
    if (!transfer || typeof transfer.setDragImage !== 'function') return;
    const image = DOC.createElement('div');
    image.setAttribute('aria-hidden', 'true');
    image.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:.01;background:#efedf0;pointer-events:none;';
    DOC.body.append(image);
    worldMultiDragGhost = image;
    try { transfer.setDragImage(image, 0, 0); } catch (_) {}
  }

  function setUnsupportedPresetToWorldDrop(event, unsupported) {
    const bottomPanel = state.host?.querySelector?.('[data-pmm-wb-panel="bottom"]');
    bottomPanel?.classList.toggle('pmm-wb-panel--drop-forbidden', Boolean(unsupported));
    const chip = worldMultiDragFloat;
    if (!unsupported) {
      if (chip?.dataset.pmmWbMultiDragForbiddenOnly === 'true') removeWorldMultiDragFloat();
      else if (chip) {
        delete chip.dataset.pmmWbMultiDragForbidden;
        const icon = chip.querySelector('i');
        const label = chip.querySelector('.pmm-wb-multi-drag-float-face span');
        const count = dragPayload?.keys?.length || 1;
        if (icon) icon.className = 'fa-solid fa-up-down';
        if (label) label.textContent = `拖动 ${count} 条`;
      }
      return;
    }
    if (!worldMultiDragFloat) {
      showWorldMultiDragFloat(event, dragPayload?.keys?.length || 1, { force:true, forbiddenOnly:true });
    }
    const activeChip = worldMultiDragFloat;
    if (!activeChip) return;
    activeChip.dataset.pmmWbMultiDragForbidden = 'true';
    const icon = activeChip.querySelector('i');
    const label = activeChip.querySelector('.pmm-wb-multi-drag-float-face span');
    if (icon) icon.className = 'fa-solid fa-ban';
    if (label) label.textContent = '不支持拖入';
    positionWorldMultiDragFloat(event);
  }

  function isUnsupportedPresetToWorldDrop(targetSide) {
    return state.topType === 'preset' && dragPayload?.from === 'top' && targetSide === 'bottom';
  }

  function showWorldDropIndicator(sideName, placement) {
    const list = state.host?.querySelector?.(`[data-wb-list="${sideName}"]`);
    clearWorldDropIndicators();
    if (!list) return;
    const card = Array.from(list.children).find(node => (
      node.matches?.('.pmm-wb-entry[data-wb-entry]')
      && decodeId(node.dataset.wbEntry) === String(placement?.targetKey || '')
    ));
    if (!card) {
      list.classList.add('pmm-wb-list--drop-empty');
      return;
    }
    card.classList.add(placement?.position === 'before' ? 'pmm-wb-entry--drop-before' : 'pmm-wb-entry--drop-after');
  }

  function onDragStart(event) {
    if (!state.open) return;
    const custom = event.target.closest?.('[data-wb-drag-side][data-wb-drag-key]');
    if (custom) {
      const sideName = custom.dataset.wbDragSide;
      const key = decodeId(custom.dataset.wbDragKey);
      const side = state[sideName];
      const keys = side.selected.has(key) ? selectedWorldEntryKeys(side) : [key];
      dragPayload = { from: sideName, keys };
      event.dataTransfer?.setData('text/plain', 'pmm-worldbook-entry');
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copyMove';
      showWorldMultiDragFloat(event, keys.length);
      return;
    }
    if (state.topType === 'preset') {
      const id = nativePromptIdFromDrag(event.target);
      if (id) {
        const snapshot = nativePresetSnapshot();
        dragPayload = { from: 'top', keys: snapshot.selected.has(id) ? [...snapshot.selected] : [id] };
      }
    }
  }

  function onDragOver(event) {
    if (!state.open || !dragPayload) return;
    positionWorldMultiDragFloat(event);
    const customList = event.target.closest?.('[data-wb-list]');
    const customPanel = event.target.closest?.('[data-pmm-wb-panel]');
    const nativeList = state.topType === 'preset' && event.target.closest?.('.pm-main-wrapper > .preset-panel .prompt-panel__list');
    const targetSide = customList?.dataset.wbList || customPanel?.dataset.pmmWbPanel || (nativeList ? 'top' : '');
    const sameWorldbookList = Boolean(customList && targetSide === dragPayload.from && state[targetSide]?.data?.entries);
    if (sameWorldbookList) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      const placement = worldDropPlacement(event, targetSide);
      if (placement?.targetKey && dragPayload.keys.includes(String(placement.targetKey))) clearWorldDropIndicators();
      else showWorldDropIndicator(targetSide, placement);
      return;
    }
    if (isUnsupportedPresetToWorldDrop(targetSide)) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
      clearWorldDropIndicators();
      setUnsupportedPresetToWorldDrop(event, true);
      return;
    }
    setUnsupportedPresetToWorldDrop(event, false);
    if (!targetSide || targetSide === dragPayload.from) {
      clearWorldDropIndicators();
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    if (nativeList) clearWorldDropIndicators();
    else showWorldDropIndicator(targetSide, worldDropPlacement(event, targetSide));
  }

  function onDragMove(event) {
    positionWorldMultiDragFloat(event);
  }

  function onDrop(event) {
    if (!state.open || !dragPayload) return;
    const customList = event.target.closest?.('[data-wb-list]');
    const customPanel = event.target.closest?.('[data-pmm-wb-panel]');
    const nativeList = state.topType === 'preset' && event.target.closest?.('.pm-main-wrapper > .preset-panel .prompt-panel__list');
    const targetSide = customList?.dataset.wbList || customPanel?.dataset.pmmWbPanel || (nativeList ? 'top' : '');
    const sameWorldbookList = Boolean(customList && targetSide === dragPayload.from && state[targetSide]?.data?.entries);
    if (sameWorldbookList) {
      event.preventDefault();
      event.stopPropagation();
      const placement = worldDropPlacement(event, targetSide);
      const payload = dragPayload;
      dragPayload = null;
      removeWorldMultiDragFloat();
      clearNativeDropIndicators();
      clearWorldDropIndicators();
      if (placement) void reorderWorldEntries(targetSide, payload.keys, placement).finally(scheduleDropIndicatorCleanup);
      else scheduleDropIndicatorCleanup();
      return;
    }
    if (isUnsupportedPresetToWorldDrop(targetSide)) {
      event.preventDefault();
      event.stopPropagation();
      dragPayload = null;
      setUnsupportedPresetToWorldDrop(event, false);
      removeWorldMultiDragFloat();
      clearNativeDropIndicators();
      clearWorldDropIndicators();
      scheduleDropIndicatorCleanup();
      notify('info', '当前仅支持世界书条目拖入预设');
      return;
    }
    setUnsupportedPresetToWorldDrop(event, false);
    if (!targetSide || targetSide === dragPayload.from) return;
    event.preventDefault();
    event.stopPropagation();
    const placement = nativeList ? nativeDropPlacement(event) : worldDropPlacement(event, targetSide);
    const payload = dragPayload;
    dragPayload = null;
    removeWorldMultiDragFloat();
    clearNativeDropIndicators();
    clearWorldDropIndicators();
    scheduleDropIndicatorCleanup();
    void transfer(payload.from, false, payload.keys, placement).finally(scheduleDropIndicatorCleanup);
  }

  function onDocumentClick(event) {
    if (!state.open) return;
    const modeButton = event.target.closest?.('.side-panel-root .panel-btn');
    if (modeButton && !modeButton.matches('[data-pmm-worldbook-placeholder="1"]')) {
      close();
      return;
    }
    const action = event.target.closest?.('[data-wb-action]');
    if (!action) {
      if (event.target.closest?.('.prompt-item__checkbox,.prompt-card__checkbox')) TOP.setTimeout(scheduleDecorate, 0);
      return;
    }
    if (action.tagName === 'SELECT'
      || action.matches('[data-wb-action="search-input"],[data-wb-action="replace-input"]')
      || (action.matches('[data-wb-action="content-search-edit"]') && event.target.matches('textarea'))) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    void handleAction(action);
  }

  function onDocumentChange(event) {
    if (!state.open) return;
    const target = event.target;
    if (target.matches?.('[data-wb-action="select-source"]')) {
      const side = state[target.dataset.wbSide];
      if (side.name !== target.value) {
        discardWorldDraft(side);
        side.history.length = 0;
      }
      side.name = target.value;
      void enqueue('载入世界书', async () => { await loadWorldSide(side); renderPanels(); });
      return;
    }
    if (target.matches?.('[data-wb-field]')) void updateField(target);
  }

  function onDocumentInput(event) {
    if (!state.open || !event.target.matches?.('[data-wb-action]')) return;
    const input = event.target;
    const side = state[input.dataset.wbSide];
    if (!side) return;
    if (input.matches?.('[data-wb-action="replace-input"]')) {
      side.replaceValue = input.value;
      return;
    }
    if (!input.matches?.('[data-wb-action="search-input"]')) return;
    side.query = input.value;
    side.scrollTop = 0;
    resetWorldSearch(input.dataset.wbSide);
  }

  function onDocumentFocusOut(event) {
    if (!state.open || !event.target.matches?.('[data-wb-field="content"]')) return;
    const textarea = event.target;
    const wrapper = event.target.closest?.('.pmm-wb-content-search-wrap');
    TOP.setTimeout(() => {
      if (DOC.activeElement !== textarea) clearWorldContentEditorShift(textarea);
      if (wrapper && !wrapper.contains(DOC.activeElement)) wrapper.classList.remove('is-editing');
    }, 0);
  }

  function onDocumentFocusIn(event) {
    if (!state.open || !event.target.matches?.('[data-wb-field="content"]')) return;
    keepWorldContentEditorVisible(event.target);
  }

  function installStyle() {
    if (DOC.getElementById(STYLE_ID)) return;
    const style = DOC.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#preset-manager-main-panel.pmm-worldbook-mode .pm-panel-container{position:relative!important}
#preset-manager-main-panel.pmm-worldbook-mode .pm-panel-container--merge-mode button[title="取消当前预设全部分组"]{display:none!important}
#preset-manager-main-panel.pmm-worldbook-mode .pm-main-wrapper>.preset-panel .theme-switch-card{display:none!important}
#preset-manager-main-panel .pmm-wb-native-hidden{display:none!important}
#preset-manager-main-panel .pmm-wb-theme-slot{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}
#preset-manager-main-panel .pmm-wb-theme-slot:empty{display:none}
#preset-manager-main-panel .pmm-wb-theme-slot .pmm-mobile-theme-toggle{width:27px!important;min-width:27px!important;height:27px!important;padding:0!important;margin:0!important;border-radius:5px!important;box-shadow:none!important}
#preset-manager-main-panel .pmm-wb-theme-slot .pmm-mobile-theme-toggle i{font-size:10px!important}
#preset-manager-main-panel .pmm-wb-inline-panel{min-width:0!important;min-height:0!important;width:100%!important;height:100%!important;display:flex!important;overflow:hidden!important;border:1px solid var(--pm-border,rgba(127,127,127,.17))!important;border-radius:12px!important;background:var(--pm-panel-bg,var(--pm-card-bg,rgba(255,255,255,.96)))!important;color:var(--pm-text-primary,inherit)!important;box-shadow:0 4px 18px rgba(0,0,0,.10)!important}
#preset-manager-main-panel .pmm-wb-inline-panel[data-pmm-wb-keyboard-shift]{transform:translateY(var(--pmm-wb-keyboard-shift,0px))!important;transition:transform .16s ease!important;z-index:16010!important}
.pmm-wb-main-content{width:100%;height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.pmm-wb-header{height:46px;min-height:46px;display:flex;align-items:center;justify-content:space-between;gap:5px;padding:5px 7px;border-bottom:1px solid var(--pm-border,rgba(127,127,127,.12));background:var(--pm-toolbar-bg,transparent)}
.pmm-wb-header-left,.pmm-wb-header-right,.pmm-wb-title-row{display:flex;align-items:center;gap:3px;min-width:0}.pmm-wb-header-left{flex:1 1 auto}.pmm-wb-header-left>.pmm-wb-title-row,.pmm-wb-header-left>.pmm-wb-title-card,.pmm-wb-title-card>.pmm-wb-title-row{width:100%;min-width:0;flex:1 1 auto}.pmm-wb-header-right{flex:0 0 auto}
.pmm-wb-source-select{width:auto!important;min-width:0!important;max-width:none!important;flex:1 1 auto!important}.pmm-wb-source-action{width:25px;height:25px;min-width:25px;padding:0;border:0;border-radius:5px;background:transparent;color:var(--pm-text-secondary,currentColor);display:inline-flex;align-items:center;justify-content:center;opacity:.68}.pmm-wb-source-action i{font-size:9px}.pmm-wb-source-action:active{transform:scale(.94)}.pmm-wb-kind-switch{display:inline-flex;align-items:center;gap:1px;padding:2px;border-radius:7px;background:color-mix(in srgb,currentColor 6%,transparent)}
.pmm-wb-kind-switch button{width:25px;height:23px;padding:0;border:0;border-radius:5px;background:transparent;color:var(--pm-text-secondary,currentColor);opacity:.62;display:inline-flex;align-items:center;justify-content:center}.pmm-wb-kind-switch button.is-active{background:var(--pm-quote-color,#3b82f6);color:#fff;opacity:1}.pmm-wb-kind-switch button:active{transform:scale(.94)}.pmm-wb-kind-switch i{font-size:10px}
#preset-manager-main-panel .pmm-wb-kind-switch--toolbar button.is-active,#preset-manager-main-panel .pmm-wb-kind-switch--toolbar button.is-active>i,#preset-manager-main-panel .pmm-wb-kind-switch--toolbar button.is-active>i::before{color:#fff!important;opacity:1!important;-webkit-text-fill-color:#fff!important}#preset-manager-main-panel .pmm-wb-kind-switch--toolbar button[data-wb-kind="world"].is-active>i{filter:drop-shadow(0 1px 1px rgba(0,0,0,.26))}
#preset-manager-main-panel[data-pmm-wb-search-theme="light"] .pmm-wb-search-highlight{border-color:transparent!important;background:#d6eefc!important;color:#183f5c!important;-webkit-text-fill-color:#183f5c!important}#preset-manager-main-panel[data-pmm-wb-search-theme="light"] .pmm-wb-search-highlight.is-current{border-color:transparent!important;background:#75bee8!important;color:#163d59!important;-webkit-text-fill-color:#163d59!important;box-shadow:none!important}
#preset-manager-main-panel[data-pmm-wb-search-theme="light"] .pmm-wb-replace-row:focus-within .pmm-wb-replace-action{background:color-mix(in srgb,var(--pm-text-primary,#1f2937) 48%,var(--pm-panel-bg,#fff))!important;color:var(--pm-text-primary,#1f2937)!important;-webkit-text-fill-color:var(--pm-text-primary,#1f2937)!important;opacity:.9!important}
.pmm-wb-tool{width:27px;height:27px;min-width:27px;padding:0;border:0;border-radius:5px;background:transparent;color:var(--pm-text-secondary,currentColor);display:inline-flex;align-items:center;justify-content:center;opacity:.72}.pmm-wb-tool:active:not(:disabled){transform:scale(.94)}.pmm-wb-tool:disabled{opacity:.22}.pmm-wb-tool i{font-size:10px}.pmm-wb-tool[data-wb-action="save"][data-wb-dirty="true"]{background:var(--pm-quote-color,#3485f6)!important;color:#fff!important;-webkit-text-fill-color:#fff!important;opacity:1;box-shadow:0 0 0 1px color-mix(in srgb,var(--pm-quote-color,#3485f6) 70%,transparent),0 0 10px color-mix(in srgb,var(--pm-quote-color,#3485f6) 46%,transparent)}.pmm-wb-tool[data-wb-action="save"][data-wb-dirty="true"] i{color:#fff!important;-webkit-text-fill-color:#fff!important}.pmm-wb-status{font-size:9px;opacity:.5;white-space:nowrap}
.pmm-wb-search-bar{display:flex;flex-direction:column;gap:4px;padding:4px 7px;border-bottom:1px solid var(--pm-border,rgba(127,127,127,.12))}.pmm-wb-search-primary{min-height:26px;display:flex;align-items:center;gap:4px;min-width:0}.pmm-wb-search-primary>i{width:13px;flex:none;font-size:10px;opacity:.62;text-align:center}.pmm-wb-search-input-wrap{position:relative;min-width:48px;flex:1;display:block}.pmm-wb-search-input-wrap input{box-sizing:border-box;width:100%;height:26px;padding:0 37px 0 6px;border:1px solid var(--pm-border,rgba(127,127,127,.16));border-radius:6px;background:var(--pm-card-bg,rgba(127,127,127,.05));color:inherit;font-size:11px}.pmm-wb-search-count{position:absolute;right:6px;top:50%;transform:translateY(-50%);min-width:27px;font-size:9px;line-height:1;opacity:.58;text-align:right;white-space:nowrap;pointer-events:none}.pmm-wb-replace-toggle{width:22px;height:23px;min-width:22px;padding:0;border:0;border-radius:4px;background:transparent;color:inherit;opacity:.34}.pmm-wb-replace-toggle i{font-size:9px}.pmm-wb-replace-toggle.is-active{background:color-mix(in srgb,currentColor 10%,transparent);opacity:.9}.pmm-wb-search-nav{width:19px;height:23px;min-width:19px;padding:0;border:0;border-radius:4px;background:transparent;color:inherit;opacity:.68}.pmm-wb-search-nav:disabled{opacity:.22}.pmm-wb-search-nav i{font-size:8px}.pmm-wb-search-scope{flex:none;display:inline-flex;align-items:center;overflow:hidden;border-left:1px solid var(--pm-border,rgba(127,127,127,.16));border-radius:6px;background:color-mix(in srgb,currentColor 5%,transparent)}.pmm-wb-search-scope button{height:25px;padding:0 5px;border:0;border-right:1px solid var(--pm-border,rgba(127,127,127,.12));background:transparent;color:inherit;font-size:9px;white-space:nowrap;opacity:.66}.pmm-wb-search-scope button:last-child{border-right:0}.pmm-wb-search-scope button.is-active{background:var(--pm-quote-color,#3485f6);color:#fff;opacity:1}.pmm-wb-replace-row{display:none;align-items:center;gap:4px;min-width:0}.pmm-wb-replace-row.is-open{display:flex}.pmm-wb-replace-row input{box-sizing:border-box;min-width:0;flex:1;height:26px;padding:0 6px;border:1px solid var(--pm-border,rgba(127,127,127,.16));border-radius:6px;background:var(--pm-card-bg,rgba(127,127,127,.05));color:inherit;font-size:11px}.pmm-wb-replace-action{height:26px;min-width:42px;padding:0 7px;border:0;border-radius:6px;background:color-mix(in srgb,currentColor 9%,transparent);color:inherit;font-size:9px;opacity:.38;white-space:nowrap}.pmm-wb-replace-action:last-child{min-width:57px}.pmm-wb-replace-row:focus-within .pmm-wb-replace-action{background:var(--pm-text-primary,currentColor);color:var(--pm-panel-bg,#fff);opacity:.93}.pmm-wb-search-highlight{padding:0 1px;border:1px solid color-mix(in srgb,var(--pm-quote-color,#3485f6) 55%,transparent);border-radius:2px;background:color-mix(in srgb,var(--pm-quote-color,#3485f6) 38%,transparent);color:inherit}.pmm-wb-search-highlight.is-current{border-color:var(--pm-quote-color,#3485f6);background:color-mix(in srgb,var(--pm-quote-color,#3485f6) 82%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,var(--pm-quote-color,#3485f6) 80%,transparent),0 0 9px color-mix(in srgb,var(--pm-quote-color,#3485f6) 72%,transparent);font-weight:750}.pmm-wb-search-hit{flex:none;min-width:14px;padding:1px 3px;border-radius:5px;background:color-mix(in srgb,var(--pm-quote-color,#3485f6) 13%,transparent);color:var(--pm-quote-color,#3485f6);font-size:8px;text-align:center}.pmm-wb-entry--search-current{border-color:var(--pm-quote-color,#3485f6)!important;box-shadow:0 0 0 1px color-mix(in srgb,var(--pm-quote-color,#3485f6) 28%,transparent)}
.pmm-wb-content{flex:1;min-height:0;overflow:hidden}.pmm-wb-list{height:100%;min-height:0;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:7px;display:flex;flex-direction:column;gap:var(--pmm-user-item-gap,5px)}
.pmm-wb-entry{position:relative;flex:none;border:1px solid var(--pm-border,rgba(127,127,127,.14));border-radius:10px;background:var(--pm-card-bg,rgba(255,255,255,.68));overflow:hidden}.pmm-wb-entry.is-expanded{border-color:color-mix(in srgb,var(--pm-quote-color,#3485f6) 58%,transparent)}.pmm-wb-entry.pmm-wb-entry--drop-before,.pmm-wb-entry.pmm-wb-entry--drop-after{overflow:visible}.pmm-wb-entry--drop-before::before,.pmm-wb-entry--drop-after::after{content:"";position:absolute;left:8px;right:8px;height:2px;border-radius:2px;background:var(--pm-quote-color,#3485f6);box-shadow:0 0 5px color-mix(in srgb,var(--pm-quote-color,#3485f6) 70%,transparent);z-index:30;pointer-events:none}.pmm-wb-entry--drop-before::before{top:-4px}.pmm-wb-entry--drop-after::after{bottom:-4px}.pmm-wb-list.pmm-wb-list--drop-empty{position:relative}.pmm-wb-list.pmm-wb-list--drop-empty::before{content:"";position:absolute;top:7px;left:15px;right:15px;height:2px;border-radius:2px;background:var(--pm-quote-color,#3485f6);box-shadow:0 0 5px color-mix(in srgb,var(--pm-quote-color,#3485f6) 70%,transparent);z-index:30;pointer-events:none}.pmm-wb-entry-head{min-height:var(--pmm-user-item-height,43px);display:flex;align-items:center;gap:6px;padding:3px 8px}.pmm-wb-entry-head button{border:0;background:transparent;color:inherit}.pmm-wb-check,.pmm-wb-expand{width:27px;height:29px;padding:0;opacity:.68}.pmm-wb-check.is-selected{color:var(--pm-quote-color,#3485f6);opacity:1}.pmm-wb-entry-title{min-width:0;flex:1;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:var(--pmm-user-item-font,12px)}
.pmm-wb-entry.pmm-wb-entry--selected{border-color:color-mix(in srgb,var(--pm-quote-color,#3485f6) 56%,var(--pm-border,rgba(127,127,127,.14)))}.pmm-wb-entry.pmm-wb-entry--selected .pmm-wb-entry-head{cursor:grab}.pmm-wb-entry.pmm-wb-entry--selected .pmm-wb-entry-head:active{cursor:grabbing}.pmm-wb-multi-bar{min-height:28px;padding:3px 7px;display:flex;align-items:center;gap:7px;border-bottom:1px solid var(--pm-border,rgba(127,127,127,.12));background:color-mix(in srgb,var(--pm-quote-color,#3485f6) 6%,transparent)}.pmm-wb-multi-bar button{height:22px;flex:none;padding:0 7px;border:1px solid color-mix(in srgb,var(--pm-quote-color,#3485f6) 40%,transparent);border-radius:6px;background:color-mix(in srgb,var(--pm-quote-color,#3485f6) 10%,transparent);color:var(--pm-quote-color,#3485f6);font-size:9px;white-space:nowrap}.pmm-wb-multi-bar button i{margin-right:3px}.pmm-wb-multi-bar button:disabled{opacity:.35}.pmm-wb-multi-bar span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8.5px;opacity:.68}
.pmm-wb-multi-drag-float{position:fixed;z-index:2147483647;left:0;top:0;width:198px;height:58px;font-family:inherit;line-height:1;pointer-events:none;will-change:transform}.pmm-wb-multi-drag-float-back{position:absolute;left:0;top:0;width:188px;height:46px;box-sizing:border-box;border:1px solid rgba(255,255,255,.68);border-radius:17px;background:rgba(220,218,224,.64);box-shadow:0 12px 24px rgba(62,58,68,.13),0 2px 5px rgba(62,58,68,.07);transform:rotate(4deg);transform-origin:center;-webkit-backdrop-filter:blur(18px) saturate(112%);backdrop-filter:blur(18px) saturate(112%)}.pmm-wb-multi-drag-float-face{position:absolute;left:0;top:0;width:188px;height:46px;box-sizing:border-box;padding:0 13px;display:flex;align-items:center;gap:10px;border:1px solid rgba(255,255,255,.94);border-radius:17px;background:rgba(247,246,248,.88);color:#696770!important;-webkit-text-fill-color:#696770!important;box-shadow:0 12px 24px rgba(62,58,68,.13),0 2px 5px rgba(62,58,68,.07),inset 0 1px 0 rgba(255,255,255,.52);-webkit-backdrop-filter:blur(18px) saturate(112%);backdrop-filter:blur(18px) saturate(112%);font-size:14px;font-weight:500;letter-spacing:.01em;white-space:nowrap}.pmm-wb-multi-drag-float-face i{width:16px;color:#aaa7b0!important;-webkit-text-fill-color:#aaa7b0!important;font-size:16px;text-align:center}.pmm-wb-multi-drag-float-face span{min-width:0;flex:1;white-space:nowrap;color:inherit!important;-webkit-text-fill-color:currentColor!important}.pmm-wb-multi-drag-float-face b{width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(225,224,229,.88);color:#85828d!important;-webkit-text-fill-color:#85828d!important;font-size:13px;font-weight:500}.pmm-wb-multi-drag-float[data-pmm-wb-multi-drag-tone="dark"] .pmm-wb-multi-drag-float-back{border-color:rgba(205,214,231,.32);background:rgba(69,80,101,.58);box-shadow:0 16px 30px rgba(0,0,0,.40),0 3px 7px rgba(0,0,0,.22)}.pmm-wb-multi-drag-float[data-pmm-wb-multi-drag-tone="dark"] .pmm-wb-multi-drag-float-face{border-color:rgba(205,214,231,.32);background:rgba(36,43,57,.84);color:#f3f4f8!important;-webkit-text-fill-color:#f3f4f8!important;box-shadow:0 16px 30px rgba(0,0,0,.40),0 3px 7px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.10)}.pmm-wb-multi-drag-float[data-pmm-wb-multi-drag-tone="dark"] .pmm-wb-multi-drag-float-face i{color:#dce1ea!important;-webkit-text-fill-color:#dce1ea!important}.pmm-wb-multi-drag-float[data-pmm-wb-multi-drag-tone="dark"] .pmm-wb-multi-drag-float-face b{background:rgba(78,89,112,.72);color:#bfc7d6!important;-webkit-text-fill-color:#bfc7d6!important}.pmm-wb-multi-drag-float[data-pmm-wb-multi-drag-perf="lite"] .pmm-wb-multi-drag-float-back,.pmm-wb-multi-drag-float[data-pmm-wb-multi-drag-perf="lite"] .pmm-wb-multi-drag-float-face{-webkit-backdrop-filter:none;backdrop-filter:none}.pmm-wb-multi-drag-float[data-pmm-wb-multi-drag-perf="lite"] .pmm-wb-multi-drag-float-back{box-shadow:0 6px 14px rgba(62,58,68,.12)}.pmm-wb-multi-drag-float[data-pmm-wb-multi-drag-perf="lite"] .pmm-wb-multi-drag-float-face{box-shadow:0 6px 14px rgba(62,58,68,.12),inset 0 1px 0 rgba(255,255,255,.42)}.pmm-wb-multi-drag-float[data-pmm-wb-multi-drag-tone="dark"][data-pmm-wb-multi-drag-perf="lite"] .pmm-wb-multi-drag-float-back{box-shadow:0 7px 15px rgba(0,0,0,.28)}.pmm-wb-multi-drag-float[data-pmm-wb-multi-drag-tone="dark"][data-pmm-wb-multi-drag-perf="lite"] .pmm-wb-multi-drag-float-face{box-shadow:0 7px 15px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.08)}
.pmm-wb-dot{width:7px;height:7px;border-radius:50%;flex:none;box-shadow:0 0 6px currentColor}.pmm-wb-dot.is-blue{color:#3485f6;background:#3485f6}.pmm-wb-dot.is-green{color:#19bf72;background:#19bf72}.pmm-wb-toggle{width:25px!important;height:14px!important;min-width:25px!important;border-radius:8px!important;padding:1.5px!important;background:#9ba3ad!important;flex:none}.pmm-wb-toggle span{display:block;width:11px;height:11px;border-radius:50%;background:#fff;transition:transform .15s}.pmm-wb-toggle.is-on{background:var(--pm-quote-color,#2878ed)!important}.pmm-wb-toggle.is-on span{transform:translateX(11px)}
.pmm-wb-details{padding:7px 9px 9px;border-top:1px solid var(--pm-border,rgba(127,127,127,.10));display:flex;flex-direction:column;gap:6px;font-size:10px!important;line-height:1.35}.pmm-wb-details label,.pmm-wb-wide-field{display:flex;flex-direction:column;gap:2px;min-width:0}.pmm-wb-details label>span,.pmm-wb-field-head>span:first-child{font-size:8.5px!important;line-height:1.2;opacity:.62}.pmm-wb-details input,.pmm-wb-details select,.pmm-wb-details textarea{width:100%;min-height:26px!important;border:1px solid var(--pm-border,rgba(127,127,127,.17));border-radius:6px;background:var(--pm-card-bg,rgba(127,127,127,.05));color:inherit;padding:4px 6px!important;font-size:10.5px!important;line-height:1.35!important}.pmm-wb-details textarea{min-height:132px!important;resize:vertical}.pmm-wb-content-search-wrap{position:relative;display:block;cursor:text}.pmm-wb-content-search-preview{box-sizing:border-box;width:100%;height:132px;min-height:132px;overflow:auto;border:1px solid var(--pm-border,rgba(127,127,127,.17));border-radius:6px;background:var(--pm-card-bg,rgba(127,127,127,.05));color:inherit;padding:4px 6px;font-size:10.5px!important;line-height:1.35!important;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;cursor:text}.pmm-wb-content-search-preview .pmm-wb-search-highlight{pointer-events:none}.pmm-wb-content-search-wrap textarea{display:none}.pmm-wb-content-search-wrap.is-editing .pmm-wb-content-search-preview,.pmm-wb-content-search-wrap:focus-within .pmm-wb-content-search-preview{display:none}.pmm-wb-content-search-wrap.is-editing textarea,.pmm-wb-content-search-wrap:focus-within textarea{display:block}.pmm-wb-detail-row{display:flex;align-items:flex-end;gap:6px}.pmm-wb-detail-row label:first-child{flex:1}.pmm-wb-title-row .pmm-wb-strategy{align-self:flex-end;height:26px!important;min-width:50px!important;padding:0 6px!important;border:1px solid currentColor;border-radius:7px;background:transparent;font-size:9px!important;line-height:1!important}.pmm-wb-strategy span{display:inline-block;width:6px;height:6px;margin-right:3px;border-radius:50%;background:currentColor}.pmm-wb-strategy.is-blue{color:#3485f6}.pmm-wb-strategy.is-green{color:#19bf72}.pmm-wb-meta-grid{display:grid;grid-template-columns:minmax(130px,2fr) minmax(58px,.65fr);gap:6px}.pmm-wb-meta-grid.has-depth{grid-template-columns:minmax(120px,2fr) repeat(2,minmax(52px,.6fr))}.pmm-wb-meta-grid .is-outlet{grid-column:1/-1}.pmm-wb-field-head{min-height:19px;display:flex;align-items:center;justify-content:space-between;gap:6px}.pmm-wb-content-tools{display:flex;align-items:center;gap:5px}.pmm-wb-content-tools small{font-size:8.5px;opacity:.58}.pmm-wb-content-tools button{width:22px;height:20px;padding:0;border:0;border-radius:5px;background:transparent;color:inherit;opacity:.7}.pmm-wb-content-tools button:active{transform:scale(.94)}.pmm-wb-more{flex:none;border:1px dashed var(--pm-border,rgba(127,127,127,.22));border-radius:8px;background:transparent;color:inherit;padding:8px;opacity:.65}.pmm-wb-empty{margin:auto;padding:24px;text-align:center;opacity:.52}
.pmm-wb-editor-overlay{position:absolute;inset:0;z-index:16000;display:flex;align-items:center;justify-content:center;padding:max(12px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom));background:rgba(0,0,0,.43);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);color:var(--pmm-wb-editor-text,#222)}.pmm-wb-editor-dialog{width:min(92%,660px);height:min(82%,680px);max-height:calc(100dvh - 28px);min-height:250px;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--pmm-wb-editor-border,rgba(127,127,127,.22));border-radius:13px;background-color:var(--pmm-wb-editor-bg,#fff);background-image:var(--pmm-wb-editor-bg-image,none);color:var(--pmm-wb-editor-text,#222);box-shadow:0 18px 52px rgba(0,0,0,.36)}.pmm-wb-editor-dialog header{min-height:42px;display:flex;align-items:center;gap:7px;padding:6px 8px;border-bottom:1px solid var(--pmm-wb-editor-border,rgba(127,127,127,.14))}.pmm-wb-editor-dialog header strong{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.pmm-wb-editor-dialog header span{font-size:9px;opacity:.58;white-space:nowrap}.pmm-wb-editor-dialog header button{width:28px;height:28px;padding:0;border:0;border-radius:7px;background:color-mix(in srgb,var(--pmm-wb-editor-text,#222) 8%,transparent);color:inherit}.pmm-wb-editor-dialog header button:disabled{opacity:.28}.pmm-wb-editor-dialog header button[data-wb-editor-save]{color:var(--pmm-wb-editor-accent,#3485f6)}.pmm-wb-editor-dialog textarea{flex:1;min-height:0;width:auto;margin:8px;padding:10px;border:1px solid var(--pmm-wb-editor-border,rgba(127,127,127,.18));border-radius:9px;background:var(--pmm-wb-editor-field-bg,rgba(127,127,127,.05));color:var(--pmm-wb-editor-text,#222);font-size:12px!important;line-height:1.55!important;resize:none}
.pmm-wb-source-picker{position:absolute;inset:0;z-index:14000;display:flex;align-items:flex-start;justify-content:center;padding:max(12px,env(safe-area-inset-top)) 10px;background:rgba(0,0,0,.42);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}.pmm-wb-picker-dialog{width:min(94%,430px);max-height:min(78%,620px);margin-top:7vh;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--pm-border,rgba(127,127,127,.22));border-radius:13px;background:var(--pm-panel-bg,var(--pm-card-bg,#fff));color:var(--pm-text-primary,inherit);box-shadow:0 18px 50px rgba(0,0,0,.35)}.pmm-wb-picker-head{display:grid;grid-template-columns:minmax(0,1fr) 34px;gap:6px;padding:8px;border-bottom:1px solid var(--pm-border,rgba(127,127,127,.14))}.pmm-wb-picker-head input{height:34px;min-width:0;padding:0 9px;border:1px solid var(--pm-border,rgba(127,127,127,.2));border-radius:8px;background:var(--pm-card-bg,rgba(127,127,127,.05));color:inherit}.pmm-wb-picker-head button{border:0;border-radius:8px;background:rgba(127,127,127,.08);color:inherit}.pmm-wb-picker-list{min-height:0;overflow:auto;padding:6px}.pmm-wb-picker-section+.pmm-wb-picker-section{margin-top:6px}.pmm-wb-picker-section-title{position:sticky;top:-6px;z-index:2;width:100%;min-height:34px;margin:0;padding:6px 8px;border:1px solid var(--pm-border,rgba(127,127,127,.13));border-radius:8px;background:var(--pm-card-bg,var(--pm-panel-bg,#fff));color:var(--pm-text-secondary,currentColor);display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:10px;font-weight:650;text-align:left}.pmm-wb-picker-section.is-expanded .pmm-wb-picker-section-title{border-radius:8px 8px 4px 4px}.pmm-wb-picker-section-title span{display:flex;align-items:center;gap:6px}.pmm-wb-picker-section-title i{width:11px;text-align:center;color:var(--pm-quote-color,#3485f6)}.pmm-wb-picker-section-title small{width:auto;font-size:9px;opacity:.58}.pmm-wb-picker-section-body{padding-top:3px}.pmm-wb-picker-section-body>button{width:100%;min-height:38px;margin-bottom:3px;padding:7px 9px;border:1px solid transparent;border-radius:8px;background:transparent;color:inherit;text-align:left;display:flex;flex-direction:column;justify-content:center;gap:2px}.pmm-wb-picker-name{width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pmm-wb-picker-section-body>button small{width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;opacity:.56}.pmm-wb-picker-section-body>button.is-current{border-color:var(--pm-quote-color,#3b82f6);background:color-mix(in srgb,var(--pm-quote-color,#3b82f6) 11%,transparent)}
@media(max-width:768px){.pmm-wb-header{height:42px;min-height:42px;padding:4px}.pmm-wb-source-select{width:auto!important;min-width:0!important;max-width:none!important;flex:1 1 auto!important}.pmm-wb-source-action{width:23px;height:24px;min-width:23px}.pmm-wb-status{display:none}.pmm-wb-tool{width:24px;height:25px;min-width:24px}.pmm-wb-kind-switch button{width:22px}.pmm-wb-search-bar{gap:3px;padding:4px 6px}.pmm-wb-search-primary{gap:3px;flex-wrap:wrap}.pmm-wb-search-input-wrap{min-width:64px;flex:1 1 92px}.pmm-wb-search-scope{margin-left:auto}.pmm-wb-search-scope button{padding:0 4px;font-size:8.5px}.pmm-wb-replace-row{gap:3px}.pmm-wb-replace-action{padding:0 6px}.pmm-wb-list{padding:5px}.pmm-wb-entry-head{min-height:var(--pmm-user-item-height,39px);padding:2px 6px}.pmm-wb-details{padding:6px 7px 8px;gap:5px}.pmm-wb-meta-grid,.pmm-wb-meta-grid.has-depth{grid-template-columns:minmax(0,1.7fr) minmax(52px,.58fr) minmax(52px,.58fr)}.pmm-wb-details textarea{min-height:118px!important}.pmm-wb-content-search-preview{height:118px;min-height:118px}.pmm-wb-editor-dialog{width:94%;height:82%;max-height:calc(100dvh - 24px);border-radius:12px}.pmm-wb-editor-dialog textarea{margin:6px;padding:8px;font-size:11px!important}}
`;
    style.textContent += `
.pmm-wb-editor-dialog header button[data-wb-editor-search-toggle].is-active{background:color-mix(in srgb,var(--pmm-wb-editor-accent,#3485f6) 18%,transparent);color:var(--pmm-wb-editor-accent,#3485f6)}
.pmm-wb-editor-search{display:flex;flex-direction:column;gap:4px;padding:5px 8px;border-bottom:1px solid var(--pmm-wb-editor-border,rgba(127,127,127,.14))}.pmm-wb-editor-search[hidden]{display:none!important}.pmm-wb-editor-search-primary{min-height:26px;display:flex;align-items:center;gap:4px;min-width:0}.pmm-wb-editor-search-primary>i{width:13px;flex:none;font-size:10px;opacity:.62;text-align:center}.pmm-wb-editor-search-input-wrap{position:relative;min-width:48px;flex:1;display:block}.pmm-wb-editor-search-input-wrap input{box-sizing:border-box;width:100%;height:26px;padding:0 37px 0 7px;border:1px solid var(--pmm-wb-editor-border,rgba(127,127,127,.18));border-radius:6px;background:var(--pmm-wb-editor-field-bg,rgba(127,127,127,.05));color:inherit;font-size:11px;outline:none}.pmm-wb-editor-search-count{position:absolute;right:6px;top:50%;transform:translateY(-50%);min-width:27px;font-size:9px;line-height:1;opacity:.58;text-align:right;white-space:nowrap;pointer-events:none}
.pmm-wb-editor-search-primary button{width:22px;height:23px;min-width:22px;padding:0;border:0;border-radius:4px;background:transparent;color:inherit;opacity:.68}.pmm-wb-editor-search-primary button:disabled{opacity:.22}.pmm-wb-editor-search-primary button.is-active{background:color-mix(in srgb,currentColor 10%,transparent);opacity:.92}.pmm-wb-editor-search-primary button i{font-size:9px}.pmm-wb-editor-replace-row{display:none;align-items:center;gap:4px;min-width:0}.pmm-wb-editor-replace-row.is-open{display:flex}.pmm-wb-editor-replace-row input{box-sizing:border-box;min-width:0;flex:1;height:26px;padding:0 7px;border:1px solid var(--pmm-wb-editor-border,rgba(127,127,127,.18));border-radius:6px;background:var(--pmm-wb-editor-field-bg,rgba(127,127,127,.05));color:inherit;font-size:11px;outline:none}.pmm-wb-editor-replace-row button{height:26px;min-width:42px;padding:0 7px;border:0;border-radius:6px;background:color-mix(in srgb,currentColor 9%,transparent);color:inherit;font-size:9px;opacity:.62;white-space:nowrap}.pmm-wb-editor-replace-row button:last-child{min-width:57px}.pmm-wb-editor-replace-row:focus-within button{background:var(--pmm-wb-editor-text,#222);color:var(--pmm-wb-editor-bg,#fff);opacity:.93}
.pmm-wb-editor-body{position:relative;flex:1;min-height:0;margin:8px}.pmm-wb-editor-body>.pmm-wb-editor-search-preview,.pmm-wb-editor-body>textarea{box-sizing:border-box;position:absolute!important;inset:0;width:100%!important;height:100%!important;min-height:0!important;margin:0!important;padding:10px;border:1px solid var(--pmm-wb-editor-border,rgba(127,127,127,.18));border-radius:9px;font-size:12px!important;line-height:1.55!important;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word}.pmm-wb-editor-body>.pmm-wb-editor-search-preview{display:none;overflow:auto;background:var(--pmm-wb-editor-field-bg,rgba(127,127,127,.05));color:var(--pmm-wb-editor-text,#222);pointer-events:none;scrollbar-width:none}.pmm-wb-editor-body>.pmm-wb-editor-search-preview::-webkit-scrollbar{display:none}.pmm-wb-editor-body.is-search-active>.pmm-wb-editor-search-preview{display:block}.pmm-wb-editor-body>textarea{z-index:1;resize:none}.pmm-wb-editor-body.is-search-active>textarea{border-color:transparent!important;background:transparent!important;color:transparent!important;-webkit-text-fill-color:transparent!important;caret-color:var(--pmm-wb-editor-text,#222)!important}.pmm-wb-editor-body.is-search-active>textarea::selection{background:color-mix(in srgb,var(--pmm-wb-editor-accent,#3485f6) 38%,transparent)}
.pmm-wb-editor-search-preview .pmm-wb-search-highlight{border-color:color-mix(in srgb,var(--pmm-wb-editor-accent,#3485f6) 55%,transparent);background:color-mix(in srgb,var(--pmm-wb-editor-accent,#3485f6) 38%,transparent)}.pmm-wb-editor-search-preview .pmm-wb-search-highlight.is-current{border-color:var(--pmm-wb-editor-accent,#3485f6);background:color-mix(in srgb,var(--pmm-wb-editor-accent,#3485f6) 82%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,var(--pmm-wb-editor-accent,#3485f6) 80%,transparent),0 0 9px color-mix(in srgb,var(--pmm-wb-editor-accent,#3485f6) 72%,transparent)}
@media(max-width:768px){.pmm-wb-editor-dialog header{gap:5px;padding:5px 6px}.pmm-wb-editor-dialog header button{width:26px;height:26px}.pmm-wb-editor-search{gap:3px;padding:4px 6px}.pmm-wb-editor-search-primary{gap:3px}.pmm-wb-editor-body{margin:6px}.pmm-wb-editor-body>.pmm-wb-editor-search-preview,.pmm-wb-editor-body>textarea{margin:0!important;padding:8px!important;font-size:11px!important}}
`;
    style.textContent += `
.pmm-wb-editor-search-primary{flex-wrap:nowrap!important}.pmm-wb-editor-search-input-wrap input{padding:0 7px!important}.pmm-wb-editor-search-count{position:static!important;top:auto!important;right:auto!important;transform:none!important;display:block;flex:0 0 28px;min-width:28px;font-size:9px;line-height:26px;opacity:.58;text-align:center;white-space:nowrap;pointer-events:none}
`;
    style.textContent += `
.pmm-wb-multi-drag-float[data-pmm-wb-multi-drag-forbidden="true"] .pmm-wb-multi-drag-float-back{border-color:rgba(222,106,120,.55);background:rgba(122,53,67,.45)}.pmm-wb-multi-drag-float[data-pmm-wb-multi-drag-forbidden="true"] .pmm-wb-multi-drag-float-face{border-color:rgba(237,150,160,.72);background:rgba(84,43,53,.90);color:#ffe8eb!important;-webkit-text-fill-color:#ffe8eb!important}.pmm-wb-multi-drag-float[data-pmm-wb-multi-drag-forbidden="true"] .pmm-wb-multi-drag-float-face i{color:#ff9daa!important;-webkit-text-fill-color:#ff9daa!important}.pmm-wb-multi-drag-float[data-pmm-wb-multi-drag-forbidden="true"] .pmm-wb-multi-drag-float-face b{background:rgba(163,75,90,.88);color:#fff0f2!important;-webkit-text-fill-color:#fff0f2!important}.pmm-wb-panel--drop-forbidden .pmm-wb-list{cursor:not-allowed}
`;
    style.textContent += `
.pmm-wb-entry-actions{display:inline-flex;flex:none;align-items:center;gap:6px;margin:0 10px 0 5px}.pmm-wb-entry-action{width:23px;height:24px;min-width:23px;padding:0!important;display:inline-flex;align-items:center;justify-content:center;border:0!important;border-radius:6px;background:color-mix(in srgb,currentColor 8%,transparent)!important;color:inherit!important;opacity:.72}.pmm-wb-entry-action i{font-size:9px}.pmm-wb-entry-action:active{transform:scale(.94);opacity:1}
@media(max-width:768px){.pmm-wb-entry-actions{gap:7px;margin:0 11px 0 6px}.pmm-wb-entry-action{width:24px;height:25px;min-width:24px}}
`;
    DOC.head.append(style);
  }

  function wait(milliseconds) { return new Promise(resolve => TOP.setTimeout(resolve, milliseconds)); }

  async function ensureNormalMode(container) {
    const activeMode = MODE_CLASSES.some(name => container.classList.contains(name));
    if (!activeMode) return true;
    const activeButton = container.querySelector('.side-panel-root .panel-btn.panel-btn--active:not([data-pmm-worldbook-placeholder="1"])');
    activeButton?.click();
    for (let attempt = 0; attempt < 20; attempt++) {
      await wait(35);
      if (!MODE_CLASSES.some(name => container.classList.contains(name))) return true;
    }
    return false;
  }

  async function open() {
    if (state.open) return close();
    const host = DOC.getElementById('preset-manager-main-panel');
    const container = host?.querySelector('.pm-panel-container');
    const mainWrapper = container?.querySelector(':scope > .pm-main-wrapper');
    const nativeTop = mainWrapper?.querySelector(':scope > .preset-panel');
    if (!host || !container || !mainWrapper || !nativeTop) {
      return notify('warning', '请先打开预设工坊主面板');
    }
    if (!await ensureNormalMode(container)) {
      return notify('warning', '请先退出当前的缝合／分支／收藏页面后再打开世界书');
    }
    installStyle();
    state.open = true;
    state.host = host;
    state.container = container;
    state.mainWrapper = mainWrapper;
    state.nativeTop = nativeTop;
    endNativePresetDragState();
    clearNativeDropIndicators();
    clearWorldDropIndicators();
    host.classList.add('pmm-worldbook-mode');
    container.classList.add('pm-panel-container--merge-mode', 'pmm-worldbook-layout');
    try {
      state.busy = true;
      setStatus('读取世界书…');
      await refreshWorldNames();
      await loadWorldSide(state.bottom);
      if (state.topType === 'world') await loadWorldSide(state.top);
      setStatus('已同步');
      renderPanels();
    } catch (error) {
      console.error('[世界书缝合] 打开失败', error);
      notify('error', `打开失败：${error?.message || error}`);
      close();
      return;
    } finally {
      state.busy = false;
    }
    hostObserver?.disconnect();
    hostObserver = new MutationObserver(() => {
      if (!state.host?.isConnected) return resetClosedState();
      scheduleDecorate();
    });
    hostObserver.observe(host, { childList: true, subtree: true });
  }

  function resetClosedState() {
    endNativePresetDragState();
    clearNativeDropIndicators();
    clearWorldDropIndicators();
    state.open = false;
    state.busy = false;
    state.status = '已同步';
    state.host = null;
    state.container = null;
    state.mainWrapper = null;
    state.nativeTop = null;
    state.bottomCard = null;
    state.topCard = null;
    resetSide(state.top, true);
    resetSide(state.bottom, true);
    context = null;
    dragPayload = null;
    removeWorldMultiDragFloat();
    hostObserver?.disconnect();
    hostObserver = null;
  }

  function close() {
    if (!state.open) return;
    endNativePresetDragState();
    clearDrag();
    if (renderFrame) TOP.cancelAnimationFrame(renderFrame);
    renderFrame = 0;
    const themeToggle = state.host?.querySelector?.('.pmm-mobile-theme-toggle');
    const themeCard = state.nativeTop?.querySelector?.('.theme-switch-card');
    if (themeToggle && themeCard) themeCard.append(themeToggle);
    removeSourcePicker(state.host?.querySelector?.('.pmm-wb-source-picker'));
    state.topCard?.remove();
    state.bottomCard?.remove();
    state.host?.querySelector('.pmm-wb-editor-overlay')?.remove();
    state.nativeTop?.classList.remove('pmm-wb-native-hidden');
    state.nativeTop?.querySelector('[data-pmm-wb-kind-switch]')?.remove();
    state.nativeTop?.querySelector('[data-pmm-theme-toolbar-slot]')?.remove();
    state.nativeTop?.querySelector('[data-pmm-wb-native-transfer]')?.remove();
    state.container?.classList.remove('pm-panel-container--merge-mode', 'pmm-worldbook-layout');
    state.host?.classList.remove('pmm-worldbook-mode');
    state.host?.querySelector('[data-pmm-worldbook-placeholder="1"]')?.classList.remove('panel-btn--active');
    resetClosedState();
  }

  function cleanup() {
    close();
    DOC.querySelector('#preset-manager-main-panel .pmm-wb-editor-overlay')?.remove();
    DOC.getElementById(STYLE_ID)?.remove();
    DOC.removeEventListener('click', onPresetExpandClick, true);
    DOC.removeEventListener('click', onDocumentClick, true);
    DOC.removeEventListener('change', onDocumentChange, true);
    DOC.removeEventListener('input', onDocumentInput, true);
    DOC.removeEventListener('focusin', onDocumentFocusIn, true);
    DOC.removeEventListener('focusout', onDocumentFocusOut, true);
    DOC.removeEventListener('dragstart', onDragStart, true);
    DOC.removeEventListener('drag', onDragMove, true);
    DOC.removeEventListener('dragover', onDragOver, true);
    DOC.removeEventListener('drop', onDrop, true);
    DOC.removeEventListener('dragend', clearDrag, true);
    try { if (TOP[API_KEY]?.cleanup === cleanup) delete TOP[API_KEY]; } catch (_) {}
  }

  function clearDrag() {
    dragPayload = null;
    setUnsupportedPresetToWorldDrop(null, false);
    removeWorldMultiDragFloat();
    clearNativeDropIndicators();
    clearWorldDropIndicators();
  }

  try { TOP.__PMM_WORLDBOOK_STITCH_TEST2__?.cleanup?.(); } catch (_) {}
  try { TOP[API_KEY]?.cleanup?.(); } catch (_) {}
  DOC.addEventListener('click', onPresetExpandClick, true);
  DOC.addEventListener('click', onDocumentClick, true);
  DOC.addEventListener('change', onDocumentChange, true);
  DOC.addEventListener('input', onDocumentInput, true);
  DOC.addEventListener('focusin', onDocumentFocusIn, true);
  DOC.addEventListener('focusout', onDocumentFocusOut, true);
  DOC.addEventListener('dragstart', onDragStart, true);
  DOC.addEventListener('drag', onDragMove, true);
  DOC.addEventListener('dragover', onDragOver, true);
  DOC.addEventListener('drop', onDrop, true);
  DOC.addEventListener('dragend', clearDrag, true);
  TOP[API_KEY] = { open, close, cleanup, state,
    async refreshSnapshotBook(name, data, skipNative = false) {
      if (!state.open) return;
      saveScrolls();
      for (const side of [state.top, state.bottom]) {
        if (side.name !== name || side.dirty) continue;
        applyWorldData(side, data);
        side.savedData = clone(data);
        side.history.length = 0;
      }
      renderPanels();
      if (!skipNative) await reloadOpenNativeWorldbook(name);
    },
  };
  console.info('[预设工坊测试版] test.3 世界书已接入原生双卡片布局。');
  console.info('[预设工坊测试版] test.29 已加载：世界书条目按蓝色落点线插入目标位置。');
  console.info('[预设工坊测试版] test.30 已加载：手机三态主题按钮已移入世界书顶部工具栏。');
  console.info('[预设工坊测试版] test.31 已加载：世界书可按角色名搜索并按角色绑定状态分组。');
  console.info('[预设工坊测试版] test.32 已加载：世界书搜索跟随主题，分类默认折叠并可展开。');
  console.info('[预设工坊测试版] test.33 已加载：角色绑定世界书兼容名称末尾空格与 Unicode 差异。');
  console.info('[预设工坊测试版] test.34 已加载：世界书支持原生重命名入口和范围关键词搜索。');
  console.info('[预设工坊测试版] test.35 已加载：世界书搜索输入不会重建输入框，兼容 iOS 中文输入法。');
  console.info('[预设工坊测试版] test.36 已加载：世界书搜索支持范围替换、空替换删除和单步撤销。');
  console.info('[预设工坊测试版] test.37 已加载：世界书正文高亮区分当前命中，并跟随日夜间和魔法棒主题。');
})();
