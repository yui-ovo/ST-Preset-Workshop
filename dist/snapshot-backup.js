import { readStores, createBackup, validateBackup, planImport, commitImport, readPresetStore, planPresetRelink, commitPresetRelink } from './snapshot-backup-core.js?v=2.98.23';

export function openSnapshotBackup(host = window.parent || window) {
  const doc = host.document;
  if (doc.getElementById('pmm-snapshot-backup')) return;
  const root = doc.createElement('div'); root.id = 'pmm-snapshot-backup';
  root.innerHTML = `<style>
    #pmm-snapshot-backup{z-index:2147483647!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:max(12px,env(safe-area-inset-top,0px)) max(12px,env(safe-area-inset-right,0px)) max(12px,env(safe-area-inset-bottom,0px)) max(12px,env(safe-area-inset-left,0px))!important;background:#0008;box-sizing:border-box!important;color:var(--SmartThemeBodyColor,#eee);font:14px/1.6 sans-serif;overflow:hidden!important}
    #pmm-snapshot-backup *{box-sizing:border-box}
    #pmm-snapshot-backup .pmm-backup-panel{position:relative!important;inset:auto!important;transform:none!important;translate:none!important;margin:0!important;width:min(480px,100%)!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:min(70%,600px)!important;flex:0 1 auto!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;background:var(--SmartThemeBlurTintColor,#25252b);border:1px solid #8887;border-radius:16px;padding:0!important;box-shadow:0 12px 50px #0005}
    #pmm-snapshot-backup .pmm-backup-body{flex:1 1 auto!important;min-height:0!important;overflow:auto!important;overscroll-behavior:contain;padding:0 16px 12px!important;overflow-wrap:anywhere}
    #pmm-snapshot-backup header{position:static!important;transform:none!important;display:flex!important;flex:0 0 auto!important;align-items:center;justify-content:space-between;gap:8px;padding:12px 16px!important;margin:0!important;border-bottom:1px solid #8884}#pmm-snapshot-backup h2{font:600 19px sans-serif;margin:0}
    #pmm-snapshot-backup [data-import-actions]{flex:0 0 auto!important;margin:0!important;padding:10px 16px!important;border-top:1px solid #8884}
    @media(max-width:768px){#pmm-snapshot-backup{align-items:flex-end!important}#pmm-snapshot-backup .pmm-backup-panel{width:100%!important;max-height:60%!important}}
    #pmm-snapshot-backup button,#pmm-snapshot-backup .file-label{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:8px 12px;border:1px solid #8887;border-radius:9px;background:transparent;color:inherit;cursor:pointer;font:inherit;text-decoration:none}
    #pmm-snapshot-backup .actions{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}#pmm-snapshot-backup p{margin:12px 0}#pmm-snapshot-backup input[type=checkbox]{appearance:auto;width:18px;height:18px;vertical-align:middle}
    #pmm-snapshot-backup button:disabled{opacity:.45;cursor:default}#pmm-snapshot-backup [hidden]{display:none!important}#pmm-snapshot-backup pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;max-height:150px;overflow:auto}#pmm-snapshot-backup small{opacity:.75}
    #pmm-snapshot-backup select{display:block;width:100%;max-width:100%;min-width:0;min-height:38px;margin:5px 0 12px;padding:6px;border:1px solid #8887;border-radius:8px;background:var(--SmartThemeBlurTintColor,#25252b);color:inherit;font:inherit;text-overflow:ellipsis}
    #pmm-snapshot-backup details{margin:12px 0}#pmm-snapshot-backup summary{cursor:pointer}#pmm-snapshot-backup .pmm-preset-mapping{display:block;margin:10px 0;overflow-wrap:anywhere}
  </style><section class="pmm-backup-panel" role="dialog" aria-modal="true" aria-label="快照备份" tabindex="-1">
    <header><h2>快照备份</h2><button data-close aria-label="关闭快照备份">×</button></header>
    <div class="pmm-backup-body">
    <p>一起备份所有预设快照、角色世界书快照、全局分组及方案。</p>
    <small>只包含开关和绑定配置，不含预设、角色卡或世界书正文。新酒馆需先准备对应资料；角色和聊天标识不同的绑定需重新设置。</small>
    <div class="actions"><button data-export>导出全部快照</button><button data-choose>选择备份文件</button><input data-file type="file" accept=".json,application/json" hidden></div>
    <details data-migration hidden><summary>更新前的旧快照备份</summary><p>保留首次迁移前的浏览器快照，仅用于找回旧数据，不会随之后的修改更新。</p><button data-export-migration>导出旧快照备份</button></details>
    <details data-recovery><summary>恢复旧预设快照</summary>
      <p>把本浏览器旧名字下的快照复制到对应预设，保留旧记录，不改变当前开关。已有角色／聊天绑定优先；目标已有默认时，旧默认会保留为普通快照。</p>
      <label>恢复到<select data-recovery-target></select></label>
      <label>来源预设<select data-recovery-source></select></label>
      <p data-recovery-preview></p><button data-recover disabled>复制快照到所选预设</button>
    </details>
    <div data-preview hidden><p data-counts></p><p>合并导入：保留已有同名或同标识数据；冲突分组及其方案会一起跳过。</p>
      <details data-mapping hidden><summary>预设对应关系（改名后在这里选择）</summary><small>左侧是备份中的名字，下方选择导入到哪个预设。改到其他预设时创建副本，保留本地旧记录；目标已有默认或同名快照时仍会跳过。</small><div data-mapping-list></div></details>
      <details data-conflicts hidden><summary>查看跳过的数据</summary><pre></pre></details>
      <p><label><input data-bindings type="checkbox">同时恢复角色／聊天绑定</label><br><small>已有绑定优先。恢复的绑定在后续切换聊天时生效。</small></p>
      <small>导入不会应用快照；新导入的全局分组保持关闭。</small>
    </div><p data-status role="status"></p>
    </div><div class="actions" data-import-actions hidden><button data-import>确认合并导入</button></div>
  </section>`;
  const priorFocus = doc.activeElement;
  const q = selector => root.querySelector(selector);
  let backup = null, fileSerial = 0;
  let presetTargets = Object.create(null);
  const status = text => { q('[data-status]').textContent = text; };
  const counts = added => `预设快照 ${added.preset} 个 · 世界书快照 ${added.world} 个 · 全局分组 ${added.groups} 个 · 世界书默认方案 ${added.defaults} 个`;
  function preview() {
    if (!backup) return;
    const plan = planImport(readStores(host.localStorage), backup, q('[data-bindings]').checked, presetTargets);
    q('[data-preview]').hidden = false;
    q('[data-import-actions]').hidden = false;
    q('[data-counts]').textContent = '将新增：' + counts(plan.added);
    q('[data-conflicts]').hidden = !plan.skipped.length;
    q('[data-conflicts] summary').textContent = `查看跳过的数据（${plan.skipped.length}）`;
    q('[data-conflicts] pre').textContent = plan.skipped.join('\n');
    q('[data-import]').disabled = !Object.values(plan.added).some(Boolean);
    if (!Object.values(plan.added).some(Boolean)) status('没有可新增的数据。请查看跳过原因；若预设改过名，请展开「预设对应关系」选择现在的预设。');
    return plan;
  }
  function presetChoices() {
    const context = host.SillyTavern?.getContext?.();
    const manager = context?.getPresetManager?.('openai');
    const selected = String(manager?.getSelectedPresetName?.() || host.getLoadedPresetName?.() || '');
    const names = [...new Set([...(manager?.getAllPresets?.() || []), selected].filter(n => typeof n === 'string' && n && n !== 'in_use'))];
    return { selected, names };
  }
  function option(select, value, label = value) {
    const node = doc.createElement('option'); node.value = value; node.textContent = label; select.append(node);
  }
  function renderMappings() {
    const list = q('[data-mapping-list]'); list.replaceChildren();
    const { names } = presetChoices();
    const sourceNames = [...new Set(backup.preset.snapshots.map(s => s.presetName))];
    q('[data-mapping]').hidden = !sourceNames.length;
    q('[data-mapping]').open = sourceNames.some(name => !names.includes(name));
    for (const name of sourceNames) {
      const label = doc.createElement('label'); label.className = 'pmm-preset-mapping';
      const count = backup.preset.snapshots.filter(s => s.presetName === name).length;
      label.textContent = `${name}（${count} 个快照） →`;
      const select = doc.createElement('select'); select.dataset.presetSource = name;
      option(select, name, names.includes(name) ? name : `保留原名：${name}（当前未找到）`);
      for (const target of names) if (target !== name) option(select, target);
      select.onchange = () => {
        presetTargets[name] = select.value; status('');
        try { preview(); } catch (error) { status(error.message); }
      };
      label.append(select); list.append(label);
    }
  }
  function recoveryPlan() {
    return planPresetRelink(readPresetStore(host.localStorage), q('[data-recovery-source]').value, q('[data-recovery-target]').value, { copySnapshots: true });
  }
  function previewRecovery() {
    q('[data-recover]').disabled = true;
    if (!q('[data-recovery-source]').value || !q('[data-recovery-target]').value) {
      q('[data-recovery-preview]').textContent = '没有可恢复到此预设的旧记录。'; return;
    }
    try {
      const plan = recoveryPlan();
      q('[data-recovery-preview]').textContent = `将复制 ${plan.changed} 个，跳过已恢复的 ${plan.skipped} 个。${plan.notes.join('；')}`;
      q('[data-recover]').disabled = !plan.changed;
    } catch (error) { q('[data-recovery-preview]').textContent = error.message; }
  }
  function renderRecoverySources() {
    const select = q('[data-recovery-source]'), previous = select.value; select.replaceChildren();
    const target = q('[data-recovery-target]').value;
    const rows = readPresetStore(host.localStorage).snapshots;
    option(select, '', '请选择旧预设名字');
    for (const name of new Set(rows.map(s => s.presetName))) if (name && name !== target) {
      option(select, name, `${name}（${rows.filter(s => s.presetName === name).length} 个）`);
    }
    if ([...select.options].some(o => o.value === previous)) select.value = previous;
    previewRecovery();
  }
  function renderRecovery() {
    const { selected, names } = presetChoices(), select = q('[data-recovery-target]');
    select.replaceChildren(); option(select, '', '请选择要恢复到的预设');
    for (const name of names) option(select, name);
    if (names.includes(selected)) select.value = selected;
    renderRecoverySources();
  }
  q('[data-recovery]').ontoggle = () => { if (q('[data-recovery]').open) { try { renderRecovery(); } catch (error) { status(error.message); } } };
  q('[data-recovery-target]').onchange = () => { try { renderRecoverySources(); } catch (error) { status(error.message); } };
  q('[data-recovery-source]').onchange = previewRecovery;
  q('[data-recover]').onclick = async () => {
    try {
      await host.__PMM_PRESET_SNAPSHOT_STORAGE__?.refresh?.();
      const target = q('[data-recovery-target]').value;
      if (!presetChoices().names.includes(target)) throw new Error('目标预设已改名或移除，请重新选择');
      const plan = recoveryPlan(); commitPresetRelink(host.localStorage, plan);
      host.__PMM_PRESET_SNAPSHOT_STORAGE__?.observe?.();
      host.__PMM_SWITCH_SNAPSHOTS_TEST52__?.refreshAfterImport?.();
      status(`已复制 ${plan.changed} 个快照到“${target}”，当前开关未改变。`);
      previewRecovery(); if (backup) preview();
    } catch (error) { status('恢复失败：' + error.message); }
  };
  q('[data-export]').onclick = async () => {
    try {
      await host.__PMM_PRESET_SNAPSHOT_STORAGE__?.refresh?.();
      const data = createBackup(readStores(host.localStorage));
      const url = host.URL.createObjectURL(new host.Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = doc.createElement('a'); link.href = url; link.download = `预设工坊-全部快照-${new Date().toISOString().slice(0, 10)}.json`;
      doc.body.append(link); link.click(); link.remove(); host.setTimeout(() => host.URL.revokeObjectURL(url), 30000);
      status('已生成备份文件，请保留下载的 JSON 文件。');
    } catch (error) { status(error.message); }
  };
  const migration = host.__PMM_PRESET_SNAPSHOT_STORAGE__?.migrationBackup?.();
  q('[data-migration]').hidden = !migration?.snapshots?.length;
  q('[data-export-migration]').onclick = () => {
    try {
      const data = createBackup({ preset: migration, world: { snapshots: [], groups: [], defaults: [] } });
      const url = host.URL.createObjectURL(new host.Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = doc.createElement('a'); link.href = url; link.download = '预设工坊-迁移前本地快照.json';
      doc.body.append(link); link.click(); link.remove(); host.setTimeout(() => host.URL.revokeObjectURL(url), 30000);
      status('已导出更新前的旧快照备份。可通过「选择备份文件」合并恢复；已有同名或同标识快照会保留，冲突项会跳过。');
    } catch (error) { status(error.message); }
  };
  q('[data-choose]').onclick = () => q('[data-file]').click();
  q('[data-file]').onchange = async event => {
    const serial = ++fileSerial; backup = null; presetTargets = Object.create(null); q('[data-preview]').hidden = true; q('[data-import-actions]').hidden = true; status('');
    try {
      const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
      if (file.size > 20 * 1024 * 1024) throw new Error('文件超过 20 MB，请确认选择的是快照备份');
      const value = validateBackup(JSON.parse(await file.text()));
      if (serial !== fileSerial || !root.isConnected) return;
      backup = value; renderMappings(); preview();
    } catch (error) { if (serial === fileSerial) status('无法读取备份：' + error.message); }
  };
  q('[data-bindings]').onchange = () => { try { preview(); } catch (error) { status(error.message); } };
  q('[data-import]').onclick = async () => {
    try {
      await host.__PMM_PRESET_SNAPSHOT_STORAGE__?.refresh?.();
      const names = presetChoices().names;
      for (const [source, target] of Object.entries(presetTargets)) if (source !== target && !names.includes(target)) throw new Error('目标预设已改名或移除，请重新选择备份文件和对应预设');
      const plan = preview(); if (!plan || !Object.values(plan.added).some(Boolean)) return;
      commitImport(host.localStorage, plan);
      host.__PMM_PRESET_SNAPSHOT_STORAGE__?.observe?.();
      host.__PMM_SWITCH_SNAPSHOTS_TEST52__?.refreshAfterImport?.();
      host.__PMM_WORLDBOOK_SNAPSHOTS__?.refreshAfterImport?.();
      backup = null; q('[data-preview]').hidden = true; q('[data-import-actions]').hidden = true;
      status('导入完成：' + counts(plan.added) + `。跳过 ${plan.skipped.length} 项；当前开关未改变。`);
    } catch (error) { status(error.message); }
  };
  const viewport = host.visualViewport;
  let frame = 0;
  function updateViewport() {
    frame = 0;
    const width = Math.max(1, viewport?.width || host.innerWidth);
    const height = Math.max(1, viewport?.height || host.innerHeight);
    const values = { position: 'fixed', inset: 'auto', left: `${viewport?.offsetLeft || 0}px`, top: `${viewport?.offsetTop || 0}px`,
      right: 'auto', bottom: 'auto', width: `${width}px`, height: `${height}px`, 'min-height': '0', 'max-height': 'none',
      margin: '0', transform: 'none', translate: 'none' };
    for (const [key, value] of Object.entries(values)) root.style.setProperty(key, value, 'important');
  }
  function scheduleViewport() { if (!frame) frame = host.requestAnimationFrame(updateViewport); }
  const viewportEvents = [[host, 'resize'], [host, 'orientationchange'], [viewport, 'resize'], [viewport, 'scroll']];
  function close() {
    fileSerial++;
    for (const [target, type] of viewportEvents) target?.removeEventListener(type, scheduleViewport);
    if (frame) host.cancelAnimationFrame(frame);
    root.remove(); doc.removeEventListener('keydown', onKey, true); priorFocus?.focus?.({ preventScroll: true });
  }
  function onKey(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
    if (event.key === 'Tab') {
      const nodes = [...root.querySelectorAll('button,input,select,summary')].filter(n => !n.disabled && n.getClientRects().length);
      const first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && (doc.activeElement === first || !root.contains(doc.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }
  q('[data-close]').onclick = close;
  root.onclick = event => { if (event.target === root) close(); };
  doc.body.append(root);
  updateViewport();
  for (const [target, type] of viewportEvents) target?.addEventListener(type, scheduleViewport, { passive: true });
  doc.addEventListener('keydown', onKey, true); q('[data-close]').focus({ preventScroll: true });
}
