// Matching never uses list position or fuzzy text similarity as an automatic match.
const text = value => String(value ?? '').trim();
const indexBy = (rows, key) => {
  const index = new Map();
  rows.forEach((row, i) => { const value = key(row); if (!value) return; if (!index.has(value)) index.set(value, []); index.get(value).push(i); });
  return index;
};
export const draftSignature = value => JSON.stringify(value);

export function planSwitchTransfer(source, target) {
  const ids = indexBy(source, p => text(p.id)), names = indexBy(source, p => text(p.name));
  const targetIds = indexBy(target, p => text(p.id)), targetNames = indexBy(target, p => text(p.name));
  const used = new Set(), matches = new Map();
  for (const [lookup, own, field] of [[ids, targetIds, 'id'], [names, targetNames, 'name']]) {
    target.forEach((row, ti) => {
      if (matches.has(ti)) return;
      const key = text(row[field]), found = lookup.get(key) || [];
      if (found.length === 1 && own.get(key)?.length === 1 && !used.has(found[0])) {
        matches.set(ti, found[0]); used.add(found[0]);
      }
    });
  }
  return { matches };
}

export function transferSwitches(source, target, matches) {
  const used = new Set();
  for (const [ti, si] of matches) {
    if (!Number.isInteger(ti) || !Number.isInteger(si) || !target[ti] || !source[si] || used.has(si)) throw Error('条目对应重复或已失效，请重新选择');
    used.add(si);
  }
  let changed = 0;
  const prompts = target.map((row, ti) => {
    if (!matches.has(ti)) return row;
    const enabled = source[matches.get(ti)].enabled !== false;
    if ((row.enabled !== false) === enabled) return row;
    changed++;
    return { ...row, enabled };
  });
  return { prompts, changed };
}

export async function saveDirtyDrafts(entries) {
  const destinations = new Map();
  for (const entry of entries) {
    const value = draftSignature(entry.read());
    if (destinations.has(entry.destination) && destinations.get(entry.destination) !== value) {
      throw Error(`“${entry.name}”在两侧有不同修改，请返回编辑后分别处理，避免互相覆盖。`);
    }
    destinations.set(entry.destination, value);
  }
  for (const entry of entries) {
    if (!entry.dirty()) continue;
    if (await entry.save() === false) throw Error(`“${entry.name}”保存失败`);
    if (entry.dirty()) throw Error(`“${entry.name}”仍有未保存修改，请返回编辑检查`);
  }
}
