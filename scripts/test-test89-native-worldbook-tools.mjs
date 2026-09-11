import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../dist/worldbook-snapshots.js',import.meta.url),'utf8');

assert.match(source,/data-pmm-native-worldbook-action="batch"/,'Native worldbook header is missing the batch manager');
assert.match(source,/data-pmm-native-worldbook-action="snapshot"/,'Native worldbook header is missing the snapshot camera');
assert.match(source,/void open\('global','',true\)/,'Worldbook camera does not restore the last snapshot category');
assert.match(source,/快照已保存，请手动应用或绑定当前聊天/,'Character snapshot save still claims or implies an automatic apply');
assert.match(source,/optionalHelper\('deleteWorldbook'\)/,'Batch deletion does not reuse Tavern Helper worldbook deletion');
assert.match(source,/搜索、多选并删除世界书/,'Batch manager has expanded beyond the agreed search/select/delete scope');
assert.doesNotMatch(source,/批量挂载|批量导出|根据所选世界书直接新建分组/,'Batch manager contains unapproved extra actions');
assert.match(source,/角色绑定世界书/,'Batch manager does not group character-bound worldbooks');
assert.match(source,/非角色绑定世界书/,'Batch manager does not group unbound worldbooks');
assert.match(source,/row\.characters\.length/,'Batch grouping does not use actual character bindings');
assert.ok(source.indexOf('非角色绑定世界书')<source.indexOf('角色绑定世界书 ·'),'Unbound worldbooks are not rendered before character-bound worldbooks');
assert.match(source,/batchBoundExpanded = false/,'Character-bound worldbooks are not collapsed by default');
assert.match(source,/data-batch-action="toggle-bound"/,'Collapsed character-bound section has no expand control');
assert.match(source,/if\(!batchBoundExpanded\)for\(const row of batchBooks\.filter\(row=>row\.characters\.length\)\)batchSelected\.delete\(row\.name\)/,'Collapsing character-bound books retains hidden destructive selections');
assert.match(source,/\(!row\.characters\.length \|\| batchBoundExpanded\)/,'Select all can still include collapsed character-bound worldbooks');
assert.match(source,/function renderBatch\(preserveScroll=false\)/,'Batch interactions cannot preserve the current scroll position');
assert.match(source,/body\.scrollTop\+=toggle\.getBoundingClientRect\(\)\.top-body\.getBoundingClientRect\(\)\.top-6/,'Expanding character-bound books does not reveal the section in its own scroller');
assert.match(source,/renderBatch\(!expanding\);if\(expanding\)revealBatchBoundStart\(\)/,'Character-bound expansion still resets to the top of the unbound list');
assert.doesNotMatch(source,/renderBatch\(\);batchOverlay\.querySelector\('\.pmm-wbs-batch-search'\)\?\.focus\(\)/,'Opening batch manager still forces the search field to focus');
assert.match(source,/names\.length<nativeCatalogNames\.length/,'Native catalog deletion is not distinguished from a rename');
assert.match(source,/engine\.reconcileBooks\(current\)/,'Native worldbook deletion does not reconcile snapshot group references');

console.log('Native worldbook tools passed: compact header entries, scoped batch deletion and group reconciliation.');
