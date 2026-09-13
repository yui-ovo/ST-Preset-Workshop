import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const marker = '/* PMM_BRANCH_DIFF_REBASE_TEST108';
const start = source.indexOf(marker);
const end = source.indexOf('function Ae(', start);

assert.ok(start >= 0 && end > start, '找不到分支继承重基实现');
assert.ok(source.includes('function _pmmReadBranchDiffs(e,n)'), '重基逻辑必须读取已保存的显式 diffs');
assert.ok(source.includes('_pmmBranchRebaseDraft(d(A.value),_pmmReadBranchDiffs(A.value,a.value)'), '保存分支前必须重基草稿');
assert.ok(source.includes('je().rebaseForDefaultUpdate?.(e.value)'), '默认预设保存后必须通知已打开的分支编辑器重基');

const sandbox = { structuredClone, JSON, Map, Set, Array, String, Object };
sandbox.globalThis = sandbox;
vm.runInNewContext(
  `${source.slice(start, end)}\nglobalThis.rebase = _pmmBranchRebaseDraft;\nglobalThis.applyDiffs = _pmmBranchApplyDiffs;`,
  sandbox,
  { filename: 'workshop-v3.02.branch-rebase.js' },
);

const clone = value => structuredClone(value);
const prompt = id => ({
  id,
  name: id,
  enabled: true,
  role: 'system',
  content: id,
  position: { type: 'relative' },
});
const enabled = (prompts, id) => prompts.find(prompt => prompt.id === id)?.enabled;

function makeDiffs(base, draft) {
  const baseById = new Map(base.map(item => [item.id, item]));
  const fields = ['name', 'enabled', 'role', 'content', 'position'];
  const diffs = [];

  for (const item of draft) {
    const original = baseById.get(item.id);
    if (!original) {
      diffs.push({ id: item.id, changes: clone(item) });
      continue;
    }
    const changes = {};
    for (const field of fields) {
      if (JSON.stringify(item[field]) !== JSON.stringify(original[field])) {
        changes[field] = clone(item[field]);
      }
    }
    if (Object.keys(changes).length) diffs.push({ id: item.id, changes });
  }
  return diffs;
}

// 默认 A/B/C/D 全开，新建分支时没有显式差异。
const initialDefault = ['A', 'B', 'C', 'D'].map(prompt);
const initialBranchDraft = clone(initialDefault);
const noBranchDiffs = [];

// 默认随后保存 D=关闭；打开着的分支草稿必须立即继承最新 D。
const defaultWithDOff = clone(initialDefault);
defaultWithDOff.find(item => item.id === 'D').enabled = false;
const afterDefaultChanged = sandbox.rebase(
  defaultWithDOff,
  noBranchDiffs,
  initialBranchDraft,
  initialBranchDraft,
);
assert.equal(enabled(afterDefaultChanged.prompts, 'D'), false, '未显式覆盖的 D 必须继承默认关闭');
assert.equal(enabled(afterDefaultChanged.baseline, 'D'), false, '重基后的草稿基线必须更新为最新默认');
assert.equal(enabled(sandbox.applyDiffs(defaultWithDOff, noBranchDiffs), 'D'), false, '重新进入或应用分支时也必须继承默认关闭');

// 分支只关闭 C 后保存，不能把旧 D=开启误写成分支差异。
const editCOnly = clone(afterDefaultChanged.prompts);
editCOnly.find(item => item.id === 'C').enabled = false;
const beforeSave = sandbox.rebase(
  defaultWithDOff,
  noBranchDiffs,
  afterDefaultChanged.baseline,
  editCOnly,
);
const diffsAfterC = makeDiffs(defaultWithDOff, beforeSave.prompts);
assert.deepEqual(diffsAfterC, [{ id: 'C', changes: { enabled: false } }], '只编辑 C 时只能保存 C 的差异');
const appliedAfterC = sandbox.applyDiffs(defaultWithDOff, diffsAfterC);
assert.equal(enabled(appliedAfterC, 'C'), false, '应用测试分支后 C 应关闭');
assert.equal(enabled(appliedAfterC, 'D'), false, '应用测试分支后 D 仍应继承默认关闭');

// 只有用户随后主动把 D 打开，D 才成为这个分支自己的差异。
const reopenedBaseline = clone(appliedAfterC);
const editDExplicitly = clone(appliedAfterC);
editDExplicitly.find(item => item.id === 'D').enabled = true;
const beforeExplicitDSave = sandbox.rebase(
  defaultWithDOff,
  diffsAfterC,
  reopenedBaseline,
  editDExplicitly,
);
const diffsAfterExplicitD = makeDiffs(defaultWithDOff, beforeExplicitDSave.prompts);
assert.deepEqual(
  diffsAfterExplicitD,
  [
    { id: 'C', changes: { enabled: false } },
    { id: 'D', changes: { enabled: true } },
  ],
  '用户主动打开 D 后，D 才应成为分支自己的显式差异',
);
const appliedAfterExplicitD = sandbox.applyDiffs(defaultWithDOff, diffsAfterExplicitD);
assert.equal(enabled(appliedAfterExplicitD, 'C'), false);
assert.equal(enabled(appliedAfterExplicitD, 'D'), true);

console.log('test.108 分支 diff 重基回归通过：继承字段跟随默认，显式修改才写入分支。');
