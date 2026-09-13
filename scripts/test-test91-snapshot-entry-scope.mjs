import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../dist/worldbook-snapshots.js',import.meta.url),'utf8');

assert.match(source,/const tabLabels = \{ character: '角色世界书', global: '全局世界书' \};/,'Worldbook camera still exposes the preset tab');
assert.match(source,/function lastWorldTab\(\)[\s\S]*?\['character','global'\]\.includes\(value\.page\)/,'Worldbook tab memory is not limited to character/global');
assert.match(source,/function rememberWorldTab\(value\) \{ if\(\['character','global'\]\.includes\(value\?\.page\)\)/,'Worldbook tab memory can still record the preset page');
assert.match(source,/dialog\.querySelector\('\.pmm-snapshot-tabs'\)\?\.remove\(\);/,'Preset snapshot overlay does not remove stale cross-category tabs');
assert.doesNotMatch(source,/function resumeLast\(|resumeLast, engine/,'Legacy cross-entry resume API is still exposed');
assert.match(source,/page=last\?\.page \|\| \(scope==='global'\?'global':'character'\);/,'Worldbook camera does not restore its own last category');

console.log('test.91 回归通过：预设相机与世界书相机入口隔离，世界书只记忆角色／全局分类。');
