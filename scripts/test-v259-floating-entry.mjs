import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v2.59.js', import.meta.url), 'utf8');
const entry = await readFile(new URL('../dist/index.js', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));

assert.ok(source.includes('floatingWidth: 200'), '悬浮入口默认长度没有缩短到 200px');
assert.ok(source.includes('floatingWidth: [180, 420]'), '悬浮入口调节范围没有允许紧凑宽度');
assert.ok(
  source.includes("key === 'floatingWidth' && savedCustomized?.[key] !== true"),
  '旧版未定制的 328px 宽度不会迁移到新版默认值',
);
assert.ok(source.includes('mobile?.customized?.floatingWidth === true'), '读取宽度时没有区分默认值和用户自定义值');
assert.ok(source.includes('--pmm-mobile-floating-width,200px'), '悬浮入口 CSS 仍在回退到旧的 328px');
assert.ok(source.includes('const horizontalThreshold ='), '箭头横拖没有短距离换边阈值');
assert.ok(source.includes("if (dx <= -horizontalThreshold) nextDock = 'left'"), '向左横拖不能吸附左侧');
assert.ok(source.includes("else if (dx >= horizontalThreshold) nextDock = 'right'"), '向右横拖不能吸附右侧');

assert.ok(
  entry.includes(`const EXTENSION_VERSION = '${manifest.version}'`),
  '自动刷新没有使用当前扩展版本',
);
assert.ok(entry.includes("new URL('../manifest.json', import.meta.url)"), '自动刷新没有读取本地扩展清单');
assert.ok(entry.includes("cache: 'no-store'"), '版本检查仍可能读取缓存');
assert.ok(entry.includes('await sleep(900)'), '更新文件没有二次确认写入完成');
assert.ok(entry.includes('globalThis.location.reload()'), '检测到更新后没有刷新酒馆');
assert.ok(!entry.includes('const VERSION_CHECK_INTERVAL'), '不应保留常驻版本轮询间隔');
assert.ok(!/versionCheckTimer\s*=\s*globalThis\.setInterval/.test(entry), '不应常驻轮询扩展版本');
assert.ok(entry.includes("document.addEventListener('visibilitychange', handleVisibilityChange)"), '回到前台时仍应即时检查版本');

console.log('v2.59 悬浮入口测试通过：默认更短、箭头可短距离横拖换边，后续更新会自动刷新酒馆。');
