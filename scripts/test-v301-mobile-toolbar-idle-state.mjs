import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const start = source.indexOf('/* 手机顶部工具按钮：静止态与日间一致地融入标题栏，只给启用态和按压态显示框。 */');
const end = source.indexOf('  .header-right {', start);

assert.ok(start >= 0 && end > start, '找不到手机顶部按钮静止态样式');
const css = source.slice(start, end);

assert.ok(css.includes('#preset-manager-main-panel.pmm-mobile-layout-enabled .pm-header .header-right > .header-card'), '样式没有限定在手机顶部工具栏');
assert.ok(css.includes(':not(.active):not(.primary):not(:active)'), '静止态会误清除当前启用或保存高亮');
assert.ok(css.includes('background: transparent !important'), '静止按钮仍保留夜间底色');
assert.ok(css.includes('border-color: transparent !important'), '静止按钮仍保留夜间边框');
assert.ok(css.includes('box-shadow: none !important'), '静止按钮仍保留夜间阴影');
assert.ok(css.includes('.card-icon'), '按钮内部图标卡片没有同步去框');
assert.ok(css.includes(':not(.active):not(.primary):not(:active)::before'), '取消按钮后仍可能残留触屏悬停竖线');
assert.ok(css.includes('height: 0 !important'), '取消按钮后的左侧竖线没有归零');
assert.ok(css.includes('opacity: 0 !important'), '触屏悬停残留竖线没有隐藏');
assert.ok(css.includes(':not(.active):not(.primary):active'), '轻点时缺少短暂按压反馈');
assert.ok(!css.includes('.header-left'), '标题名称外框被顶部按钮样式误伤');
assert.ok(source.includes('.action-card.active'), '原有启用态样式丢失');
assert.ok(source.includes('.action-card.primary'), '原有保存高亮样式丢失');

console.log('v3.01 手机顶部按钮通过：夜间静止态无框，取消后无悬停竖线。');
