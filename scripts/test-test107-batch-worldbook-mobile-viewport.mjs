import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/worldbook-snapshots.js', import.meta.url), 'utf8');

assert.ok(source.includes('let batchOverlay = null, batchViewportCleanup = null'), '批量管理弹窗必须拥有独立的视口清理器');
assert.match(source, /function bindBatchViewport\(\)[\s\S]*?const node = batchOverlay;[\s\S]*?position:'fixed'[\s\S]*?width:`\$\{width\}px`, height:`\$\{height\}px`/, '批量管理弹窗必须将遮罩锁定到真实可视区域');
assert.ok(source.includes("node.style.setProperty('--wbs-batch-visible-height', `${height}px`);"), '批量管理弹窗高度必须传给对话框 CSS');
assert.ok(source.includes("DOC.body.append(batchOverlay);theme(batchOverlay);bindBatchViewport();renderBatch();"), '创建批量管理弹窗后必须立即绑定手机视口');
assert.ok(source.includes('batchViewportCleanup?.(); batchViewportCleanup=null;\n  batchOverlay?.remove();'), '关闭批量管理弹窗时必须清理视口监听');
assert.ok(source.includes('var(--wbs-batch-visible-height,100dvh)'), '批量管理对话框必须使用实时可视高度变量');

console.log('test.44 batch worldbook mobile viewport regression checks passed');
