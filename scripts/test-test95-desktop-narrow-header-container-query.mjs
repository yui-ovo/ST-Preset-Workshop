import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const moduleStart = source.indexOf("const API_KEY = '__PMM_DESKTOP_FOUR_CORNER_RESIZE__';");
const styleStart = source.indexOf('    style.textContent = `', moduleStart);
const cssStart = source.indexOf('`', styleStart) + 1;
const cssEnd = source.indexOf('\n    `;', cssStart);
assert.ok(moduleStart >= 0 && styleStart > moduleStart && cssEnd > cssStart, '无法提取桌面缩放与顶部布局样式');

const css = source.slice(cssStart, cssEnd);
const marker = 'PMM_DESKTOP_HEADER_NATURAL_WRAP_TEST36';
const headerStart = css.indexOf(marker);
assert.ok(headerStart >= 0, '必须提供桌面顶部工具组自然换行规则');
const headerCss = css.slice(headerStart);

for (const markerPart of [
  '@media screen and (min-width: 769px)',
  '#preset-manager-main-panel .pm-header {',
  '#preset-manager-main-panel .pm-header > .header-left {',
  '#preset-manager-main-panel .pm-header > .header-right {',
  'flex-wrap: wrap !important',
  'flex: 0 0 auto !important',
  'max-width: 100% !important',
  'margin-left: 0 !important',
  'justify-content: flex-start !important',
  'flex-wrap: nowrap !important',
  'overflow: visible !important',
  'flex-shrink: 0 !important',
]) {
  assert.ok(headerCss.includes(markerPart), `桌面顶部自然换行样式缺失：${markerPart}`);
}

assert.ok(!headerCss.includes(':not(.pmm-mobile-layout-enabled)'), '桌面规则不能被遗留移动布局类意外排除');
assert.ok(!headerCss.includes('overflow-x: auto !important'), '窄面板必须换行，不能使用横向滚动代替');
assert.ok(!headerCss.includes('container-type: inline-size'), '无需依赖固定阈值的容器查询；应根据两个真实 flex 项目自然换行');

console.log('test.95 回归通过：桌面顶部栏按标题和工具组的实际宽度自然换行，宽度充足时保持单行，窄宽度时整组工具进入第二行，且不受遗留移动布局类影响。');
