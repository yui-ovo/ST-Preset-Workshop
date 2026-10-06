import { clone, equal, sourceKey, createTransactions, createHostAdapter } from './regex-manager-core.js';

const ID = 'pmm-regex-manager';
const SCOPES = { 0: '旧版显示', 1: '用户输入', 2: 'AI 输出', 3: '快捷命令', 4: '旧版发送', 5: '世界信息', 6: '推理' };
const TYPES = { preset: '预设正则', global: '全局正则', character: '当前角色', favorites: '正则收藏' };
const nativeLoads = new WeakMap();

// Import in the HOST document's module map, not the hidden runtime iframe.
// This reuses the host's live settings instead of initializing another app.
function loadNative(host) {
  if (nativeLoads.has(host)) return nativeLoads.get(host);
  const promise = new Promise((resolve, reject) => {
    const key = `__pmm_regex_native_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = host.document.createElement('script');
    script.type = 'module';
    const url = new URL('script.js', host.document.baseURI).href;
    const cleanup = () => { host.clearTimeout(timer); delete host[key]; script.remove(); };
    const timer = host.setTimeout(() => { cleanup(); reject(new Error('酒馆保存接口载入超时')); }, 12000);
    host[key] = (module, error) => { cleanup(); error ? reject(new Error(error)) : resolve(module); };
    script.textContent = `import(${JSON.stringify(url)}).then(m=>window[${JSON.stringify(key)}]?.(m),e=>window[${JSON.stringify(key)}]?.(null,e.message));`;
    script.onerror = () => { cleanup(); reject(new Error('酒馆保存接口载入失败')); };
    host.document.head.append(script);
  }).catch(error => { nativeLoads.delete(host); throw error; });
  nativeLoads.set(host, promise);
  return promise;
}

const CSS = `
#${ID}{position:absolute!important;inset:0!important;z-index:12200!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:max(10px,var(--pmm-safe-top,0px),var(--tt-inset-top,0px),env(safe-area-inset-top)) 8px max(10px,var(--pmm-safe-bottom,0px),var(--tt-inset-bottom,0px),env(safe-area-inset-bottom))!important;box-sizing:border-box!important;background:rgba(0,0,0,.36)!important;pointer-events:auto!important;font-family:var(--pm-font-family,system-ui)!important;color:var(--pm-text-primary,#e5eaf3)!important}
#${ID} *{box-sizing:border-box}
#${ID} .rx-shell{width:min(100%,1060px);height:var(--pmm-user-panel-height,100%);max-height:100%;min-height:0;display:flex;flex-direction:column;gap:10px;padding:14px;background:var(--pm-panel-bg,#192230);border:1px solid var(--pm-border,#394357);border-radius:20px;overflow:hidden;box-shadow:0 12px 44px #0004}
#${ID} button,#${ID} input,#${ID} select{font:inherit!important;color:inherit!important;box-shadow:none!important;text-shadow:none!important;filter:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;opacity:1;letter-spacing:normal!important}
#${ID} button{display:inline-flex;align-items:center;justify-content:center;gap:5px;flex-shrink:0;min-width:32px;min-height:32px;width:auto;height:auto;margin:0;padding:5px 8px;border:1px solid transparent;border-radius:9px;background:transparent;cursor:pointer;line-height:1.2;font-size:13px!important}
#${ID} button:hover,#${ID} button[aria-pressed=true]{background:var(--pm-hover-bg,#354357);border-color:var(--pm-border,#546075)}
#${ID} button:disabled{opacity:.4;cursor:default}
#${ID} :focus-visible{outline:2px solid var(--pm-accent,#8eafff);outline-offset:1px}
#${ID} .rx-head{display:flex;align-items:center;gap:6px;flex-shrink:0}
#${ID} .rx-title{flex:1;font-size:17px;font-weight:650;line-height:1.5;min-width:0}
#${ID} .rx-title small{display:block;font-size:11px;font-weight:400;color:var(--pm-text-secondary,#aeb9cb)}
#${ID} .rx-panes{display:flex;flex-direction:column;flex:1;min-height:0;gap:12px}
#${ID} .rx-pane{display:flex;flex:1;flex-direction:column;min-height:0;min-width:0;border:1px solid var(--pm-border,#394357);border-radius:14px;overflow:hidden;background:var(--pm-card-bg,#222e3e)}
#${ID} .rx-pane-head{padding:8px 10px;display:flex;flex-wrap:wrap;align-items:center;gap:6px;border-bottom:1px solid var(--pm-border,#394357)}
#${ID} select{width:112px;min-width:0;max-width:45%;height:32px;padding:3px 4px;border:0;background:var(--pm-panel-bg,#192230)!important;color:var(--pm-text-primary,#e5eaf3)!important;border-radius:7px;font-size:13px!important}
#${ID} select{appearance:none!important;-webkit-appearance:none!important;padding-right:20px!important;background-image:linear-gradient(45deg,transparent 50%,currentColor 50%),linear-gradient(135deg,currentColor 50%,transparent 50%)!important;background-position:calc(100% - 11px) 50%,calc(100% - 7px) 50%!important;background-size:4px 4px,4px 4px!important;background-repeat:no-repeat!important}
#${ID} .rx-source-name{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;text-align:left;font-size:12px!important}
#${ID} .rx-tools{display:flex;align-items:center;gap:5px;width:100%;min-width:0}
#${ID} .rx-search{flex:1;min-width:30px;width:0;height:29px;padding:4px 7px;margin:0;border:0;border-radius:6px;background:var(--pm-panel-bg,#192230);font-size:12px!important}
#${ID} .rx-count{font-size:11px;white-space:nowrap;color:var(--pm-text-secondary,#aeb9cb)}
#${ID} .rx-list{position:relative;flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:6px;scrollbar-width:thin;touch-action:pan-y}
#${ID} .rx-row{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin:0 0 5px;padding:8px 6px;border:1px solid transparent;border-radius:10px;min-height:61px;background:var(--pm-panel-bg,#192230)}
#${ID} .rx-row.selected{border-color:var(--pm-text-primary,#e5eaf3);background:var(--pm-selected-bg,#334563)}
#${ID} .rx-grip{touch-action:none;cursor:grab;padding:4px;min-width:26px;color:var(--pm-text-secondary,#aeb9cb)!important}
#${ID} input[type=checkbox]{appearance:auto!important;-webkit-appearance:checkbox!important;accent-color:var(--pm-accent,#8eafff);width:17px!important;height:17px!important;min-width:17px;margin:0!important;cursor:pointer}
#${ID} .rx-row-title{flex:1;min-width:0;display:block;text-align:left;padding:1px 0;border:0!important;background:transparent!important}
#${ID} .rx-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:1.5}
#${ID} .rx-scope{display:block;font-size:10px;line-height:1.5;color:var(--pm-text-secondary,#aeb9cb);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#${ID} .rx-toggle{font-size:11px!important;min-width:40px;color:var(--pm-text-secondary,#aeb9cb)!important}
#${ID} .rx-toggle[aria-pressed=true]{color:var(--pm-text-primary,#e5eaf3)!important;background:transparent;border-color:transparent}
#${ID} .rx-detail{width:100%;padding:6px 5px 2px 30px;display:flex;flex-direction:column;gap:6px}
#${ID} .rx-detail pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:100px;overflow:auto;margin:0;font:11px/1.5 monospace;color:var(--pm-text-secondary,#aeb9cb)}
#${ID} .rx-detail .rx-full-name{font-size:13px;overflow-wrap:anywhere}
#${ID} .rx-actions{display:flex;align-items:center;justify-content:flex-end;gap:3px;flex-wrap:wrap}
#${ID} .rx-empty{padding:28px 10px;text-align:center;font-size:12px;line-height:1.8;color:var(--pm-text-secondary,#aeb9cb)}
#${ID} .rx-status{font-size:11px;line-height:1.5;min-height:17px;color:var(--pm-text-secondary,#aeb9cb);flex-shrink:0;overflow-wrap:anywhere}
#${ID} .rx-status.error{color:#ef8d85}
#${ID} .rx-drop-line{height:3px;position:absolute;left:7px;right:7px;background:var(--pm-text-primary,#e5eaf3);pointer-events:none;z-index:2;border-radius:5px}
#${ID} .rx-drag-label{position:fixed;pointer-events:none;background:var(--pm-panel-bg,#192230);color:var(--pm-text-primary,#fff);border:1px solid var(--pm-accent,#8eafff);padding:6px 10px;border-radius:8px;font-size:12px;z-index:5;max-width:240px}
#${ID} .rx-picker{position:absolute;inset:8%;z-index:8;background:var(--pm-panel-bg,#192230);border:1px solid var(--pm-border,#394357);border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:10px;box-shadow:0 10px 40px #0008}
#${ID} .rx-picker .rx-search{flex:0 0 36px;width:100%}
#${ID} .rx-picker-list{overflow:auto;min-height:0;display:flex;flex-direction:column;gap:4px}
#${ID} .rx-picker-list button{justify-content:flex-start;text-align:left;white-space:normal;overflow-wrap:anywhere}
#${ID}[data-busy=true] .rx-panes{pointer-events:none;opacity:.7}
@media(min-width:850px){#${ID} .rx-panes{flex-direction:row}#${ID} .rx-shell{height:85%;max-height:900px}}
@media(max-width:849px){#${ID} .rx-search,#${ID} select{font-size:16px!important}}
`;

export async function open({ host = window.parent, root = host.document.getElementById('preset-manager-main-panel'), adapter } = {}) {
  const doc = root?.ownerDocument || host.document;
  if (doc.getElementById(ID)) return;
  adapter ||= createHostAdapter(host, () => loadNative(host));
  const abort = new host.AbortController();
  const on = (node, type, handler, options = {}) => node.addEventListener(type, handler, node === doc || node === host ? { ...options, signal: abort.signal } : options);
  const el = (tag, className, text) => { const node = doc.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
  const button = (text, title, fn, cls = '') => { const b = el('button', cls, text); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title); on(b, 'click', fn); return b; };
  if (!doc.getElementById(`${ID}-style`)) { const style = el('style'); style.id = `${ID}-style`; style.textContent = CSS; doc.head.append(style); }
  const overlay = el('div'); overlay.id = ID;
  const shell = el('section', 'rx-shell'); shell.setAttribute('role', 'dialog'); shell.setAttribute('aria-label', '正则整理');
  shell.setAttribute('aria-modal', 'true'); shell.tabIndex = -1;
  const previousFocus = doc.activeElement;
  const heading = el('header', 'rx-head');
  const title = el('div', 'rx-title', '正则整理'); title.append(el('small', '', '拖动 ⋮⋮ 到指定位置 · 跨栏复制，同列表排序'));
  const status = el('div', 'rx-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  let busy = false, closed = false, dirty = false, drag = null, frame = 0, picker = null;
  const transaction = createTransactions({
    read: adapter.read,
    async write(source, records) { await adapter.write(source, records); if (source.type !== 'favorites') dirty = true; },
  });
  const panes = [];
  const message = (text, error = false) => { status.textContent = text; status.classList.toggle('error', error); };
  const themeSource = root?.querySelector('.pm-overlay');
  function syncTheme() {
    if (!themeSource) return;
    const computed = host.getComputedStyle(themeSource);
    for (const name of computed) if (name.startsWith('--pm-') || name === '--pmm-user-panel-height') overlay.style.setProperty(name, computed.getPropertyValue(name));
    const height = root.style.getPropertyValue('--pmm-user-panel-height');
    if (height) overlay.style.setProperty('--pmm-user-panel-height', height);
  }
  syncTheme();
  const observer = new host.MutationObserver(syncTheme);
  if (themeSource) observer.observe(themeSource, { attributes: true, attributeFilter: ['style'] });
  function close() {
    if (busy) { message('正在保存，完成后即可关闭'); return; }
    if (closed) return;
    closed = true; stopDrag(); abort.abort(); observer.disconnect(); lifecycle.disconnect(); overlay.remove();
    if (previousFocus?.isConnected) previousFocus.focus?.({ preventScroll: true });
    // One native refresh after all edits, never per drag frame or per row.
    if (dirty) {
      const ctx = adapter.context();
      const type = ctx.eventTypes?.PRESET_CHANGED;
      if (type && ctx.eventSource?.emit) Promise.resolve(ctx.eventSource.emit(type, { apiId: ctx.getPresetManager?.()?.apiId, name: ctx.getPresetManager?.()?.getSelectedPresetName?.() })).catch(error => console.warn('[预设工坊][正则] 原生列表刷新失败', error));
    }
  }
  const undo = button('↶', '撤销上一步', () => run(() => transaction.undo(), '已撤销'));
  const refresh = button('⟳', '刷新两栏列表', () => run(async () => {}, '已刷新'));
  heading.append(title, undo, refresh, button('×', '关闭正则整理', close));
  const panesNode = el('div', 'rx-panes'); shell.append(heading, panesNode, status); overlay.append(shell); (root || doc.body).append(overlay);
  // Observe only the direct parent for removal, not the page subtree.
  const lifecycle = new host.MutationObserver(() => { if (!overlay.isConnected) { closed = true; stopDrag(); abort.abort(); observer.disconnect(); lifecycle.disconnect(); } });
  lifecycle.observe(root?.parentNode || doc.body, { childList: true });
  if (root) lifecycle.observe(root, { childList: true });
  on(host, 'pagehide', close, { once: true });
  on(overlay, 'keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); if (picker) { picker.remove(); picker = null; } else close(); } });
  on(overlay, 'keydown', e => {
    if (e.key !== 'Tab') return;
    const nodes = [...(picker || shell).querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled)')].filter(n => n.getClientRects().length && !n.closest('[inert]'));
    if (!nodes.length) return;
    if (e.shiftKey && (doc.activeElement === nodes[0] || doc.activeElement === shell)) { e.preventDefault(); nodes.at(-1).focus(); }
    else if (!e.shiftKey && doc.activeElement === nodes.at(-1)) { e.preventDefault(); nodes[0].focus(); }
  });
  // Existing workshop keyboard and selection handlers must not consume these controls.
  for (const type of ['click', 'dblclick', 'pointerdown', 'mousedown', 'touchstart']) on(overlay, type, e => e.stopPropagation());
  async function run(fn, success) {
    if (busy || closed) return;
    busy = true; overlay.dataset.busy = 'true'; panesNode.inert = true; undo.disabled = refresh.disabled = true; stopDrag();
    let error;
    try { await fn(); message(success || '已保存'); }
    catch (e) { error = e; message(e.message || String(e), true); }
    finally {
      if (!closed) {
        for (const pane of panes) { try { pane.data = adapter.read(pane.source); pane.selected.clear(); pane.expanded = -1; renderRows(pane); } catch (e) { pane.data = []; pane.list.replaceChildren(el('div', 'rx-empty', e.message)); } }
        busy = false; overlay.dataset.busy = 'false'; panesNode.inert = false; undo.disabled = !transaction.history.length; refresh.disabled = false;
        if (error) console.warn('[预设工坊][正则]', error);
      }
    }
  }
  const metadata = adapter.presets();
  const makePreset = name => ({ type: 'preset', name, apiId: metadata.apiId });
  const initial = metadata.current || metadata.names[0];
  const second = metadata.names.find(n => n !== initial) || initial;
  async function changeSource(pane, source) {
    if (busy) return;
    stopDrag(); pane.source = source; pane.selected.clear(); pane.expanded = -1; pane.query = ''; pane.search.value = ''; pane.limit = 80;
    try { pane.data = adapter.read(source); message(source.type === 'favorites' ? '收藏保留完整正则副本，不会执行，也不会随来源修改。' : '作用范围、深度和其他正则设置会原样保留。'); }
    catch (e) { pane.data = []; message(e.message, true); }
    pane.type.value = source.type; pane.name.textContent = source.name || TYPES[source.type];
    pane.name.disabled = source.type !== 'preset'; renderRows(pane); pane.list.scrollTop = 0;
  }
  function choosePreset(pane) {
    if (picker || busy) return;
    picker = el('div', 'rx-picker'); const head = el('div', 'rx-head'); head.append(el('strong', 'rx-title', '选择预设'), button('×', '关闭预设选择', () => { picker.remove(); picker = null; }));
    const search = el('input', 'rx-search'); search.placeholder = '搜索预设名称'; search.setAttribute('aria-label', '搜索预设名称');
    const list = el('div', 'rx-picker-list'); picker.append(head, search, list); shell.append(picker);
    const presets = adapter.presets();
    const draw = () => { list.replaceChildren(); for (const name of presets.names.filter(n => n.toLowerCase().includes(search.value.trim().toLowerCase()))) list.append(button(name, name, () => { picker.remove(); picker = null; changeSource(pane, { type: 'preset', name, apiId: presets.apiId }); })); if (!list.childElementCount) list.append(el('div', 'rx-empty', '没有匹配的预设')); };
    on(search, 'input', draw); draw(); search.focus();
  }
  function visibleIndices(pane) { const q = pane.query.trim().toLowerCase(); return pane.data.flatMap((r, i) => !q || String(r.scriptName || '').toLowerCase().includes(q) ? [i] : []); }
  function updateSelection(pane) {
    pane.count.textContent = pane.selected.size ? `已选 ${pane.selected.size} / ${pane.data.length}` : `${pane.data.length} 条`;
    const all = visibleIndices(pane); const checked = all.length > 0 && all.every(i => pane.selected.has(i));
    pane.all.setAttribute('aria-pressed', String(checked)); pane.all.textContent = checked ? '取消全选' : pane.query ? '全选结果' : '全选';
    for (const row of pane.list.querySelectorAll('.rx-row')) { const selected = pane.selected.has(Number(row.dataset.index)); row.classList.toggle('selected', selected); row.querySelector('input').checked = selected; }
  }
  async function transfer(from, to, indices, at, move = false) {
    if (!to?.source) return;
    const snapshot = clone(from.data), destination = clone(to.data);
    await run(async () => {
      await transaction.transfer(from.source, to.source, snapshot, destination, indices, at, move);
    }, sourceKey(from.source) === sourceKey(to.source) ? '已调整顺序' : move ? '已移动，来源已移除' : '已复制，来源保留');
  }
  function selectedFor(pane, index) { return pane.selected.has(index) ? [...pane.selected].sort((a, b) => a - b) : [index]; }
  function createRow(pane, index) {
    const record = pane.data[index]; const row = el('div', 'rx-row'); row.dataset.index = String(index);
    const grip = button('⋮⋮', '拖动正则；已勾选时拖动整批', () => {}, 'rx-grip');
    on(grip, 'pointerdown', e => startDrag(e, pane, index));
    const check = el('input'); check.type = 'checkbox'; check.setAttribute('aria-label', `选择 ${record.scriptName || '未命名正则'}`);
    on(check, 'change', () => { check.checked ? pane.selected.add(index) : pane.selected.delete(index); updateSelection(pane); });
    const name = button('', `展开 ${record.scriptName || '未命名正则'}`, () => { pane.expanded = pane.expanded === index ? -1 : index; renderRows(pane); }, 'rx-row-title');
    name.setAttribute('aria-expanded', String(pane.expanded === index)); name.append(el('span', 'rx-name', record.scriptName || '未命名正则'), el('span', 'rx-scope', (record.placement || []).map(n => SCOPES[n] || `范围 ${n}`).join(' · ') || '未设置作用范围'));
    const toggle = button(record.disabled ? '关闭' : '开启', `${record.disabled ? '开启' : '关闭'} ${record.scriptName || '正则'}`, () => run(async () => { const after = clone(pane.data); after[index].disabled = !record.disabled; await transaction.edit(pane.source, pane.data, after, '更改开关'); }, '开关已保存'), 'rx-toggle'); toggle.setAttribute('aria-pressed', String(!record.disabled));
    row.append(grip, check, name, toggle);
    if (pane.expanded === index) {
      const detail = el('div', 'rx-detail'); detail.append(el('div', 'rx-full-name', record.scriptName || '未命名正则'));
      detail.append(el('pre', '', `查找：${record.findRegex || ''}\n替换：${record.replaceString || ''}`));
      const actions = el('div', 'rx-actions'); const target = () => panes.find(p => p !== pane);
      if (pane.source.type !== 'favorites') actions.append(button('☆', '收藏选中的正则', () => run(async () => { const to = { type: 'favorites' }; const data = adapter.read(to); await transaction.transfer(pane.source, to, pane.data, data, selectedFor(pane, index), data.length); }, '已加入正则收藏')));
      actions.append(button('⧉', '复制到另一栏末尾', () => transfer(pane, target(), selectedFor(pane, index), target().data.length)), button('移动', '移动到另一栏末尾', () => transfer(pane, target(), selectedFor(pane, index), target().data.length, true)), button('删除', '删除选中的正则', () => {
        const indices = selectedFor(pane, index);
        if (host.confirm(`删除 ${indices.length} 条正则？本次关闭前可撤销。`)) run(() => transaction.edit(pane.source, pane.data, pane.data.filter((_, i) => !indices.includes(i)), '删除正则'), '已删除，可撤销');
      }));
      detail.append(actions); row.append(detail);
    }
    return row;
  }
  function renderRows(pane) {
    const scroll = pane.list.scrollTop; pane.list.replaceChildren();
    const indices = visibleIndices(pane); const shown = indices.slice(0, pane.limit);
    const fragment = doc.createDocumentFragment();
    for (const index of shown) fragment.append(createRow(pane, index));
    if (!shown.length) fragment.append(el('div', 'rx-empty', pane.query ? '没有匹配的正则' : '这里还没有正则\n可从另一栏拖入'));
    pane.list.append(fragment);
    if (indices.length > shown.length) pane.list.append(button(`继续显示（余 ${indices.length - shown.length} 条）`, '显示更多正则', () => { pane.limit += 80; renderRows(pane); }, 'rx-more'));
    pane.list.scrollTop = scroll; updateSelection(pane);
  }
  function makePane(source, side) {
    const pane = { source, data: [], selected: new Set(), query: '', expanded: -1, limit: 80, side };
    const wrapper = el('section', 'rx-pane'); wrapper.dataset.side = side; const head = el('div', 'rx-pane-head');
    const type = el('select'); type.setAttribute('aria-label', `${side === 'a' ? '上方／左侧' : '下方／右侧'}正则来源`);
    for (const [value, label] of Object.entries(TYPES)) { const option = el('option', '', label); option.value = value; if (value === 'character') option.disabled = !adapter.currentCharacter(); if (value === 'preset') option.disabled = !metadata.names.length; type.append(option); }
    const name = button('', '选择预设', () => choosePreset(pane), 'rx-source-name'); const tools = el('div', 'rx-tools'); const search = el('input', 'rx-search'); search.placeholder = '搜索正则'; search.setAttribute('aria-label', `${side} 栏搜索正则`);
    const count = el('span', 'rx-count'); const all = button('全选', '全选当前搜索结果', () => { const indices = visibleIndices(pane); const clear = indices.every(i => pane.selected.has(i)); for (const i of indices) clear ? pane.selected.delete(i) : pane.selected.add(i); updateSelection(pane); });
    const list = el('div', 'rx-list'); list.dataset.side = side;
    Object.assign(pane, { wrapper, type, name, search, count, all, list });
    on(type, 'change', () => {
      const source = type.value === 'preset' ? { type: 'preset', apiId: adapter.presets().apiId, name: adapter.presets().current || adapter.presets().names[0] } : type.value === 'character' ? adapter.currentCharacter() : { type: type.value };
      if (!source) { type.value = pane.source.type; message('请先打开一个角色聊天', true); return; } changeSource(pane, source);
    });
    on(type, 'focus', () => { type.querySelector('option[value=character]').disabled = !adapter.currentCharacter(); });
    on(search, 'input', () => { pane.query = search.value; pane.limit = 80; pane.expanded = -1; renderRows(pane); pane.list.scrollTop = 0; });
    // Incremental DOM construction, only while the user scrolls this list.
    on(list, 'scroll', () => { if (!drag && list.scrollHeight - list.scrollTop - list.clientHeight < 120 && visibleIndices(pane).length > pane.limit) { pane.limit += 80; renderRows(pane); } }, { passive: true });
    tools.append(search, count, all); head.append(type, name, tools); wrapper.append(head, list); panesNode.append(wrapper); panes.push(pane); changeSource(pane, source);
  }
  function stopDrag() {
    if (frame) host.cancelAnimationFrame(frame); frame = 0;
    if (drag) { drag.line.remove(); drag.badge.remove(); try { drag.handle.releasePointerCapture(drag.pointer); } catch (_) {} drag = null; }
  }
  function startDrag(event, pane, index) {
    if (busy || event.button !== 0 || drag) return;
    event.preventDefault(); event.stopPropagation();
    const line = el('div', 'rx-drop-line'); const indices = selectedFor(pane, index);
    const badge = el('div', 'rx-drag-label', `${indices.length} 条正则`); badge.style.display = 'none'; overlay.append(badge);
    drag = { pane, indices, pointer: event.pointerId, handle: event.currentTarget, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, line, badge, target: null, active: false };
    drag.handle.setPointerCapture(event.pointerId);
  }
  function drawDrag() {
    frame = 0; if (!drag?.active) return;
    const { x, y, line, badge } = drag;
    badge.style.display = ''; badge.style.left = `${Math.max(4, Math.min(host.innerWidth - 170, x + 10))}px`; badge.style.top = `${Math.max(4, y - 42)}px`;
    const hit = doc.elementFromPoint(x, y);
    const list = hit?.closest('.rx-list'); const target = panes.find(p => p.list === list);
    drag.target = null; line.remove();
    if (target && overlay.contains(list)) {
      const rect = list.getBoundingClientRect();
      const velocity = y < rect.top + 35 ? -8 : y > rect.bottom - 35 ? 8 : 0;
      if (velocity) {
        list.scrollTop += velocity;
        if (velocity > 0 && list.scrollHeight - list.scrollTop - list.clientHeight < 80 && visibleIndices(target).length > target.limit) { target.limit += 80; renderRows(target); }
      }
      // Only measure the row under the pointer. In the narrow gaps between rows,
      // binary search the list instead of measuring every row on every frame.
      let row = doc.elementFromPoint(x, y)?.closest('.rx-row'), before = true;
      if (row && list.contains(row)) {
        const r = row.getBoundingClientRect(); before = y < r.top + r.height / 2;
      } else {
        const rows = list.querySelectorAll('.rx-row'); let low = 0, high = rows.length;
        while (low < high) { const mid = (low + high) >> 1; const r = rows[mid].getBoundingClientRect(); if (y < r.top + r.height / 2) high = mid; else low = mid + 1; }
        row = rows[low] || rows[rows.length - 1]; before = low < rows.length;
      }
      const at = row ? Number(row.dataset.index) + (before ? 0 : 1) : target.data.length;
      const top = row ? row.offsetTop + (before ? 0 : row.offsetHeight) : 18;
      line.style.top = `${top}px`; list.append(line); drag.target = target; drag.at = at;
      badge.textContent = `${sourceKey(drag.pane.source) === sourceKey(target.source) ? '排序' : '复制'} ${drag.indices.length} 条`;
      if (velocity) frame = host.requestAnimationFrame(drawDrag);
    }
  }
  on(doc, 'pointermove', e => {
    if (!drag || drag.pointer !== e.pointerId) return;
    drag.x = e.clientX; drag.y = e.clientY;
    if (Math.hypot(drag.x - drag.startX, drag.y - drag.startY) > 5) drag.active = true;
    if (drag.active) { e.preventDefault(); if (!frame) frame = host.requestAnimationFrame(drawDrag); }
  }, { passive: false });
  on(doc, 'pointerup', e => {
    if (!drag || drag.pointer !== e.pointerId) return;
    if (drag.active) drawDrag();
    const final = drag; stopDrag();
    if (final.active && final.target) transfer(final.pane, final.target, final.indices, final.at);
  });
  on(doc, 'pointercancel', stopDrag);
  on(host, 'blur', stopDrag);
  makePane(initial ? makePreset(initial) : { type: 'global' }, 'a');
  makePane(second ? makePreset(second) : { type: 'favorites' }, 'b');
  undo.disabled = true;
  shell.focus({ preventScroll: true });
  return { close, overlay };
}
