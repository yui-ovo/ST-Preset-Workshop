import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [preset, worldbook] = await Promise.all([
  readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8'),
  readFile(new URL('../dist/worldbook-snapshots.js', import.meta.url), 'utf8'),
]);

assert.ok(preset.includes('<i class="fa-solid fa-camera"></i>预设快照</h2>'), '预设相机弹窗标题必须为“预设快照”');
assert.ok(worldbook.includes("editGroup ? '世界书分组' : '世界书快照'"), '世界书相机弹窗标题必须为“世界书快照”');
assert.ok(worldbook.includes("page==='global' ? '可一键全局挂载世界书分组；也可为分组世界书创建快照。'"), '全局世界书页必须保留分组与快照说明');

console.log('test.110 快照标题与全局世界书说明回归通过。');