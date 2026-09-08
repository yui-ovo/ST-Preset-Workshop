import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workshop = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const entry = await readFile(new URL('../dist/index.js', import.meta.url), 'utf8');

for (const forcedSetting of [
  'toastr.options.timeOut=300',
  'toastr.options.extendedTimeOut=100',
]) {
  assert.ok(
    !workshop.includes(forcedSetting),
    `工坊仍在强制改写酒馆通知时长：${forcedSetting}`,
  );
}

assert.ok(workshop.includes('const toastr = new Proxy'), '顶部通知作用域代理丢失');
assert.ok(workshop.includes('V2.99 已加载：顶部通知遵循酒馆时长'), '缺少 v2.99 运行标记');
assert.ok(entry.includes("const EXTENSION_VERSION = '2.97.24'"), '启动器版本未更新');
assert.ok(entry.includes("new URL('./workshop-v3.02.js'"), '启动器没有加载 v2.99');

console.log('v2.99 通知时长测试通过：不再改写全局 toastr 计时，并保留工坊通知开关。');
