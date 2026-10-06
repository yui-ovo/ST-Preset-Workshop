// Raw native regex records are deliberately not mapped through TavernHelper's
// simplified schema: doing so would discard trimStrings and future fields.
export const clone = value => JSON.parse(JSON.stringify(value));
export const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const sourceKey = source => JSON.stringify([source.type, source.apiId || '', source.name || '', source.avatar || '']);
export const freshId = () => globalThis.crypto?.randomUUID?.() || `pmrx-${Date.now()}-${Math.random().toString(36).slice(2)}`;

// The row copy action duplicates locally, immediately after each original.
// This is separate from a drag onto the same source, which remains a reorder.
export function duplicateInPlace(records, indices, uuid = freshId) {
  const selected = new Set(indices), used = new Set(records.map(r => r.id));
  return records.flatMap((record, index) => {
    if (!selected.has(index)) return [clone(record)];
    let id;
    do { id = uuid(); } while (used.has(id));
    used.add(id);
    return [clone(record), { ...clone(record), id }];
  });
}

export function planTransfer(source, target, indices, position, same, move, uuid = freshId) {
  const selected = new Set(indices);
  const chosen = source.filter((_, i) => selected.has(i));
  if (!chosen.length) throw new Error('请先选择正则');
  position = Math.max(0, Math.min(target.length, position));
  if (same) {
    const rest = source.filter((_, i) => !selected.has(i));
    const offset = source.slice(0, position).filter((_, i) => selected.has(i)).length;
    rest.splice(position - offset, 0, ...chosen);
    return { target: clone(rest), source: clone(rest), count: chosen.length };
  }
  const used = new Set([...source, ...target].map(x => x.id));
  const copies = chosen.map(record => {
    let id;
    do { id = uuid(); } while (used.has(id));
    used.add(id);
    return { ...clone(record), id };
  });
  const next = clone(target);
  next.splice(position, 0, ...copies);
  return { target: next, source: move ? clone(source.filter((_, i) => !selected.has(i))) : clone(source), count: copies.length };
}

export function createTransactions(adapter) {
  const history = [];
  let busy = false;
  async function commit(changes, label, remember = true) {
    if (busy) throw new Error('正在保存，请稍候');
    busy = true;
    const written = [];
    try {
      for (const change of changes) {
        if (!equal(await adapter.read(change.source), change.before)) throw new Error('列表已在其他地方更新，请刷新后重试');
      }
      for (const change of changes) {
        // Recheck immediately before each write, including the source removal.
        if (!equal(await adapter.read(change.source), change.before)) throw new Error('列表已变化，已停止操作');
        if (equal(change.before, change.after)) continue;
        await adapter.write(change.source, clone(change.after));
        written.push(change);
      }
      if (written.length && remember) {
        history.push({ label, changes: clone(written) });
        if (history.length > 10) history.shift();
      }
      return written.length;
    } catch (error) {
      // Never remove the destination copy if the source deletion failed: an
      // interrupted native write may already have reached disk. Keep recoverable
      // copies and record exactly the confirmed changes for undo.
      if (written.length && remember) {
        history.push({ label: `${label}（部分完成）`, changes: clone(written) });
        if (history.length > 10) history.shift();
      }
      if (written.length) {
        const partial = new Error(`${error.message}。已保存的副本保留，未继续删除；可检查后${remember ? '撤销' : '重试撤销'}。`);
        partial.written = clone(written);
        throw partial;
      }
      throw error;
    } finally { busy = false; }
  }
  return {
    history,
    async transfer(from, to, source, target, indices, position, move = false) {
      const same = sourceKey(from) === sourceKey(to);
      const plan = planTransfer(source, target, indices, position, same, move);
      const changes = [{ source: to, before: target, after: plan.target }];
      if (!same && move) changes.push({ source: from, before: source, after: plan.source });
      // Even copy must validate its source snapshot before writing the target.
      if (!equal(await adapter.read(from), source)) throw new Error('来源已变化，请刷新后重新选择');
      await commit(changes, same ? '调整顺序' : move ? '移动正则' : '复制正则');
      return plan.count;
    },
    edit: (source, before, after, label) => commit([{ source, before, after }], label),
    async undo() {
      const entry = history.at(-1);
      if (!entry) return;
      // Restore source first on a move, then remove the destination copies.
      try { await commit([...entry.changes].reverse().map(c => ({ source: c.source, before: c.after, after: c.before })), '', false); }
      catch (error) {
        if (error.written?.length) {
          const completed = new Set(error.written.map(c => sourceKey(c.source)));
          entry.changes = entry.changes.filter(c => !completed.has(sourceKey(c.source)));
        }
        throw error;
      }
      history.pop();
    },
  };
}

const FAVORITES = 'pmm_regex_favorites_v1';
export function createHostAdapter(host, loadNative) {
  const context = () => {
    const ctx = host.SillyTavern?.getContext?.();
    if (!ctx) throw new Error('未找到酒馆接口');
    return ctx;
  };
  const currentCharacter = () => {
    const ctx = context();
    if (ctx.groupId || ctx.characterId == null) return null;
    const character = ctx.characters?.[ctx.characterId];
    return character?.avatar ? { type: 'character', avatar: character.avatar, name: character.name || '当前角色' } : null;
  };
  const manager = source => {
    const pm = context().getPresetManager?.(source.apiId);
    if (!pm || pm.apiId !== source.apiId || !pm.getAllPresets?.().includes(source.name)) throw new Error('预设已更名、删除或不可用，请重新选择');
    return pm;
  };
  const character = source => {
    const ctx = context();
    if (currentCharacter()?.avatar !== source.avatar) throw new Error('当前角色已切换，请重新选择当前角色');
    return ctx.characters[ctx.characterId];
  };
  function read(source) {
    const ctx = context();
    let value;
    if (source.type === 'preset') value = manager(source).readPresetExtensionField({ name: source.name, path: 'regex_scripts' });
    else if (source.type === 'character') value = character(source).data?.extensions?.regex_scripts;
    else if (source.type === 'global') value = ctx.extensionSettings.regex;
    else if (source.type === 'favorites') value = ctx.extensionSettings[FAVORITES];
    else throw new Error('未知的正则来源');
    if (value != null && !Array.isArray(value)) throw new Error('正则数据格式不正确，已停止读取');
    return clone(value || []);
  }
  async function write(source, records) {
    const ctx = context();
    const before = read(source);
    if (source.type === 'preset') {
      const pm = manager(source);
      try { await pm.writePresetExtensionField({ name: source.name, path: 'regex_scripts', value: clone(records) }); }
      catch (error) {
        // The native writer updates memory before its request. Restore only the
        // regex field on failure, preserving unrelated live preset edits.
        const preset = pm.getCompletionPresetByName?.(source.name);
        if (preset?.extensions && equal(preset.extensions.regex_scripts, records)) preset.extensions.regex_scripts = clone(before);
        const settings = pm.getPresetList?.().settings;
        if (pm.getSelectedPresetName?.() === source.name && settings?.extensions && equal(settings.extensions.regex_scripts, records)) settings.extensions.regex_scripts = clone(before);
        throw error;
      }
    } else if (source.type === 'character') {
      const record = character(source);
      // writeExtensionField in supported hosts swallows HTTP errors. Use its
      // same merge endpoint with an explicit success check before updating RAM.
      const response = await host.fetch('/api/characters/merge-attributes', {
        method: 'POST', headers: ctx.getRequestHeaders(),
        body: JSON.stringify({ avatar: source.avatar, data: { extensions: { regex_scripts: records } } }),
      });
      if (!response.ok) throw new Error(`角色正则保存失败（${response.status}）`);
      record.data ||= {}; record.data.extensions ||= {};
      record.data.extensions.regex_scripts = clone(records);
      try {
        const json = JSON.parse(record.json_data);
        json.data ||= {}; json.data.extensions ||= {}; json.data.extensions.regex_scripts = clone(records);
        record.json_data = JSON.stringify(json);
        if (currentCharacter()?.avatar === source.avatar) {
          const input = host.document?.querySelector('#character_json_data');
          if (input) input.value = record.json_data;
        }
      } catch (_) { /* Older character records may have no serialized cache. */ }
    } else {
      const native = await loadNative();
      if (typeof native.saveSettings !== 'function') throw new Error('当前酒馆缺少设置保存接口');
      const key = source.type === 'global' ? 'regex' : FAVORITES;
      // The module load may have yielded while native settings changed.
      if (!equal(read(source), before)) throw new Error('设置已变化，请刷新后重试');
      ctx.extensionSettings[key] = clone(records);
      try {
        const saved = await native.saveSettings();
        if (saved === false) throw new Error('酒馆未能保存设置，请检查连接后重试');
      } catch (error) {
        if (equal(ctx.extensionSettings[key], records)) ctx.extensionSettings[key] = before;
        throw error;
      }
    }
  }
  return { read, write, context, currentCharacter,
    presets() {
      const pm = context().getPresetManager?.();
      return { apiId: pm?.apiId, names: pm?.getAllPresets?.() || [], current: pm?.getSelectedPresetName?.() };
    },
  };
}
