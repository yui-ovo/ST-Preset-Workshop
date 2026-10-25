function pmmRuntimeResource(target) { return globalThis.__PMM_RUNTIME_SCOPE__?.own(target) || target; }
import { draftSignature } from './workshop-editing-core.js?v=2.98.49';
import { planCompareActions, applyCompareActions } from './compare-actions-core.js?v=2.98.49';

// Both the Vue modal and its mobile portal share one comparison transaction.
export function createCompareActions(adapter) {
  const sides = adapter.read();
  if (!sides || sides[0].name === sides[1].name) return null;
  const signature = draftSignature(sides), selected = new Set(), placements = new Map(), mounts = new Set();
  let direction = 0, mode = 'replace', query = '', busy = false, error = '', actions = [], prepared = [], revision = 0;
  const source = () => sides[direction], target = () => sides[1 - direction];
  const resolved = a => ({ ...a, ...placements.get(a.si) });
  const ready = a => a && a.kind === mode && (a.kind === 'replace' || Number.isInteger(resolved(a).at));
  const label = () => ({replace:'替换',insert:'插入',off:'关闭'})[mode];
  function reset() {
    selected.clear(); placements.clear();
    actions = planCompareActions(source(), target(), adapter.pairs.map(p => direction ? {si:p.ti,ti:p.si} : p));
    const indices = new Map(source().prompts.map((p,si)=>[p.id,si])), byIndex = new Map(actions.map(a=>[a.si,a]));
    prepared = adapter.rows.map(row => {
      const id = direction ? row.rightId : row.leftId;
      const si = indices.get(id) ?? -1;
      return { ...row, si, action:byIndex.get(si), comparisonName:row.name, name:source().prompts[si]?.name || row.name };
    });
    revision++;
  }
  const rows = () => prepared.filter(row => mode === 'off' || !query || row.name.toLowerCase().includes(query.toLowerCase()));
  async function apply(list) {
    if (busy || !list.length || list.some(a => !ready(a))) return;
    busy = true; error = ''; refresh();
    try {
      if (draftSignature(adapter.read()) !== signature) throw Error('预设或分组已变化，请重新打开比对');
      const result = applyCompareActions(source(), target(), list.map(resolved));
      await adapter.apply(1 - direction, result, mode === 'replace' ? '对比替换正文' : '对比插入条目');
      adapter.notice(`已${label()} ${result.changed} 条，请保存目标预设；可在目标面板撤销。`);
    } catch (e) { error = e.message || String(e); }
    finally { busy = false; refresh(); }
  }
  const node = (parent, tag, text = '', cls = '') => {
    const el = pmmRuntimeResource(parent.ownerDocument).createElement(tag); el.className = cls; el.textContent = text; pmmRuntimeResource(parent).append(el); return el;
  };
  function button(parent, text, click, cls = '') {
    const el = node(parent, 'button', text, 'pmm-ca-button ' + cls); el.type = 'button'; el.disabled = busy;
    el.onclick = e => { e.stopPropagation(); click(); }; return el;
  }
  function refresh() {
    for (const mount of mounts) {
      if (!mount.modal.isConnected) mounts.delete(mount);
      else if (!mount.modal.parentElement?.dataset.pmmDiffOriginal) mount.render();
    }
  }
  function mount(modal) {
    if (!modal || modal.__pmmCompareController === api) return;
    modal.__pmmCompareController = api;
    // Clones carry generated markup, but not its handlers.
    modal.querySelectorAll('[data-pmm-ca-owned]').forEach(el => el.remove());
    const nativeList = modal.querySelector('[data-pmm-diff-list]'), footer = modal.querySelector('[data-pmm-diff-footer]'), title = modal.querySelector('[data-pmm-diff-title]');
    if (!nativeList || !footer || !title) return;
    const theme = modal.ownerDocument.defaultView.getComputedStyle(title);
    modal.style.setProperty('--pmm-ca-text', theme.color);
    const own = (parent, tag, text, cls) => { const el = node(parent, tag, text, cls); el.dataset.pmmCaOwned = '1'; return el; };
    own(modal, 'style', CSS);
    const dir = own(title.parentElement, 'button', '', 'pmm-ca-button pmm-ca-direction'); dir.type = 'button'; pmmRuntimeResource(title).after(dir);
    const from = node(dir,'span'); node(dir,'span','→'); const to = node(dir,'span');
    dir.setAttribute('aria-label', '反转方向'); dir.onclick = e => { e.stopPropagation(); if (!busy) { direction = 1-direction; reset(); refresh(); } };
    const body = own(modal, 'div', '', 'pmm-ca-body'); pmmRuntimeResource(nativeList).before(body);
    const toolbar = node(body, 'div', '', 'pmm-ca-toolbar'); node(toolbar, 'strong', '差异条目列表');
    const all = node(toolbar, 'input'); all.type = 'checkbox'; all.setAttribute('aria-label', '全选可操作的搜索结果');
    const cycle = button(toolbar, '', () => { mode = {replace:'insert',insert:'off',off:'replace'}[mode]; selected.clear(); query=''; revision++; refresh(); });
    cycle.dataset.pmmCompareMode = '1'; cycle.title = '切换：替换 → 插入 → 关闭'; cycle.setAttribute('aria-label', '切换操作模式');
    const search = node(body, 'input', '', 'pmm-ca-search'); search.type = 'search'; search.placeholder = '搜索条目'; search.setAttribute('aria-label', '搜索条目');
    search.oninput = () => { query = search.value; revision++; refresh(); };
    const list = node(body, 'div', '', 'pmm-ca-list');
    const status = node(body, 'div', '', 'pmm-ca-status'); status.setAttribute('role','status');
    const submit = own(footer, 'button', '', 'pmm-ca-button pmm-ca-submit'); submit.type = 'button'; pmmRuntimeResource(footer).prepend(submit);
    submit.onclick = e => { e.stopPropagation(); void apply(actions.filter(a => selected.has(a.si))); };
    all.onchange = () => { if (!all.checked) selected.clear(); else rows().forEach(r => { if (ready(r.action)) selected.add(r.si); }); refresh(); };
    let renderedRevision = -1;
    const rowControls = [];
    function render() {
      const enabled = mode !== 'off', visible = rows(), eligible = visible.filter(r => ready(r.action));
      from.textContent=source().name; to.textContent=target().name;
      dir.title = `${source().name} → ${target().name}（点击反转）`; dir.setAttribute('aria-description',dir.title); dir.hidden = !enabled; dir.disabled = busy;
      cycle.textContent = label(); cycle.disabled = busy;
      all.hidden = !enabled; all.disabled = busy || !eligible.length; all.checked = !!eligible.length && eligible.every(r => selected.has(r.si));
      all.indeterminate = !all.checked && eligible.some(r => selected.has(r.si));
      search.hidden = !enabled; search.disabled = busy; search.value = query;
      nativeList.style.setProperty('display', enabled ? 'none' : 'flex', 'important');
      body.classList.toggle('pmm-ca-off', !enabled); list.hidden = !enabled; status.hidden = !enabled;
      submit.hidden = !enabled; submit.textContent = `${label()}（${selected.size}）`; submit.disabled = busy || !selected.size;
      status.textContent = error || (selected.size ? `已选 ${selected.size} 条` : '');
      list.querySelectorAll('select').forEach(control => {control.disabled=busy;});
      // Selecting a row updates controls in place, preserving focus and scroll.
      // It does not rebuild hundreds of cards or redo matching.
      if (renderedRevision === revision) {
        for (const {a,check,single} of rowControls) { check.checked=selected.has(a.si); check.disabled=single.disabled=busy||!ready(a); }
        return;
      }
      renderedRevision=revision; rowControls.length=0;
      pmmRuntimeResource(list).replaceChildren(); if (!enabled) return;
      if (!visible.length) node(list,'p','没有符合搜索条件的条目。');
      for (const row of visible) {
        const a = row.action, canAct = a?.kind === mode;
        const article = node(list, 'article', '', 'pmm-ca-row'); article.dataset.sourceIndex = row.si;
        const first = node(article, 'div', '', 'pmm-ca-first');
        let single;
        if (canAct) { single = button(first, label(), () => void apply([a]), 'pmm-ca-single'); single.disabled = busy || !ready(a); }
        else node(first, 'span', '', 'pmm-ca-action-space');
        const name = node(first, 'span', row.name || '未命名条目', 'pmm-ca-name'); name.title = row.name || '';
        const checkSlot = node(first, 'span', '', 'pmm-ca-check-slot');
        if (canAct) {
          const check = node(checkSlot, 'input'); check.type = 'checkbox'; check.setAttribute('aria-label', `选择 ${row.name}`); check.checked = selected.has(row.si); check.disabled = busy || !ready(a);
          check.onchange = () => { check.checked ? selected.add(row.si) : selected.delete(row.si); refresh(); };
          rowControls.push({a,check,single});
        }
        const percent = row.similarity === undefined ? '' : `${Math.round((row.status === 'content' ? 1-row.similarity : row.similarity)*100)}%`;
        node(first, 'span', percent, 'pmm-ca-percent');
        const names = {content:'内容不同',name:'已改名',partial:'正文相似',unique:row.leftId?'仅上侧存在':'仅下侧存在'};
        const badge = node(first, 'span', names[row.status] || '', 'pmm-ca-badge'); badge.dataset.status = row.status;
        if (['content','partial'].includes(row.status)) { badge.tabIndex=0; badge.setAttribute('role','button'); badge.title='查看正文差异'; badge.onclick=()=>adapter.inspect?.(row); badge.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();adapter.inspect?.(row);}}; }
        if (!canAct) continue;
        const note = node(article, 'div', '', 'pmm-ca-note');
        if (a.kind === 'replace') note.textContent = `→ ${target().prompts[a.ti].name}${a.approximate ? '（正文相似配对）' : ''}`;
        else if (a.at !== null) note.textContent = `自动位置：${a.at < target().prompts.length ? `“${target().prompts[a.at].name}”之前` : '最后一个对应条目之后'} · ${target().sections?.find(s=>s.id===a.sectionId)?.displayName || '未分组'}`;
        else {
          node(note,'div',a.reason);
          const group = node(note,'select'), slot = node(note,'select'); group.setAttribute('aria-label','目标分组'); slot.setAttribute('aria-label','插入位置'); group.disabled=slot.disabled=busy;
          const option = (select,value,text) => { const o=node(select,'option',text);o.value=String(value); };
          option(group,'','未分组'); for(const s of target().sections || []) option(group,s.id,s.displayName || s.id); group.value=resolved(a).sectionId || '';
          option(slot,'','请选择插入位置');
          const section=target().sections?.find(s=>s.id===group.value);
          const members=target().prompts.map((p,index)=>({p,index})).filter(({p})=>section?section.itemIds.includes(p.id):!(target().sections || []).some(s=>s.itemIds.includes(p.id)));
          for(const {p,index} of members) option(slot,index,`在“${p.name}”之前`);
          option(slot,members.length?members.at(-1).index+1:target().prompts.length,section?'该分组末尾':'未分组条目末尾'); slot.value=Number.isInteger(resolved(a).at)?String(resolved(a).at):'';
          group.onchange=()=>{placements.set(a.si,{at:null,sectionId:group.value});selected.delete(a.si);revision++;refresh();};
          slot.onchange=()=>{placements.set(a.si,{at:slot.value===''?null:Number(slot.value),sectionId:group.value});if(slot.value==='')selected.delete(a.si);revision++;refresh();};
        }
      }
    }
    mounts.add({modal,render}); render();
  }
  const api = {mount}; reset(); return api;
}

const CSS = `
[data-pmm-diff-title]{min-width:0;flex-shrink:0}
.pmm-ca-direction{display:inline-grid!important;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:3px;margin-left:auto;margin-right:6px;max-width:48%;min-width:0;text-align:center;white-space:nowrap}
.pmm-ca-direction span{min-width:0;overflow:hidden;text-overflow:ellipsis}
.pmm-ca-body{flex:1;min-height:0;display:flex;flex-direction:column;padding:0 12px 10px;color:var(--pm-text-primary,var(--pmm-ca-text,#e2e8f0));font-size:12px}
.pmm-ca-toolbar{display:flex;align-items:center;gap:8px;padding:8px 0;flex:none}.pmm-ca-toolbar strong{flex:1;font-size:11px}
.pmm-ca-button{font:inherit!important;font-size:11px!important;color:var(--pm-text-primary,var(--pmm-ca-text,#e2e8f0))!important;background:var(--pm-panel-bg,rgba(127,127,127,.12))!important;border:1px solid var(--pm-border,#666)!important;border-radius:7px!important;padding:5px 8px!important;cursor:pointer;min-height:28px;box-sizing:border-box;line-height:1.3!important}
.pmm-ca-button:disabled{opacity:.4;cursor:default}.pmm-ca-button:focus-visible{outline:2px solid var(--pm-quote-color,#90a5e0)}
.pmm-ca-body input[type=checkbox]{appearance:auto!important;width:16px!important;height:16px!important;min-width:16px!important;margin:0!important;accent-color:var(--pm-quote-color,#90a5e0);box-shadow:none!important}
.pmm-ca-search,.pmm-ca-note select{font:inherit!important;box-sizing:border-box;width:100%;min-width:0;color:inherit!important;background:var(--pm-panel-bg,transparent)!important;border:1px solid var(--pm-border,#666)!important;border-radius:7px;padding:6px!important;margin:0 0 6px!important}
.pmm-ca-list{overflow:auto;min-height:0;flex:1;max-height:55vh;overscroll-behavior:contain;border:1px solid var(--pm-border,#555);border-radius:8px}
.pmm-ca-row{padding:8px 7px;border-bottom:1px solid var(--pm-border,#555)}.pmm-ca-row:last-child{border-bottom:0}
.pmm-ca-first{display:grid!important;grid-template-columns:42px minmax(0,1fr) 16px 4ch 64px;align-items:center;gap:6px;font-size:11px}
.pmm-ca-single{padding:4px 2px!important;width:42px}.pmm-ca-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.pmm-ca-check-slot{display:flex;width:16px}.pmm-ca-percent{text-align:right;font-size:10px;font-variant-numeric:tabular-nums;white-space:nowrap;opacity:.75}
.pmm-ca-badge{font-size:9px;text-align:center;border-radius:4px;padding:2px 0;color:#e19540;background:#a973111a;white-space:nowrap}.pmm-ca-badge[data-status=content]{color:#ef6666;background:#ef44441a}.pmm-ca-badge[data-status=name]{color:#22b55e;background:#22c55e1a}.pmm-ca-badge[data-status=unique]{color:#9c8be9;background:#a855f71a}.pmm-ca-badge[role=button]{cursor:pointer}
.pmm-ca-note{margin:5px 0 0 48px;font-size:10px;line-height:1.5;opacity:.8;overflow-wrap:anywhere}.pmm-ca-note select{display:block;margin-top:5px!important}
.pmm-ca-status{font-size:11px;padding-top:4px;overflow-wrap:anywhere}.pmm-ca-off{flex:0 0 auto;padding-bottom:0}.pmm-ca-submit{margin-right:6px}
.pmm-ca-off + [data-pmm-diff-list] > div:first-child{display:none!important}
[data-pmm-diff-footer]{gap:4px;flex-wrap:wrap}[data-pmm-diff-footer]>button{white-space:nowrap;padding:7px 9px!important;font-size:11px!important}
[data-pmm-ca-owned][hidden],.pmm-ca-body [hidden]{display:none!important}
@media(max-width:360px){.pmm-ca-body{padding-left:7px;padding-right:7px}.pmm-ca-first{grid-template-columns:38px minmax(0,1fr) 16px 4ch 58px;gap:4px}.pmm-ca-single{width:38px}.pmm-ca-note{margin-left:42px}}
`;
