import { compareCards } from './character-card-core.js?v=2.98.67-card.1';
import { buildHighlightedDiff } from './body-highlight.js';
import { runtimeResource } from './runtime-resources.js';

const categories = [
  ['changed', '内容不同', '#e26367'], ['renamed', '改名', '#46ae77'],
  ['old', '仅旧卡有', '#ad75d8'], ['new', '仅新卡有', '#548dde'], ['same', '完全一致', '#43a797'],
];
const sides = ['A · 旧卡', 'B · 新卡'];

export function showCharacterResults(opener, cards, initialView) {
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
  let rows = compareCards(...cards, view), selected = new Set(), current, listScroll = 0;
  const style = doc.createElement('style');
  style.textContent = css;
  const content = element('div', '', 'cc-content');
  dialog.append(style, content);
  runtimeResource(opener.closest('#preset-manager-main-panel') || doc.body).append(dialog);
  dialog.addEventListener('cancel', event => { event.preventDefault(); back(); });
  dialog.addEventListener('close', () => { dialog.remove(); opener.focus(); }, { once: true });
  render();
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
    screen = 'results';
    render();
    content.querySelector('.cc-list')?.children[visible().indexOf(current)]?.focus({ preventScroll: true });
  }
  function tabs() {
    const bar = element('div', '', 'cc-tabs');
    for (const [id, label, icon] of [['persona', '人设', 'fa-id-card'], ['book', '绑定世界书', 'fa-book-atlas']]) {
      const tab = button('', () => {
        if (view === id) return;
        view = id;
        selected.clear(); listScroll = 0;
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
    current = row; screen = 'body'; render();
    content.querySelector('h2').focus();
  }
  function render() {
    content.replaceChildren();
    const header = element('header');
    const goBack = button('返回', back, 'cc-back');
    const heading = element('h2', screen === 'body' ? title(current) : screen === 'results' ? '角色卡对比详情' : '角色卡对比');
    heading.tabIndex = -1;
    header.append(heading, goBack);
    content.append(header);
    if (screen !== 'body') content.append(tabs());
    if (screen === 'results') {
      content.append(summary(), element('h3', '差异条目列表'));
      const list = element('div', '', 'cc-list');
      for (const row of visible()) {
        const item = button('', () => { listScroll = list.scrollTop; showRow(row); }, 'cc-row');
        const [,label,color] = categories.find(([key]) => key === row.status);
        const badge = element('small', label); badge.style.setProperty('--cc-category', color);
        item.append(element('span', title(row)), badge); list.append(item);
      }
      if (!list.childElementCount) list.append(element('p', selected.size ? '所选分类没有差异条目。' : '两张卡在当前页没有差异。'));
      content.append(list); list.scrollTop = listScroll;
    } else {
      const filtered = visible(), index = filtered.indexOf(current);
      const nav = element('div', '', 'cc-nav');
      for (const [delta, label] of [[-1, '上一个条目'], [1, '下一个条目']]) {
        const arrow = button('', () => showRow(filtered[index + delta]));
        arrow.setAttribute('aria-label', label); arrow.title = label;
        arrow.append(element('i', '', 'fa-solid fa-chevron-' + (delta < 0 ? 'up' : 'down')));
        arrow.disabled = !filtered[index + delta]; nav.append(arrow);
      }
      header.insertBefore(nav, goBack);
      const body = element('div', '', 'cc-panels');
      const panels = sides.map((side, i) => {
        const panel = element('section', '', 'cc-panel');
        panel.append(element('h3', side + ' · ' + cards[i].name)); body.append(panel); return panel;
      });
      const entries = [current.left, current.right];
      entries.forEach((entry, i) => panels[i].append(element('strong', entry?.title || '此卡没有这一项')));
      for (const field of Object.keys((current.left || current.right).fields)) {
        const values = entries.map(entry => entry?.fields[field] ?? '');
        if (!values.some(Boolean)) continue;
        const diff = buildHighlightedDiff(...values);
        entries.forEach((entry, i) => {
          if (!entry) return;
          const pre = element('pre'); pre.innerHTML = i ? diff.rightHtml : diff.leftHtml;
          panels[i].append(element('h4', field), pre);
        });
      }
      content.append(body);
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
.pmm-character-compare footer {justify-content:flex-end}
.pmm-character-compare pre {white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}
.pmm-character-compare mark {background:#e5ab3b55;color:inherit}
`;
