import { dialog, dialogs, element, button } from './workshop-editing.js?v=2.98.48';
import { draftSignature } from './workshop-editing-core.js?v=2.98.48';
import { planCompareActions, applyCompareActions } from './compare-actions-core.js?v=2.98.48';

export function openCompareActions(host, adapter) {
  if (!host?.isConnected || dialogs.has(host.ownerDocument)) return;
  const sides = adapter.read();
  if (!sides || sides[0].name === sides[1].name) return adapter.notice('请先选择两份不同的预设');
  const signature = draftSignature(sides), view = dialog(host, '对比 · 替换与插入', () => view.finish());
  dialogs.set(host.ownerDocument, true);
  element(view.root, 'style', `
    .tools{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.tools button{padding:6px 9px;font-size:12px}.active{outline:1px solid var(--pm-quote-color,#90a5e0)}
    input,select{font:inherit;font-size:12px;color:inherit;background:var(--pm-panel-bg,#20252e);border:1px solid var(--pm-border,#666);border-radius:8px;padding:7px;max-width:100%;min-width:0}input[type=search]{width:100%}
    article{border-bottom:1px solid var(--pm-border,#555);padding:10px 0}label{display:flex;align-items:center;gap:8px;font-size:13px;overflow-wrap:anywhere}input[type=checkbox]{flex:none;width:16px;height:16px;accent-color:var(--pm-quote-color,#90a5e0)}
    small{display:block;font-size:11px;line-height:1.5;opacity:.75;overflow-wrap:anywhere;margin:6px 0}.row-actions{display:flex;justify-content:flex-end}.row-actions button{padding:5px 10px;font-size:11px}.placement{display:grid;gap:6px;margin-top:7px}.placement select{width:100%}.status{margin:0 18px}.direction strong{font-size:12px}.direction{padding:8px}footer{padding-top:8px}
  `);
  let direction = 0, kind = 'replace', query = '', limit = 60, actions = [], selected = new Set(), placements = new Map();
  const status = element(view.root.querySelector('section'), 'p', '', 'status');
  view.footer.before(status);
  const source = () => sides[direction], target = () => sides[1 - direction];
  const pairs = () => (adapter.pairs || []).map(p => direction ? { si: p.ti, ti: p.si } : p);
  const reset = () => { actions = planCompareActions(source(), target(), pairs()); selected.clear(); placements.clear(); limit = 60; };
  const resolved = action => ({ ...action, ...(placements.get(action.si) || {}) });
  const filtered = () => actions.filter(a => a.kind === kind && source().prompts[a.si].name.toLowerCase().includes(query.toLowerCase()));
  const ready = list => list.length && list.every(a => a.kind === 'replace' || Number.isInteger(resolved(a).at));
  async function apply(list) {
    view.busy(true); status.textContent = '';
    try {
      if (draftSignature(adapter.read()) !== signature) throw Error('预设或分组已变化，请重新打开对比操作');
      const result = applyCompareActions(source(), target(), list.map(resolved));
      await adapter.apply(1 - direction, result, kind === 'replace' ? '对比替换正文' : '对比插入条目');
      view.finish(); adapter.notice(`已${kind === 'replace' ? '替换正文' : '插入'} ${result.changed} 条，请保存目标预设；可在目标面板一次撤销。`);
    } catch (error) { status.textContent = error.message || String(error); view.busy(false); }
  }
  function option(select, value, label) { const o = element(select, 'option', label); o.value = String(value); }
  function render() {
    view.main.replaceChildren(); view.footer.replaceChildren(); status.textContent = '';
    const dir = element(view.main, 'div', '', 'direction');
    element(dir, 'strong', `来源：${source().name}`); element(dir, 'strong', `目标：${target().name}`);
    button(dir, '⇅ 反转方向', () => { direction = 1 - direction; reset(); render(); }, 'swap');
    const tabs = element(view.main, 'div', '', 'tools');
    for (const [value, label] of [['replace', '替换正文'], ['insert', '插入独有条目']]) {
      button(tabs, `${label} ${actions.filter(a => a.kind === value).length}`, () => { kind = value; selected.clear(); limit = 60; render(); }, kind === value ? 'active' : '');
    }
    element(view.main, 'small', kind === 'replace' ? '只替换正文，目标名称、开关、顺序和其他设置保持原样。' : '优先按相邻对应条目定位；需要确认的位置请选择后再插入。');
    const search = element(view.main, 'input', ''); search.type = 'search'; search.placeholder = '搜索条目'; search.value = query; search.setAttribute('aria-label', '搜索操作条目');
    const tools = element(view.main, 'div', '', 'tools'), list = element(view.main, 'div', '');
    const count = element(tools, 'small', '');
    button(tools, '全选筛选结果', () => { filtered().forEach(a => selected.add(a.si)); renderRows(); });
    button(tools, '取消选择', () => { selected.clear(); renderRows(); });
    button(view.footer, '返回对比', () => view.finish());
    const submit = button(view.footer, '应用所选', () => apply(actions.filter(a => selected.has(a.si))), 'primary');
    function syncCount() {
      const chosen = actions.filter(a => selected.has(a.si));
      count.textContent = `已选 ${chosen.length} 条`; submit.textContent = `${kind === 'replace' ? '替换正文' : '插入'}（${chosen.length}）`;
      submit.disabled = !ready(chosen);
    }
    function renderRows() {
      list.replaceChildren(); const rows = filtered(); syncCount();
      if (!rows.length) element(list, 'small', '没有可处理的条目。');
      for (const a of rows.slice(0, limit)) {
        const row = element(list, 'article', ''); row.dataset.sourceIndex = a.si;
        const label = element(row, 'label', ''), check = element(label, 'input', ''); check.type = 'checkbox'; check.checked = selected.has(a.si);
        element(label, 'span', source().prompts[a.si].name || '未命名条目');
        check.onchange = () => { check.checked ? selected.add(a.si) : selected.delete(a.si); syncCount(); };
        if (a.kind === 'replace') element(row, 'small', `→ ${target().prompts[a.ti].name}${a.approximate ? '（正文相似配对，请确认）' : ''}`);
        else if (a.at !== null) {
          element(row, 'small', `自动位置：${a.at < target().prompts.length ? `“${target().prompts[a.at].name}”之前` : '最后一个对应条目之后'} · ${target().sections?.find(s => s.id === a.sectionId)?.displayName || '未分组'}`);
        } else {
          element(row, 'small', a.reason);
          const controls = element(row, 'div', '', 'placement'), group = element(controls, 'select', ''), slot = element(controls, 'select', '');
          group.setAttribute('aria-label', '目标分组'); slot.setAttribute('aria-label', '插入位置');
          option(group, '', '未分组'); for (const s of target().sections || []) option(group, s.id, s.displayName || s.id);
          group.value = resolved(a).sectionId || '';
          const slots = () => {
            slot.replaceChildren(); option(slot, '', '请选择插入位置');
            const section = target().sections?.find(s => s.id === group.value);
            const members = target().prompts.map((p, index) => ({ p, index })).filter(({p}) => section ? section.itemIds.includes(p.id) : !(target().sections || []).some(s => s.itemIds.includes(p.id)));
            for (const {p, index} of members) option(slot, index, `在“${p.name}”之前`);
            option(slot, members.length ? members.at(-1).index + 1 : target().prompts.length, section ? '该分组末尾' : '未分组条目末尾');
            const placement = placements.get(a.si); slot.value = placement?.sectionId === group.value ? String(placement.at) : '';
          };
          group.onchange = () => { placements.delete(a.si); slots(); syncCount(); single.disabled = true; };
          slot.onchange = () => { if (slot.value === '') placements.delete(a.si); else placements.set(a.si, { at: Number(slot.value), sectionId: group.value }); syncCount(); single.disabled = !ready([a]); };
          slots();
        }
        const controls = element(row, 'div', '', 'row-actions');
        const single = button(controls, kind === 'replace' ? '替换此条正文' : '插入此条', () => apply([a])); single.disabled = !ready([a]);
      }
      if (rows.length > limit) button(list, `显示更多（剩余 ${rows.length - limit} 条）`, () => { limit += 60; renderRows(); });
      const blocked = actions.filter(a => a.kind === 'blocked').length;
      if (blocked) element(list, 'small', `${blocked} 条存在重名或重复标识，已跳过，避免错误替换或重复插入。`);
    }
    search.oninput = () => { query = search.value; limit = 60; renderRows(); };
    renderRows();
    view.footer.querySelector('button').focus({ preventScroll: true });
  }
  reset(); render();
}
