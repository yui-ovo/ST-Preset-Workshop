import { planSwitchTransfer } from './workshop-editing-core.js?v=2.98.49';
const copy = value => JSON.parse(JSON.stringify(value));
const text = value => String(value ?? '').trim();
const sectionOf = (side, index) => side.sections?.find(s => s.itemIds?.includes(side.prompts[index]?.id))?.id || '';

// One identity mapping for statistics, the body editor and replacement actions.
export function buildCompareResult(left, right, similarity = (a,b) => a === b ? 1 : 0) {
  const result = {leftStatus:new Map(),rightStatus:new Map(),pairLabels:new Map(),similarities:new Map(),diffItems:[],stats:{contentDiffCount:0,nameDiffCount:0,partialCount:0,leftUniqueCount:0,rightUniqueCount:0,matchCount:0}};
  const paired = new Map([...planSwitchTransfer(left,right).matches].map(([ti,si])=>[si,ti]));
  const used = new Set(paired.values());
  const body = p => String(p.content ?? '');
  for (let si=0;si<left.length;si++) if(!paired.has(si)) {
    const ti=right.findIndex((p,ti)=>!used.has(ti)&&body(p)!==''&&body(p)===body(left[si]));
    if(ti>=0){paired.set(si,ti);used.add(ti);}
  }
  for (let si=0;si<left.length;si++) if(!paired.has(si)) {
    let best=-1,score=.6;
    right.forEach((p,ti)=>{if(!used.has(ti)){const value=similarity(body(left[si]),body(p));if(value>=score){best=ti;score=value;}}});
    if(best>=0){paired.set(si,best);used.add(best);}
  }
  let labelIndex=0;
  for(let si=0;si<left.length;si++) {
    const a=left[si],ti=paired.get(si),b=right[ti];
    if(!b){result.leftStatus.set(a.id,'unique');result.stats.leftUniqueCount++;result.diffItems.push({leftId:a.id,name:a.name,status:'unique'});continue;}
    const equal=body(a)===body(b),sameName=a.name===b.name;
    const status=equal?(sameName?'match':'name'):(sameName||a.id===b.id?'content':'partial');
    result.leftStatus.set(a.id,status);result.rightStatus.set(b.id,status);
    result.stats[{match:'matchCount',name:'nameDiffCount',content:'contentDiffCount',partial:'partialCount'}[status]]++;
    if(status==='match')continue;
    let label='',n=labelIndex++;for(;n>=0;n=Math.floor(n/26)-1)label=String.fromCharCode(65+n%26)+label;
    result.pairLabels.set(a.id,label);result.pairLabels.set(b.id,label);
    const score=similarity(body(a),body(b));result.similarities.set(a.id,score);result.similarities.set(b.id,score);
    result.diffItems.push({leftId:a.id,rightId:b.id,name:sameName?a.name:`${a.name} ${equal?'/':'≈'} ${b.name}`,status,...(!equal?{similarity:score}:{})});
  }
  right.forEach((b,ti)=>{if(!used.has(ti)){result.rightStatus.set(b.id,'unique');result.stats.rightUniqueCount++;result.diffItems.push({rightId:b.id,name:b.name,status:'unique'});}});
  return result;
}

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
      else if (!reason && previousGroup === sectionId && nextGroup !== sectionId) at = before + 1;
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
