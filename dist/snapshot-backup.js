import { readStores, createBackup, validateBackup, planImport, commitImport } from './snapshot-backup-core.js?v=2.98.19';

export function openSnapshotBackup(host = window.parent || window) {
  const doc = host.document;
  if (doc.getElementById('pmm-snapshot-backup')) return;
  const root = doc.createElement('div'); root.id = 'pmm-snapshot-backup';
  root.innerHTML = `<style>
    #pmm-snapshot-backup{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:16px;background:#0008;box-sizing:border-box;color:var(--SmartThemeBodyColor,#eee);font:14px/1.6 sans-serif}
    #pmm-snapshot-backup *{box-sizing:border-box}
    #pmm-snapshot-backup section{width:min(480px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:var(--SmartThemeBlurTintColor,#25252b);border:1px solid #8887;border-radius:16px;padding:18px;box-shadow:0 12px 50px #0005}
    #pmm-snapshot-backup header{display:flex;align-items:center;justify-content:space-between;gap:8px}#pmm-snapshot-backup h2{font:600 19px sans-serif;margin:0}
    #pmm-snapshot-backup button,#pmm-snapshot-backup .file-label{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:8px 12px;border:1px solid #8887;border-radius:9px;background:transparent;color:inherit;cursor:pointer;font:inherit;text-decoration:none}
    #pmm-snapshot-backup .actions{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}#pmm-snapshot-backup p{margin:12px 0}#pmm-snapshot-backup input[type=checkbox]{appearance:auto;width:18px;height:18px;vertical-align:middle}
    #pmm-snapshot-backup button:disabled{opacity:.45;cursor:default}#pmm-snapshot-backup [hidden]{display:none!important}#pmm-snapshot-backup pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;max-height:150px;overflow:auto}#pmm-snapshot-backup small{opacity:.75}
  </style><section role="dialog" aria-modal="true" aria-label="快照备份" tabindex="-1">
    <header><h2>快照备份</h2><button data-close aria-label="关闭快照备份">×</button></header>
    <p>一起备份所有预设快照、角色世界书快照、全局分组及方案。</p>
    <small>只包含开关和绑定配置，不含预设、角色卡或世界书正文。新酒馆需先准备对应资料；角色和聊天标识不同的绑定需重新设置。</small>
    <div class="actions"><button data-export>导出全部快照</button><button data-choose>选择备份文件</button><input data-file type="file" accept=".json,application/json" hidden></div>
    <div data-preview hidden><p data-counts></p><p>合并导入：保留已有同名或同标识数据；冲突分组及其方案会一起跳过。</p>
      <details data-conflicts hidden><summary>查看跳过的数据</summary><pre></pre></details>
      <p><label><input data-bindings type="checkbox">同时恢复角色／聊天绑定</label><br><small>已有绑定优先。恢复的绑定在后续切换聊天时生效。</small></p>
      <small>导入不会应用快照；新导入的全局分组保持关闭。</small>
      <div class="actions"><button data-import>确认合并导入</button></div>
    </div><p data-status role="status"></p>
  </section>`;
  const priorFocus = doc.activeElement;
  const q = selector => root.querySelector(selector);
  let backup = null, fileSerial = 0;
  const status = text => { q('[data-status]').textContent = text; };
  const counts = added => `预设快照 ${added.preset} 个 · 世界书快照 ${added.world} 个 · 全局分组 ${added.groups} 个 · 世界书默认方案 ${added.defaults} 个`;
  function preview() {
    if (!backup) return;
    const plan = planImport(readStores(host.localStorage), backup, q('[data-bindings]').checked);
    q('[data-preview]').hidden = false;
    q('[data-counts]').textContent = '将新增：' + counts(plan.added);
    q('[data-conflicts]').hidden = !plan.skipped.length;
    q('[data-conflicts] summary').textContent = `查看跳过的数据（${plan.skipped.length}）`;
    q('[data-conflicts] pre').textContent = plan.skipped.join('\n');
    q('[data-import]').disabled = !Object.values(plan.added).some(Boolean);
    return plan;
  }
  q('[data-export]').onclick = () => {
    try {
      const data = createBackup(readStores(host.localStorage));
      const url = host.URL.createObjectURL(new host.Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = doc.createElement('a'); link.href = url; link.download = `预设工坊-全部快照-${new Date().toISOString().slice(0, 10)}.json`;
      doc.body.append(link); link.click(); link.remove(); host.setTimeout(() => host.URL.revokeObjectURL(url), 30000);
      status('已生成备份文件，请保留下载的 JSON 文件。');
    } catch (error) { status(error.message); }
  };
  q('[data-choose]').onclick = () => q('[data-file]').click();
  q('[data-file]').onchange = async event => {
    const serial = ++fileSerial; backup = null; q('[data-preview]').hidden = true; status('');
    try {
      const file = event.target.files?.[0]; if (!file) return;
      if (file.size > 20 * 1024 * 1024) throw new Error('文件超过 20 MB，请确认选择的是快照备份');
      const value = validateBackup(JSON.parse(await file.text()));
      if (serial !== fileSerial || !root.isConnected) return;
      backup = value; preview();
    } catch (error) { if (serial === fileSerial) status('无法读取备份：' + error.message); }
  };
  q('[data-bindings]').onchange = () => { try { preview(); } catch (error) { status(error.message); } };
  q('[data-import]').onclick = () => {
    try {
      const plan = preview(); if (!plan || !Object.values(plan.added).some(Boolean)) return;
      commitImport(host.localStorage, plan);
      host.__PMM_SWITCH_SNAPSHOTS_TEST52__?.refreshAfterImport?.();
      host.__PMM_WORLDBOOK_SNAPSHOTS__?.refreshAfterImport?.();
      backup = null; q('[data-preview]').hidden = true;
      status('导入完成：' + counts(plan.added) + `。跳过 ${plan.skipped.length} 项；当前开关未改变。`);
    } catch (error) { status(error.message); }
  };
  function close() { fileSerial++; root.remove(); doc.removeEventListener('keydown', onKey, true); priorFocus?.focus?.({ preventScroll: true }); }
  function onKey(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
    if (event.key === 'Tab') {
      const nodes = [...root.querySelectorAll('button,input,summary')].filter(n => !n.disabled && n.getClientRects().length);
      const first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && (doc.activeElement === first || !root.contains(doc.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }
  q('[data-close]').onclick = close;
  root.onclick = event => { if (event.target === root) close(); };
  doc.body.append(root); doc.addEventListener('keydown', onKey, true); q('[data-close]').focus();
}
