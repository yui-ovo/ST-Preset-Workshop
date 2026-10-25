import { planSwitchTransfer } from './workshop-editing-core.js?v=2.98.49';
const copy = value => JSON.parse(JSON.stringify(value));
const text = value => String(value ?? '').trim();
const sectionOf = (side, index) => side.sections?.find(s => s.itemIds?.includes(side.prompts[index]?.id))?.id || '';

export function planCompareActions(source, target, pairs = []) {
  const { matches } = planSwitchTransfer(source.prompts, target.prompts);
  const reliable = new Map([...matches].map(([ti, si]) => [si, ti]));
  const paired = new Map(reliable), usedTargets = new Set(reliable.values());
  const sourceIdCounts = new Map(), targetIds = new Set(), targetNames = new Set();
  for (const row of source.prompts) sourceIdCounts.set(text(row.id), (sourceIdCounts.get(text(row.id)) || 0) + 1);
  for (const row of target.prompts) { targetIds.add(text(row.id)); if (text(row.name)) targetNames.add(text(row.name)); }
  const previous = [], next = []; let anchor = -1;
  for (let n = 0; n < source.prompts.length; n++) { previous[n] = anchor; if (reliable.has(n)) anchor = reliable.get(n); }
  anchor = -1;
  for (let n = source.prompts.length - 1; n >= 0; n--) { next[n] = anchor; if (reliable.has(n)) anchor = reliable.get(n); }
  // Similar-content pairs are offered explicitly for body replacement, never used
  // as positional anchors. The user must select them before any write occurs.
  for (const { si, ti } of pairs) {
    if (Number.isInteger(si) && Number.isInteger(ti) && source.prompts[si] && target.prompts[ti]
      && !paired.has(si) && !usedTargets.has(ti)) { paired.set(si, ti); usedTargets.add(ti); }
  }
  return source.prompts.flatMap((row, si) => {
    if (paired.has(si)) {
      const ti = paired.get(si);
      return String(row.content ?? '') === String(target.prompts[ti].content ?? '') ? []
        : [{ kind: 'replace', si, ti, approximate: !reliable.has(si) }];
    }
    const duplicate = !text(row.id) || sourceIdCounts.get(text(row.id)) !== 1
      || targetIds.has(text(row.id)) || targetNames.has(text(row.name));
    if (duplicate) return [{ kind: 'blocked', si, reason: '存在重名或重复标识，无法确定对应条目' }];
    const before = previous[si], after = next[si];
    let at = after >= 0 ? after : before >= 0 ? before + 1 : null;
    let reason = '';
    if (before >= 0 && after >= 0 && before >= after) { at = null; reason = '两侧相邻条目顺序冲突'; }
    if (before < 0 && after < 0) { at = null; reason = '没有可靠的相邻对应条目'; }
    const previousGroup = before >= 0 ? sectionOf(target, before) : null;
    const nextGroup = after >= 0 ? sectionOf(target, after) : null;
    let sectionId = previousGroup ?? nextGroup ?? '';
    const ownGroup = source.sections?.find(s => s.itemIds?.includes(row.id));
    const matchingGroups = ownGroup ? (target.sections || []).filter(s => s.id === ownGroup.id || (text(s.displayName) && text(s.displayName) === text(ownGroup.displayName))) : [];
    if (matchingGroups.length === 1) {
      sectionId = matchingGroups[0].id;
      if (previousGroup !== sectionId && nextGroup !== sectionId) { at = null; reason ||= '对应分组内没有可靠的定位条目'; }
    } else if ((ownGroup && matchingGroups.length !== 1) || (previousGroup !== null && nextGroup !== null && previousGroup !== nextGroup)) {
      at = null; reason ||= '需要确认目标分组';
    }
    return [{ kind: 'insert', si, at, sectionId, reason }];
  });
}

export function applyCompareActions(source, target, actions) {
  const prompts = copy(target.prompts), sections = copy(target.sections || []);
  const inserts = [], selected = new Set();
  for (const action of actions) {
    const { si, ti, kind, at, sectionId = '' } = action;
    if (!Number.isInteger(si) || !source.prompts[si] || selected.has(si)) throw Error('选择已失效，请重新打开对比操作');
    selected.add(si);
    if (kind === 'replace') {
      if (!Number.isInteger(ti) || !prompts[ti]) throw Error('目标条目已失效');
      prompts[ti].content = source.prompts[si].content ?? '';
    } else if (kind === 'insert') {
      if (!Number.isInteger(at) || at < 0 || at > prompts.length) throw Error('请先为未定位条目选择插入位置');
      if (sectionId && !sections.some(s => s.id === sectionId)) throw Error('目标分组已失效');
      const row = copy(source.prompts[si]);
      if (prompts.some(p => p.id === row.id) || inserts.some(p => p.row.id === row.id)) throw Error('目标已有相同标识，已停止插入');
      inserts.push({ ...action, row, sectionId });
    } else throw Error('存在无法安全处理的条目');
  }
  // Sorting by the original target slot then source order keeps batches stable.
  inserts.sort((a, b) => a.at - b.at || a.si - b.si);
  let offset = 0;
  for (const item of inserts) {
    prompts.splice(item.at + offset++, 0, item.row);
    sections.find(s => s.id === item.sectionId)?.itemIds.push(item.row.id);
  }
  const order = new Map(prompts.map((p, i) => [p.id, i]));
  for (const section of sections) section.itemIds.sort((a, b) => order.get(a) - order.get(b));
  return { prompts, sections, inserted: inserts.map(({ row, sectionId, at }) => ({ id: row.id, sectionId, at })), changed: actions.length };
}
