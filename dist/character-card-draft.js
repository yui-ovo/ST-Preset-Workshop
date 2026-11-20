import { personaFields, readCard } from './character-card-core.js?v=2.98.67-card.2';

export const dataOf = card => card.raw.data ?? card.raw;
export function changeCard(card, fields) {
  const raw = { ...card.raw };
  if (raw.data) {
    raw.data = { ...raw.data, ...fields };
    for (const key of Object.keys(fields)) if (key in raw) raw[key] = fields[key];
  } else Object.assign(raw, fields);
  return readCard(raw);
}

export function itemsOf(card, book) {
  const data = dataOf(card);
  return book ? Object.values(data.character_book?.entries || {}) : [data.first_mes ?? '', ...(data.alternate_greetings || [])];
}

// Comparison rows keep the original slot even when greetings are empty or reordered between versions.
export function changeComparedBody(card, view, index, fields) {
  if (view === 'book') {
    const book = dataOf(card).character_book;
    const entries = Array.isArray(book.entries) ? book.entries.slice() : { ...book.entries };
    const key = Object.keys(entries)[index];
    entries[key] = { ...entries[key], content: fields.正文 };
    return changeCard(card, { character_book: { ...book, entries } });
  }
  if (index === -1) {
    const delta = {};
    for (const [label, key] of personaFields) {
      if (card.persona.fields[label] !== fields[label]) delta[key] = fields[label];
    }
    return changeCard(card, delta);
  }
  if (index === 0) return changeCard(card, { first_mes: fields.正文 });
  const alternatives = [...dataOf(card).alternate_greetings];
  alternatives[index - 1] = fields.正文;
  return changeCard(card, { alternate_greetings: alternatives });
}

export function putItems(card, book, items) {
  if (!book) return changeCard(card, { first_mes: items[0] ?? '', alternate_greetings: items.slice(1) });
  return changeCard(card, { character_book: { ...dataOf(card).character_book, entries: items } });
}

export function transferItems(from, to, book, indices, at, sameSide) {
  const source = itemsOf(from, book), target = itemsOf(to, book);
  const selected = new Set(indices);
  let moved = source.filter((_, i) => selected.has(i));
  if (!moved.length || !Number.isInteger(at) || at < 0 || at > target.length) return to;
  let before = target.slice(0, at), after = target.slice(at);
  if (sameSide) {
    before = before.filter((_, i) => !selected.has(i));
    after = after.filter((_, i) => !selected.has(i + at));
  } else if (book) {
    const taken = new Set(target.map(e => String(e.id ?? e.uid)));
    let next = 0;
    moved = moved.map(entry => {
      const copy = structuredClone(entry);
      if (taken.has(String(copy.id ?? copy.uid)) || (copy.id ?? copy.uid) == null) {
        while (taken.has(String(next))) next++;
        copy.id = next++;
        if ('uid' in copy) copy.uid = copy.id;
      }
      taken.add(String(copy.id ?? copy.uid));
      return copy;
    });
  }
  // An empty primary greeting in a card without greetings is a placeholder.
  if (!book && !sameSide && target.length === 1 && !target[0]) before = after = [];
  return putItems(to, book, [...before, ...moved, ...after]);
}

export function attachBook(card, world, name) {
  if (!world?.entries || typeof world.entries !== 'object') throw Error('世界书中没有条目');
  const entries = Array.isArray(world.entries) ? world.entries : Object.values(world.entries).map(e => ({
    ...e, id: e.uid ?? e.id, keys: e.key ?? e.keys ?? [], secondary_keys: e.keysecondary ?? e.secondary_keys ?? [],
    enabled: e.enabled ?? !e.disable, insertion_order: e.insertion_order ?? e.order ?? 100,
  }));
  return changeCard(card, { character_book: { ...world, name: world.name || name, entries } });
}

export async function localCards(win, operation, key, value, baseline) {
  const db = await new Promise((resolve, reject) => {
    const req = win.indexedDB.open('pmm-character-workshop', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('cards');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('cards', operation === 'put' ? 'readwrite' : 'readonly');
      const store = tx.objectStore('cards');
      const req = operation === 'list' ? store.getAllKeys() : store.get(key);
      if (operation === 'put') req.onsuccess = () => {
        if (req.result && JSON.stringify(req.result.raw) !== JSON.stringify(baseline)
            && JSON.stringify(req.result.raw) !== JSON.stringify(value.raw)) {
          reject(Error('本机保存的同一张卡已发生变化。可先导出当前草稿，再打开最新版本。'));
          tx.abort();
          return;
        }
        store.put(value, key);
      };
      tx.oncomplete = () => resolve(req.result);
      tx.onabort = tx.onerror = () => reject(tx.error || Error('本地角色卡读取或保存失败'));
    });
  } finally { db.close(); }
}

export function installedRaw(record) {
  if (record.json_data) {
    const parsed = JSON.parse(record.json_data);
    if (parsed.data || parsed.name) return parsed;
  }
  if (!record.data) return record;
  return { spec: record.spec || 'chara_card_v2', spec_version: record.spec_version || '2.0', data: record.data };
}

export async function saveInstalled(win, context, avatar, baseline, next) {
  const api = async (path, payload) => {
    const res = await win.fetch('/api/characters/' + path, {
      method: 'POST', headers: context.getRequestHeaders(), body: JSON.stringify(payload),
    });
    if (!res.ok) throw Error('角色卡读取或保存失败（HTTP ' + res.status + '）');
    return res;
  };
  const current = await (await api('get', { avatar_url: avatar })).json();
  const latest = dataOf(readCard(installedRaw(current)));
  const original = dataOf(baseline), modified = dataOf(next), delta = {};
  for (const key of Object.keys(modified)) {
    if (JSON.stringify(original[key]) === JSON.stringify(modified[key])) continue;
    if (JSON.stringify(latest[key]) !== JSON.stringify(original[key]) && JSON.stringify(latest[key]) !== JSON.stringify(modified[key])) {
      throw Error('酒馆中的同一项已被修改，请先导出草稿，再重新选择角色卡。');
    }
    delta[key] = modified[key];
  }
  if (!Object.keys(delta).length) return;
  const mirrors = {};
  for (const key of ['description','personality','scenario','first_mes','mes_example']) if (key in delta) mirrors[key] = delta[key];
  await api('merge-attributes', { avatar, ...mirrors, data: delta });
  const record = context.characters?.find(c => c?.avatar === avatar);
  if (record) {
    Object.assign(record, mirrors);
    if (record.data) Object.assign(record.data, structuredClone(delta));
    const raw = changeCard(readCard(installedRaw(current)), delta).raw;
    record.json_data = JSON.stringify(raw);
    if (context.characters[context.characterId]?.avatar === avatar) {
      const field = win.document.getElementById('character_json_data');
      if (field) field.value = record.json_data;
    }
  }
}

// Keep image pixels, metadata and artwork of imported PNGs. Replace only card text chunks.
export async function exportBlob(card, png) {
  const json = JSON.stringify(card.raw, null, 2);
  if (!png) return new Blob([json], { type: 'application/json' });
  const bytes = new Uint8Array(await png.arrayBuffer()), view = new DataView(bytes.buffer);
  const encoder = new TextEncoder(), decoder = new TextDecoder();
  const parts = [bytes.subarray(0, 8)];
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const end = offset + 12 + view.getUint32(offset);
    if (end > bytes.length) throw Error('PNG 文件不完整');
    const chunk = bytes.subarray(offset, end);
    const type = decoder.decode(chunk.subarray(4, 8));
    const zero = type === 'tEXt' ? chunk.indexOf(0, 8) : -1;
    const key = zero > 8 ? decoder.decode(chunk.subarray(8, zero)) : '';
    if (['chara', 'ccv3'].includes(key.toLowerCase())) {
      const raw = key.toLowerCase() === 'chara' && card.raw.spec === 'chara_card_v3'
        ? { ...card.raw, spec: 'chara_card_v2', spec_version: '2.0' } : card.raw;
      const utf8 = encoder.encode(JSON.stringify(raw));
      const blocks = [];
      for (let i = 0; i < utf8.length; i += 8192) blocks.push(String.fromCharCode(...utf8.subarray(i, i + 8192)));
      const payload = encoder.encode(key + '\0' + btoa(blocks.join('')));
      const replacement = new Uint8Array(payload.length + 12), fields = new DataView(replacement.buffer);
      fields.setUint32(0, payload.length); replacement.set(chunk.subarray(4,8), 4); replacement.set(payload, 8);
      let crc = -1;
      for (const byte of replacement.subarray(4,-4)) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
      }
      fields.setUint32(replacement.length - 4, ~crc); parts.push(replacement);
    } else parts.push(chunk);
    offset = end;
  }
  return new Blob(parts, { type: 'image/png' });
}
