import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/worldbook-snapshots.js', import.meta.url), 'utf8');
const match = source.match(/function makeSnapshotId\(\) \{[\s\S]*?\n\}\nconst ctx/);
assert.ok(match, '找不到世界书快照兼容 ID 生成器');
assert.ok(source.includes('id: makeSnapshotId, character, chat, catalog,'), '世界书快照引擎必须使用兼容 ID 生成器');
assert.ok(!source.includes('id: () => TOP.crypto.randomUUID()'), '不得直接依赖安全上下文才提供的 randomUUID');
assert.ok(!source.includes('pmm-snapshot-opaque') && !source.includes('--wbs-safe-surface') && !source.includes('--wbs-safe-card'), '已撤掉快照实色底与安卓强制不透明类');

const declaration = match[0].slice(0, -'\nconst ctx'.length);
const build = top => Function('TOP', 'Uint8Array', 'Date', 'Math', `${declaration}; return makeSnapshotId;`)(top, Uint8Array, Date, Math);
assert.equal(build({ crypto: { randomUUID: () => 'native-id' } })(), 'native-id', '支持 randomUUID 时应继续使用原生实现');

const legacyCrypto = {
  getRandomValues(bytes) {
    bytes.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    return bytes;
  },
};
const compatibleId = build({ crypto: legacyCrypto })();
assert.match(compatibleId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, '缺少 randomUUID 的 iOS 环境仍须生成标准 UUID');
assert.match(build({})(), /^pmm-wbs-[a-z0-9]+-[a-z0-9]+$/i, '完全没有 Web Crypto 时仍须提供最终备用 ID');

console.log('test.41 iOS 世界书分组 ID 回归通过：原生、旧版 Web Crypto 与无 Crypto 环境均可保存。');
