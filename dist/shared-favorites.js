/* Shared preset/worldbook favorites. Loaded once; no polling or DOM observers. */
(() => {
  'use strict';
  const SELF = window, TOP = window.parent || window, DOC = TOP.document;
  const KEY = 'pmmWorldbookFavorite';
  const copy = value => JSON.parse(JSON.stringify(value));
  const metadata = item => {
    const value = item?.extra?.[KEY];
    return value?.version === 1 && value.entry && typeof value.entry === 'object' && !Array.isArray(value.entry) ? value : null;
  };
  function fromWorld(book, entry) {
    return {
      name: String(entry.comment || entry.key?.join(', ') || `世界书条目 ${entry.uid}`),
      content: String(entry.content || ''), enabled: entry.disable !== true,
      role: 'system', position: { type: 'relative' },
      extra: { [KEY]: { version: 1, book: String(book), uid: String(entry.uid), entry: copy(entry) } },
    };
  }
  function asPrompt(item) {
    if (!metadata(item)) return copy(item);
    return { name: item.name, content: item.content || '', enabled: item.enabled !== false, role: 'system', position: { type: 'relative' } };
  }
  function asWorld(item) {
    const meta = metadata(item);
    if (!meta) return null;
    const entry = copy(meta.entry), original = fromWorld(meta.book, entry);
    if (item.name !== original.name) entry.comment = String(item.name || '');
    if (item.content !== original.content) entry.content = String(item.content || '');
    if (item.enabled !== original.enabled) entry.disable = item.enabled === false;
    return entry;
  }
  const identity = (book, uid) => JSON.stringify([String(book), String(uid)]);
  function index(items) {
    const result = new Map();
    for (const item of items) {
      const meta = metadata(item);
      if (meta && !result.has(identity(meta.book, meta.uid))) result.set(identity(meta.book, meta.uid), item.id);
    }
    return result;
  }
  function store() {
    const value = TOP.__PMM_FAVORITE_STORE__;
    if (!value) throw new Error('收藏库尚未就绪，请重新打开工坊');
    return value;
  }
  let tail = Promise.resolve();
  function queue(task) {
    const next = tail.then(task);
    tail = next.catch(() => {});
    return next;
  }
  async function saveWorld(book, entry, update = false) {
    // Capture the unsaved editor draft now, before waiting for any earlier write.
    const snapshot = fromWorld(book, entry);
    return queue(async () => {
      const api = store(), id = index(api.read().items).get(identity(book, snapshot.extra[KEY].uid));
      if (id) {
        if (update) await api.update(id, snapshot);
        else await api.remove(id);
        return update ? '已更新收藏副本' : '已取消收藏';
      }
      await api.add(snapshot);
      return '已收藏到收藏库';
    });
  }
  async function worldApi() {
    const api = TOP.__PMM_WORLDBOOK_STITCH_TEST3__ || await SELF.__PMM_LOAD_WORLDBOOK_STITCH__?.();
    if (!api?.insertFavorite) throw new Error('世界书模块尚未就绪，请刷新酒馆后重试');
    return api;
  }
  function installStyle() {
    if (DOC.getElementById('pmm-shared-favorites-style')) return;
    const style = DOC.createElement('style'); style.id = 'pmm-shared-favorites-style';
    style.textContent = `
      .pmm-favorite-picker{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.35)}
      .pmm-favorite-picker [role=dialog]{box-sizing:border-box;width:min(400px,100%);max-height:calc(100dvh - 32px);overflow:auto;padding:18px;border:1px solid var(--pm-border,#777);border-radius:16px;background:var(--pm-panel-bg,#242832);color:var(--pm-text-primary,#eee);font:14px/1.5 sans-serif;text-align:left}
      .pmm-favorite-picker header{display:flex;align-items:center;justify-content:space-between;gap:12px;font-weight:600;margin-bottom:12px}
      .pmm-favorite-picker button,.pmm-favorite-picker select{font:inherit;color:inherit;background:var(--pm-control-bg,rgba(128,128,128,.15));border:1px solid var(--pm-border,#777);border-radius:8px;padding:8px;min-height:36px;box-sizing:border-box}
      .pmm-favorite-picker label{display:block;margin:12px 0}.pmm-favorite-picker select{display:block;width:100%;margin-top:6px}
      .pmm-favorite-picker p{margin:12px 0;overflow-wrap:anywhere}.pmm-favorite-picker [data-fav-status]{font-size:12px}
      .pmm-favorite-picker footer{display:flex;justify-content:flex-end;gap:8px}.pmm-favorite-picker [hidden]{display:none!important}
    `;
    DOC.head.append(style);
  }
  function closePicker() { DOC.querySelector('.pmm-favorite-picker')?.remove(); }
  async function use(id) {
    try {
      const item = store().read().items.find(item => item.id === id);
      if (!item) throw new Error('这个收藏已经被删除');
      installStyle(); closePicker();
      const overlay = DOC.createElement('div'); overlay.className = 'pmm-favorite-picker';
      overlay.innerHTML = `<section role="dialog" aria-modal="true" aria-label="使用收藏"><header><span>使用收藏</span><button type="button" data-fav-close aria-label="关闭">×</button></header><p data-fav-name></p><label>放入<select data-fav-type><option value="preset">当前工坊预设</option><option value="world">世界书</option></select></label><label data-fav-world-label hidden>目标世界书<select data-fav-world></select></label><p data-fav-note></p><p data-fav-status role="status"></p><footer><button type="button" data-fav-submit>添加条目</button></footer></section>`;
      const host = DOC.getElementById('preset-manager-main-panel');
      if (!host) throw new Error('请先打开预设工坊');
      const theme = host.querySelector('.pm-overlay');
      if (theme) {
        const computed = TOP.getComputedStyle(theme);
        for (const name of ['--pm-panel-bg','--pm-text-primary','--pm-border','--pm-control-bg']) overlay.style.setProperty(name, computed.getPropertyValue(name));
      }
      host.append(overlay);
      const type = overlay.querySelector('[data-fav-type]'), world = overlay.querySelector('[data-fav-world]');
      const status = overlay.querySelector('[data-fav-status]'), submit = overlay.querySelector('[data-fav-submit]');
      overlay.querySelector('[data-fav-name]').textContent = item.name;
      let namesLoaded = false, busy = false, complete = false;
      const close = () => { if (!busy) { closePicker(); } };
      const escape = event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } };
      overlay.addEventListener('keydown', escape, true);
      overlay.querySelector('[data-fav-close]').onclick = close;
      overlay.onclick = event => { if (event.target === overlay) close(); };
      const update = async () => {
        const isWorld = type.value === 'world';
        overlay.querySelector('[data-fav-world-label]').hidden = !isWorld;
        overlay.querySelector('[data-fav-note]').textContent = isWorld
          ? (metadata(item) ? '保留世界书触发设置，作为新条目添加。' : '使用名称、正文和开关，世界书触发设置采用默认值。')
          : '添加到当前工坊预设的末尾，之后点击预设的保存按钮。世界书条目转为普通系统条目。';
        status.textContent = ''; submit.disabled = busy || (isWorld && !world.value);
        if (isWorld && !namesLoaded) {
          try {
            const api = await worldApi(), names = await api.favoriteTargets();
            if (!overlay.isConnected) return;
            world.replaceChildren(...names.map(name => { const option = DOC.createElement('option'); option.value = name; option.textContent = name; return option; }));
            namesLoaded = true;
            if (!names.length) status.textContent = '没有可用世界书，请先创建一本世界书。';
          } catch (error) { status.textContent = error.message; }
          submit.disabled = busy || (type.value === 'world' && !world.value);
        }
      };
      type.onchange = update;
      submit.onclick = async () => {
        if (busy) return;
        busy = true; submit.disabled = true; type.disabled = true; world.disabled = true;
        try {
          // Read again so library edits made since opening the dialog are respected.
          const current = store().read().items.find(value => value.id === id);
          if (!current) throw new Error('这个收藏已经被删除');
          if (type.value === 'world') {
            const result = await (await worldApi()).insertFavorite(world.value, current);
            status.textContent = result.draft ? '已添加到世界书草稿，请点击世界书的保存按钮。' : '已添加并保存到世界书。';
          } else {
            const bridge = TOP.__PMM_WORLDBOOK_PRESET_DROP_BRIDGE__;
            if (!bridge?.snapshot()?.name) throw new Error('请先选择当前工坊预设');
            const result = await bridge.drop({ entries: [asPrompt(current)] });
            if (!result?.ok) throw new Error('未能添加到当前工坊预设');
            status.textContent = '已添加到预设末尾，请点击预设的保存按钮。';
          }
          complete = true; submit.textContent = '完成'; submit.onclick = close;
        } catch (error) { status.textContent = `添加失败：${error.message || error}`; }
        finally { busy = false; submit.disabled = false; type.disabled = complete; world.disabled = complete; }
      };
      await update();
      overlay.querySelector('[data-fav-close]').focus();
    } catch (error) { (TOP.toastr || SELF.toastr)?.error?.(error.message || String(error)); }
  }
  TOP.__PMM_SHARED_FAVORITES__ = { metadata, fromWorld, asPrompt, asWorld, index, identity, saveWorld, use };
})();
