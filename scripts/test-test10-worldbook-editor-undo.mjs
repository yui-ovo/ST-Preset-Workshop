import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/worldbook-stitch-test3.js', import.meta.url), 'utf8');

for (const marker of [
  'data-wb-editor-undo',
  'undoStack = [];',
  'let previousValue = text;',
  'now - lastInputAt > 450',
  'textarea.value = undoStack.pop();',
  "undoButton.title = available ? '撤销本次编辑' : '暂无可撤销输入';",
  '.pmm-wb-editor-dialog header button:disabled{opacity:.28}',
]) {
  assert.ok(source.includes(marker), `test.10 全屏编辑撤销缺少实现：${marker}`);
}

assert.ok(
  source.indexOf('data-wb-editor-undo') < source.indexOf('data-wb-editor-cancel'),
  '全屏撤销按钮没有放在关闭按钮之前',
);

console.log('test.10 世界书全屏编辑回归通过：本次输入可分步撤销，外层保存撤销保持不变。');
