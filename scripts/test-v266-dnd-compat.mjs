import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workshop = (await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8')).replace(/pmmRuntimeResource\((\w+)\)/g, '$1');

const compatStart = workshop.indexOf('PMM_MOBILE_DND_COMPAT_V266');
const compatEnd = workshop.indexOf('PMM_MOBILE_LAYOUT_TUNER_V1', compatStart);
assert.ok(compatStart >= 0 && compatEnd > compatStart, '无法隔离 v2.66 轻量拖拽兼容模块');
const compat = workshop.slice(compatStart, compatEnd);

for (const snippet of [
  "const STORAGE_KEY = 'pmm_mobile_drag_compat_v1'",
  "const API_KEY = '__PMM_MOBILE_DND_COMPAT_V266__'",
  "TOP.localStorage?.getItem(STORAGE_KEY) === '1'",
  'if (enabled) install();',
  'else console.info',
  "timer:TOP.setTimeout(activate, HOLD_MS)",
  "fire('dragstart', active.source, active.point)",
  "fire('dragover', active.target, point)",
  "fire('drop', session.target, session.point)",
  "ghost.className = 'pmm-dnd-compat-ghost'",
  'name.textContent = String(',
  '-webkit-backdrop-filter:none!important',
  'max-width:min(220px,calc(100vw - 28px))',
]) {
  assert.ok(compat.includes(snippet), `轻量兼容拖拽缺少关键行为：${snippet}`);
}

for (const forbidden of [
  'source.cloneNode(true)',
  'ghost.innerHTML = source.innerHTML',
  'backdrop-filter:blur(',
  'width = Math.min(Math.max(rect.width',
]) {
  assert.ok(!compat.includes(forbidden), `兼容模式重新引入了高开销整卡 ghost：${forbidden}`);
}

const tunerStart = workshop.indexOf('PMM_MOBILE_LAYOUT_TUNER_V1');
const tunerEnd = workshop.indexOf('PMM_FLOATING_PANEL_BATCH_V1', tunerStart);
assert.ok(tunerStart >= 0 && tunerEnd > tunerStart, '无法隔离布局调节模块');
const tuner = workshop.slice(tunerStart, tunerEnd);
const footerIndex = tuner.indexOf('<footer class="pmm-layout-card__footer">');
const resetIndex = tuner.indexOf('data-pmm-layout-reset', footerIndex);
const compatButtonIndex = tuner.indexOf('data-pmm-layout-dnd-compat', footerIndex);
const doneIndex = tuner.indexOf('data-pmm-layout-done', footerIndex);
assert.ok(resetIndex >= 0 && resetIndex < compatButtonIndex && compatButtonIndex < doneIndex, '拖拽兼容按钮没有放在底部中央');

for (const snippet of [
  '拖拽兼容：<span data-pmm-dnd-state>关</span>',
  "button.setAttribute('aria-pressed', enabled ? 'true' : 'false')",
  'setDragCompatEnabled(!dragCompatEnabled())',
  'setDragCompatEnabled(false)',
  "TOP.localStorage?.setItem(DND_COMPAT_STORAGE_KEY, enabled ? '1' : '0')",
  '.pmm-layout-dnd-btn.pmm-layout-dnd-btn--active',
  '.pmm-layout-dnd-btn{display:none!important}',
]) {
  assert.ok(tuner.includes(snippet), `布局调节开关缺少关键行为：${snippet}`);
}

for (const snippet of [
  "draggable:!s.value,'data-prompt-id':e.prompt.id",
  "e.dataTransfer.effectAllowed='move'",
  "e.dataTransfer.setData('text/plain'",
  'e.dataTransfer.setDragImage',
]) {
  assert.ok(workshop.includes(snippet), `默认浏览器原生拖拽链路不完整：${snippet}`);
}

console.log('v2.66 拖拽模式测试通过：原生拖拽默认保留，底部中央可按浏览器开启无整卡克隆的轻量兼容模式。');
