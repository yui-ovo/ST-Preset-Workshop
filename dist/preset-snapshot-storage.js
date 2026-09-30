import { PRESET_KEY, readPresetStore, validateBackup } from './snapshot-backup-core.js?v=2.98.23';

export const FIELD = 'pmm_switch_snapshots';
export const SYNC_KEY = 'pmm.preset-snapshot-sync.v1';
export const ARCHIVE_KEY = 'pmm.preset-snapshot-migration-backup.v1';
const API = '__PMM_PRESET_SNAPSHOT_STORAGE__';
const copy = value => JSON.parse(JSON.stringify(value));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const object = value => value && typeof value === 'object' && !Array.isArray(value);

// Use the backup validator's allowlist: never embed prompt bodies or runtime journals.
export function snapshotRows(rows, name) {
  return validateBackup({ format: 'st-preset-workshop-snapshots', version: 1,
    preset: { snapshots: rows.map(row => ({ ...row, id: row.embeddedId || row.id, presetName: name })) },
    world: { snapshots: [], groups: [], defaults: [] },
  }).preset.snapshots.map(({ presetName, ...row }) => row).sort((a, b) => a.id.localeCompare(b.id));
}

export function readEmbedded(preset, name) {
  const data = preset?.extensions?.[FIELD];
  if (data == null) return { revision: null, rows: [] };
  if (data.version !== 1 || typeof data.revision !== 'string' || !Array.isArray(data.snapshots)) {
    throw new Error('预设里的快照格式无法读取，请更新工坊；本地记录已保留');
  }
  return { revision: data.revision, rows: snapshotRows(data.snapshots, name) };
}

// Three-way merge. Remote edits win their original identity; concurrent local edits
// become an unbound ordinary copy. A stale deletion never deletes an edited row.
export function mergeSnapshots(base, local, remote, makeId) {
  const b = new Map(base.map(s => [s.id, s])), l = new Map(local.map(s => [s.id, s]));
  const r = new Map(remote.map(s => [s.id, s]));
  const rows = copy(remote), notes = [], accepted = new Set();
  for (const id of new Set([...b.keys(), ...l.keys()])) {
    const before = b.get(id), ours = l.get(id), theirs = r.get(id);
    if (equal(before, ours) || equal(ours, theirs)) continue;
    const conflict = !equal(before, theirs);
    if (conflict && !ours) { notes.push('另一处已修改的快照保留，未执行旧删除'); continue; }
    if (!conflict) {
      const index = rows.findIndex(s => s.id === id);
      if (index >= 0) rows.splice(index, 1);
      if (!ours) continue;
    }
    const row = copy(ours);
    if (conflict || (row.isDefault && rows.some(s => s.isDefault))) {
      row.id = makeId(); row.isDefault = false; row.characters = []; row.chats = [];
      row.name = `${row.name}（本地冲突副本）`; notes.push('同一快照在两处修改，已保留本地冲突副本');
    }
    const preferred = row.name; let suffix = 2;
    while (rows.some(s => s.name === row.name)) row.name = `${preferred}（${suffix++}）`;
    accepted.add(row.id);
    rows.push(row);
  }
  // Resolve bindings only after all deltas, so moving a binding from snapshot Z
  // to A does not drop it just because A was processed before Z's removal.
  for (const kind of ['characters', 'chats']) {
    const occupied = new Set();
    for (const row of [...rows.filter(s => !accepted.has(s.id)), ...rows.filter(s => accepted.has(s.id))]) {
      row[kind] = row[kind].filter(binding => {
        if (occupied.has(binding.key)) return false;
        occupied.add(binding.key); return true;
      });
    }
  }
  return { rows: rows.sort((a, b) => a.id.localeCompare(b.id)), notes: [...new Set(notes)] };
}

// Both upstream SillyTavern and TauriTavern provide these routes. Read the saved
// files, not getPreset('in_use') / oai_settings, before attaching our one field.
export function createPresetAdapter(host) {
  const context = () => host.SillyTavern?.getContext?.();
  async function request(path, body) {
    const headers = context()?.getRequestHeaders?.();
    if (!headers || typeof host.fetch !== 'function') throw new Error('当前酒馆未提供安全的预设保存接口');
    const controller = new AbortController();
    const timeout = host.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await host.fetch(path, { method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`酒馆读写失败（${response.status}），请检查连接后重试`);
      return await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw new Error('酒馆连接超时，请稍后重试');
      throw error;
    } finally { host.clearTimeout(timeout); }
  }
  return {
    async readAll() {
      const data = await request('/api/settings/get', {});
      if (!Array.isArray(data.openai_settings) || !Array.isArray(data.openai_setting_names)
        || data.openai_settings.length !== data.openai_setting_names.length) throw new Error('酒馆返回的预设列表无法读取');
      return new Map(data.openai_setting_names.map((name, i) => {
        const raw = data.openai_settings[i];
        const preset = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (typeof name !== 'string' || !object(preset)) throw new Error('酒馆返回的预设内容无法读取');
        return [name, preset];
      }));
    },
    async save(name, saved, envelope) {
      const preset = copy(saved);
      preset.extensions = { ...preset.extensions, [FIELD]: copy(envelope) };
      const result = await request('/api/presets/save', { name, apiId: 'openai', preset });
      if (result.name !== name) throw new Error('酒馆保存后返回的预设名不一致，请重新检查');
    },
    patchCache(name, envelope) {
      const manager = context()?.getPresetManager?.('openai');
      const cached = manager?.getCompletionPresetByName?.(name);
      if (cached) {
        cached.extensions ||= {};
        if (envelope) cached.extensions[FIELD] = copy(envelope); else delete cached.extensions[FIELD];
      }
      if (manager?.getSelectedPresetName?.() === name) {
        const live = manager?.getPresetList?.()?.settings;
        if (live) {
          live.extensions ||= {};
          if (envelope) live.extensions[FIELD] = copy(envelope); else delete live.extensions[FIELD];
        }
      }
    },
  };
}

export function installPresetSnapshotStorage(host, options = {}) {
  host[API]?.cleanup?.();
  const storage = host.localStorage, adapter = options.adapter || createPresetAdapter(host);
  const delay = options.delay ?? 600, makeId = () => `pmm-${host.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  let ledger;
  try { ledger = JSON.parse(storage.getItem(SYNC_KEY) || 'null'); } catch (_) {}
  if (ledger?.version !== 1 || !object(ledger.presets)) ledger = { version: 1, presets: {} };
  const records = new Map(Object.entries(ledger.presets));
  const pending = new Set([...records].filter(([, r]) => r.pending).map(([n]) => n));
  const statuses = new Map(), generations = new Map(), seen = new Map();
  let available = new Set(), initialized = false, readError = '';
  let stopped = false, timer = 0, running = null, ready, wantsRefresh = false;
  const events = host.SillyTavern?.getContext?.();
  let loadedName = events?.getPresetManager?.('openai')?.getSelectedPresetName?.(), contextChanged = false;
  const eventType = events?.eventTypes?.PRESET_CHANGED || events?.event_types?.PRESET_CHANGED || 'preset_changed';
  const localRows = name => snapshotRows(readPresetStore(storage).snapshots.filter(s => s.presetName === name), name);
  function persistLedger() {
    const value = JSON.stringify({ version: 1, presets: Object.fromEntries(records) });
    if (storage.getItem(SYNC_KEY) !== value) storage.setItem(SYNC_KEY, value);
  }
  function status(name, state, message) {
    const prior = statuses.get(name);
    statuses.set(name, { state, message });
    if (state === 'error' && prior?.message !== message && pending.has(name)) host.toastr?.warning?.(`“${name}”快照${message}。可在快照窗口重试。`);
    if (!stopped) options.onStatus?.(name);
  }
  function archiveLocal() {
    if (!storage.getItem(ARCHIVE_KEY)) {
      const raw = storage.getItem(PRESET_KEY);
      if (raw) storage.setItem(ARCHIVE_KEY, raw);
    }
  }
  function adopt(name, rows) {
    const store = readPresetStore(storage), previous = store.snapshots.filter(s => s.presetName === name);
    const others = store.snapshots.filter(s => s.presetName !== name), used = new Set(others.map(s => s.id));
    const mapped = rows.map(row => {
      const old = previous.find(s => (s.embeddedId || s.id) === row.id);
      let id = old?.id || row.id;
      while (used.has(id)) id = `${id}~copy`;
      used.add(id);
      return { ...copy(row), id, embeddedId: row.id, presetName: name };
    });
    store.snapshots = [...others, ...mapped];
    for (const key of ['activeSnapshots', 'homeSnapshots', 'manualSnapshots']) {
      if (store[key]?.[name] && !mapped.some(s => s.id === store[key][name])) delete store[key][name];
    }
    const value = JSON.stringify(store);
    if (storage.getItem(PRESET_KEY) !== value) storage.setItem(PRESET_KEY, value);
    seen.set(name, rows);
  }
  function changed() {
    if (!stopped) options.onChange?.();
  }
  function observe(store = readPresetStore(storage)) {
    let dirty = false;
    const names = new Set([...seen.keys(), ...store.snapshots.map(s => s.presetName)]);
    for (const name of names) {
      const rows = snapshotRows(store.snapshots.filter(s => s.presetName === name), name);
      if (equal(rows, seen.get(name) || [])) continue;
      dirty = true;
      seen.set(name, rows); pending.add(name);
      generations.set(name, (generations.get(name) || 0) + 1);
      records.set(name, { ...(records.get(name) || { rows: [], revision: null }), pending: true });
      status(name, 'pending', '已存本地，正在保存到预设…');
    }
    if (!dirty) return;
    try { persistLedger(); } catch (e) { for (const name of pending) status(name, 'error', `仅本地：${e.message}`); }
    if (pending.size && !stopped) schedule();
  }
  function schedule() {
    if (timer) host.clearTimeout(timer);
    timer = host.setTimeout(() => { timer = 0; void run(); }, delay);
  }
  async function cycle() {
    const files = await adapter.readAll();
    if (stopped) return;
    available = new Set(files.keys()); initialized = true; readError = '';
    archiveLocal();
    const candidates = new Set([...files].filter(([, file]) => file.extensions?.[FIELD] != null).map(([name]) => name));
    for (const name of [...seen.keys(), ...records.keys(), ...pending]) candidates.add(name);
    const selected = events?.getPresetManager?.('openai')?.getSelectedPresetName?.();
    if (selected) candidates.add(selected);
    const confirmations = [];
    for (const name of candidates) {
      if (stopped) return;
      const file = files.get(name);
      if (!file) { status(name, 'error', '仅存本地：未找到对应预设，可在快照备份中恢复到其他预设'); continue; }
      try {
        const remote = readEmbedded(file, name), record = records.get(name);
        let local = localRows(name);
        if (record?.attempt?.envelope?.revision === remote.revision) {
          // Previous response/verification was lost, but the server did save it.
          local = mergeSnapshots(record.attempt.local, local, remote.rows, makeId).rows;
          adopt(name, local);
          records.set(name, { ...remote, pending: true });
        }
        if (!pending.has(name)) {
          // Embedded data is authoritative on an already migrated preset. Do not
          // resurrect a stale browser's deleted snapshots. The original cache is archived.
          if (!record && remote.revision === null && local.length) {
            records.set(name, { rows: [], revision: null, pending: true }); pending.add(name);
          } else {
            adopt(name, remote.rows); records.set(name, { ...remote, pending: false });
            adapter.patchCache(name, file.extensions?.[FIELD]);
            status(name, 'saved', remote.revision ? '已保存到预设' : '快照将自动保存到预设');
            continue;
          }
        }
        const generation = generations.get(name) || 0;
        const base = records.get(name)?.rows || [];
        const merged = mergeSnapshots(base, local, remote.rows, makeId);
        const envelope = { version: 1, revision: makeId(), updatedAt: Date.now(), snapshots: merged.rows };
        status(name, 'pending', '已存本地，正在保存到预设…');
        const wrote = !equal(merged.rows, remote.rows) || remote.revision === null;
        if (wrote) {
          // Journal the attempted write before sending. If confirmation is lost,
          // retry recognizes this exact revision instead of creating duplicate copies.
          records.set(name, { rows: base, revision: records.get(name)?.revision || null, pending: true,
            attempt: { envelope, local } });
          persistLedger();
          await adapter.save(name, file, envelope);
          if (stopped) return;
        }
        confirmations.push({ name, generation, local, merged, envelope, wrote });
      } catch (error) {
        status(name, 'error', `仅存本地：${error.message}`);
      }
    }
    // One verification read for the whole coalesced batch (including first migration).
    const verifiedFiles = confirmations.some(item => item.wrote) ? await adapter.readAll() : files;
    if (stopped) return;
    for (const { name, generation, local, merged, envelope, wrote } of confirmations) {
      try {
        const verified = verifiedFiles.get(name), check = readEmbedded(verified, name);
        if (!verified || (wrote && check.revision !== envelope.revision) || !equal(check.rows, merged.rows)) {
          throw new Error('保存后校验未通过，本地记录仍保留，请重试');
        }
        const confirmed = verified.extensions?.[FIELD];
        adapter.patchCache(name, confirmed);
        const latest = localRows(name);
        const editedWhileSaving = generation !== (generations.get(name) || 0);
        const final = editedWhileSaving ? mergeSnapshots(local, latest, merged.rows, makeId) : merged;
        adopt(name, final.rows);
        records.set(name, { rows: merged.rows, revision: check.revision, pending: editedWhileSaving });
        if (!editedWhileSaving) pending.delete(name);
        status(name, editedWhileSaving ? 'pending' : 'saved', editedWhileSaving ? '已存本地，等待保存最新修改…' : '已保存到预设');
        if (final.notes.length) host.toastr?.info?.(final.notes.join('；'));
      } catch (error) {
        status(name, 'error', `仅存本地：${error.message}`);
      }
    }
    persistLedger(); changed();
    if (contextChanged) { contextChanged = false; options.onPresetLoaded?.(); }
  }
  async function run() {
    if (stopped) return;
    if (running) { wantsRefresh = true; return running; }
    wantsRefresh = false;
    if (timer) { host.clearTimeout(timer); timer = 0; }
    running = cycle().catch(error => {
      initialized = true; readError = error.message;
      const names = new Set([...seen.keys(), ...records.keys()]);
      const selected = events?.getPresetManager?.('openai')?.getSelectedPresetName?.();
      if (selected) names.add(selected);
      for (const name of names) status(name, 'error', `仅存本地：${error.message}`);
    }).finally(() => {
      running = null;
      if (wantsRefresh && !stopped) { wantsRefresh = false; schedule(); }
    });
    return running;
  }
  function renamed(oldName, newName) {
    const record = records.get(oldName);
    if (record) { records.set(newName, record); records.delete(oldName); }
    pending.delete(oldName); seen.delete(oldName); statuses.delete(oldName);
    // Native rename already carries embedded fields. Pending/local-only changes
    // still need saving, and the normal observer captures them after the relink.
    seen.set(newName, record?.rows || []);
    if (record?.pending) pending.add(newName);
    observe(); wantsRefresh = true; schedule();
  }
  const presetChanged = ({ apiId } = {}) => {
    if (apiId && apiId !== 'openai') return;
    const manager = events?.getPresetManager?.('openai'), name = manager?.getSelectedPresetName?.();
    const revision = manager?.getCompletionPresetByName?.(name)?.extensions?.[FIELD]?.revision || null;
    // Hosts also emit PRESET_CHANGED to repaint an existing preset. A repaint or
    // temporary toggle needs neither a disk read nor a snapshot write.
    if (name === loadedName && revision === (records.get(name)?.revision || null)) return;
    loadedName = name; contextChanged = true; wantsRefresh = true; schedule();
  };
  for (const name of new Set(readPresetStore(storage).snapshots.map(s => s.presetName))) seen.set(name, localRows(name));
  const api = { observe, renamed, refresh: run, retry: run, ensure: () => ready,
    migrationBackup: () => JSON.parse(storage.getItem(ARCHIVE_KEY) || 'null'),
    state: name => statuses.get(name) || (readError ? { state: 'error', message: `仅存本地：${readError}` }
      : !initialized ? { state: 'loading', message: '正在读取预设快照…' }
      : available.has(name) ? { state: 'saved', message: '快照将自动保存到预设' }
      : { state: 'error', message: '仅存本地：未找到对应预设，可在快照备份中恢复到其他预设' }),
    cleanup() {
      stopped = true; if (timer) host.clearTimeout(timer);
      if (events?.eventSource?.off) events.eventSource.off(eventType, presetChanged);
      else events?.eventSource?.removeListener?.(eventType, presetChanged);
      if (host[API] === api) delete host[API];
    },
  };
  host[API] = api;
  events?.eventSource?.on?.(eventType, presetChanged);
  ready = run();
  return api;
}
