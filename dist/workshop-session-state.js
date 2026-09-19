// Local, per-tab drafts. Reading a draft never selects, saves or applies a Tavern preset.
export function createDraftSession(storage, timers = globalThis) {
  const key = 'pmm-workshop-drafts-v1';
  let data;
  try { data = JSON.parse(storage?.getItem(key) || 'null'); } catch (_) {}
  if (!data || data.version !== 1) data = { version:1, presets:{}, branch:null };
  data.presets ||= {};
  const readers = new Set();
  let timer = 0, dirty = false;
  const serialize = value => JSON.stringify(value);
  const clone = value => JSON.parse(serialize(value));
  const promptSignature = prompts => JSON.stringify((prompts||[]).map(prompt=>({
    id:String(prompt.id||''),name:prompt.name||'',content:prompt.content||'',role:prompt.role||'system',enabled:prompt.enabled===true,position:prompt.position||null,
  })),(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value);

  function persist() {
    if (!dirty) return;
    try { storage?.setItem(key, serialize(data)); dirty = false; }
    catch (error) { console.warn('[预设工坊] 本标签页草稿缓存写入失败，当前编辑仍保留在内存中', error); }
  }
  function flush() {
    if (timer) timers.clearTimeout(timer);
    timer = 0;
    for (const reader of readers) reader();
    if (timer) timers.clearTimeout(timer);
    timer = 0;
    persist();
  }
  function schedule() {
    if (timer) timers.clearTimeout(timer);
    timer = timers.setTimeout(flush, 400);
  }
  function remember(name, prompts, baseline) {
    if (!name || !Array.isArray(prompts) || !Array.isArray(baseline)) return;
    const id = `preset:${name}`, content = serialize(prompts), saved = serialize(baseline);
    if (content === saved) {
      if (data.presets[id]) { delete data.presets[id]; dirty = true; }
    } else if (data.presets[id]?.content !== content || data.presets[id]?.saved !== saved) {
      data.presets[id] = { content, saved }; dirty = true;
    }
  }
  function read(name, baseline) {
    const draft = data.presets[`preset:${name}`];
    // An external save is authoritative; keep the old draft cached without applying it.
    if (!draft || draft.saved !== serialize(baseline)) return null;
    try { return JSON.parse(draft.content); } catch (_) { return null; }
  }
  function rememberBranch(name, branch, prompts) {
    const next = branch ? { name, branch, content:promptSignature(prompts) } : null;
    if (serialize(next) !== serialize(data.branch)) { data.branch = next; dirty = true; schedule(); }
  }
  function matchesBranch(name, branch, prompts, savedPrompts) {
    const content = promptSignature(prompts);
    return content === promptSignature(savedPrompts) || Boolean(data.branch?.name === name && data.branch.branch === branch && data.branch.content === content);
  }
  return { read, remember, schedule, flush, rememberBranch, matchesBranch,
    register(reader) { readers.add(reader); return () => readers.delete(reader); },
    snapshot:() => clone(data), dispose() { flush(); readers.clear(); },
  };
}
const topWindow = (() => { try { return window.top || window; } catch (_) { return globalThis; } })();
let storage;
try { storage = topWindow.sessionStorage; } catch (_) {}
export const workshopDrafts = createDraftSession(storage, topWindow);
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => workshopDrafts.dispose(), { once:true });
