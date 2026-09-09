import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位快照绑定与通知片段：${startMarker}`);
  return source.slice(start, end);
}

const groupSync = section('async function syncGroupEnabledState', 'function readGroupEnabledStates');
assert.ok(source.includes("function isSnapshotCaptureActive(){"), '快照模式没有识别柏宝箱分组同步');
assert.ok(groupSync.includes('if(isSnapshotCaptureActive())return true'), '快照模式仍会执行分组同步并显示通知');
assert.ok(source.includes('suppressSuccessMessage = API.__suppressNextSuccessMessage === true'), '柏宝箱通知层没有处理静默标记');

const saveDefault = section('function saveDefaultSnapshot()', 'function saveNewSnapshot');
assert.ok(saveDefault.includes("'已保存预设默认的开关'"), '保存默认通知没有改为简短文案');
assert.ok(saveDefault.includes("'已更新预设默认的开关'"), '更新默认通知没有改为简短文案');
const onboarding = section('function ensureOverlay()', 'function openOverlay()');
assert.ok(onboarding.includes('saveDefaultSnapshot({ silent: true })'), '首次保存默认并进入时仍会出现第二条通知');
const capture = section('function enterCaptureMode(entryContext = null)', 'function renderCaptureSavePrompt');
assert.ok(capture.includes("notify('info', '已进入快照模式')"), '进入快照模式通知仍然过长');

const creation = section('function saveNewSnapshot', 'function findSnapshot');
assert.ok(creation.includes('characters: []'), '新快照不应自动绑定当前角色');
assert.ok(creation.includes('chats: []'), '新快照不应自动绑定当前聊天');

const normalization = section('function normalizeUniqueBindings', 'function makeStates');
assert.ok(normalization.includes('characterOwners'), '旧的重复角色绑定没有兼容整理');
assert.ok(normalization.includes('chatOwners'), '旧的重复聊天绑定没有兼容整理');
assert.ok(normalization.includes('delete snapshot.character'), '旧版单角色绑定没有迁移');
assert.ok(normalization.includes('delete snapshot.chat'), '旧版单聊天绑定没有迁移');
assert.ok(normalization.includes('snapshot.characters = characters'), '角色绑定没有整理成多绑定数组');
assert.ok(normalization.includes('snapshot.chats = chats'), '聊天绑定没有整理成多绑定数组');

const bindings = section('function bindSnapshotToCurrentCharacter', 'function deleteSnapshot');
assert.ok(bindings.includes('text(item.presetName) !== text(snapshot.presetName)'), '绑定唯一性没有按预设隔离');
assert.ok(bindings.includes('function bindSnapshotToCurrentChat'), '缺少绑定当前聊天功能');
assert.ok(bindings.includes('snapshot.characters.push({ ...character })'), '一条快照不能追加绑定多个角色');
assert.ok(bindings.includes('snapshot.chats.push({ ...chat })'), '一条快照不能追加绑定多个聊天');
assert.ok(bindings.includes("if (chatSnapshot) return { snapshot: chatSnapshot, source: 'chat'"), '聊天绑定没有优先于角色绑定');
assert.ok(bindings.includes("source: 'character'"), '缺少角色绑定自动匹配');
assert.ok(bindings.includes("automatic: true"), '进入绑定聊天后没有自动应用快照');
assert.ok(bindings.includes('eventTypes?.CHAT_CHANGED'), '没有监听酒馆聊天切换事件');

const overlay = section('function renderOverlay()', 'function ensureOverlay()');
assert.ok(overlay.includes('data-pmm-snapshot-action="toggle-character-binding"'), '快照行缺少直接角色锁');
assert.ok(overlay.includes('data-pmm-snapshot-action="toggle-chat-binding"'), '快照行缺少直接聊天锁');
assert.ok(overlay.includes('const bindingContextReady = !!(character && chat)'), '未进入角色聊天时绑定锁没有禁用依据');
assert.ok(overlay.includes('pmm-switch-snapshot-lock is-chat'), '聊天绑定缺少独立锁按钮');
const menu = overlay.slice(overlay.indexOf('const menu ='), overlay.indexOf('return `<article'));
assert.ok(!menu.includes('绑定当前角色') && !menu.includes('绑定当前聊天'), '绑定入口仍藏在更多菜单里');
const events = section('function ensureOverlay()', 'function openOverlay()');
assert.ok(events.includes('dismissOpenSnapshotMenu(overlay)'), '点击菜单外区域不会收起更多菜单');
assert.ok(events.includes("action === 'toggle-character-binding'"), '角色锁没有事件处理');
assert.ok(events.includes("action === 'toggle-chat-binding'"), '聊天锁没有事件处理');
assert.ok(events.includes("event.key === 'Escape' && openMenuId"), '按 Esc 不会优先收起菜单');

console.log('test.66 回归通过：快照通知已精简，多角色与多聊天绑定保持同预设唯一并按聊天优先自动应用。');
