import { compareCards, personaFields, readCard, readCardFile } from './character-card-core.js?v=2.98.67-card.10';
import { attachBook, changeBookEntry, changeCard, dataOf, exportBlob, installedRaw, itemsOf, localCards, putItems, saveInstalled, transferItems, openInstalled } from './character-card-draft.js?v=2.98.67-card.10';
import { cardDiffStyles, showCharacterResults } from './character-card-compare.js?v=2.98.67-card.10';
import { confirmWorkshopClose } from './workshop-editing.js?v=2.98.49';
import { runtimeResource } from './runtime-resources.js';

import { editBookFields, worldEntryView, embeddedBook } from './character-card-world.js?v=2.98.67-card.10';

const names = ['A 旧卡', 'B 新卡'];
const fresh = () => ({ card: null, saved: null, avatar: '', key: '', png: null, undo: [], selected: new Set(), multi: false, expanded: -1, search: false, query: '', notice: '' });
export function openCharacterCompare(opener, entryUI) {
  const doc = opener.ownerDocument, win = doc.defaultView;
  const host = opener.closest('#preset-manager-main-panel'), container = host?.querySelector('.pm-panel-container');
  const wrapper = container?.querySelector('.pm-main-wrapper');
  if (!wrapper) return;
  const previous = win.__PMM_CHARACTER_CARDS__;
  if (previous?.host === host) return previous.exit();
  previous?.cleanup();
  const ctx = win.SillyTavern?.getContext?.();
  let states = [fresh(), fresh()], book = false, busy = false, popup = null, pointer = null;
  let comparing = false, pairing = false, picks = [null,null], marks = [new Map(),new Map()];
  const style = node('style'); style.textContent = css;
  host.append(style);
  const panels = names.map((name, i) => {
    const panel = node('section', '', 'cc-work-panel');
    panel.dataset.ccSide = String(i);
    panel.setAttribute('aria-label', name);
    return panel;
  });
  wrapper.insertBefore(panels[0], opener.closest('.side-panel-root'));
  container.append(panels[1]); host.classList.add('cc-work-mode');
  opener.setAttribute('aria-pressed', 'true');
  const observe = new MutationObserver(() => { if (!host.isConnected) cleanup(); });
  runtimeResource(observe).observe(host.parentNode, { childList: true });
  host.addEventListener('click', switchMode, true);
  win.__PMM_CHARACTER_CARDS__ = { host, dirtyDrafts, cleanup, get busy() { return busy; }, exit: () => guard([0,1], cleanup) };
  entryUI.installStyle();
  entryUI.refreshFavoriteIndex();
  draw();

  function node(tag, text = '', cls = '') {
    const el = doc.createElement(tag); if (text) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  }
  function button(label, fn, icon) {
    const el = node('button', icon ? '' : label);
    el.type = 'button'; el.title = label; el.setAttribute('aria-label', label);
    if (icon) { const i = node('i', '', 'fa-solid fa-' + icon); i.setAttribute('aria-hidden','true'); el.append(i); }
    el.onclick = fn; return el;
  }
  function cleanup() {
    host.querySelector('.pmm-wb-editor-overlay')?.remove();
    endDrag(); observe.disconnect(); popup?.remove(); popup = null;
    host.querySelector('dialog.pmm-character-compare[open]')?.close();
    host.removeEventListener('click',switchMode,true);
    host.classList.remove('cc-work-mode'); opener.removeAttribute('aria-pressed');
    panels.forEach(p => p.remove()); style.remove();
    if (win.__PMM_CHARACTER_CARDS__?.host === host) delete win.__PMM_CHARACTER_CARDS__;
  }
  function switchMode(event) {
    const btn = event.target.closest?.('.side-panel-root .panel-btn');
    if (!btn || btn === opener) return;
    event.stopImmediatePropagation(); event.preventDefault();
    guard([0,1], () => { cleanup(); btn.click(); });
  }
  function dirty(s) { return s.card !== s.saved; }
  function dirtyDrafts(indices = [0,1]) {
    return indices.filter(i => dirty(states[i])).map(i => {
      const s = states[i];
      return { label: names[i] + ' · ' + s.card.name, name:s.card.name, destination:'card:' + (s.avatar || s.key),
        read:() => s.card.raw, dirty:() => dirty(s), save:() => save(i),
        discard:() => { s.card = s.saved; s.undo = []; draw(); } };
    });
  }
  function guard(indices, action) {
    if (busy) return;
    return confirmWorkshopClose(host, () => dirtyDrafts(indices), action);
  }
  function modal(label) {
    popup?.remove();
    const el = node('dialog', '', 'cc-work-dialog'); el.setAttribute('aria-label', label);
    const head = node('header'); head.append(node('strong',label),button('关闭', () => el.close(),'xmark'));
    el.append(head); host.append(el);
    el.addEventListener('close', () => { if (popup === el) popup = null; el.remove(); }, {once:true});
    popup = el; el.showModal(); return el;
  }
  function commit(i, card) {
    const s = states[i];
    if (JSON.stringify(s.card.raw) === JSON.stringify(card.raw)) return;
    s.undo.push(s.card); if (s.undo.length > 24) s.undo.shift();
    s.card = card; s.selected.clear(); s.notice = ''; draw();
  }
  async function run(i, action) {
    if (busy) return;
    busy = true; draw();
    try { await action(); }
    catch (error) { states[i].notice = error.message || String(error); }
    finally { busy = false; if (host.isConnected && panels[i].isConnected) draw(); }
  }
  async function save(i) {
    const s = states[i];
    let bookSynced = false;
    if (s.avatar) bookSynced = await saveInstalled(win, ctx, s.avatar, s.saved, s.card, s.source);
    else await localCards(win, 'put', s.key, { raw: s.card.raw, png: s.png }, s.saved.raw);
    if (bookSynced) {
      const peer = states[1-i];
      if (peer.avatar && peer.card.binding === s.card.binding) {
        if (JSON.stringify(dataOf(peer.card).character_book) === JSON.stringify(dataOf(peer.saved).character_book)) {
          const fields = { character_book:embeddedBook(s.source.world,dataOf(peer.card).character_book,s.card.binding) };
          const previousSaved = peer.saved;
          peer.saved = changeCard(previousSaved,fields);
          const rebase = card => card === previousSaved ? peer.saved : changeCard(card,fields);
          peer.card = rebase(peer.card);
          peer.undo = peer.undo.map(rebase);
          peer.source.world = structuredClone(s.source.world);
        } else peer.notice = '另一侧已保存这本世界书，这里的草稿仍保留。';
      }
      try { await win.__PMM_WORLDBOOK_STITCH_TEST3__?.refreshSnapshotBook(s.card.binding,s.source.world,true); }
      catch (error) { console.warn('世界书已保存，刷新世界书面板失败',error); }
    }
    s.saved = s.card; s.notice = s.avatar ? (bookSynced ? '已保存角色卡，同步世界书「' + s.card.binding + '」' : '已保存到酒馆角色卡') : '已保存在本机，可从卡名菜单重新打开';
    draw();
  }
  async function download(i) {
    const s = states[i], blob = await exportBlob(s.card, s.png);
    const url = win.URL.createObjectURL(blob), link = node('a');
    link.href = url; link.download = [s.card.name, s.card.version].filter(Boolean).join(' ') + (s.png ? '.png' : '.json');
    host.append(link); link.click(); link.remove();
    win.setTimeout(() => win.URL.revokeObjectURL(url), 30000);
  }
  function filePick(el, label, accept, read) {
    const input = node('input'); input.type = 'file'; input.accept = accept; input.hidden = true;
    input.onchange = () => { if (input.files[0]) read(input.files[0]); };
    el.append(input,button(label, () => input.click()));
  }
  function choose(i) {
    const dlg = modal(names[i] + ' · 选择角色卡');
    function replace(reader) {
      dlg.close();
      guard([i], () => run(i, async () => {
        const loaded = await reader();
        const s = Object.assign(fresh(),loaded);
        s.saved = s.card;
        s.key ||= [s.card.name, s.card.version, win.crypto.randomUUID?.() || String(Math.random())].join('｜');
        states[i] = s;
      }));
    }
    filePick(dlg,'导入角色卡文件','.png,.json', file => replace(async () => ({
      card:await readCardFile(file), png: /\.png$/i.test(file.name) || file.type === 'image/png' ? file : null,
    })));
    function select(label, options, action) {
      if (!options.length) return;
      const sel = node('select'); sel.setAttribute('aria-label', label);
      sel.append(new win.Option(label,''));
      for (const [key, title] of options) sel.append(new win.Option(title,key));
      sel.onchange = () => { if (sel.value) action(sel.value); }; dlg.append(sel);
    }
    function pickInstalled(avatar) { replace(async () => {
      let record = ctx.characters.find(c => c?.avatar === avatar);
      if (!record?.data || record.shallow) {
        const res = await win.fetch('/api/characters/get',{method:'POST',headers:ctx.getRequestHeaders(),body:JSON.stringify({avatar_url:avatar})});
        if (!res.ok) throw Error('无法读取酒馆角色卡'); record = await res.json();
      }
      return { ...await openInstalled(ctx,readCard(structuredClone(installedRaw(record)))), avatar };
    }); }
    const tavern = button('从酒馆选择', () => {
      if (dlg.querySelector('.cc-character-picker')) return;
      const picker = node('div','','cc-character-picker');
      const input = node('input'); input.type = 'search'; input.placeholder = '搜索角色名';
      input.setAttribute('aria-label',input.placeholder);
      const list = node('div','','cc-character-options');
      const normalize = text => String(text || '').normalize('NFKC').trim().toLocaleLowerCase();
      const counts = new Map(), characters = [];
      const avatars = new Set();
      for (const c of ctx?.characters || []) {
        if (!c?.avatar || avatars.has(c.avatar)) continue;
        avatars.add(c.avatar);
        const title = c.name || c.avatar.replace(/\.png$/i,'');
        const name = normalize(title);
        counts.set(name,(counts.get(name) || 0) + 1);
        characters.push({title,name,avatar:c.avatar,filename:normalize(c.avatar)});
      }
      function render(limit = 80) {
        const query = normalize(input.value);
        const matches = characters.filter(c => c.name.includes(query) || c.filename.includes(query));
        list.replaceChildren();
        for (const c of matches.slice(0,limit)) {
          const label = counts.get(c.name) > 1 ? c.title + ' · ' + c.avatar : c.title;
          list.append(button(label,() => pickInstalled(c.avatar)));
        }
        if (!matches.length) list.append(node('small',characters.length ? '没有找到匹配的角色卡' : '酒馆里暂无角色卡'));
        if (matches.length > limit) list.append(button('显示更多',() => render(limit + 80)));
      }
      input.oninput = () => { render(); list.scrollTop = 0; };
      picker.append(input,list); tavern.replaceWith(picker); render(); input.focus();
    });
    dlg.append(tavern);
    localCards(win,'list').then(keys => {
      if (dlg.open) select('打开本机保存的卡',keys.map(k => [k,k.split('｜').slice(0,-1).filter(Boolean).join(' · ')]),key => replace(async () => {
        const value = await localCards(win,'get',key);
        return { card:readCard(value.raw), png:value.png, key };
      }));
    }).catch(() => { if (dlg.open) dlg.append(node('small','本机保存空间暂不可用')); });
  }
  function editor(i,entry,index,field) {
    const s = states[i], start = s.card;
    const persona = !book && index < 0;
    const sections = persona ? personaFields.map(([label]) => ({label,value:entry.fields[label]})) : undefined;
    entryUI.openTextEditor({
      host, title:entry.title, original:sections?.[0].value ?? entry.fields.正文, sections,
      ariaLabel:'编辑' + entry.title, sourceField:field, themeNodes:[panels[i]], searchable:true,
      onSave(value) {
        if (s.card !== start) { s.notice = '角色卡已变化，请重新打开条目。'; draw(); return; }
        if (persona) {
          const changes = {};
          personaFields.forEach(([,key],n) => { if (sections[n].value !== value[n]) changes[key] = value[n]; });
          commit(i,changeCard(s.card,changes));
        } else {
          const items = itemsOf(s.card,book).slice();
          items[index] = book ? {...items[index],content:value} : value;
          commit(i,putItems(s.card,book,items));
        }
      }
    });
  }
  function bookRow(i,index,entry,raw) {
    const s = states[i], sideName = s.avatar && s.card.binding ? s.card.binding : s.key;
    const view = worldEntryView(raw,index), key = String(view.uid);
    const side = { name:sideName, multi:s.multi, selected:new Set(s.selected.has(index) ? [key] : []),
      expanded:new Set(s.expanded === index ? [key] : []) };
    const template = node('template');
    template.innerHTML = entryUI.renderEntry('character',side,view);
    const row = template.content.firstElementChild;
    row.classList.add('cc-work-row');
    row.draggable = false; row.dataset.ccIndex = String(index);
    row.removeAttribute('data-wb-drag-side'); row.removeAttribute('data-wb-drag-key');
    const gear = row.querySelector('.pmm-wb-expand');
    gear.classList.add('cc-grip'); gear.setAttribute('aria-label','编辑' + entry.title);
    gear.setAttribute('aria-expanded',String(s.expanded === index));
    gear.onpointerdown = e => beginDrag(e,i,index);
    for (const el of row.querySelectorAll('[data-wb-action],[data-wb-field]')) {
      if (el.dataset.wbAction) el.dataset.ccAction = el.dataset.wbAction;
      if (el.dataset.wbField) el.dataset.ccField = el.dataset.wbField;
      for (const attr of ['data-wb-action','data-wb-field','data-wb-key','data-wb-side']) el.removeAttribute(attr);
      el.disabled = busy;
    }
    function update(changes, input) {
      const current = itemsOf(s.card,true)[index];
      const next = changeBookEntry(s.card,index,editBookFields(current,changes));
      if (!input) return commit(i,next);
      // Keep the focused field and its caret alive. One editing session is one panel undo.
      if (!input.dataset.ccEditing) { s.undo.push(s.card); if (s.undo.length > 24) s.undo.shift(); input.dataset.ccEditing = '1'; }
      s.card = next; s.notice = '';
      const panel = panels[i];
      panel.querySelector('[aria-label="撤回"]').disabled = false;
      const save = panel.querySelector('[aria-label="保存"]'); save.disabled = false; save.classList.add('cc-dirty');
      panel.querySelector('[role=status]')?.remove();
    }
    row.onfocusout = e => {
      const input = e.target;
      delete input.dataset.ccEditing;
      if (input.type === 'number' && !Number.isFinite(input.valueAsNumber)) {
        const current = worldEntryView(itemsOf(s.card,true)[index],index);
        input.value = current[input.dataset.ccField] ?? input.defaultValue;
      }
    };
    row.oninput = e => {
      const input = e.target, field = input.dataset.ccField;
      if (!field || field === 'positionRole' || busy) return;
      let value = input.value;
      if (input.type === 'number') { if (!Number.isFinite(input.valueAsNumber)) return; value = input.valueAsNumber; }
      if (field === 'key') value = value.split(/[,，]/).map(k=>k.trim()).filter(Boolean);
      update({[field]:value},input);
      if (field === 'content') row.querySelector('.pmm-wb-content-tools small').textContent = value.length + ' 字符';
      if (field === 'comment') row.querySelector('.pmm-wb-entry-title').textContent = value || '未命名条目';
    };
    row.onchange = e => {
      if (busy || e.target.dataset.ccField !== 'positionRole') return;
      const [position,role] = e.target.value.split(':').map(Number);
      update(position === 4 ? {position,role} : {position});
    };
    row.onclick = e => {
      const action = e.target.closest('[data-cc-action]')?.dataset.ccAction;
      if (!action || busy) return;
      const items = itemsOf(s.card,true), current = worldEntryView(items[index],index);
      switch (action) {
        case 'expand': s.expanded = s.expanded === index ? -1 : index; return drawSide(i);
        case 'select': s.selected.has(index) ? s.selected.delete(index) : s.selected.add(index); return drawSide(i);
        case 'strategy': return update(current.constant ? {constant:false} : {constant:true,vectorized:false});
        case 'toggle': return update({disable:!current.disable});
        case 'content-expand': return editor(i,s.card.book[index],index,row.querySelector('textarea'));
        case 'duplicate-entry': return commit(i,transferItems(s.card,s.card,true,[index],index+1,false));
        case 'delete-entry': s.expanded = -1; return commit(i,putItems(s.card,true,items.filter((_,n)=>n !== index)));
        case 'favorite': case 'update-favorite': return run(i,async () => {
          s.notice = await win.__PMM_SHARED_FAVORITES__.saveWorld(sideName,current,action === 'update-favorite');
          entryUI.refreshFavoriteIndex();
        });
      }
    };
    return row;
  }
  function readyToCompare() { return states.every(s => s.card && (!book || s.card.book)); }
  function openResults(opener, pair = null) {
    showCharacterResults(opener,states.map(s=>s.card),book ? 'book':'persona', (before, next) => {
      if (busy || before.some((card, i) => card !== states[i].card)) throw Error('角色卡已变化，请重新比对。');
      next.forEach((card, i) => { if (card !== before[i]) commit(i,card); });
      return states.map(s => s.card);
    },pair);
  }
  function draw() {
    if (!readyToCompare()) comparing = false;
    if (!comparing) pairing = false;
    marks = [new Map(),new Map()];
    if (comparing) for (const row of compareCards(states[0].card,states[1].card,book ? 'book':'persona')) {
      [row.left,row.right].forEach((entry,i) => { if (entry) marks[i].set(entry.index ?? -1,row.status); });
    }
    picks = picks.map((pick,i) => pairing && pick?.card === states[i].card && pick.book === book ? pick : null);
    panels.forEach((_,i) => drawSide(i));
  }
  function drawSide(i) {
    const panel = panels[i], s = states[i], card = s.card;
    const previousScroll = panel.querySelector('.cc-work-list')?.scrollTop || 0;
    const header = node('header','','pmm-wb-header'), list = node('div','','cc-work-list pmm-wb-list');
    panel.replaceChildren(header);
    const title = [names[i], card ? [card.name, card.version].filter(Boolean).join(' ') : '选择角色卡'].join(' · ');
    const pick = button(title,() => choose(i)); pick.className = 'cc-title'; pick.disabled = busy;
    pick.replaceChildren(node('small',names[i]), node('span',card?.name || '选择角色卡'));
    if (card?.version) pick.append(node('em',card.version));
    pick.append(node('i','','fa-solid fa-chevron-down')); header.append(pick);
    function tool(label, icon, fn, disabled = false, pressed) {
      const b = button(label,fn,icon); b.disabled = busy || disabled;
      if (pressed !== undefined) b.setAttribute('aria-pressed',String(pressed));
      header.append(b); return b;
    }
    tool('导出','file-export',() => run(i,() => download(i)),!card);
    if (i === 0) {
      for (const [v,label,icon] of [[false,'人设','user'],[true,'绑定世界书','book-open']]) {
        tool(label,icon,() => { book = v; states.forEach(s => { s.selected.clear(); s.query = ''; }); draw(); },false,v === book);
      }
    } else tool('对比模式','code-compare',() => { comparing = !comparing; draw(); },!readyToCompare(),comparing);
    tool('多选','check-double',() => { s.multi = !s.multi; s.selected.clear(); drawSide(i); },!card || comparing,!comparing && s.multi);
    tool('撤回','rotate-left',() => { s.card = s.undo.pop(); s.expanded = -1; s.selected.clear(); s.notice = ''; draw(); },!s.undo.length);
    tool('搜索','magnifying-glass',() => { s.search = !s.search; s.query = ''; drawSide(i); panel.querySelector('input[type=search]')?.focus(); },!card,s.search);
    const saveBtn = tool('保存','floppy-disk',() => run(i,() => save(i)),!card || (s.avatar && !dirty(s)));
    saveBtn.classList.toggle('cc-dirty',dirty(s));
    tool('关闭预设工坊','xmark',() => win.__PMM_WORKSHOP_EDITING__.closeMain());
    if (comparing && i === 1) {
      const actions = node('div','','cc-compare-tools');
      const single = button('单个对比',() => { pairing = !pairing; picks = [null,null]; draw(); });
      single.setAttribute('aria-pressed',String(pairing));
      const details = button('查看对比详情',e => openResults(e.currentTarget));
      single.disabled = details.disabled = busy;
      actions.append(single,details);
      if (pairing) {
        const inspect = button('对比所选',e => openResults(e.currentTarget,picks.map(pick => pick.entry)));
        inspect.disabled = busy || !picks.every(Boolean);
        actions.append(inspect,node('small','上下各选一项'));
      }
      panel.append(actions);
    }
    if (s.search) {
      const input = node('input'); input.type = 'search'; input.placeholder = '搜索本卡条目'; input.value = s.query;
      input.oninput = () => { s.query = input.value; s.selected.clear(); fill(); }; panel.append(input);
    }
    if (s.notice) { const msg = node('small',s.notice); msg.setAttribute('role','status'); panel.append(msg); }
    panel.append(list);
    function fill() {
      list.replaceChildren();
      if (!card) { list.append(button('选择或导入角色卡',() => choose(i))); return; }
      if (book && !card.book) {
        list.append(node('p','卡内仅记录书名「' + card.binding + '」，请选择对应版本。'));
        filePick(list,'导入绑定世界书副本','.json',file => run(i,async () => commit(i,attachBook(card,JSON.parse(await file.text()),file.name))));
        if (ctx?.loadWorldInfo) list.append(button('使用酒馆中的同名书',() => run(i,async () => commit(i,attachBook(card,await ctx.loadWorldInfo(card.binding),card.binding)))));
        return;
      }
      const entries = book ? card.book : [card.persona,...itemsOf(card,false).map((text,index) => ({
        index, title:'开场白 ' + (index+1), fields:{正文:String(text)},
      }))];
      const rawEntries = book ? itemsOf(card,true) : null;
      for (const [pos,entry] of entries.entries()) {
        const index = book ? pos : entry.index ?? -1;
        const text = [entry.title,...Object.values(entry.fields)].join(' ');
        if (s.query && !text.toLocaleLowerCase().includes(s.query.toLocaleLowerCase())) continue;
        if (comparing) {
          const row = node('div','','cc-work-row cc-diff-row');
          row.dataset.ccIndex = String(index);
          const label = node(pairing ? 'label' : 'span','','cc-diff-title');
          if (pairing) {
            const check = node('input'); check.type = 'checkbox'; check.checked = picks[i]?.index === index;
            check.setAttribute('aria-label','选择对比' + entry.title);
            check.disabled = busy;
            check.onchange = () => {
              const previous = picks[i];
              if (previous && previous.index !== index) {
                const other = list.querySelector('[data-cc-index="'+previous.index+'"] input');
                if (other) other.checked = false;
              }
              picks[i] = check.checked ? {card,book,index,entry} : null;
              panels[1].querySelector('button[aria-label="对比所选"]').disabled = !picks.every(Boolean);
            };
            label.append(check);
          }
          label.append(node('span',entry.title + (!book && index >= 0 ? ' · '+entry.fields.正文.trim().slice(0,60) : '')));
          row.append(label);
          const style = cardDiffStyles.get(marks[i].get(index));
          if (style) {
            row.style.setProperty('--cc-category',style.color);
            row.append(node('small',style.label));
          }
          list.append(row); continue;
        }
        if (book) { list.append(bookRow(i,index,entry,rawEntries[index])); continue; }
        const row = node('div','','cc-work-row pmm-wb-entry'); const head = node('div','','pmm-wb-entry-head'); row.append(head); row.dataset.ccIndex = String(index);
        if (index >= 0) {
          if (s.multi) {
            const check = node('input'); check.type = 'checkbox'; check.checked = s.selected.has(index);
            check.setAttribute('aria-label','选择' + entry.title);
            check.onchange = () => check.checked ? s.selected.add(index) : s.selected.delete(index); head.append(check);
          }
          const handle = button('拖动' + entry.title,() => {},'grip-vertical'); handle.className = 'cc-grip';
          handle.disabled = busy;
          handle.onpointerdown = e => beginDrag(e,i,index); head.append(handle);
        } else head.append(node('i','','fa-solid fa-user cc-person'));
        const label = !book && index >= 0 ? entry.title + ' · ' + entry.fields.正文.trim().slice(0,60) : entry.title;
        const name = button(label,() => { if (!busy) editor(i,entry,index,row); });
        name.className = 'cc-row-title pmm-wb-entry-title';
        name.setAttribute('aria-label','编辑' + entry.title);
        head.append(name); list.append(row);
      }
      if (!list.childElementCount) list.append(node('p',s.query ? '没有匹配的条目' : '暂无条目'));
    }
    fill(); list.scrollTop = previousScroll;
  }

  function endDrag() {
    if (!pointer) return;
    pointer.abort.abort(); pointer.mark?.classList.remove('cc-drop-before','cc-drop-after');
    pointer.handle.classList.remove('cc-dragging'); pointer = null;
  }
  function beginDrag(e, side, index) {
    if (busy || !e.isPrimary || e.button !== 0) return;
    endDrag(); e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture?.(e.pointerId);
    const abort = new win.AbortController(), options = {signal:abort.signal};
    pointer = {abort,handle,mark:null};
    function locate(ev) {
      const hit = doc.elementFromPoint(ev.clientX,ev.clientY);
      const list = hit?.closest('.cc-work-list');
      const targetSide = panels.indexOf(list?.closest('.cc-work-panel'));
      const card = states[targetSide]?.card;
      if (!card || (book && !card.book)) return null;
      const rect = list.getBoundingClientRect();
      if (ev.clientY < rect.top + 22) list.scrollTop -= 18;
      if (ev.clientY > rect.bottom - 22) list.scrollTop += 18;
      const row = hit.closest('.cc-work-row'), n = row ? Number(row.dataset.ccIndex) : itemsOf(card,book).length;
      const after = row && n >= 0 && ev.clientY > row.getBoundingClientRect().top + row.offsetHeight/2;
      return { side:targetSide, at:Math.max(0,n + (after ? 1 : 0)), mark:row || list, cls:after ? 'cc-drop-after':'cc-drop-before' };
    }
    let moved = false;
    handle.addEventListener('pointermove',ev => {
      if (ev.pointerId !== e.pointerId || (!moved && Math.hypot(ev.clientX-e.clientX,ev.clientY-e.clientY) < 5)) return;
      moved = true; handle.classList.add('cc-dragging');
      pointer.mark?.classList.remove('cc-drop-before','cc-drop-after');
      const target = locate(ev);
      if (target) { pointer.mark = target.mark; target.mark.classList.add(target.cls); }
    },options);
    handle.addEventListener('pointerup',ev => {
      const target = moved && locate(ev); endDrag();
      if (!target) return;
      const suppressClick = e => { e.preventDefault(); e.stopPropagation(); };
      handle.addEventListener('click',suppressClick,{once:true,capture:true});
      win.setTimeout(() => handle.removeEventListener('click',suppressClick,true),0);
      const source = states[side], dest = states[target.side];
      const indices = source.multi && source.selected.has(index) ? source.selected : [index];
      dest.expanded = -1;
      commit(target.side,transferItems(source.card,dest.card,book,indices,target.at,target.side === side));
    },options);
    handle.addEventListener('lostpointercapture',endDrag,options);
    handle.addEventListener('pointercancel',endDrag,options);
  }
}

const css = `
#preset-manager-main-panel.cc-work-mode .pm-panel-container{display:grid!important;grid-template: minmax(0,1fr) auto minmax(0,1fr) / minmax(0,1fr)!important;gap:5px!important}
#preset-manager-main-panel.cc-work-mode .pm-panel-container>.pm-main-wrapper{display:contents!important}
#preset-manager-main-panel.cc-work-mode .pm-panel-container>:not(.pm-main-wrapper,.cc-work-panel),#preset-manager-main-panel.cc-work-mode .pm-main-wrapper>:not(.cc-work-panel,.side-panel-root){display:none!important}
#preset-manager-main-panel.cc-work-mode .side-panel-root{grid-row:2;position:relative!important;inset:auto!important;transform:none!important;justify-self:center;align-self:center;width:min(96%,365px)!important;height:40px!important;margin:0!important}
#preset-manager-main-panel.cc-work-mode .side-panel-content,#preset-manager-main-panel.cc-work-mode .panel-buttons{display:flex!important;position:static!important;flex-direction:row!important;width:100%!important;height:100%!important;transform:none!important}
#preset-manager-main-panel.cc-work-mode .side-panel-content{box-sizing:border-box;border:1px solid var(--pm-border,#8885)!important;border-radius:10px!important;background:var(--pm-toolbar-bg,var(--pm-panel-bg,#202124))!important}
#preset-manager-main-panel.cc-work-mode .side-panel-root .side-tab,#preset-manager-main-panel.cc-work-mode .side-panel-root .panel-collapse{display:none!important}
#preset-manager-main-panel.cc-work-mode .panel-buttons .panel-btn{flex:1 1 0!important;min-width:0!important}
.cc-work-mode [data-pmm-character-compare]{background:var(--pm-card-bg,#8884)!important;outline:1px solid currentColor}
.cc-work-panel{grid-column:1;min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--pm-border,#8886);border-radius:12px;background:var(--pm-panel-bg,#202124);color:var(--pm-text-primary,#eee)}
.cc-work-panel[data-cc-side="0"]{grid-row:1}.cc-work-panel[data-cc-side="1"]{grid-row:3}
.cc-work-panel header,.cc-work-dialog header{display:flex;align-items:center;gap:3px}
.cc-work-panel header{flex:none;padding:4px;border-bottom:1px solid var(--pm-border,#8885);background:var(--pm-toolbar-bg,transparent)}
.cc-work-panel header button,.cc-work-panel .cc-grip,.cc-work-panel .cc-row-title,.cc-work-dialog button,.cc-work-dialog select{font:inherit;color:inherit;border:0;background:var(--pm-card-bg,#8882);border-radius:6px;padding:5px;cursor:pointer}
.cc-work-panel header button,.cc-work-panel .cc-grip,.cc-work-panel .cc-row-title{background:transparent;font-size:clamp(12px,3vw,14px);min-width:clamp(24px,6.8vw,32px);min-height:32px;flex:none}
.cc-work-panel button:disabled{opacity:.38;cursor:default}
.cc-work-panel header .cc-title,.cc-work-panel .cc-row-title{flex:1;min-width:0;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cc-work-panel header .cc-title{display:flex;align-items:center;gap:3px;background:var(--pm-card-bg,#8882)}
.cc-title span{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis}
.cc-work-panel .cc-title small,.cc-title em{flex:none;padding:0;font:inherit}
.cc-title em{max-width:40%;overflow:hidden;text-overflow:ellipsis}
.cc-work-panel .cc-row-title{font-size:clamp(13px,3.5vw,15px)}
.cc-title i{margin-inline-start:4px;font-size:.75em}
.cc-work-panel [aria-pressed=true],.cc-work-panel .cc-dirty{background:var(--pm-card-bg,#8884);box-shadow:inset 0 0 0 1px var(--pm-border,#888)}
.cc-work-panel .cc-work-list{min-height:0;flex:1;overflow:auto;overscroll-behavior:contain;padding:5px;gap:var(--pmm-user-item-gap,3px)}
.cc-compare-tools,.cc-diff-row,.cc-diff-title{display:flex;align-items:center;gap:6px}
.cc-compare-tools{flex-wrap:wrap;padding:4px 6px}
.cc-compare-tools button{font:inherit;color:inherit;background:var(--pm-card-bg,#8882);border:1px solid var(--pm-border,#8885);border-radius:6px;padding:3px 7px}
.cc-diff-row{border-inline-start:3px solid var(--cc-category,transparent);padding:5px 6px;background:var(--pm-card-bg,#8882);border-radius:5px}
.cc-diff-title{min-width:0;flex:1;min-height:26px}.cc-diff-title span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cc-diff-row small{color:var(--cc-category);flex:none}.cc-diff-title input{flex:none}
.cc-work-panel header .cc-title{border:1px solid var(--pm-border,#8885);padding-inline:7px}
.cc-work-panel .cc-work-row .pmm-wb-entry-title{text-align:start;min-width:0}
.cc-work-panel .cc-person{margin-inline:5px;color:var(--pm-text-secondary,currentColor)}
.pmm-wb-editor-dialog header strong select{max-width:100%;border:0;background:transparent;color:inherit;font:inherit;cursor:pointer}
.pmm-wb-editor-dialog header strong:has(select){display:flex;flex-wrap:wrap;align-items:center;gap:3px}
.cc-work-row .cc-grip{touch-action:none;cursor:grab}.cc-person{padding:4px}
.cc-work-panel .cc-drop-before{box-shadow:inset 0 2px var(--pm-quote-color,#68a7e0)}.cc-work-panel .cc-drop-after{box-shadow:inset 0 -2px var(--pm-quote-color,#68a7e0)}
.cc-work-panel input[type=search]{width:calc(100% - 10px);margin:4px 5px;color:inherit;background:var(--pm-card-bg,#8882)}
.cc-work-panel small,.cc-work-panel p{padding:2px 6px;margin:0;font-size:.84em}
dialog.cc-work-dialog{margin:auto;width:min(92vw,460px);max-height:80dvh;overflow:auto;box-sizing:border-box;background:var(--pm-panel-bg,#202124);color:var(--pm-text-primary,#eee);padding:14px;border:1px solid var(--pm-border,#777);border-radius:12px}
.cc-work-dialog::backdrop{background:#0008}
.cc-work-dialog[open]{display:grid;gap:10px}.cc-work-dialog header{justify-content:space-between}
.cc-work-dialog label{display:grid;gap:3px}.cc-work-dialog :is(textarea,select){max-width:100%;width:100%;box-sizing:border-box;background:var(--pm-card-bg,#8882);color:inherit}.cc-work-dialog option{color:CanvasText;background:Canvas}
.cc-character-picker{display:grid;gap:6px;min-width:0}.cc-character-picker input{width:100%;box-sizing:border-box;color:inherit;background:var(--pm-card-bg,#8882);border:1px solid var(--pm-border,#8885);border-radius:6px;padding:8px}
.cc-character-options{max-height:34vh;max-height:34dvh;overflow:auto;overscroll-behavior:contain}.cc-character-options button{display:block;width:100%;text-align:left;overflow-wrap:anywhere;padding:8px;margin:2px 0}
`;
