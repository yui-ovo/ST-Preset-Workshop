/* Shared preset/worldbook favorites. Loaded once; no polling or DOM observers. */
(() => {
  'use strict';
  const TOP = window.parent || window;
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
  TOP.__PMM_SHARED_FAVORITES__ = { metadata, fromWorld, asPrompt, asWorld, index, identity, saveWorld };
})();
