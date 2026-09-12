import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/worldbook-snapshots.js', import.meta.url), 'utf8');
const core = await readFile(new URL('../dist/worldbook-snapshot-core.js', import.meta.url), 'utf8');

assert.ok(core.includes('host.catalog(scope, owner)'), '快照校验必须把作用域传给目录读取器');
assert.ok(source.includes('const CATALOG_BINDING_CONCURRENCY=4'), '完整角色绑定扫描必须限制并发数');
assert.ok(
  source.includes("scope==='names' ? [] : scope==='character' ? characters().filter(c=>c.key===owner) : characters()"),
  '目录读取必须区分仅名称、当前角色和完整扫描',
);
assert.ok(
  source.includes("full ? catalog() : current ? catalog('character',current.key) : catalog('names')"),
  '普通页面刷新必须只读取当前页面所需的绑定范围',
);

const mapStart = source.indexOf('async function boundedMap(');
const mapEnd = source.indexOf('\nasync function catalog(', mapStart);
assert.ok(mapStart >= 0 && mapEnd > mapStart, '无法定位有限并发目录读取器');
const boundedMap = Function(`${source.slice(mapStart, mapEnd)}; return boundedMap;`)();
let active = 0;
let peak = 0;
const mapped = await boundedMap([0,1,2,3,4,5,6,7,8], 4, async value => {
  active++;
  peak = Math.max(peak, active);
  await new Promise(resolve => setTimeout(resolve, 2 + value % 3));
  active--;
  return value * 2;
});
assert.deepEqual(mapped, [0,2,4,6,8,10,12,14,16], '有限并发读取必须保持角色顺序');
assert.ok(peak > 1 && peak <= 4, `完整扫描并发峰值应在 2–4 之间，实际为 ${peak}`);

const tabStart = source.indexOf('if (target.dataset.hubTab)');
const tabEnd = source.indexOf("} else if (action === 'choose')", tabStart);
const tabBody = source.slice(tabStart, tabEnd);
assert.ok(!tabBody.includes('refresh('), '角色／全局标签切换不得重新读取世界书目录');

const sectionStart = source.indexOf("else if (action === 'snapshots' || action === 'groups')");
const sectionEnd = source.indexOf("else if (action === 'new')", sectionStart);
assert.ok(!source.slice(sectionStart, sectionEnd).includes('refresh('), '世界书内部分页切换不得重新读取目录');

const groupEditStart = source.indexOf("else if (action === 'new-group' || action === 'edit-group')");
const groupEditEnd = source.indexOf("} else if (action === 'save-group')", groupEditStart);
assert.ok(source.slice(groupEditStart, groupEditEnd).includes('await refresh(true)'), '分组编辑前必须强制完整扫描，不能放入角色绑定世界书');

assert.ok(source.includes('const BOOK_ENTRY_INITIAL_BATCH_SIZE=2'), '展开世界书时必须立即生成极小首批条目');
assert.ok(source.includes('renderBatch(BOOK_ENTRY_INITIAL_BATCH_SIZE)'), '首批条目必须在点击帧内生成');
assert.ok(source.includes('scheduleBookEntryRender(()=>renderBatch(BOOK_ENTRY_RENDER_BATCH_SIZE))'), '其余条目必须继续分帧生成');
assert.ok(source.includes('.pmm-wbs-book-head .pmm-wbs-svg { width:14px; height:14px; transition:none; }'), '世界书箭头不应保留造成迟滞感的过渡动画');

console.log('test.111 世界书快照响应回归通过：页面切换复用目录、当前角色按需读取、完整扫描有限并发、首批条目即时显示。');
