import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/worldbook-snapshots.js', import.meta.url), 'utf8');

// --- 1. Lazy book entries: collapsed books should NOT pre-render entry DOM ---

assert.ok(
  source.includes('const isOpen=!!draft.expanded[name]'),
  'draftMarkup 必须检查世界书展开状态'
);
assert.ok(
  source.includes("const entriesContent=isOpen?bookEntriesMarkup(name,data):''"),
  '折叠世界书不应预渲染条目 DOM'
);
assert.ok(
  source.includes('const rendered=isOpen'),
  '已渲染的世界书必须标记 data-rendered'
);

// --- 2. ensureBookEntries must exist and apply search filter on expand ---

assert.ok(
  source.includes('function ensureBookEntries(details)'),
  '必须有 ensureBookEntries 辅助函数'
);
assert.ok(
  source.includes('container.dataset.rendered'),
  'ensureBookEntries 必须检查 data-rendered 避免重复渲染'
);

// ensureBookEntries must call filterDraft after rendering to apply search
{
  const fnStart = source.indexOf('function ensureBookEntries(details)');
  const fnBody = source.slice(fnStart, source.indexOf('\n}\n', fnStart) + 3);
  assert.ok(
    fnBody.includes("container.dataset.rendered='1'"),
    'ensureBookEntries 渲染后必须设置 data-rendered 标记'
  );
  assert.ok(
    fnBody.includes('filterDraft(name)'),
    'ensureBookEntries 渲染后必须立即应用搜索过滤，不能短暂显示全部条目'
  );
  // filterDraft must come AFTER rendered='1' to ensure it runs on fresh DOM
  const renderedIdx = fnBody.indexOf("container.dataset.rendered='1'");
  const filterIdx = fnBody.indexOf('filterDraft(name)');
  assert.ok(
    filterIdx > renderedIdx,
    'filterDraft 必须在设置 rendered 标记之后调用'
  );
}

// The toggle event handler must call ensureBookEntries on open
const toggleHandler = source.match(/overlay\.addEventListener\('toggle'[\s\S]*?},true\)/)?.[0] || '';
assert.ok(
  toggleHandler.includes('ensureBookEntries(event.target)'),
  '展开折叠世界书时必须调用 ensureBookEntries 按需渲染'
);
assert.ok(
  toggleHandler.includes('if(event.target.open)'),
  'ensureBookEntries 只在展开时调用，折叠时不重复渲染'
);

// --- 3. Entry preview content loaded on demand ---

assert.ok(
  source.includes('preview.dataset.loaded'),
  '条目正文必须通过 data-loaded 标记避免重复加载'
);

// bookEntriesMarkup must produce empty preview containers (not pre-filled with content)
{
  const fnStart = source.indexOf('function bookEntriesMarkup(name, data)');
  const fnEnd = source.indexOf('\nfunction ensureBookEntries', fnStart);
  const fnBody = source.slice(fnStart, fnEnd);
  // Should have empty hidden preview div
  assert.ok(
    fnBody.includes('entry-preview" hidden></div>'),
    '初始条目 DOM 中正文容器必须为空'
  );
  // Should NOT pre-render the preview content class
  assert.ok(
    !fnBody.includes('pmm-wbs-entry-preview-content'),
    '初始条目 DOM 不应包含正文内容元素'
  );
}

// preview-entry click handler must fill content on first expand
{
  const handlerStart = source.indexOf("action==='preview-entry'");
  const handlerEnd = source.indexOf('return;\n  }', handlerStart);
  const handler = source.slice(handlerStart, handlerEnd + 12);
  assert.ok(
    handler.includes('!preview.dataset.loaded'),
    '首次展开正文必须检查 data-loaded 标记'
  );
  assert.ok(
    handler.includes("preview.dataset.loaded='1'"),
    '展开正文后必须设置 data-loaded 标记'
  );
  assert.ok(
    handler.includes('pmm-wbs-entry-preview-content'),
    '展开正文时必须动态填入内容 DOM'
  );
}

// --- 4. Batch row single-update optimization ---

assert.ok(
  source.includes('function updateBatchRow(name)'),
  '必须有 updateBatchRow 单行更新函数'
);
assert.ok(
  source.includes('function updateBatchFooter()'),
  '必须有 updateBatchFooter 底栏更新函数'
);

// toggle action must use updateBatchRow, not renderBatch
{
  // Find the line containing the toggle action
  const toggleIdx = source.indexOf("action==='toggle')");
  const toggleLineEnd = source.indexOf('\n', toggleIdx);
  const toggleLine = source.slice(toggleIdx, toggleLineEnd);
  assert.ok(
    toggleLine.includes('updateBatchRow(name)'),
    '勾选单个世界书必须使用 updateBatchRow 单行更新'
  );
  assert.ok(
    !toggleLine.includes('renderBatch'),
    '勾选单个世界书不应调用 renderBatch 整页重绘'
  );
}

// select-all action must use updateBatchRow per visible name
{
  const selectIdx = source.indexOf("action==='select-all')");
  const selectLineEnd = source.indexOf('\n', selectIdx);
  const selectLine = source.slice(selectIdx, selectLineEnd);
  assert.ok(
    selectLine.includes('updateBatchRow(name)'),
    '全选操作必须逐行 updateBatchRow'
  );
  assert.ok(
    selectLine.includes('updateBatchFooter'),
    '全选操作必须更新底栏'
  );
}

// --- 5. CSS content-visibility optimization ---

assert.ok(
  source.includes('.pmm-wbs-entry-block { content-visibility:auto; contain-intrinsic-size:auto 50px; }'),
  '条目行必须使用 content-visibility:auto 离屏渲染优化'
);
assert.ok(
  source.includes('.pmm-wbs-batch-row { content-visibility:auto; contain-intrinsic-size:auto 44px; }'),
  '批量管理行必须使用 content-visibility:auto 离屏渲染优化'
);
assert.ok(
  source.includes('.pmm-wbs-row { content-visibility:auto; contain-intrinsic-size:auto 70px; }'),
  '快照列表卡片必须使用 content-visibility:auto 离屏渲染优化'
);

// --- 6. No visual effect removal ---

assert.ok(
  source.includes('backdrop-filter:blur'),
  '毛玻璃效果不应被删除'
);
assert.ok(
  source.includes('transition:'),
  '动画效果不应被删除'
);

console.log('test.v302 回归通过：懒加载折叠世界书条目、正文按需加载、批量单行更新、CSS 离屏渲染优化。搜索词展开场景已覆盖。');
