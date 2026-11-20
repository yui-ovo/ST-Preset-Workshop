const personaFields = [
  ['角色描述', 'description'], ['性格', 'personality'], ['场景', 'scenario'],
  ['示例对话', 'mes_example'], ['系统提示', 'system_prompt'], ['历史记录后指令', 'post_history_instructions'],
];

function section(title, fields, id = null) {
  return { title, fields, id };
}

export function readCard(raw) {
  const data = raw?.data ?? raw;
  if (!data || typeof data.name !== 'string' || !['description', 'first_mes', 'personality', 'scenario'].some(key => typeof data[key] === 'string')) {
    throw new Error('没有找到角色人设或开场白，请选择角色卡 PNG 或 JSON。');
  }
  const persona = Object.fromEntries(personaFields.map(([label, key]) => [label, String(data[key] ?? '')]));
  const greetings = [data.first_mes ?? '', ...(Array.isArray(data.alternate_greetings) ? data.alternate_greetings : [])]
    .map((body, i) => section('开场白 ' + (i + 1), { 正文: String(body) }))
    .filter(entry => entry.fields.正文 !== '');
  const book = data.character_book;
  const binding = String(data.extensions?.world || '');
  return {
    name: data.name, version: String(data.character_version || ''),
    persona: section('人设', persona), greetings, binding,
    book: book ? readBook(book) : binding ? null : [],
    bookName: book ? String(book.name || binding || '卡内世界书') : '',
  };
}

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])]));
  }
  return value;
}

export function readBook(book) {
  if (!book?.entries || typeof book.entries !== 'object') throw new Error('文件中没有世界书条目。');
  return Object.values(book.entries).map((entry, i) => {
    if (!entry || typeof entry !== 'object') throw new Error('无法读取世界书条目。');
    const { name, comment, content, id, uid, keys, key, secondary_keys, keysecondary,
      disable, enabled, insertion_order, order, extensions = {}, ...other } = entry;
    const title = String(comment || name || (keys ?? key)?.[0] || '');
    const settings = { ...other, ...extensions, 关键词: keys ?? key ?? [], 辅助词: secondary_keys ?? keysecondary ?? [],
      启用: enabled ?? !disable, 顺序: insertion_order ?? order ?? 100 };
    if (name && comment && name !== comment) settings.name = name;
    return { ...section(title || '未命名条目 ' + (i + 1), {
      正文: String(content ?? ''), 条目设置: JSON.stringify(sorted(settings), null, 2),
    }, id ?? uid), matchName: title };
  });
}

export async function readCardFile(file) {
  if (!/\.png$/i.test(file.name) && file.type !== 'image/png') return readCard(JSON.parse(await file.text()));
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = [137,80,78,71,13,10,26,10];
  if (!signature.every((b, i) => bytes[i] === b)) throw new Error('PNG 文件格式错误。');
  const view = new DataView(bytes.buffer);
  const decoder = new TextDecoder();
  const cards = new Map();
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const size = view.getUint32(offset);
    const end = offset + 8 + size;
    if (end + 4 > bytes.length) throw new Error('PNG 文件不完整。');
    const type = decoder.decode(bytes.subarray(offset + 4, offset + 8));
    if (type === 'tEXt') {
      const chunk = bytes.subarray(offset + 8, end);
      const separator = chunk.indexOf(0);
      if (separator > 0 && separator < 10) {
        const key = decoder.decode(chunk.subarray(0, separator)).toLowerCase();
        if (key === 'ccv3' || key === 'chara') cards.set(key, chunk.subarray(separator + 1));
      }
    }
    if (type === 'IEND') break;
    offset = end + 4;
  }
  for (const key of ['ccv3', 'chara']) {
    if (!cards.has(key)) continue;
    try {
      const binary = atob(decoder.decode(cards.get(key)));
      return readCard(JSON.parse(decoder.decode(Uint8Array.from(binary, char => char.charCodeAt(0)))));
    } catch { /* Some cards also carry a usable fallback version. */ }
  }
  throw new Error('PNG 中没有可读取的角色卡数据，请使用原始角色卡或 JSON。');
}

const fieldsEqual = (a, b) => Object.keys(a.fields).every(key => a.fields[key] === b.fields[key]);

function result(left, right, compareTitle) {
  let status;
  if (!left) status = 'new';
  else if (!right) status = 'old';
  else if (!fieldsEqual(left, right)) status = 'changed';
  else if (compareTitle && left.matchName !== right.matchName) status = 'renamed';
  else status = 'same';
  return { left, right, status };
}

function groupRemaining(items, used, keyOf) {
  const groups = new Map();
  items.forEach((item, index) => {
    if (used.has(index)) return;
    const key = keyOf(item);
    if (key === '' || key == null) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(index);
  });
  return groups;
}

function compareEntries(left, right, greetings) {
  const pairs = new Map(), usedRight = new Set();
  function pair(a, b) { pairs.set(a, b); usedRight.add(b); }
  function match(keyOf, allowDuplicates = false) {
    const a = groupRemaining(left, pairs, keyOf);
    const b = groupRemaining(right, usedRight, keyOf);
    for (const [key, xs] of a) {
      const ys = b.get(key);
      if (!ys || (!allowDuplicates && (xs.length !== 1 || ys.length !== 1))) continue;
      xs.slice(0, ys.length).forEach((x, i) => pair(x, ys[i]));
    }
  }

  if (greetings) {
    match(entry => entry.fields.正文, true);
    // Pair edits within gaps between unchanged greetings, so an insertion in
    // one gap and a deletion in another are not shown as a replacement.
    let startA = 0, startB = 0;
    const anchors = [...pairs].sort(([a], [b]) => a - b);
    for (const [endA, endB] of [...anchors, [left.length, right.length]]) {
      if (endB < startB) continue;
      let b = startB;
      for (let a = startA; a < endA && b < endB; a++) {
        if (pairs.has(a)) continue;
        while (b < endB && usedRight.has(b)) b++;
        if (b < endB) pair(a, b++);
      }
      startA = endA + 1;
      startB = endB + 1;
    }
  } else {
    match(entry => entry.matchName);
    match(entry => entry.id == null ? null : String(entry.id));
    match(entry => entry.fields.正文);
  }
  const byRight = new Map([...pairs].map(([a,b]) => [b,a]));
  const rows = right.map((item, i) => result(left[byRight.get(i)], item, !greetings));
  left.forEach((item, i) => { if (!pairs.has(i)) rows.push(result(item, null, !greetings)); });
  return rows;
}

export function compareCards(oldCard, newCard, view) {
  if (view === 'book') {
    if (!oldCard.book || !newCard.book) throw new Error('请先选择绑定世界书对应的版本。');
    return compareEntries(oldCard.book, newCard.book, false);
  }
  return [result(oldCard.persona, newCard.persona, false), ...compareEntries(oldCard.greetings, newCard.greetings, true)];
}
