import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/worldbook-snapshots.js', import.meta.url), 'utf8');

// --- 1. Lazy book entries: collapsed books should NOT pre-render entry DOM ---

assert.ok(
  source.includes('const isOpen=!!draft.expanded[name]'),
  'draftMarkup 必须检查世界书展开状态'
);
assert.ok(
  !source.slice(source.indexOf('function draftMarkup()'),source.indexOf('\nfunction groupEditorMarkup')).includes('bookEntriesMarkup('),
  'draftMarkup 不应同步渲染任何世界书条目，包括恢复为展开状态的分组'
);
assert.ok(
  source.includes("if(draft)for(const details of overlay.querySelectorAll('[data-draft-book][open]'))ensureBookEntries(details)"),
  '重新渲染后，已展开分组也必须统一进入渐进渲染流程'
);

// --- 2. ensureBookEntries must exist and apply search filter on expand ---

assert.ok(
  source.includes('function ensureBookEntries(details)'),
  '必须有 ensureBookEntries 辅助函数'
);
assert.ok(
  source.includes('container.dataset.rendered || container.dataset.rendering'),
  'ensureBookEntries 必须检查 data-rendered 避免重复渲染'
);

// ensureBookEntries must render bounded batches across animation frames.
{
  const fnStart = source.indexOf('function ensureBookEntries(details)');
  const fnBody = source.slice(fnStart, source.indexOf('\nfunction draftMarkup', fnStart));
  assert.ok(
    fnBody.includes('offset+BOOK_ENTRY_RENDER_BATCH_SIZE'),
    '每帧必须只创建固定批量的世界书条目'
  );
  assert.ok(
    fnBody.includes('scheduleBookEntryRender(()=>scheduleBookEntryRender(renderBatch))'),
    '首次条目生成前必须给 details 展开状态留出一次绘制机会'
  );
  assert.ok(
    fnBody.includes('scheduleBookEntryRender(renderBatch)'),
    '剩余条目必须分散到后续帧继续创建'
  );
  assert.ok(
    fnBody.includes("if(!details.open){stop();return;}"),
    '分组在生成途中折叠时必须暂停，避免后台继续占用帧时间'
  );
  assert.ok(
    fnBody.includes("container.dataset.rendered='1'"),
    '全部批次完成后必须设置 data-rendered 标记'
  );
  assert.ok(
    fnBody.includes('filterDraft(name)'),
    '每批生成后必须应用当前搜索词，不能短暂显示不匹配条目'
  );
}

assert.ok(source.includes('const BOOK_ENTRY_RENDER_BATCH_SIZE=12'), '世界书条目每帧批量上限应保持为 12');
assert.ok(source.includes('container.dataset.renderedCount'), '折叠后重新展开必须从已生成数量继续，不能重复创建条目');

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
  const fnStart = source.indexOf('function bookEntriesMarkup(name, entries)');
  const fnEnd = source.indexOf('\nfunction scheduleBookEntryRender', fnStart);
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

console.log('test.v302 回归通过：世界书条目分帧渐进生成、折叠续传、正文按需加载、批量单行更新与 CSS 离屏渲染优化均已覆盖。');
