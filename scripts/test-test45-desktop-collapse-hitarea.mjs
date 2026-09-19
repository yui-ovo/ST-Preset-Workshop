import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const marker = '/* 桌面浮动栏右侧的收起箭头原本只有 16px，难以准确点按。 */';
const start = source.indexOf(marker);
const end = source.indexOf('@media screen and (max-width:768px)', start);

assert.ok(start >= 0 && end > start, '无法定位桌面收起按钮热区样式');
const desktopStyle = source.slice(start, end);

assert.ok(desktopStyle.includes('@media screen and (min-width:769px)'), '收起热区应只在桌面宽度启用');
assert.ok(desktopStyle.includes('width:328px!important'), '移除工坊相机后浮动栏没有恢复紧凑宽度');
assert.ok(desktopStyle.includes('flex:0 0 30px!important;width:30px!important;height:26px!important'), '桌面收起按钮没有扩展为足够的点击区');
assert.ok(desktopStyle.includes(':not(.pmm-floating-mobile) .panel-collapse'), '移动端收起按钮不应被桌面热区改动影响');
assert.ok(desktopStyle.includes('.panel-section:has(.panel-select--preset)'), '预设名较长时没有为收起区保留可收缩空间');
assert.ok(desktopStyle.includes('text-overflow:clip!important'), '长预设名必须单行硬截断并保留收起箭头');
assert.ok(desktopStyle.includes('margin:0!important;border-radius:0 7px 7px 0!important'), '收起按钮不应以负边距挤出固定宽度工具栏');

console.log('test.45 回归通过：桌面浮动栏移除相机后恢复紧凑宽度，并保留独立的 30px 收起热区。');
