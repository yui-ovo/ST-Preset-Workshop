import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位多绑定锁片段：${startMarker}`);
  return source.slice(start, end);
}

const storage = section('function readStore()', 'function makeStates');
assert.ok(storage.includes('characters: bindingList(snapshot.characters, snapshot.character)'), '旧版单角色绑定没有读入多角色数组');
assert.ok(storage.includes('chats: bindingList(snapshot.chats, snapshot.chat)'), '旧版单聊天绑定没有读入多聊天数组');
assert.ok(storage.includes("Object.prototype.hasOwnProperty.call(snapshot, 'character')"), '迁移后没有清理旧角色字段');
assert.ok(storage.includes("Object.prototype.hasOwnProperty.call(snapshot, 'chat')"), '迁移后没有清理旧聊天字段');
assert.ok(storage.includes('`${presetName}\\u0000${binding.key}`'), '绑定唯一性没有按预设和对象共同隔离');

const creation = section('function saveNewSnapshot', 'function findSnapshot');
assert.ok(creation.includes('characters: []') && creation.includes('chats: []'), '新快照必须默认不绑定角色和聊天');

const bindings = section('function bindSnapshotToCurrentCharacter', 'function deleteSnapshot');
assert.ok(bindings.includes('if (!character || !chat)'), '未进入单人角色聊天时绑定动作仍可执行');
assert.ok(bindings.includes('snapshot.characters.some'), '角色锁没有识别当前角色的绑定状态');
assert.ok(bindings.includes('snapshot.characters.filter'), '再次点击角色锁不能只解除当前角色');
assert.ok(bindings.includes('snapshot.characters.push({ ...character })'), '同一快照不能追加多个角色');
assert.ok(bindings.includes('snapshot.chats.some'), '聊天锁没有识别当前聊天的绑定状态');
assert.ok(bindings.includes('snapshot.chats.filter'), '再次点击聊天锁不能只解除当前聊天');
assert.ok(bindings.includes('snapshot.chats.push({ ...chat })'), '同一快照不能追加多个聊天');
assert.ok(bindings.includes("source: 'chat'") && bindings.indexOf("source: 'chat'") < bindings.indexOf("source: 'character'"), '自动应用没有保持聊天优先于角色');

const overlay = section('function renderOverlay()', 'function ensureOverlay()');
assert.ok(overlay.includes('const bindingContextReady = !!(character && chat)'), '两把锁没有根据角色聊天上下文统一禁用');
assert.ok(overlay.includes('const disabledBinding = bindingContextReady ? \'\' : \' disabled\''), '无角色聊天时锁按钮没有真正 disabled');
assert.ok(overlay.includes('data-pmm-snapshot-action="toggle-character-binding"'), '角色锁没有直接显示在快照行');
assert.ok(overlay.includes('data-pmm-snapshot-action="toggle-chat-binding"'), '聊天锁没有直接显示在快照行');
assert.ok(overlay.includes("isCurrentCharacter ? 'fa-lock' : 'fa-lock-open'"), '角色锁没有按绑定状态切换关锁和开锁');
assert.ok(overlay.includes("isCurrentChat ? 'fa-lock' : 'fa-lock-open'"), '聊天锁没有按绑定状态切换关锁和开锁');
assert.ok(overlay.includes('characterNames = snapshot.characters.map'), '多角色名称没有显示在快照行');
assert.ok(overlay.includes('pmm-switch-snapshot-character-names'), '角色名称没有换到快照下方独立一行');
assert.ok(!overlay.includes('chatNames = snapshot.chats.map'), '聊天名称不应占用快照行空间');

const menu = overlay.slice(overlay.indexOf('const menu ='), overlay.indexOf('return `<article'));
assert.ok(menu.includes('重命名') && menu.includes('覆盖为当前开关') && menu.includes('删除'), '更多菜单没有保留常规操作');
assert.ok(!menu.includes('toggle-character-binding') && !menu.includes('toggle-chat-binding'), '锁按钮仍然藏在更多菜单中');

const style = section('function installStyle()', 'function scheduleMount()');
assert.ok(style.includes('color:var(--pm-text-primary,var(--SmartThemeBodyColor,#e5e7eb))'), '未绑定的开锁没有保持白色');
assert.ok(style.includes('.pmm-switch-snapshot-lock.is-character.is-bound{border-color:#22c55e'), '绑定后的角色关锁没有使用绿色');
assert.ok(style.includes('.pmm-switch-snapshot-lock.is-chat.is-bound{border-color:#eab308'), '绑定后的聊天关锁没有使用黄色');
assert.ok(style.includes('.pmm-switch-snapshot-lock:disabled{pointer-events:none'), '禁用锁仍可能被点击');
assert.ok(style.includes('.pmm-switch-snapshot-character-names{'), '多角色名称行缺少独立布局');
assert.ok(style.includes('flex:0 0 100%'), '角色名称行没有使用整行空间');

console.log('test.67 回归通过：快照行内提供绿色角色锁与黄色聊天锁，支持多绑定、唯一转移、上下文禁用及旧数据迁移。');
