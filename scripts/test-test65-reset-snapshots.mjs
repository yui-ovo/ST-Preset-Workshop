import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位整套快照重置片段：${startMarker}`);
  return source.slice(start, end);
}

const reset = section('async function resetSnapshotsForCurrentPreset()', 'function formatSavedAt');
assert.ok(reset.includes('presetSnapshots.filter(snapshot => !isDefaultSnapshot(snapshot)).length'), '重置确认没有统计当前预设的角色快照');
assert.ok(reset.includes('await applySnapshot(defaultSnapshot.id, { silent: true })'), '当前应用角色快照时没有静默恢复预设默认');
assert.ok(reset.includes('if (activeSnapshotForPreset(presetName))'), '恢复默认失败后仍可能继续删除快照');
assert.ok(reset.includes('text(snapshot.presetName) !== presetName'), '重置可能误删其他预设的快照');
assert.ok(reset.includes('delete latestStore.activeSnapshots[presetName]'), '重置没有清理当前应用标记');
assert.ok(reset.includes('renderFirstDefaultPrompt()'), '重置后没有回到首次设置界面');
assert.ok(reset.includes('删除后不可撤销'), '危险操作缺少明确确认');

const overlay = section('function renderOverlay()', 'function ensureOverlay()');
assert.ok(overlay.includes('class="pmm-switch-snapshot-reset-all"'), '预设默认旁没有直接显示垃圾桶按钮');
assert.ok(overlay.includes('data-pmm-snapshot-action="reset-all"'), '垃圾桶按钮没有绑定重置动作');
assert.ok(overlay.includes('fa-solid fa-trash'), '垃圾桶按钮图标缺失');

const events = section('function ensureOverlay()', 'function openOverlay()');
assert.ok(events.includes("action === 'reset-all'"), '没有处理垃圾桶按钮点击');
assert.ok(events.includes('void resetSnapshotsForCurrentPreset()'), '垃圾桶没有调用整套快照重置');

const style = section('function installStyle()', 'function scheduleMount()');
assert.ok(style.includes('.pmm-switch-snapshot-reset-all'), '垃圾桶按钮缺少独立的紧凑危险样式');

console.log('test.65 回归通过：垃圾桶可安全重置当前预设整套快照，活动快照会先恢复默认。');
