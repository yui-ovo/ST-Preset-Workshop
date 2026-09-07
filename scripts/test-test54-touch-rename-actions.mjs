import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

for (const marker of [
  'PMM_TOUCH_RENAME_ACTIONS_TEST54',
  '__PMM_TOUCH_RENAME_ACTIONS_TEST54__',
  '外层改名铅笔在触屏按下阶段直接生效',
]) {
  assert.ok(!source.includes(marker), `test.54 触屏外层改名补丁仍有残留：${marker}`);
}

console.log('test.54 回归通过：已移除触屏按下阶段提前触发外层改名铅笔的兼容模块，恢复正常点击逻辑。');
