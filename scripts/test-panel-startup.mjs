import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const helper = source.slice(source.indexOf('function pmmScheduleVisiblePanelStart('), source.indexOf('const PMM_TOP_NOTIFICATION_STORAGE_KEY'));
const start = source.indexOf('/* PMM_VISIBLE_PANEL_START:');
const end = source.indexOf(';let x=!1;', start);
assert.ok(start > 0 && end > start, 'Missing production startup hook');
const hook = source.slice(start, end);

async function fixture({ themeError = false, loadError = false, noFrames = false } = {}) {
  let mounted, unmount, shown = false, loaded = 0, cleared = 0, notice = 0, nextId = 0;
  const frames = new Map(), timers = new Map();
  const host = {
    document: { body: {} },
    requestAnimationFrame(fn) { if (noFrames) throw Error('No host frame API'); const id = ++nextId; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(fn, delay) { assert.equal(delay, 120); const id = ++nextId; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  const preset = {
    currentPresetName: 'Example',
    async initialize() { loaded++; if (loadError) throw Error('Read failed'); },
    refreshDisplayedPrompts(value) { assert.equal(value.length, 0); cleared++; },
  };
  runInNewContext(helper + '\n' + hook, {
    window: { parent: host },
    // Hidden iframe frames may never run. Startup must not request one.
    requestAnimationFrame() { throw Error('Used hidden iframe frame'); },
    i: { onMounted(fn) { mounted = fn; }, onBeforeUnmount(fn) { unmount = fn; }, nextTick: () => Promise.resolve() },
    p: { set value(value) { shown = value; } }, a: preset,
    l: { updateThemeColors() {}, startObserving() { if (themeError) throw Error('Theme failed'); } },
    toastr: { error() { notice++; } }, console: { warn() {}, error() {} },
  });
  const pending = mounted();
  assert.equal(shown, true, 'Shell must be visible before any frame or data read');
  await pending;
  assert.equal(loaded, 0, 'Data loading must yield for shell rendering');
  return { frames, timers, unmount, preset, counts: () => ({ loaded, cleared, notice }) };
}

// A normal visible-host frame starts once and removes its fallback.
{
  const f = await fixture();
  const lateTimer = [...f.timers.values()][0];
  [...f.frames.values()][0]();
  lateTimer();
  assert.equal(f.counts().loaded, 1);
  assert.equal(f.frames.size + f.timers.size, 0);
}
// A suspended frame cannot strand the shell or the initial data load.
for (const options of [{}, { noFrames: true }, { themeError: true }]) {
  const f = await fixture(options);
  const lateFrame = [...f.frames.values()][0];
  [...f.timers.values()][0]();
  lateFrame?.();
  assert.equal(f.counts().loaded, 1);
  assert.equal(f.frames.size + f.timers.size, 0);
}
// Closing during startup cancels both pending paths; callbacks cannot load later.
{
  const f = await fixture();
  const pending = [...f.frames.values(), ...f.timers.values()];
  f.unmount();
  pending.forEach(fn => fn());
  assert.equal(f.counts().loaded, 0);
  assert.equal(f.frames.size + f.timers.size, 0);
}
// Preserve the existing safe-mode recovery for a preset read failure.
{
  const f = await fixture({ loadError: true });
  [...f.timers.values()][0]();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.counts(), { loaded: 1, cleared: 1, notice: 1 });
  assert.equal(f.preset.currentPresetName, '');
}
console.log('Panel startup passed: immediate shell, visible-host scheduling, stalled-frame fallback, cancellation, theme failure and preset recovery.');
