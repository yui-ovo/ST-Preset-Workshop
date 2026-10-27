import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8')).replace(/pmmRuntimeResource\((\w+)\)/g, '$1');
const selector = '#preset-manager-main-panel.pmm-layout-custom-item-height .prompt-item:not(.prompt-item--expanded){';
const blocks = source.split(selector).slice(1).map(part => part.slice(0, part.indexOf('}')));

assert.equal(blocks.length, 2, '手机与窄屏布局都应覆盖自定义普通条目高度');
for (const block of blocks) {
  assert.match(block, /content-visibility:visible!important;/, '自定义高度时必须关闭离屏跳过绘制');
  assert.match(block, /contain:none!important;/, '自定义高度时必须解除条目自身的布局 containment');
  assert.match(block, /contain-intrinsic-size:none!important;/, '自定义高度时不能继续使用缓存占位高度');
}

assert.match(source, /content-visibility:\s*auto;\s*\n\s*contain-intrinsic-size:\s*auto 82px;/, '默认高度仍应保留安卓离屏性能优化');
console.log('v2.92 安卓自定义普通条目高度回归检查通过。');
