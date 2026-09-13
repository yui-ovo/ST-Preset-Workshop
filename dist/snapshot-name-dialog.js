// Shared by preset, character and global snapshot editors.
export function requestSnapshotName(parent, value, maxLength = 100, kind = 'snapshot') {
  if (!parent?.isConnected) return Promise.resolve(null);
  const doc = parent.ownerDocument;
  const previousFocus = doc.activeElement;
  const content = parent.querySelector('[role="dialog"], .pmm-wbs-dialog');
  const wasInert = content?.inert;
  if (content) content.inert = true;
  const host = doc.createElement('div');
  host.style.cssText = 'position:absolute!important;inset:0!important;z-index:10!important;display:block!important';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host{font-family:inherit;color:var(--pm-text-primary,var(--SmartThemeBodyColor,#e5e7eb))}
    *{box-sizing:border-box} .backdrop{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.28);backdrop-filter:blur(3px)}
    form{width:min(360px,100%);padding:20px;border:1px solid var(--pm-border,var(--SmartThemeBorderColor,#666));border-radius:16px;background:var(--pm-panel-bg,var(--SmartThemeBlurTintColor,#202126));box-shadow:0 16px 48px #0004}
    h3{margin:0 0 6px;font-size:16px} p{margin:0 0 16px;font-size:12px;opacity:.65;line-height:1.5}
    label{display:block;font-size:12px;margin-bottom:7px} input{width:100%;height:40px;padding:0 10px;border:1px solid var(--pm-border,var(--SmartThemeBorderColor,#666));border-radius:8px;background:rgba(127,127,127,.08);color:inherit;font:inherit;font-size:16px}
    input:focus-visible,button:focus-visible{outline:2px solid var(--pm-quote-color,var(--SmartThemeQuoteColor,#a5a5ad));outline-offset:2px}
    footer{display:flex;justify-content:flex-end;gap:8px;margin-top:18px} button{min-height:36px;padding:0 14px;border:1px solid var(--pm-border,var(--SmartThemeBorderColor,#666));border-radius:8px;background:transparent;color:inherit;font:inherit;font-size:13px;cursor:pointer} button[type=submit]{background:color-mix(in srgb,var(--pm-quote-color,var(--SmartThemeQuoteColor,#aaa)) 20%,transparent)}
  </style><div class="backdrop"><form role="dialog" aria-modal="true" aria-labelledby="title"><h3 id="title">保存快照</h3><p>为刚刚调整的方案起个名字。</p><label for="name">快照名称</label><input id="name" autocomplete="off" required><footer><button type="button">返回编辑</button><button type="submit">保存</button></footer></form></div>`;
  if (kind === 'group') {
    root.querySelector('h3').textContent = '保存分组';
    root.querySelector('p').textContent = '为选好的世界书分组起个名字。';
    root.querySelector('label').textContent = '分组名称';
  }
  const input = root.querySelector('input');
  input.maxLength = maxLength;
  input.value = String(value || '').slice(0, maxLength);
  for (const type of ['click', 'pointerdown', 'mousedown', 'touchstart', 'keydown', 'input']) {
    host.addEventListener(type, event => event.stopPropagation());
  }
  parent.append(host);
  return new Promise(resolve => {
    let finished = false;
    const observer = new doc.defaultView.MutationObserver(() => {
      if (!host.isConnected) finish(null);
    });
    const finish = result => {
      if (finished) return;
      finished = true;
      observer.disconnect();
      host.remove();
      if (content) content.inert = wasInert;
      if (previousFocus?.isConnected) previousFocus.focus?.({ preventScroll: true });
      resolve(result);
    };
    observer.observe(doc.body, { childList: true, subtree: true });
    root.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      const name = input.value.trim();
      if (!name) { input.setCustomValidity(kind === 'group' ? '请填写分组名称' : '请填写快照名称'); input.reportValidity(); return; }
      finish(name);
    });
    input.addEventListener('input', () => input.setCustomValidity(''));
    root.querySelector('button').addEventListener('click', () => finish(null));
    root.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); finish(null); }
      if (event.key === 'Tab') {
        const controls = [...root.querySelectorAll('input,button')];
        const current = controls.indexOf(root.activeElement);
        event.preventDefault();
        controls[(current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
      }
    });
    input.focus({ preventScroll: true });
    input.select();
  });
}
