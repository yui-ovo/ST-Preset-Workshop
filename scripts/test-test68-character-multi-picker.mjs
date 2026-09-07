import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法定位角色多选片段：${startMarker}`);
  return source.slice(start, end);
}

const characters = section('function availableCharacters()', 'function currentChat()');
assert.ok(characters.includes('context.characters || TOP.characters || SELF.characters'), '角色多选没有读取酒馆角色列表');
assert.ok(characters.includes("character?.avatar || character?.id || rawKey"), '角色多选没有使用稳定角色标识');
assert.ok(characters.includes("localeCompare(right.name, 'zh-CN')"), '角色列表没有按名称排序');

const picker = section('function openCharacterPicker(id)', 'function boundSnapshotForContext');
assert.ok(picker.includes('selectedKeys: new Set(snapshot.characters.map'), '角色多选没有载入快照现有绑定');
assert.ok(picker.includes('character.name.toLocaleLowerCase().includes(query)'), '搜索框不能按角色名称筛选');
assert.ok(picker.includes('text(snapshot.presetName) === text(target.presetName)'), '绑定归属提示没有限制在当前预设');
assert.ok(picker.includes('当前绑定：${escapeHtml(owner.name)}'), '已被同预设其他快照绑定的角色没有显示归属');
assert.ok(picker.includes('characterPicker.selectedKeys.add(key)'), '角色列表不能多选');
assert.ok(picker.includes('text(item.presetName) !== text(snapshot.presetName)'), '保存多选时没有按预设隔离绑定转移');
assert.ok(picker.includes('!selectedKeys.has(binding.key)'), '选中其他快照的角色后没有自动转移');
assert.ok(picker.includes("notify('success', '已更新角色绑定')"), '多选保存通知不够明确简短');

const overlay = section('function renderOverlay()', 'function ensureOverlay()');
assert.ok(overlay.includes('>多选角色绑定</button>'), '省略号菜单缺少“多选角色绑定”');
assert.ok(overlay.includes('data-pmm-snapshot-action="clear-character-bindings"'), '省略号菜单缺少取消全部角色绑定');
assert.ok(overlay.includes("snapshot.characters.length ? '' : ' disabled'"), '没有角色绑定时菜单清空按钮仍可点击');
assert.ok(overlay.includes('placeholder="搜索角色名字"'), '多选角色面板缺少搜索框');
assert.ok(overlay.includes('data-pmm-character-picker-list'), '多选角色面板缺少结果列表');
assert.ok(overlay.includes('data-pmm-character-picker-count'), '多选角色面板没有显示已选数量');
assert.ok(overlay.includes('data-pmm-snapshot-action="save-character-picker"'), '多选角色面板缺少保存动作');
assert.ok(!overlay.includes('chatNames = snapshot.chats.map'), '聊天绑定名称仍显示在快照行');

const events = section('function ensureOverlay()', 'function openOverlay()');
assert.ok(events.includes("action === 'manage-characters'"), '更多菜单不能打开角色多选');
assert.ok(events.includes("action === 'clear-character-bindings'"), '更多菜单不能取消全部角色绑定');
assert.ok(events.includes("action === 'toggle-character-choice'"), '角色选项不能切换勾选');
assert.ok(events.includes("matches?.('[data-pmm-character-search]')"), '角色搜索输入没有即时筛选');
assert.ok(events.includes("event.key === 'Escape' && characterPicker"), '角色多选面板不能用 Esc 关闭');

const style = section('function installStyle()', 'function scheduleMount()');
assert.ok(style.includes('.pmm-switch-character-picker-search'), '角色搜索框缺少样式');
assert.ok(style.includes('.pmm-switch-character-picker-list'), '角色多选列表缺少可滚动布局');
assert.ok(style.includes('.pmm-switch-character-picker-option.is-selected'), '已选角色没有清晰状态');
assert.ok(style.includes('.pmm-switch-snapshot-clear-characters'), '菜单中的取消全部角色绑定缺少禁用样式');

console.log('test.68 回归通过：省略号支持带搜索的角色多选，同预设绑定可转移，角色名单独换行且聊天名称不占位。');
