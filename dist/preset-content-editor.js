;(() => {
  const TOP = globalThis.parent && globalThis.parent !== globalThis ? globalThis.parent : globalThis;
  const DOC = TOP.document;
  const API_KEY = '__PMM_PRESET_CONTENT_EDITOR_V1__';
  const STYLE_ID = 'pmm-preset-content-editor-style';
  let activeEditorCleanup = null;

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

  function installStyle() {
    if (DOC.getElementById(STYLE_ID)) return;
    const style = DOC.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .pmm-preset-editor-host{position:relative!important}
      .pmm-preset-editor-overlay{position:absolute;inset:0;z-index:16000;display:flex;align-items:center;justify-content:center;padding:max(12px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom));background:rgba(0,0,0,.43);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);color:var(--pmm-editor-text,#222)}
      .pmm-preset-editor-overlay.pmm-preset-editor-desktop{position:fixed!important;inset:0!important;width:auto!important;height:auto!important;margin:0!important;transform:none!important;box-sizing:border-box!important;z-index:2147483000!important;align-items:center!important;justify-content:center!important}
      .pmm-preset-editor-dialog{width:min(92%,660px);height:min(82%,680px);max-height:calc(100dvh - 28px);min-height:250px;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--pmm-editor-border,rgba(127,127,127,.22));border-radius:13px;background-color:var(--pmm-editor-bg,#fff);background-image:var(--pmm-editor-bg-image,none);color:var(--pmm-editor-text,#222);box-shadow:0 18px 52px rgba(0,0,0,.36)}
      .pmm-preset-editor-desktop .pmm-preset-editor-dialog{box-sizing:border-box;min-height:0;max-height:calc(100% - 24px)}
      .pmm-preset-editor-dialog header{min-height:42px;display:flex;align-items:center;gap:7px;padding:6px 8px;border-bottom:1px solid var(--pmm-editor-border,rgba(127,127,127,.14))}
      .pmm-preset-editor-dialog header strong{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}
      .pmm-preset-editor-dialog header span{font-size:9px;opacity:.58;white-space:nowrap}
      .pmm-preset-editor-dialog header button{width:28px;height:28px;padding:0;border:0;border-radius:7px;background:color-mix(in srgb,var(--pmm-editor-text,#222) 8%,transparent);color:inherit}
      .pmm-preset-editor-dialog header button:disabled{opacity:.28}
      .pmm-preset-editor-dialog header button[data-pmm-editor-save]{color:var(--pmm-editor-accent,#3485f6)}
      .pmm-preset-editor-dialog textarea{flex:1;min-height:0;width:auto;margin:8px;padding:10px;border:1px solid var(--pmm-editor-border,rgba(127,127,127,.18));border-radius:9px;background:var(--pmm-editor-field-bg,rgba(127,127,127,.05));color:var(--pmm-editor-text,#222);font-size:12px!important;line-height:1.55!important;resize:none}
      @media(max-width:768px){.pmm-preset-editor-dialog{width:94%;height:82%;max-height:calc(100dvh - 24px);border-radius:12px}.pmm-preset-editor-dialog textarea{margin:6px;padding:8px;font-size:11px!important}}
    `;
    DOC.head.append(style);
  }

  function closeActiveEditor() {
    activeEditorCleanup?.();
    const overlay = DOC.querySelector('#preset-manager-main-panel .pmm-preset-editor-overlay');
    const host = overlay?.parentElement;
    overlay?.remove();
    host?.classList.remove('pmm-preset-editor-host');
  }

  function openPresetContentEditor(button) {
    const editor = button.closest('.prompt-editor');
    const sourceField = editor?.querySelector('.prompt-editor__textarea');
    const host = button.closest('#preset-manager-main-panel') || DOC.getElementById('preset-manager-main-panel');
    if (!editor || !sourceField || !host) return;

    installStyle();
    closeActiveEditor();
    const mobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(TOP.navigator?.userAgent || '')
      || (TOP.navigator?.platform === 'MacIntel' && TOP.navigator?.maxTouchPoints > 1);
    const desktop = !mobileDevice && TOP.matchMedia('(min-width:769px)').matches;
    if (!desktop) host.classList.add('pmm-preset-editor-host');

    const item = editor.closest('.prompt-item');
    const panel = editor.closest('.preset-panel');
    const title = editor.querySelector('.prompt-editor__name-input')?.value
      || item?.querySelector('.prompt-card__name,.prompt-card__title')?.textContent?.trim()
      || '预设条目';
    const original = String(sourceField.value || '');
    const themeNodes = [sourceField, editor, item, panel, host].filter(Boolean);
    const styles = themeNodes.map(node => TOP.getComputedStyle(node));
    const visibleColor = value => {
      const normalized = String(value || '').replace(/\s+/g, '').toLowerCase();
      return normalized && normalized !== 'transparent' && normalized !== 'rgba(0,0,0,0)';
    };
    const pickStyle = (property, fallback, requireVisible = false) => {
      for (const style of styles) {
        const value = style?.[property];
        if (value && (!requireVisible || visibleColor(value))) return value;
      }
      return fallback;
    };

    const overlay = DOC.createElement('div');
    overlay.className = 'pmm-preset-editor-overlay';
    if (desktop) overlay.classList.add('pmm-preset-editor-desktop');
    overlay.style.setProperty('--pmm-editor-bg', pickStyle('backgroundColor', '#fff', true));
    overlay.style.setProperty('--pmm-editor-bg-image', pickStyle('backgroundImage', 'none'));
    overlay.style.setProperty('--pmm-editor-field-bg', TOP.getComputedStyle(sourceField).backgroundColor || pickStyle('backgroundColor', 'rgba(127,127,127,.05)', true));
    overlay.style.setProperty('--pmm-editor-text', pickStyle('color', '#222', true));
    overlay.style.setProperty('--pmm-editor-border', TOP.getComputedStyle(sourceField).borderColor || pickStyle('borderColor', 'rgba(127,127,127,.22)', true));
    overlay.style.setProperty('--pmm-editor-accent', styles.map(style => style.getPropertyValue('--pm-quote-color').trim()).find(Boolean) || pickStyle('color', '#3485f6', true));
    overlay.innerHTML = `<section class="pmm-preset-editor-dialog" role="dialog" aria-modal="true" aria-label="放大编辑预设正文">
      <header><strong>${escapeHtml(title)}</strong><span data-pmm-editor-count>${original.length} 字符</span><button type="button" data-pmm-editor-undo title="暂无可撤销输入" aria-label="撤销本次编辑" disabled><i class="fa-solid fa-rotate-left"></i></button><button type="button" data-pmm-editor-cancel title="取消"><i class="fa-solid fa-xmark"></i></button><button type="button" data-pmm-editor-save title="完成"><i class="fa-solid fa-check"></i></button></header>
      <textarea spellcheck="false">${escapeHtml(original)}</textarea>
    </section>`;

    const textarea = overlay.querySelector('textarea');
    const counter = overlay.querySelector('[data-pmm-editor-count]');
    const undoButton = overlay.querySelector('[data-pmm-editor-undo]');
    const undoStack = [];
    let previousValue = original;
    let lastInputAt = 0;
    let focusTimer = null;
    let hostObserver = null;
    const updateUndoButton = () => {
      const available = undoStack.length > 0;
      undoButton.disabled = !available;
      undoButton.title = available ? '撤销本次编辑' : '暂无可撤销输入';
    };
    const closeEditor = () => {
      TOP.clearTimeout(focusTimer);
      hostObserver?.disconnect();
      overlay.remove();
      host.classList.remove('pmm-preset-editor-host');
      if (activeEditorCleanup === closeEditor) activeEditorCleanup = null;
    };
    activeEditorCleanup = closeEditor;
    const undoInput = () => {
      if (!undoStack.length) return;
      const start = textarea.selectionStart;
      textarea.value = undoStack.pop();
      previousValue = textarea.value;
      lastInputAt = 0;
      counter.textContent = `${textarea.value.length} 字符`;
      updateUndoButton();
      desktop ? textarea.focus({ preventScroll: true }) : textarea.focus();
      const cursor = Math.min(Number.isFinite(start) ? start : textarea.value.length, textarea.value.length);
      textarea.setSelectionRange(cursor, cursor);
    };
    const saveEditor = () => {
      const next = String(textarea.value || '');
      closeEditor();
      if (next === original) return;
      sourceField.value = next;
      sourceField.dispatchEvent(new TOP.Event('input', { bubbles: true }));
      sourceField.dispatchEvent(new TOP.Event('change', { bubbles: true }));
    };

    textarea.addEventListener('input', () => {
      const now = Date.now();
      if (!undoStack.length || now - lastInputAt > 450) undoStack.push(previousValue);
      previousValue = textarea.value;
      lastInputAt = now;
      counter.textContent = `${textarea.value.length} 字符`;
      updateUndoButton();
    });
    undoButton.addEventListener('click', undoInput);
    overlay.querySelector('[data-pmm-editor-cancel]').addEventListener('click', closeEditor);
    overlay.querySelector('[data-pmm-editor-save]').addEventListener('click', saveEditor);
    overlay.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeEditor();
      } else if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undoInput();
      }
    });

    if (desktop) {
      DOC.body.append(overlay);
      // The desktop portal must disappear if its workshop is closed or removed.
      hostObserver = new TOP.MutationObserver(() => {
        if (!host.isConnected || !host.getClientRects().length) closeEditor();
      });
      hostObserver.observe(DOC.body, { childList: true, subtree: true });
      hostObserver.observe(host, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
    } else host.append(overlay);
    focusTimer = TOP.setTimeout(() => {
      if (overlay.isConnected) desktop ? textarea.focus({ preventScroll: true }) : textarea.focus();
    }, 20);
  }

  function onPresetExpandClick(event) {
    const button = event.target.closest?.('.prompt-editor__expand-btn');
    if (!button || !button.closest('#preset-manager-main-panel')) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    openPresetContentEditor(button);
  }

  function cleanup() {
    closeActiveEditor();
    DOC.removeEventListener('click', onPresetExpandClick, true);
    DOC.getElementById(STYLE_ID)?.remove();
    try { if (TOP[API_KEY]?.cleanup === cleanup) delete TOP[API_KEY]; } catch (_) {}
  }

  try { TOP[API_KEY]?.cleanup?.(); } catch (_) {}
  DOC.addEventListener('click', onPresetExpandClick, true);
  TOP[API_KEY] = { cleanup, openPresetContentEditor };
  console.info('[预设工坊] 预设条目正文全屏编辑器已加载。');
})();
