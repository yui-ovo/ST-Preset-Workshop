import { planSwitchTransfer, transferSwitches, draftSignature, saveDirtyDrafts } from './workshop-editing-core.js?v=2.98.46';

const dialogs = new WeakMap();
function dialog(host, title, onCancel) {
  const doc = host.ownerDocument, win = doc.defaultView, prior = doc.activeElement, wasInert = host.inert;
  const layer = doc.createElement('div'); layer.dataset.pmmEditingDialog = '1';
  const theme = win.getComputedStyle(host.querySelector('.preset-panel') || host);
  for (const name of ['--pm-panel-bg', '--pm-text-primary', '--pm-border', '--pm-quote-color', '--pmm-safe-top', '--pmm-safe-bottom', '--tt-inset-top', '--tt-inset-bottom']) layer.style.setProperty(name, theme.getPropertyValue(name));
  // Make the dialog opaque even when the surrounding theme uses translucent panels.
  const rgb = theme.getPropertyValue('--pm-panel-bg').match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (rgb) layer.style.setProperty('--pm-panel-bg', `rgb(${rgb.slice(1, 4).join(',')})`);
  const root = layer.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host{font-family:system-ui,sans-serif;color:var(--pm-text-primary,#e5e7eb)}*{box-sizing:border-box}
    .veil{height:100%;display:flex;align-items:center;justify-content:center;padding:max(16px,var(--pmm-safe-top,0px),var(--tt-inset-top,0px),env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) max(16px,var(--pmm-safe-bottom,0px),var(--tt-inset-bottom,0px),env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px));background:#0009}
    section{width:min(440px,100%);min-height:0;max-height:min(82vh,100%);max-height:min(82dvh,100%);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--pm-border,#555);border-radius:18px;background:var(--pm-panel-bg,#20252e);box-shadow:0 16px 48px #0006;background-color:var(--pm-panel-bg,#20252e)}
    h2{flex:none;font-size:16px;margin:0;padding:18px 18px 10px}main{padding:0 18px;overflow:auto;min-height:0;overscroll-behavior:contain}p,li,label{font-size:13px;line-height:1.6;overflow-wrap:anywhere}ul{padding-left:20px}.status{font-size:12px;min-height:1.6em;white-space:pre-wrap}.error{color:#ef8f8f}
    footer{flex:none;display:flex;gap:8px;flex-wrap:wrap;padding:14px 18px}button,select{font:inherit;font-size:13px;color:inherit;border:1px solid var(--pm-border,#666);background:rgba(127,127,127,.12);border-radius:10px;padding:10px 12px;cursor:pointer}button:disabled{opacity:.45;cursor:default}button.primary{background:color-mix(in srgb,var(--pm-quote-color,#889bc9) 24%,transparent)}button.danger{color:#e68c8c}button:focus-visible,select:focus-visible{outline:2px solid var(--pm-quote-color,#90a5e0);outline-offset:2px}select{max-width:100%;font-size:16px}option{color:#111;background:#fff}
    .direction{padding:12px;border-radius:12px;background:rgba(127,127,127,.1);font-size:13px;overflow-wrap:anywhere}.direction strong{display:block;margin:5px 0;line-height:1.5}.preset-role{font-size:12px;opacity:.8}.swap{display:block;margin:10px auto}details{font-size:13px;margin:12px 0}summary{cursor:pointer}.row{padding:10px 0;border-bottom:1px solid var(--pm-border,#555)}.row label{display:block;margin-bottom:6px}.row select{width:100%}.note{opacity:.7;font-size:12px}footer button{flex:1 1 auto}.transfer-actions .primary{flex:1 1 100%}
    @media(max-width:480px){footer.close-actions button{width:100%}}
  </style><div class="veil"><section role="dialog" aria-modal="true" aria-labelledby="heading"><h2 id="heading"></h2><main></main><footer></footer></section></div>`;
  root.querySelector('h2').textContent = title;
  host.inert = true; doc.body.append(layer);
  const viewport = win.visualViewport;
  let busy = false, frame = 0, finished = false;
  function updateViewport() {
    frame = 0;
    // Shadow DOM protects the contents, but host themes can still style this outer div.
    // Use the owning window's visible viewport, not the helper iframe or either preset pane.
    const values = { position: 'fixed', inset: 'auto', left: `${viewport?.offsetLeft || 0}px`, top: `${viewport?.offsetTop || 0}px`,
      right: 'auto', bottom: 'auto', width: `${Math.max(1, viewport?.width || win.innerWidth)}px`, height: `${Math.max(1, viewport?.height || win.innerHeight)}px`,
      'min-width': '0', 'max-width': 'none', 'min-height': '0', 'max-height': 'none', 'box-sizing': 'border-box',
      display: 'block', margin: '0', padding: '0', border: '0', transform: 'none', translate: 'none', scale: 'none', rotate: 'none',
      animation: 'none', transition: 'none', overflow: 'hidden', 'z-index': '2147483645' };
    for (const [key, value] of Object.entries(values)) layer.style.setProperty(key, value, 'important');
  }
  function scheduleViewport() { if (!frame && !finished) frame = win.requestAnimationFrame(updateViewport); }
  const viewportEvents = [[win, 'resize'], [win, 'orientationchange'], [viewport, 'resize'], [viewport, 'scroll']];
  updateViewport();
  for (const [target, type] of viewportEvents) target?.addEventListener(type, scheduleViewport, { passive: true });
  const finish = () => {
    if (finished) return; finished = true;
    for (const [target, type] of viewportEvents) target?.removeEventListener(type, scheduleViewport);
    if (frame) win.cancelAnimationFrame(frame);
    layer.remove(); host.inert = wasInert; dialogs.delete(doc); if (prior?.isConnected) prior.focus?.({ preventScroll: true });
  };
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!busy) onCancel(); }
    if (event.key !== 'Tab') return;
    const controls = [...root.querySelectorAll('button:not(:disabled),select:not(:disabled),summary')].filter(n => n.getClientRects().length);
    if (!controls.length) return;
    event.preventDefault(); const at = controls.indexOf(root.activeElement);
    controls[(at + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
  });
  for (const type of ['click', 'pointerdown', 'touchstart', 'keydown']) layer.addEventListener(type, e => e.stopPropagation());
  return { root, main: root.querySelector('main'), footer: root.querySelector('footer'), finish,
    busy(value) { busy = value; root.querySelectorAll('button,select').forEach(n => n.disabled = value); } };
}
function element(parent, tag, value, className = '') {
  const node = parent.ownerDocument.createElement(tag); node.textContent = value; if (className) node.className = className; parent.append(node); return node;
}
function button(parent, label, action, className = '') { const b = element(parent, 'button', label, className); b.type = 'button'; b.onclick = action; return b; }

export function confirmWorkshopClose(host, getEntries, close) {
  if (!host?.isConnected) return false;
  const doc = host.ownerDocument;
  if (dialogs.has(doc)) return dialogs.get(doc);
  const entries = getEntries();
  if (!entries.length) return close();
  let resolve;
  const result = new Promise(done => resolve = done);
  const view = dialog(host, '还有修改没保存', () => end(false));
  function end(value) { view.finish(); resolve(value); }
  dialogs.set(doc, result);
  element(view.main, 'p', '以下内容尚未保存：');
  const list = element(view.main, 'ul', '');
  const refreshList = rows => { list.replaceChildren(); rows.forEach(entry => element(list, 'li', entry.label)); };
  refreshList(entries);
  const status = element(view.main, 'p', '', 'status');
  view.footer.className = 'close-actions';
  const cancel = button(view.footer, '继续编辑', () => end(false));
  const act = async save => {
    view.busy(true); status.className = 'status'; status.textContent = save ? '正在保存…' : '';
    try {
      if (save) await saveDirtyDrafts(getEntries());
      else for (const entry of getEntries()) await entry.discard();
      if (getEntries().length) throw Error('仍有未保存的修改，已保留面板');
      view.finish(); resolve(true); close();
    } catch (error) { refreshList(getEntries()); status.textContent = `${error.message || error}\n面板和未保存内容已保留。`; status.className = 'status error'; view.busy(false); }
  };
  button(view.footer, '保存并关闭', () => act(true), 'primary');
  button(view.footer, '不保存关闭', () => act(false), 'danger');
  cancel.focus({ preventScroll: true }); return result;
}

export function openSwitchTransfer(host, adapter) {
  if (!host?.isConnected || dialogs.has(host.ownerDocument)) return;
  let sides = adapter.read();
  if (!sides || sides[0].name === sides[1].name) return adapter.notice('请先选择旧版和新版两份不同的预设');
  const original = draftSignature(sides), view = dialog(host, '沿用开关', () => view.finish());
  dialogs.set(host.ownerDocument, true);
  let direction = 0, plan, selections, shown;
  function render() {
    view.main.replaceChildren(); view.footer.replaceChildren();
    const source = sides[direction], target = sides[1 - direction];
    plan = planSwitchTransfer(source.prompts, target.prompts); selections = new Map(plan.matches); shown = 0;
    element(view.main, 'p', '请确认新旧预设标记，放反了可反转。这里不会自动判断版本。', 'note');
    const directionBox = element(view.main, 'div', '', 'direction');
    element(directionBox, 'span', '旧预设 · 提供开关', 'preset-role'); element(directionBox, 'strong', source.name);
    button(directionBox, '⇅ 反转新旧', () => { direction = 1 - direction; render(); }, 'swap');
    element(directionBox, 'span', '新预设 · 接收开关', 'preset-role'); element(directionBox, 'strong', target.name);
    const summary = element(view.main, 'p', '');
    const refresh = () => { const changed = transferSwitches(source.prompts, target.prompts, selections).changed; summary.textContent = `已对应 ${selections.size} 条 · 将调整 ${changed} 条 · 保持新版 ${target.prompts.length - selections.size} 条`; };
    refresh();
    element(view.main, 'p', '只沿用条目开关，保留新版正文、顺序和其他设置。未对应的条目保留新版当前状态。', 'note');
    if (plan.unresolved.length) {
      const details = element(view.main, 'details', '');
      element(details, 'summary', `手动确认对应（${plan.unresolved.length} 条）`);
      const rows = element(details, 'div', '');
      const more = button(details, '显示更多', addRows);
      function addRows() {
        for (const row of plan.unresolved.slice(shown, shown + 40)) {
          const block = element(rows, 'div', '', 'row');
          const label = element(block, 'label', target.prompts[row.targetIndex].name || '未命名条目');
          const select = element(label, 'select', '');
          const option = (value, label) => { const o = element(select, 'option', label); o.value = String(value); };
          option('', '保持新版当前状态');
          let populated = false;
          select.onfocus = select.onpointerdown = () => {
            if (populated) return; populated = true;
            const order = [...row.candidates, ...source.prompts.map((_, i) => i).filter(i => !row.candidates.includes(i))];
            const autoMatched = new Set(plan.matches.values());
            for (const si of order) if (!autoMatched.has(si)) option(si, `${row.candidates.includes(si) ? '建议 · ' : ''}${si + 1}. ${source.prompts[si].name || '未命名条目'} · ${source.prompts[si].enabled !== false ? '开' : '关'}`);
          };
          select.onchange = () => {
            const value = select.value;
            if (value !== '' && [...selections].some(([ti, si]) => ti !== row.targetIndex && si === Number(value))) { select.value = selections.has(row.targetIndex) ? String(selections.get(row.targetIndex)) : ''; status.textContent = '这个旧版条目已经对应到其他条目，请先取消原对应。'; return; }
            if (value === '') selections.delete(row.targetIndex); else selections.set(row.targetIndex, Number(value));
            status.textContent = ''; refresh();
          };
        }
        shown += 40; more.hidden = shown >= plan.unresolved.length;
      }
      details.addEventListener('toggle', () => { if (details.open && !shown) addRows(); });
    }
    const status = element(view.main, 'p', '', 'status');
    view.footer.className = 'transfer-actions';
    const cancel = button(view.footer, '取消', () => view.finish());
    button(view.footer, '新预设沿用旧预设开关', async () => {
      view.busy(true);
      try {
        if (draftSignature(adapter.read()) !== original) throw Error('两侧预设已发生变化，请关闭后重新打开沿用开关');
        const result = transferSwitches(source.prompts, target.prompts, selections);
        if (!result.changed) { status.textContent = '对应条目的开关已经一致，无需修改。'; view.busy(false); return; }
        await adapter.apply(1 - direction, result.prompts);
        view.finish(); adapter.notice(`已沿用 ${result.changed} 条开关，请保存目标预设；可用目标面板的撤销按钮撤销。`);
      } catch (error) { status.textContent = error.message || String(error); status.className = 'status error'; view.busy(false); }
    }, 'primary');
    cancel.focus({ preventScroll: true });
  }
  render();
}
