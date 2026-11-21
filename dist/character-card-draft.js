import { personaFields, readCard, readBookEntry } from './character-card-core.js?v=2.98.67-card.10';
import { embeddedBook, updatedWorld } from './character-card-world.js?v=2.98.67-card.10';

export const dataOf = card => card.raw.data ?? card.raw;
function rawWithFields(card, fields) {
  const raw = { ...card.raw };
  if (raw.data) {
    raw.data = { ...raw.data, ...fields };
    for (const key of Object.keys(fields)) if (key in raw) raw[key] = fields[key];
  } else Object.assign(raw, fields);
  return raw;
}

export function changeCard(card, fields) {
  return readCard(rawWithFields(card,fields));
}

// Inline typing only needs to rebuild the edited row, including for legacy object-shaped books.
export function changeBookEntry(card,index,entry) {
  const book = dataOf(card).character_book;
  const entries = Array.isArray(book.entries) ? book.entries.slice() : {...book.entries};
  const key = Array.isArray(entries) ? index : Object.keys(entries)[index];
  entries[key] = entry;
  const rows = card.book.slice();
  rows[index] = readBookEntry(entry,index);
  return {...card, raw:rawWithFields(card,{character_book:{...book,entries}}), book:rows};
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
  if (items.some(e => e.extensions?.display_index != null)) {
    items = items.map((e,index) => e.extensions?.display_index === index ? e
      : { ...e, extensions:{ ...e.extensions, display_index:index } });
  }
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

export async function openInstalled(context, card) {
  const source = { world:null };
  if (card.binding) {
    try {
      const world = await context.loadWorldInfo?.(card.binding);
      if (!world?.entries) throw Error();
      source.world = structuredClone(world);
      card = changeCard(card,{ character_book:embeddedBook(source.world,dataOf(card).character_book,card.binding) });
    } catch {
      return { card, source, notice:'无法读取绑定世界书「' + card.binding + '」，仍可编辑并保存人设。' };
    }
  }
  return { card, source };
}

export async function saveInstalled(win, context, avatar, baseline, next, source) {
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
  const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  for (const key of Object.keys(modified)) {
    if (same(original[key],modified[key])) continue;
    if (key !== 'character_book' && !same(latest[key],original[key]) && !same(latest[key],modified[key])) {
      throw Error('酒馆中的同一项已被修改，请先导出草稿，再重新选择角色卡。');
    }
    delta[key] = modified[key];
  }
  if (!Object.keys(delta).length) return;
  const syncBook = Boolean(baseline.binding && delta.character_book);
  let restoreWorld, savedWorld;
  if (syncBook) {
    if (latest.extensions?.world !== baseline.binding) throw Error('酒馆角色绑定的世界书已更换，请先导出草稿，再重新选择角色卡。');
    if (!source?.world || !context.saveWorldInfo) throw Error('无法同步绑定世界书，请先导出草稿并检查酒馆中的世界书。');
    const readStored = async () => {
      const res = await win.fetch('/api/worldinfo/get',{ method:'POST', headers:context.getRequestHeaders(),
        cache:'no-store', body:JSON.stringify({name:baseline.binding}) });
      if (!res.ok) throw Error('无法确认酒馆中的世界书，请检查连接后重试。');
      return res.json();
    };
    const serialize = value => JSON.stringify(value,(_,v) => v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map(k => [k,v[k]])) : v);
    const before = await readStored();
    // A draft can retain a native row that was deleted after the card was opened.
    const template = { ...before, entries:{...source.world.entries,...before.entries} };
    const desired = updatedWorld(context,template,delta.character_book);
    const wanted = serialize(desired);
    // Retry even when the cache has the desired value: the host updates it before the disk write.
    if (await context.saveWorldInfo(baseline.binding,desired,true) === false || serialize(await readStored()) !== wanted) {
      throw Error('绑定世界书保存未确认，请重试保存。');
    }
    savedWorld = desired;
    if (serialize(before) !== wanted) restoreWorld = async () => {
      const card = readCard(installedRaw(await (await api('get',{avatar_url:avatar})).json()));
      if (!same(dataOf(card).character_book,latest.character_book) || card.binding !== baseline.binding) return false;
      if (serialize(await readStored()) !== wanted || serialize(await context.loadWorldInfo(card.binding)) !== wanted) return false;
      if (await context.saveWorldInfo(card.binding,before,true) === false || serialize(await readStored()) !== serialize(before)) return false;
      return true;
    };
  }
  const mirrors = {};
  for (const key of ['description','personality','scenario','first_mes','mes_example']) if (key in delta) mirrors[key] = delta[key];
  try {
    await api('merge-attributes', { avatar, ...mirrors, data: delta });
  } catch (error) {
    if (restoreWorld && await restoreWorld().catch(() => false)) throw Error('角色卡保存失败，已还原本次世界书修改。草稿可重试保存。');
    if (syncBook) throw Error('绑定世界书已同步，角色卡保存未确认。请重试保存。');
    throw error;
  }
  const raw = changeCard(readCard(installedRaw(current)), delta).raw;
  if (syncBook) source.world = structuredClone(savedWorld);
  context = win.SillyTavern?.getContext?.() || context;
  const record = context.characters?.find(c => c?.avatar === avatar);
  if (record) {
    Object.assign(record, mirrors);
    if (record.data) Object.assign(record.data, structuredClone(delta));
    record.json_data = JSON.stringify(raw);
    const formAvatar = win.document.getElementById('avatar_url_pole');
    if ((formAvatar?.value ?? context.characters[context.characterId]?.avatar) === avatar) {
      const field = win.document.getElementById('character_json_data');
      if (field) field.value = record.json_data;
      const inputs = { description:'description_textarea', personality:'personality_textarea', scenario:'scenario_pole',
        first_mes:'firstmessage_textarea', mes_example:'mes_example_textarea', system_prompt:'system_prompt_textarea',
        post_history_instructions:'post_history_instructions_textarea' };
      for (const [key,id] of Object.entries(inputs)) {
        const input = key in delta && win.document.getElementById(id);
        if (input && input.value === (latest[key] ?? '')) input.value = delta[key];
      }
    }
  }
  if (syncBook) {
    try {
      const worldUI = win.__PMM_WORLDBOOK_STITCH_TEST3__;
      if (worldUI?.reloadOpenNativeWorldbook) await worldUI.reloadOpenNativeWorldbook(baseline.binding);
      else await context.reloadWorldInfoEditor?.(baseline.binding,false);
    }
    catch { /* The world has already been saved. */ }
  }
  return syncBook;
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
