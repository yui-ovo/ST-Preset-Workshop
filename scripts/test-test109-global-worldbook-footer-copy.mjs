import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/worldbook-snapshots.js', import.meta.url), 'utf8');
const footer = source.match(/<footer class=\"pmm-wbs-foot\"><small>\$\{[\s\S]*?<\/small>/)?.[0] || '';

assert.ok(footer.includes("page==='global' ? '可一键全局挂载世界书分组；也可为分组世界书创建快照。'"), '全局世界书页必须显示新的分组与快照说明');
assert.ok(!source.includes('分组开启时应用所选方案；关闭不卸载其他分组需要的书。'), '旧的全局世界书说明必须移除');
assert.ok(footer.includes("page==='character'?'只保存开关；聊天锁或“应用”才会应用。'"), '角色世界书说明不得被改动');

console.log('test.109 全局世界书底部说明回归通过：仅替换全局页文案。');
