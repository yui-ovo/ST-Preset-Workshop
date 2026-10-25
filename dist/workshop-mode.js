export const MODE_KEY = 'pmm.runtime-mode.v1';
export function readWorkshopMode(host = globalThis) {
  try { return host.localStorage.getItem(MODE_KEY) === 'snapshots' ? 'snapshots' : 'full'; }
  catch (_) { return 'full'; }
}

export async function changeWorkshopMode(host, next, reload = () => host.location.reload()) {
  if (!['full', 'snapshots'].includes(next)) throw Error('未知运行模式');
  if (next === readWorkshopMode(host)) return true;
  const doc = host.document;
  if (doc.querySelector('#pmm-switch-snapshot-editor-overlay,[data-pmm-editing-dialog]')) {
    throw Error('请先完成或取消当前编辑，再切换模式。');
  }
  if (doc.getElementById('preset-manager-main-panel')) {
    if (!host.__PMM_WORKSHOP_EDITING__?.closeMain) throw Error('工坊尚未准备好，请稍后重试');
    await host.__PMM_WORKSHOP_EDITING__.closeMain();
    if (doc.getElementById('preset-manager-main-panel')) return false;
  }
  host.localStorage.setItem(MODE_KEY, next);
  reload();
  return true;
}

export function installWorkshopModeSettings(host = globalThis) {
  const doc = host.document;
  if (doc.getElementById('pmm-runtime-mode-settings')) return;
  const mount = () => {
    const container = doc.querySelector('#extensions_settings2, #extensions_settings');
    if (!container) return false;
    const box = doc.createElement('div'); box.id = 'pmm-runtime-mode-settings';
    const title = doc.createElement('b'); title.textContent = '🧩预设工坊 · 运行模式';
    const select = doc.createElement('select'); select.className = 'text_pole'; select.setAttribute('aria-label', '预设工坊运行模式');
    for (const [value, label] of [['full', '完整工坊'], ['snapshots', '仅保留预设快照']]) {
      const option = doc.createElement('option'); option.value = value; option.textContent = label; select.append(option);
    }
    select.value = readWorkshopMode(host);
    const note = doc.createElement('small');
    note.textContent = '切换后重新载入酒馆。仅快照模式保留原生预设栏相机、快照保存/恢复及绑定联动，暂停其余工坊功能；已有数据保留。';
    box.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin:12px 0';
    box.append(title, select, note); container.append(box);
    select.onchange = async () => {
      select.disabled = true;
      try { await changeWorkshopMode(host, select.value); }
      catch (error) { host.toastr?.warning?.(error.message); }
      finally { select.value = readWorkshopMode(host); select.disabled = false; }
    };
    return true;
  };
  if (mount()) return;
  // Bootstrap only: disconnect as soon as the extension settings exist.
  const observer = new host.MutationObserver(() => { if (mount()) observer.disconnect(); });
  observer.observe(doc.documentElement, { childList: true, subtree: true });
}
