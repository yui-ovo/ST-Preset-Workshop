import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/worldbook-stitch-test3.js', import.meta.url), 'utf8');

const legacyStart = source.indexOf('  async function getLegacyWorldInfoNames()');
const compatibleStart = source.indexOf('  async function getWorldInfoNamesCompatible()', legacyStart);
const refreshStart = source.indexOf('  async function refreshWorldNames()', compatibleStart);
assert.ok(legacyStart >= 0 && compatibleStart > legacyStart && refreshStart > compatibleStart, 'test.48 无法定位旧版世界书枚举兼容链路');

const legacy = source.slice(legacyStart, compatibleStart);
for (const marker of [
  "typeof context?.getRequestHeaders !== 'function'",
  "await TOP.fetch('/api/settings/get'",
  "method: 'POST'",
  'headers: context.getRequestHeaders()',
  'body: JSON.stringify({})',
  'Array.isArray(data?.world_names) ? data.world_names : []',
]) {
  assert.ok(legacy.includes(marker), `test.48 旧版酒馆列表读取缺少实现：${marker}`);
}

const compatible = source.slice(compatibleStart, refreshStart);
for (const marker of [
  "if (typeof context?.getWorldInfoNames === 'function')",
  'return await context.getWorldInfoNames();',
  'return await getLegacyWorldInfoNames();',
]) {
  assert.ok(compatible.includes(marker), `test.48 新旧酒馆严格分流缺少实现：${marker}`);
}
assert.ok(!compatible.includes('worldNames.length'), 'test.48 不得因 1.18 暂时返回空列表而误切换旧版接口');

const refresh = source.slice(refreshStart, source.indexOf('  function helperFunction(', refreshStart));
assert.equal(refresh.match(/await getWorldInfoNamesCompatible\(\)/g)?.length, 2, 'test.48 初次读取和原生刷新后都必须使用同一兼容入口');
console.log('test.48 回归通过：正常版原有世界书文件保持不变；1.18 保持原生枚举路径，仅在缺少接口的 1.14 等旧版中读取 settings.world_names。');
