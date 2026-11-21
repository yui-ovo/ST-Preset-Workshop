import { compareCards } from './character-card-core.js?v=2.98.67-card.8';
import { buildHighlightedDiff } from './body-highlight.js';
import { changeComparedBody, itemsOf, transferItems } from './character-card-draft.js?v=2.98.67-card.8';
import { runtimeResource } from './runtime-resources.js';

const categories = [
  ['changed', '内容不同', '#e26367'], ['renamed', '改名', '#46ae77'],
  ['old', '仅旧卡有', '#ad75d8'], ['new', '仅新卡有', '#548dde'], ['same', '完全一致', '#43a797'],
];
const sides = ['A · 旧卡', 'B · 新卡'];

export const cardDiffStyles = new Map(categories.map(([key,label,color]) => [key,{label,color}]));

export function showCharacterResults(opener, cards, initialView, applyCards, pair = null) {
  const doc = opener.ownerDocument;
  if (doc.querySelector('dialog.pmm-character-compare[open]')) return;
  const dialog = runtimeResource(doc).createElement('dialog');
  dialog.className = 'pmm-character-compare';
  dialog.setAttribute('aria-label', '角色卡对比');
  const theme = doc.defaultView.getComputedStyle(opener);
  for (const key of ['--pm-panel-bg', '--pm-card-bg', '--pm-text-primary', '--pm-border', '--pm-accent']) {
    const value = theme.getPropertyValue(key);
    if (value) dialog.style.setProperty(key, value);
  }
  let view = initialView, screen = 'results';
  let rows = pair ? [] : compareCards(...cards, view), selected = new Set(), current, listScroll = 0;
  let sequence = [], buffers, editing = false, pending = null, notice = '';
  let snippet = null, undoPaste = null, activeSide = null;
  let syncSelection;
  const selectionChanged = () => syncSelection?.();
  runtimeResource(doc).addEventListener('selectionchange',selectionChanged);
  const style = doc.createElement('style');
  style.textContent = css;
  const content = element('div', '', 'cc-content');
  dialog.append(style, content);
  runtimeResource(opener.closest('#preset-manager-main-panel') || doc.body).append(dialog);
  dialog.addEventListener('cancel', event => { event.preventDefault(); back(); });
  const viewport = doc.defaultView.visualViewport;
  let restingHeight = viewport?.height || doc.defaultView.innerHeight, restingWidth = doc.defaultView.innerWidth;
  const fit = () => {
    const height = viewport?.height || doc.defaultView.innerHeight;
    const width = doc.defaultView.innerWidth;
    if (Math.abs(width-restingWidth)>60) { restingWidth = width; restingHeight = height; }
    if (!editing) restingHeight = height;
    else restingHeight = Math.max(restingHeight,height);
    const compact = editing && !pending && activeSide !== null && restingHeight-height > 110;
    dialog.classList.toggle('cc-keyboard',compact);
    dialog.dataset.activeSide = String(activeSide);
    dialog.style.setProperty('--cc-viewport',height + 'px');
    dialog.style.setProperty('--cc-offset',(viewport?.offsetTop || 0) + 'px');
  };
  fit();
  for (const event of ['resize','scroll']) runtimeResource(viewport)?.addEventListener(event,fit);
  dialog.addEventListener('close', () => {
    runtimeResource(doc).removeEventListener('selectionchange',selectionChanged);
    for (const event of ['resize','scroll']) runtimeResource(viewport)?.removeEventListener(event,fit);
    dialog.remove();
    const compare = doc.querySelector('.cc-work-panel button[aria-label="查看对比详情"]');
    (opener.isConnected ? opener : compare)?.focus({preventScroll:true});
  }, { once: true });
  if (pair) showRow({ left:pair[0], right:pair[1] }); else render();
  dialog.showModal();

  function element(tag, text, cls) {
    const node = doc.createElement(tag);
    if (text) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  }
  function button(label, action, cls) {
    const node = element('button', label, cls);
    node.type = 'button';
    node.onclick = action;
    return node;
  }
  function back() {
    if (screen === 'results') { dialog.close(); return; }
    if (pending) { pending = null; redrawBody(); return; }
    leaveBody(() => {
      if (pair) { dialog.close(); return; }
      const index = sequence.indexOf(current);
      rows = compareCards(...cards, view);
      screen = 'results';
      render();
      const list = content.querySelector('.cc-list');
      const row = list.children[Math.min(index,list.children.length-1)];
      (row?.matches('button') ? row : row?.querySelector('button'))?.focus({ preventScroll: true });
    });
  }
  function tabs() {
    const bar = element('div', '', 'cc-tabs');
    for (const [id, label, icon] of [['persona', '人设', 'fa-id-card'], ['book', '绑定世界书', 'fa-book-atlas']]) {
      const tab = button('', () => {
        if (view === id) return;
        view = id;
        selected.clear(); listScroll = 0; notice = '';
        rows = compareCards(...cards, view);
        render();
      });
      tab.title = label;
      tab.setAttribute('aria-label', label);
      tab.disabled = id === 'book' && cards.some(card => !card.book);
      tab.setAttribute('aria-pressed', String(view === id));
      const glyph = element('i', '', 'fa-solid ' + icon);
      glyph.setAttribute('aria-hidden', 'true');
      tab.prepend(glyph);
      bar.append(tab);
    }
    return bar;
  }
  function visible() { return rows.filter(row => row.status !== 'same' && (!selected.size || selected.has(row.status))); }
  function title(row) {
    const a = row.left?.title, b = row.right?.title;
    return a && b && a !== b ? a + ' → ' + b : b || a;
  }
  function summary() {
    const bar = element('div', '', 'cc-stats');
    for (const [key, label, color] of categories) {
      const toggle = button('', () => {
        if (selected.has(key)) selected.delete(key); else selected.add(key);
        listScroll = 0; render();
        content.querySelector('[data-cc-status="' + key + '"]').focus();
      });
      toggle.dataset.ccStatus = key;
      toggle.disabled = key === 'same';
      if (!toggle.disabled) toggle.setAttribute('aria-pressed', String(selected.has(key)));
      toggle.style.setProperty('--cc-category', color);
      toggle.append(element('span', label), element('strong', String(rows.filter(row => row.status === key).length)));
      bar.append(toggle);
    }
    return bar;
  }
  function showRow(row) {
    if (screen === 'results') {
      sequence = visible();
    }
    current = row; screen = 'body'; editing = false; notice = ''; pending = null;
    snippet = undoPaste = activeSide = null;
    buffers = [row.left,row.right].map(entry => entry ? {...entry.fields} : null);
    render();
    content.querySelector('h2').focus();
  }
  function changed(i) {
    const entry = i ? current.right : current.left;
    return entry && Object.keys(entry.fields).some(key => buffers[i][key] !== entry.fields[key]);
  }
  function apply() {
    try {
      const entries = [current.left,current.right];
      const next = cards.map((card,i) => changed(i) ? changeComparedBody(card, view, entries[i].index ?? -1, buffers[i]) : card);
      cards = applyCards(cards, next);
      for (const [i,key] of ['left','right'].entries()) {
        if (current[key]) current[key] = { ...current[key], fields: {...buffers[i]} };
      }
      editing = false; snippet = undoPaste = activeSide = null; notice = '已写入角色卡草稿，可在对应卡面保存或撤回。';
      return true;
    } catch (error) { notice = error.message; return false; }
  }
  function leaveBody(next) {
    if (!changed(0) && !changed(1)) { next(); return; }
    pending = next; redrawBody();
    content.querySelector('.cc-keep')?.focus();
  }
  function redrawBody() {
    const scrolls = [...content.querySelectorAll('.cc-pane-scroll')].map(el => {
      const fields = [...el.querySelectorAll('textarea')].map(field => ({
        key:field.name, top:field.scrollTop, start:field.selectionStart, end:field.selectionEnd,
      }));
      // Anchor each pane to the visible field when converting between a long
      // highlighted paragraph and the same text in a scrollable textarea.
      const nodes = [...el.querySelectorAll('[data-body-field]')];
      const anchor = nodes.find(node => node.getBoundingClientRect().bottom > el.getBoundingClientRect().top) || nodes.at(-1);
      const distance = anchor ? Math.max(0,el.getBoundingClientRect().top-anchor.getBoundingClientRect().top) : 0;
      const fraction = anchor?.matches('textarea') ? anchor.scrollTop/Math.max(1,anchor.scrollHeight-anchor.clientHeight)
        : distance/Math.max(1,anchor?.offsetHeight-el.clientHeight);
      return {top:el.scrollTop,fields,anchor:anchor?.dataset.bodyField,fraction};
    });
    render();
    content.querySelectorAll('.cc-pane-scroll').forEach((el,i) => {
      const state = scrolls[i];
      if (!state) return;
      el.scrollTop = state.top;
      const fields = [...el.querySelectorAll('textarea')];
      if (!!fields.length !== !!state.fields.length) {
        const anchor = [...el.querySelectorAll('[data-body-field]')].find(node => node.dataset.bodyField === state.anchor);
        if (!anchor) return;
        if (state.top || state.fraction) el.scrollTop += anchor.getBoundingClientRect().top-el.getBoundingClientRect().top;
        if (fields.length) anchor.scrollTop = state.fraction * (anchor.scrollHeight-anchor.clientHeight);
        else el.scrollTop += state.fraction * Math.max(0,anchor.offsetHeight-el.clientHeight);
      } else fields.forEach(field => {
        const prev = state.fields.find(item => item.key === field.name);
        if (prev) { field.setSelectionRange(prev.start,prev.end); field.scrollTop = prev.top; }
      });
    });
  }
  function render() {
    syncSelection = null;
    fit();
    dialog.classList.toggle('cc-reading',screen === 'body');
    content.replaceChildren();
    const header = element('header');
    const goBack = button('返回', back, 'cc-back');
    const heading = element('h2', pair ? '单个对比' : screen === 'body' ? title(current) : '角色卡对比详情');
    heading.tabIndex = -1;
    header.append(heading, goBack);
    if (screen === 'body') {
      goBack.textContent = '←'; goBack.setAttribute('aria-label','返回');
      header.prepend(goBack);
    }
    content.append(header);
    if (screen !== 'body') content.append(tabs());
    if (screen === 'results') {
      content.append(summary(), element('h3', '差异条目列表'));
      const list = element('div', '', 'cc-list');
      const isBook = view === 'book';
      const lengths = cards.map(card => itemsOf(card,isBook).length);
      // Prefer the next matched neighbour, including when greetings changed order.
      const positions = ['left','right'].map((side,i) => {
        const other = i ? 'left' : 'right';
        const slots = Array(lengths[i]);
        for (const row of rows) if (row[side]?.index >= 0 && row[other]?.index >= 0) {
          slots[row[side].index] = row[other].index;
        }
        const lastMatch = slots.findLast(value => value !== undefined);
        let nextSlot = lastMatch === undefined ? lengths[1-i] : lastMatch + 1;
        for (let n=slots.length-1; n>=0; n--) {
          if (slots[n] === undefined) slots[n] = nextSlot;
          else nextSlot = slots[n];
        }
        return slots;
      });
      for (const row of visible()) {
        const item = button('', () => { listScroll = list.scrollTop; showRow(row); }, 'cc-row');
        const [,label,color] = categories.find(([key]) => key === row.status);
        const badge = element('small', label); badge.style.setProperty('--cc-category', color);
        item.append(element('span', title(row)), badge);
        if (row.left && row.right) { list.append(item); continue; }
        const sourceSide = row.left ? 0 : 1, dest = 1-sourceSide;
        const entry = row.left || row.right;
        const slots = element('select');
        slots.setAttribute('aria-label',title(row) + '的插入位置');
        const at = positions[sourceSide][entry.index];
        function optionAt(pos) {
          const name = isBook ? cards[dest].book[pos]?.title : '开场白 ' + (pos+1);
          const option = element('option',pos===lengths[dest] ? '末尾' : name+' 之前');
          option.value = String(pos); return option;
        }
        slots.append(optionAt(at));
        function expandSlots() {
          if (slots.options.length === lengths[dest]+1) return;
          slots.replaceChildren(...Array.from({length:lengths[dest]+1},(_,pos) => optionAt(pos)));
          slots.value = String(at);
        }
        slots.onfocus = slots.onpointerdown = expandSlots;
        const group = element('div','','cc-insert-row');
        const insert = button(dest ? '插入新卡' : '插入旧卡',() => {
          try {
            const next = cards.slice();
            next[dest] = transferItems(cards[sourceSide],cards[dest],isBook,[entry.index],Number(slots.value),false);
            cards = applyCards(cards,next);
            rows = compareCards(...cards,view); listScroll = list.scrollTop;
            notice = '已将「' + entry.title + '」插入' + sides[dest] + '草稿。';
          } catch(error) { notice=error.message; }
          render();
        });
        group.append(item,slots,insert); list.append(group);
      }
      if (!list.childElementCount) list.append(element('p', selected.size ? '所选分类没有差异条目。' : '两张卡在当前页没有差异。'));
      content.append(list); list.scrollTop = listScroll;
      if (notice) { const status = element('small',notice,'cc-status'); status.setAttribute('role','status'); content.append(status); }
    } else {
      const index = sequence.indexOf(current);
      const nav = element('div','','cc-nav');
      if (!pair) for (const [delta,label] of [[-1,'上一个条目'],[1,'下一个条目']]) {
        const neighbor = sequence[index + delta];
        const arrow = button('',() => leaveBody(() => showRow(neighbor)));
        arrow.setAttribute('aria-label',label); arrow.title = label;
        arrow.append(element('i','','fa-solid fa-chevron-' + (delta < 0 ? 'up' : 'down')));
        arrow.disabled = !neighbor || !!pending; nav.append(arrow);
      }
      if (!pair) header.append(nav);
      const toggle = button(editing ? '高亮对照' : '双栏编辑',() => {
        editing = !editing; activeSide = null;
        redrawBody();
      });
      toggle.disabled = !!pending; header.append(toggle);
      const hint = element('small',editing ? '选中文字后点「取这段」，再到另一栏点落点或选中要替换的文字。' : '高亮处是正文差异。','cc-hint');
      const body = element('div','','cc-panes');
      const entries = [current.left,current.right];
      const keys = [...new Set(entries.flatMap(entry => Object.keys(entry?.fields ?? {})))];
      const shared = keys.filter(key => key !== '条目设置' && entries.every(entry => entry && Object.hasOwn(entry.fields,key)));
      const diffs = new Map(keys.filter(key => !editing && buffers.some(fields => fields?.[key]))
        .map(key => [key,buildHighlightedDiff(buffers[0]?.[key] ?? '',buffers[1]?.[key] ?? '')]));
      const footer = element('footer');
      let activeInput = null;
      const transfer = button('取这段',() => {
        if (!activeInput) return;
        const {selectionStart:start,selectionEnd:end,value,name} = activeInput;
        if (snippet && activeSide !== snippet.side) {
          undoPaste = { side:activeSide,key:name,value:buffers[activeSide][name],start,end,top:activeInput.scrollTop };
          activeInput.setRangeText(snippet.text,start,end,'end');
          buffers[activeSide][name] = activeInput.value;
          snippet = null;
          notice = start === end ? '已插入选段' : '已替换选段';
        } else if (end > start) {
          snippet = {side:activeSide,text:value.slice(start,end)};
          notice = '已取选段，请在另一栏定位。';
        }
        refreshTools();
      });
      const undo = button('撤销粘贴',() => {
        if (!undoPaste) return;
        const {side,key,value,start,end,top} = undoPaste;
        const pane = body.children[side];
        const field = [...pane.querySelectorAll('textarea')].find(input => input.name === key);
        buffers[side][key] = value; field.value = value;
        field.setSelectionRange(start,end); field.scrollTop = top;
        undoPaste = null; notice = '已撤销粘贴'; refreshTools();
      });
      // Keep native textarea selections when tapping a toolbar action.
      transfer.onpointerdown = undo.onpointerdown = event => event.preventDefault();
      syncSelection = () => { if (activeInput && doc.activeElement === activeInput) refreshTools(); };
      function refreshTools() {
        const paste = snippet && activeInput && activeSide !== snippet.side;
        const selected = activeInput && activeInput.selectionEnd > activeInput.selectionStart;
        const text = paste ? (selected ? '替换所选' : '插入到光标处') : '取这段';
        if (transfer.textContent !== text) transfer.textContent = text;
        transfer.disabled = !paste && !selected;
        undo.hidden = !undoPaste;
        save.disabled = !changed(0) && !changed(1);
        if (status.textContent !== notice) status.textContent = notice;
        [...body.children].forEach((pane,i) => {
          const preview = pane.querySelector('.cc-preview-text');
          const text = snippet?.side === i
            ? snippet.text.slice(0,80) : (buffers[i]?.正文 || Object.values(buffers[i] || {})[0] || '').slice(0,80);
          if (preview.textContent !== text) preview.textContent = text;
        });
      }
      entries.forEach((entry,i) => {
        const pane = element('section','','cc-pane');
        const strip = element('div','','cc-pane-head');
        const sideTitle = (pair ? [sides[i],entry.title] : [sides[i],cards[i].name,cards[i].version]).filter(Boolean).join(' · ');
        const label = element('h3',sideTitle); label.title = sideTitle; strip.append(label);
        const copy = button(i ? '整段 B→A':'整段 A→B',() => {
          shared.forEach(key => { buffers[1-i][key] = buffers[i][key]; });
          undoPaste = snippet = null; notice = ''; redrawBody();
        });
        copy.disabled = !shared.length || !!pending;
        if (pair && !shared.length) copy.title = '所选条目没有共同的可复制字段';
        strip.append(copy);
        const scroll = element('div','','cc-pane-scroll');
        scroll.tabIndex = 0; scroll.setAttribute('aria-label',sideTitle + '正文');
        const preview = button('',() => {
          const target = scroll.querySelector('textarea');
          if (target) { activeSide = i; fit(); target.focus({preventScroll:true}); }
        },'cc-preview-text');
        preview.setAttribute('aria-label','切换到' + sideTitle);
        strip.onclick = event => { if (!event.target.closest('button') && dialog.classList.contains('cc-keyboard') && activeSide !== i) preview.click(); };
        pane.append(strip,preview,scroll); body.append(pane);
        if (!entry) { scroll.append(element('p','此卡没有这一项')); return; }
        if (!pair && !editing && entries[0] && entries[1] && entries[0].title !== entries[1].title) scroll.append(element('strong',entry.title));
        for (const key of Object.keys(entry.fields)) {
          const canEdit = key !== '条目设置';
          if (editing && canEdit) {
            const field = element('label',key), input = element('textarea');
            input.name = key; input.value = buffers[i][key]; input.disabled = !!pending;
            input.dataset.bodyField = key;
            input.onfocus = () => { activeInput = input; activeSide = i; fit(); refreshTools(); };
            input.onselect = input.onkeyup = input.onpointerup = input.onclick = input.onselectionchange = () => {
              if (activeInput === input) refreshTools();
            };
            input.oninput = () => {
              buffers[i][key] = input.value;
              if (undoPaste?.side === i && undoPaste.key === key) undoPaste = null;
              notice = ''; refreshTools();
            };
            field.append(input); scroll.append(field);
          } else if (diffs.has(key)) {
            const pre = element('pre');
            pre.innerHTML = i ? diffs.get(key).rightHtml : diffs.get(key).leftHtml;
            pre.dataset.bodyField = key;
            if (canEdit && !pending) pre.onclick = () => toggle.click();
            scroll.append(element('h4',canEdit ? key : key + '（只读）'),pre);
          }
        }
      });
      const status = element('small',notice,'cc-status');
      status.setAttribute('role','status');
      const save = button('应用到草稿',() => { apply(); redrawBody(); });
      save.disabled = !changed(0) && !changed(1);
      if (pending) {
        const next = pending;
        footer.append(element('small','有修改尚未应用。'),
          button('继续编辑',() => { pending = null; redrawBody(); },'cc-keep'),
          button('放弃修改',() => { pending = null; next(); }),
          button('应用并继续',() => {
            pending = null;
            if (apply()) next(); else redrawBody();
          }));
      } else {
        if (editing && entries.every(Boolean)) footer.append(transfer,undo);
        footer.append(status,save);
      }
      content.append(hint,body,footer);
      refreshTools();
    }
  }
}

const css = `
dialog.pmm-character-compare {
  color:var(--pm-text-primary,var(--SmartThemeBodyColor,#eee)); background:var(--pm-panel-bg,#202125);
  border:1px solid var(--pm-border,#7776); border-radius:14px; padding:0; margin:auto;
  width:min(660px, 96vw); max-width:96vw; box-sizing:border-box; font:inherit;
  max-height:90vh; max-height:90dvh; overflow:hidden;
}
.pmm-character-compare::backdrop {background:#0008}
.pmm-character-compare .cc-content {display:flex;flex-direction:column;gap:12px;padding:16px;max-height:89vh;max-height:89dvh;box-sizing:border-box;overflow:auto}
.pmm-character-compare :is(header,footer,.cc-actions,.cc-tabs,.cc-nav) {display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pmm-character-compare header {flex-wrap:nowrap}
.pmm-character-compare h2 {font:inherit;font-weight:650;flex:1;min-width:0;overflow-wrap:anywhere;margin:0}
.pmm-character-compare :is(h3,h4,p,ul,pre) {margin:0}
.pmm-character-compare h3,.pmm-character-compare h4 {font-size:.88em}
.pmm-character-compare :is(button,select) {font:inherit;color:inherit;background:var(--pm-card-bg,#8882);border:0;border-radius:7px;padding:6px 10px;cursor:pointer}
.pmm-character-compare :is(button,select):disabled {opacity:.48;cursor:default}
.pmm-character-compare select {max-width:100%;min-width:0}
.pmm-character-compare option {color:CanvasText;background:Canvas}
.pmm-character-compare [aria-pressed=true] {box-shadow:inset 0 0 0 1.5px var(--cc-category,var(--pm-accent,currentColor))}
.pmm-character-compare .cc-tabs button {min-width:32px}
.pmm-character-compare :is(.cc-panels,.cc-list) {min-height:0;overflow:auto;overscroll-behavior:contain}
.pmm-character-compare .cc-panel {display:grid;gap:8px;padding:12px;background:var(--pm-card-bg,#8882);border-radius:9px;overflow-wrap:anywhere}
.pmm-character-compare .cc-panel + .cc-panel {margin-top:10px}
.pmm-character-compare .cc-preview {font-size:.86em;max-height:16vh;overflow:auto;padding-inline-start:1.5em}
.pmm-character-compare .cc-stats {display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:3px}
.pmm-character-compare .cc-stats button {display:grid;text-align:center;gap:3px;font-size:.77em;padding:6px 2px}
.pmm-character-compare .cc-stats strong,.pmm-character-compare .cc-row small {color:var(--cc-category)}
.pmm-character-compare .cc-stats strong {font-size:1.4em}
.pmm-character-compare .cc-stats button:disabled {opacity:1}
.pmm-character-compare .cc-row {display:flex;width:100%;align-items:center;justify-content:space-between;text-align:start;background:transparent;padding:9px 3px;gap:8px;overflow-wrap:anywhere}
.pmm-character-compare .cc-row small {flex-shrink:0}
.pmm-character-compare .cc-insert-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(4em,24%) auto;align-items:center;gap:4px}
.pmm-character-compare .cc-insert-row select{min-width:0;font-size:.82em}
.pmm-character-compare .cc-insert-row>button:last-child{font-size:.84em}
.pmm-character-compare footer {justify-content:flex-end}
.pmm-character-compare pre {white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}
.pmm-character-compare mark {background:#e5ab3b55;color:inherit}
dialog.pmm-character-compare.cc-reading {position:fixed;inset:50% 0 auto;top:calc(var(--cc-offset,0px) + min(50dvh, var(--cc-viewport,100dvh) / 2));margin:0 auto;transform:translateY(-50%)}
.pmm-character-compare.cc-reading .cc-content {
  display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:8px;padding:10px;
  height:min(86vh,820px);height:min(86dvh,calc(var(--cc-viewport,100dvh) * .86),820px);
  max-height:none;overflow:hidden;
}
.pmm-character-compare.cc-reading header h2 {text-align:center;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.pmm-character-compare .cc-hint,.pmm-character-compare .cc-status {font-size:.8em;opacity:.8}
.pmm-character-compare .cc-panes {display:grid;grid-template-rows:repeat(2,minmax(0,1fr));min-height:0;gap:8px}
.pmm-character-compare .cc-pane {display:grid;grid-template-rows:auto minmax(0,1fr);min-height:0;min-width:0;overflow:hidden;
  border:1px solid var(--pm-border,#8885);border-radius:10px;background:var(--pm-card-bg,#8882)}
.pmm-character-compare .cc-pane-head {display:flex;align-items:center;gap:4px;padding:4px 7px;border-bottom:1px solid var(--pm-border,#8884)}
.pmm-character-compare .cc-pane-head h3 {min-width:0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pmm-character-compare .cc-pane-head button {padding:4px 8px;font-size:.84em}
.pmm-character-compare .cc-pane-scroll {min-height:0;min-width:0;overflow:auto;overscroll-behavior:contain;padding:8px;line-height:1.5}
.pmm-character-compare .cc-pane-scroll h4 {opacity:.7}
.pmm-character-compare .cc-pane-scroll :is(pre,label) {display:block;margin:0 0 .5em}
.pmm-character-compare .cc-pane-scroll textarea {display:block;width:100%;box-sizing:border-box;min-height:5em;height:11em;
  resize:vertical;font:inherit;color:inherit;background:var(--pm-panel-bg,#8881);border:1px solid var(--pm-border,#8885);border-radius:5px}
.pmm-character-compare.cc-reading footer {gap:4px}
.pmm-character-compare.cc-reading footer small {flex:1;min-width:0}
.pmm-character-compare .cc-preview-text{display:none}
.pmm-character-compare .cc-pane-scroll:has(textarea) label:only-child{height:100%;min-height:0;display:flex;flex-direction:column;margin:0}
.pmm-character-compare .cc-pane-scroll label:only-child textarea{flex:1;min-height:2em;resize:none}
@media(pointer:coarse){.pmm-character-compare .cc-pane-scroll textarea{font-size:max(16px,1em)}}
dialog.pmm-character-compare.cc-keyboard{top:var(--cc-offset);transform:none;width:min(660px,100vw);max-width:100vw;max-height:var(--cc-viewport)}
.pmm-character-compare.cc-keyboard .cc-content{height:var(--cc-viewport);grid-template-rows:auto minmax(0,1fr) auto;gap:3px;padding:4px}
.pmm-character-compare.cc-keyboard .cc-hint{display:none}
.pmm-character-compare.cc-keyboard[data-active-side="0"] .cc-panes{grid-template-rows:minmax(0,1fr) auto}
.pmm-character-compare.cc-keyboard[data-active-side="1"] .cc-panes{grid-template-rows:auto minmax(0,1fr)}
.pmm-character-compare.cc-keyboard[data-active-side="0"] .cc-pane:last-child .cc-pane-scroll,
.pmm-character-compare.cc-keyboard[data-active-side="1"] .cc-pane:first-child .cc-pane-scroll{display:none}
.pmm-character-compare.cc-keyboard[data-active-side="0"] .cc-pane:last-child .cc-preview-text,
.pmm-character-compare.cc-keyboard[data-active-side="1"] .cc-pane:first-child .cc-preview-text{display:block;text-align:start;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;padding:2px 7px;font-size:.8em;min-height:1.5em}
.pmm-character-compare.cc-keyboard footer .cc-status{white-space:nowrap;text-overflow:ellipsis;overflow:hidden}
@media(max-height:500px){.pmm-character-compare.cc-reading .cc-content{gap:3px;padding:5px}.pmm-character-compare .cc-hint{display:none}.pmm-character-compare.cc-reading .cc-content{grid-template-rows:auto minmax(0,1fr) auto}}
`;
