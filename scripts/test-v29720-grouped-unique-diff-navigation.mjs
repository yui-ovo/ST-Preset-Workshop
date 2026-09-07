import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

for (const marker of [
  'async function _pmmRevealPromptForCompare(e,n=0)',
  'A.prompts.filter(e=>String(e.name??\'\').trim()===t)',
  's.getItemSectionById(l.id,A.currentPresetName)',
  'return (name, occurrence = 0) => direct.reveal(name, occurrence)',
  'setTimeout(async () => {',
  'await revealPromptForDiff(panel, name, occurrence)',
]) {
  assert.ok(source.includes(marker), `缺少独有分组条目跳转修复：${marker}`);
}

assert.ok(
  source.includes("'仅上方预设存在', '仅下方预设存在'"),
  '未兼容“上方／下方”独有状态文案',
);

const helperStart = source.indexOf('function promptItemsByName(panel, name)');
const helperEnd = source.indexOf('function ensureExpanded(item)', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, '无法定位分组跳转辅助函数');

const helperSource = source.slice(helperStart, helperEnd);
const helpers = vm.runInNewContext(
  `(() => { ${helperSource}; return { revealPromptForDiff }; })()`,
  {
    console,
    waitForElement: async getter => getter(),
  },
);

function item(id, name) {
  const card = { dataset: { promptId: id } };
  const nameNode = { textContent: name };
  return {
    id,
    querySelector(selector) {
      if (selector === '.prompt-card__name') return nameNode;
      if (selector === '.prompt-card[data-prompt-id]') return card;
      return null;
    },
  };
}

const first = item('same-name-first', '同名条目');
const second = item('same-name-second', '同名条目');
let renderedItems = [first];
let revealArgs = null;
const panel = {
  querySelectorAll(selector) {
    return selector === '.prompt-item' ? renderedItems : [];
  },
  __pmmBatchVariableBridge: {
    async reveal(name, occurrence) {
      revealArgs = [name, occurrence];
      renderedItems = [first, second];
      return { revealed: true, id: 'same-name-second' };
    },
  },
};

const target = await helpers.revealPromptForDiff(panel, '同名条目', 1);
assert.deepEqual(revealArgs, ['同名条目', 1], '没有把同名序号传给分组展开桥');
assert.equal(target, second, '分组展开后没有按条目 ID 定位到对应同名条目');

console.log('v2.97.20 回归通过：上下侧独有条目会先展开所属分组，再准确滚动到目标。');
