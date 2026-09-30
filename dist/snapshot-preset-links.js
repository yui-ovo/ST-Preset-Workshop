import { readPresetStore, planPresetRelink, commitPresetRelink } from './snapshot-backup-core.js?v=2.98.23';

const KEY = '__PMM_PRESET_SNAPSHOT_LINKS__';
export function installPresetSnapshotLinks(host) {
  host[KEY]?.cleanup?.();
  const context = host.SillyTavern?.getContext?.();
  const events = context?.eventSource;
  const renamedEvent = context?.eventTypes?.PRESET_RENAMED || context?.event_types?.PRESET_RENAMED || 'preset_renamed';
  function renamed({ apiId, oldName, newName } = {}) {
    if (apiId !== 'openai' || !oldName || !newName || oldName === newName) return;
    let plan;
    try {
      plan = planPresetRelink(readPresetStore(host.localStorage), oldName, newName);
      if (!plan.changed) { host.__PMM_PRESET_SNAPSHOT_STORAGE__?.renamed?.(oldName, newName); return; }
      commitPresetRelink(host.localStorage, plan);
      host.__PMM_PRESET_SNAPSHOT_STORAGE__?.renamed?.(oldName, newName);
    } catch (error) {
      console.error('[预设工坊] 快照改名关联失败', error);
      host.toastr?.error?.('快照关联未更新，旧记录仍保留。可从「快照备份 → 恢复旧预设快照」找回：' + error.message);
      return;
    }
    try { host.__PMM_SWITCH_SNAPSHOTS_TEST52__?.refreshAfterRename?.(oldName, newName); }
    catch (error) { console.warn('[预设工坊] 快照已迁移，重新打开快照窗口即可刷新', error); }
    if (plan.notes.length) host.toastr?.info?.('快照已跟随改名；' + plan.notes.join('；'));
  }
  // Subscribe to confirmed rename only: no rename-before, preset-change inference or polling.
  events?.on?.(renamedEvent, renamed);
  const api = { renamed, cleanup() {
    if (events?.off) events.off(renamedEvent, renamed);
    else events?.removeListener?.(renamedEvent, renamed);
    if (host[KEY] === api) delete host[KEY];
  } };
  host[KEY] = api;
  return api;
}
