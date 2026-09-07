import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const exactCopy = '空变量项指：只有变量名，里面无内容的变量。如：{{setvar::变量名:: }}';

assert.ok(source.includes(`text: '${exactCopy}'`), '空变量说明没有采用约定的精简固定文案');
assert.ok(
  source.includes('<p class="pmm-variable-note">${escapeHtml(note.text)}</p>'),
  '空变量说明与示例没有作为同一种文字样式渲染',
);
assert.ok(!source.includes('<code>${escapeHtml(note.example)}</code>'), '固定示例不应使用特殊代码标签');
assert.ok(!source.includes('.pmm-variable-note code{'), '固定示例不应使用单独的等宽字体或颜色');
assert.ok(!source.includes('noteVariableName'), '空变量说明不应再根据当前变量名变化');

const dialogCalls = source.match(/\n\s+emptyVariableNote\(\),/g) || [];
assert.equal(dialogCalls.length, 3, '三个相关变量弹窗都应使用同一份固定说明');
assert.ok(source.includes('test.23 已加载：三处空变量说明统一为固定变量名示例'), '缺少 test.23 运行标记');

console.log('test.23 回归通过：三处空变量说明均使用固定“变量名”示例，示例与前文样式完全一致。');
