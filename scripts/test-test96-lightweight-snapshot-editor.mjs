import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');

function section(start, end) {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `缺少片段：${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to > from, `缺少片段终点：${end}`);
  return source.slice(from, to);
}

const nativeEntry = section('/* ===== PMM_NATIVE_PRESET_ENTRY_TEST80', '/* ===== PMM_SWITCH_SNAPSHOTS_TEST52');
assert.ok(nativeEntry.includes("ensure('snapshot', '开关快照', 'fa-camera')"), '酒馆原生预设页没有保留相机入口');
assert.ok(nativeEntry.includes("openSnapshot({ source: 'native-preset' })"), '原生相机没有携带来源上下文');

const workshopBeforeNativeEntry = source.slice(0, source.indexOf('/* ===== PMM_NATIVE_PRESET_ENTRY_TEST80'));
assert.ok(!workshopBeforeNativeEntry.includes("button.className = 'pmm-floating-snapshot-trigger'"), '工坊浮窗仍会创建相机入口');
assert.ok(!workshopBeforeNativeEntry.includes('#preset-manager-floating-panel .pmm-floating-snapshot-trigger{'), '工坊相机样式仍被注入');

const snapshots = source.slice(source.indexOf('/* ===== PMM_SWITCH_SNAPSHOTS_TEST52'));
for (const obsolete of [
  'enterCaptureMode',
  'exitCaptureMode',
  'captureMode =',
  'pmm-switch-snapshot-capture-mode',
  'pmm-switch-snapshot-save-capture',
  'data-pmm-snapshot-trigger',
]) {
  assert.ok(!snapshots.includes(obsolete), `仍残留旧 Capture Mode：${obsolete}`);
}

const storage = section('function readStore()', 'function bindingList');
assert.ok(storage.includes('groupStates: snapshot.groupStates.map(state => ({ ...state }))'), '读取格式没有继续兼容 groupStates');
const writer = section('function writeStore(store)', 'function normalizeUniqueBindings');
for (const key of ['version: 1', 'activeSnapshots:', 'homeSnapshots:', 'snapshots: store.snapshots']) {
  assert.ok(writer.includes(key), `本地存储格式发生变化：${key}`);
}

const draftFactory = section('function createSnapshotEditorDraft', 'function snapshotEditorGroupCount');
assert.ok(draftFactory.includes('makeStates(clone(prompts))'), '编辑器没有从当前 prompts 建立隔离 draft');
assert.ok(!draftFactory.includes("id: '__ungrouped__'"), '不应创建合成未分组');
assert.ok(draftFactory.includes('expandedGroups: new Set()'), '编辑器没有自己的展开状态');

const groupReader = section('function editorGroupState', 'function createSnapshotEditorDraft');
assert.ok(groupReader.includes('snapshotBranchState'), '没有复用柏宝箱分组接口');
assert.ok(groupReader.includes('readGroupEnabledStates'), '没有读取柏宝箱真实分组供电状态');
assert.ok(groupReader.includes("sectionId.slice('baibai_'.length)"), '分组 ID 没有从显示 section ID 映射回原始 ID');

const lazyRenderer = section('function renderSnapshotEditorGroupEntries', 'function updateSnapshotEditorGroup');
assert.ok(lazyRenderer.includes("host.dataset.rendered === '1'"), '展开后没有防止重复创建 prompt DOM');
assert.ok(lazyRenderer.includes('group.promptIndexes.map(snapshotEditorPromptMarkup)'), '展开分组时没有按需渲染条目');

const mount = section('function mountSnapshotEditor()', 'function openSnapshotEditorFromOverlay');
assert.ok(mount.includes('session.rows.map(row => row.group ? snapshotEditorGroupMarkup(row.group)'), '初始窗口没有按原顺序显示分组与独立条目');
assert.ok(mount.includes('if (expanded) renderSnapshotEditorGroupEntries(groupId)'), '条目没有延迟到展开操作再渲染');
assert.ok(!mount.includes('.focus(') && !mount.includes('autofocus'), '编辑器打开时会错误自动唤起手机键盘');

const groupPowerToggle = mount.slice(mount.indexOf("action === 'toggle-group-power'"), mount.indexOf("action === 'toggle-prompt'"));
assert.ok(groupPowerToggle.includes('group.enabled = !group.enabled'), '分组供电开关没有只更新 group draft');
assert.ok(!groupPowerToggle.includes('prompt.enabled'), '分组供电错误联动了 prompt draft');
const promptToggle = mount.slice(mount.indexOf("action === 'toggle-prompt'"));
assert.ok(promptToggle.includes('prompt.enabled = !prompt.enabled'), '条目开关没有更新 prompt draft');
assert.ok(!promptToggle.includes('group.enabled ='), '条目开关错误联动了分组供电 draft');

const openEditor = section('function openSnapshotEditorFromOverlay()', 'function renderFirstDefaultPrompt');
assert.ok(openEditor.includes('const prompts = storedPrompts(presetName)'), '编辑器没有直接读取酒馆当前预设 prompts');
assert.ok(openEditor.includes('createSnapshotEditorDraft'), '编辑器没有先创建隔离 draft');
assert.ok(openEditor.indexOf('closeOverlay()') < openEditor.indexOf('mountSnapshotEditor()'), '管理弹窗没有先关闭再挂载独立编辑器');

const saver = section('function saveSnapshotDraft', 'function findSnapshot');
for (const key of ['presetName,', 'states,', 'groupStates,', 'characters: [],', 'chats: [],', 'createdAt: now', 'updatedAt: now']) {
  assert.ok(saver.includes(key), `新快照缺少兼容字段：${key}`);
}
for (const mutation of ['applySnapshot(', 'persistPromptsDirectly(', 'setPreset(', 'applyGroupSnapshotStates(']) {
  assert.ok(!saver.includes(mutation), `保存新快照时错误修改真实状态：${mutation}`);
}

const editorSave = section('function saveSnapshotEditor()', 'function mountSnapshotEditor');
assert.ok(editorSave.includes('saveSnapshotDraft({'), '保存按钮没有统一走 draft 保存入口');
assert.ok(editorSave.includes('session.groups.map(group =>'), '保存时应记录真实分组');
assert.ok(editorSave.includes('if (saved) returnFromSnapshotEditor()'), '保存成功后没有返回管理弹窗');

const returnFlow = section('function returnFromSnapshotEditor()', 'function saveSnapshotEditor');
assert.ok(returnFlow.includes('destroySnapshotEditor()'), '返回前没有销毁独立编辑器');
assert.ok(returnFlow.includes('openOverlay(returnContext)'), '保存或取消后没有按来源重开管理弹窗');

const managerEvents = section('function ensureOverlay()', 'function openOverlay()');
assert.ok(managerEvents.includes("action === 'new') openSnapshotEditorFromOverlay()"), '管理弹窗的新建按钮没有统一进入轻量编辑器');
assert.ok(managerEvents.includes("saveDefaultSnapshot({ silent: true })) openSnapshotEditorFromOverlay()"), '首次默认方案保存后没有进入同一个轻量编辑器');

assert.ok(snapshots.includes("const EDITOR_OVERLAY_ID = 'pmm-switch-snapshot-editor-overlay'"), '编辑器没有独立 Overlay ID');
assert.ok(snapshots.includes('function bindSnapshotEditorToVisibleViewport'), '编辑器没有绑定 VisualViewport');
assert.ok(snapshots.includes('--pmm-switch-editor-visible-height'), '编辑器没有使用手机可视高度变量');
assert.ok(!mount.includes('id="pmm-switch-editor-name"'), '编辑页不应预先显示快照名称');
assert.ok(snapshots.includes('pointer-events:auto!important'), '独立 Overlay 没有明确启用交互');

console.log('test.96 通过：原生相机统一进入独立轻量编辑器，lazy render、draft 隔离、兼容存储与返回流程均已覆盖。');
