export const PRESET_KEY = 'pmm.switch-snapshots.v1';
export const WORLD_KEY = 'pmm.test.worldbook-snapshots.v1';
const copy = value => JSON.parse(JSON.stringify(value));
const assert = (ok, message = '备份数据格式不正确') => { if (!ok) throw new Error(message); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const string = value => typeof value === 'string' && value.length > 0 && value.length <= 2000;
function bindings(rows = []) {
  assert(Array.isArray(rows));
  return rows.map(row => { assert(object(row) && string(row.key)); return { key: row.key, name: String(row.name || row.key) }; });
}
function states(rows) {
  assert(Array.isArray(rows));
  return rows.map(row => {
    assert(object(row) && string(row.id) && typeof row.enabled === 'boolean');
    return { id: row.id, name: String(row.name || row.id), enabled: row.enabled };
  });
}
function bookStates(value) {
  assert(object(value));
  return Object.fromEntries(Object.entries(value).map(([id, enabled]) => {
    assert(typeof enabled === 'boolean'); return [id, enabled];
  }));
}
function books(value) {
  assert(object(value));
  return Object.fromEntries(Object.entries(value).map(([name, value]) => {
    assert(string(name)); return [name, bookStates(value)];
  }));
}
function unique(rows, key) {
  const seen = new Set();
  for (const row of rows) { const id = key(row); assert(!seen.has(id), '备份包含重复标识，请重新导出'); seen.add(id); }
  return rows;
}
export function readStores(storage) {
  const preset = JSON.parse(storage.getItem(PRESET_KEY) || 'null') || { version: 1, snapshots: [] };
  const world = JSON.parse(storage.getItem(WORLD_KEY) || 'null') || { version: 1, snapshots: [], groups: [], defaults: [], owned: [], session: null };
  assert(preset.version === 1 && Array.isArray(preset.snapshots), '当前预设快照数据无法读取');
  assert(world.version === 1 && Array.isArray(world.snapshots) && Array.isArray(world.groups), '当前世界书快照数据无法读取');
  return { preset, world };
}
// Export only durable configuration, never runtime journals, active states or prompt bodies.
export function createBackup(stores) {
  return validateBackup({ format: 'st-preset-workshop-snapshots', version: 1, exportedAt: new Date().toISOString(),
    preset: { snapshots: stores.preset.snapshots },
    world: { snapshots: stores.world.snapshots, groups: stores.world.groups, defaults: stores.world.defaults || [] } });
}
export function validateBackup(data) {
  assert(data?.format === 'st-preset-workshop-snapshots' && data.version === 1, '不是支持的快照备份文件（版本 1）');
  assert(Array.isArray(data.preset?.snapshots) && Array.isArray(data.world?.snapshots) && Array.isArray(data.world?.groups) && Array.isArray(data.world?.defaults));
  const preset = unique(data.preset.snapshots.map(row => {
    assert(string(row.id) && string(row.name) && string(row.presetName));
    return { id: row.id, name: row.name, presetName: row.presetName, isDefault: row.isDefault === true || row.kind === 'default',
      states: states(row.states), groupStates: states(row.groupStates || []),
      characters: bindings(row.characters || (row.character ? [row.character] : [])),
      chats: bindings(row.chats || (row.chat ? [row.chat] : [])),
      createdAt: Number(row.createdAt) || 0, updatedAt: Number(row.updatedAt) || 0 };
  }), row => row.id);
  const groups = unique(data.world.groups.map(row => {
    assert(string(row.id) && string(row.name) && Array.isArray(row.books) && row.books.every(string));
    return { id: row.id, name: row.name, books: [...new Set(row.books)], snapshot: typeof row.snapshot === 'string' ? row.snapshot : '', enabled: false };
  }), row => row.id);
  const plan = (row, isDefault = false) => {
    assert(object(row) && string(row.name));
    if (!isDefault) assert(string(row.id));
    const base = isDefault ? { name: row.name } : { id: row.id, name: row.name, created: Number(row.created) || 0 };
    if (row.bundle === true) {
      assert(['character', 'group'].includes(row.scope) && string(row.owner));
      assert(row.scope !== 'group' || groups.some(g => g.id === row.owner), '世界书方案缺少所属分组');
      assert(row.chat == null || string(row.chat));
      return { ...base, bundle: true, scope: row.scope, owner: row.owner, books: books(row.books), chat: isDefault ? null : row.chat || null };
    }
    assert(!isDefault && ['character', 'global'].includes(row.scope) && string(row.book));
    assert(Array.isArray(row.characters || []) && (row.characters || []).every(string));
    return { ...base, book: row.book, scope: row.scope, states: bookStates(row.states), characters: row.characters || [] };
  };
  const snapshots = unique(data.world.snapshots.map(row => plan(row)), row => row.id);
  const defaults = unique(data.world.defaults.map(row => plan(row, true)), row => JSON.stringify([row.scope, row.owner]));
  for (const group of groups) assert(!group.snapshot || snapshots.some(s => s.id === group.snapshot && s.scope === 'group' && s.owner === group.id), '分组选用的快照不存在');
  return { format: data.format, version: 1, exportedAt: String(data.exportedAt || ''), preset: { snapshots: preset }, world: { snapshots, groups, defaults } };
}
export function planImport(stores, backup, restoreBindings = false) {
  const data = validateBackup(backup), next = copy(stores), skipped = [], added = { preset: 0, world: 0, groups: 0, defaults: 0 };
  const skip = (kind, row) => skipped.push(`${kind}：${row.name}`);
  // Existing identities and same-name plans are retained. A conflicting group keeps all of its own plans.
  const blockedGroups = new Set();
  for (const row of data.world.groups) {
    if (next.world.groups.some(g => g.id === row.id || g.name === row.name)) { blockedGroups.add(row.id); skip('分组', row); }
    else { next.world.groups.push(row); added.groups++; }
  }
  for (const row of data.preset.snapshots) {
    if (next.preset.snapshots.some(s => s.id === row.id || (s.presetName === row.presetName && (s.name === row.name || ((s.isDefault || s.kind === 'default') && row.isDefault))))) { skip('预设快照', row); continue; }
    row.characters = restoreBindings ? row.characters.filter(b => !next.preset.snapshots.some(s => s.presetName === row.presetName && (s.characters || (s.character ? [s.character] : [])).some(v => v.key === b.key))) : [];
    row.chats = restoreBindings ? row.chats.filter(b => !next.preset.snapshots.some(s => s.presetName === row.presetName && (s.chats || (s.chat ? [s.chat] : [])).some(v => v.key === b.key))) : [];
    next.preset.snapshots.push(row); added.preset++;
  }
  next.world.defaults ||= [];
  for (const row of data.world.defaults) {
    if ((row.scope === 'group' && blockedGroups.has(row.owner)) || next.world.defaults.some(s => s.scope === row.scope && s.owner === row.owner)) { skip('世界书默认方案', row); continue; }
    next.world.defaults.push(row); added.defaults++;
  }
  for (const row of data.world.snapshots) {
    if ((row.scope === 'group' && blockedGroups.has(row.owner)) || next.world.snapshots.some(s => s.id === row.id || (s.name === row.name && s.scope === row.scope && s.owner === row.owner && s.book === row.book))) { skip('世界书快照', row); continue; }
    if (row.bundle) row.chat = restoreBindings && !next.world.snapshots.some(s => s.owner === row.owner && s.chat === row.chat) ? row.chat : null;
    else row.characters = restoreBindings ? row.characters.filter(key => !next.world.snapshots.some(s => s.book === row.book && s.characters?.includes(key))) : [];
    next.world.snapshots.push(row); added.world++;
  }
  // If an incoming snapshot ID conflicted elsewhere, a new group must fall back to its default.
  for (const group of next.world.groups.filter(g => !stores.world.groups.some(old => old.id === g.id))) {
    if (!next.world.snapshots.some(s => s.id === group.snapshot && s.scope === 'group' && s.owner === group.id)) group.snapshot = '';
  }
  return { next, added, skipped };
}
export function commitImport(storage, plan) {
  const old = [storage.getItem(PRESET_KEY), storage.getItem(WORLD_KEY)];
  try {
    storage.setItem(PRESET_KEY, JSON.stringify(plan.next.preset));
    storage.setItem(WORLD_KEY, JSON.stringify(plan.next.world));
  } catch (error) {
    let failed = false;
    for (const [index, key] of [PRESET_KEY, WORLD_KEY].entries()) {
      try { if (old[index] == null) storage.removeItem(key); else storage.setItem(key, old[index]); } catch (_) { failed = true; }
    }
    throw new Error(failed ? '导入失败，部分数据未能回滚，请保留备份文件并检查浏览器存储' : '导入失败，原数据已保留：' + error.message);
  }
}
