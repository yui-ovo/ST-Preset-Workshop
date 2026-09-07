import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const startMarker = '/* ===== PMM_FLOATING_PANEL_BATCH_V1：悬浮预设与批量管理 ===== */';
const start = source.indexOf(startMarker);
const end = source.indexOf('/* ===== PMM_TAURITAVERN_ADAPTER_V290', start);

assert.ok(start >= 0 && end > start, '无法定位悬浮预设入口补丁');
const floating = source.slice(start, end);

assert.ok(floating.includes("TOP.matchMedia?.('(max-width: 768px)')"), '桌面／手机判断没有读取顶层酒馆页面的宽度');
assert.ok(floating.includes('const view = TOP || SELF;'), '无 matchMedia 时没有以顶层页面视口作为回退');
assert.ok(!floating.includes("const MEDIA = SELF.matchMedia?.('(max-width: 768px)');"), '不能只按脚本 iframe 的窄宽度判断手机端');

const nativeMouseGuard = "if (!isMobile()) return;";
assert.ok(floating.includes(nativeMouseGuard), '移动端的原生鼠标事件拦截必须受正确的手机判断保护');

console.log('test.44 回归通过：悬浮入口按顶层酒馆页面判断桌面／手机，不会被脚本 iframe 宽度误判。');
