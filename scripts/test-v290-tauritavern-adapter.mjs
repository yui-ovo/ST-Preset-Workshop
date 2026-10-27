import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8')).replace(/pmmRuntimeResource\((\w+)\)/g,'$1');
const start = source.indexOf('/* ===== PMM_TAURITAVERN_ADAPTER_V290');
assert.ok(start >= 0, '缺少 v2.90 TauriTavern 条件适配模块');
const patch = source.slice(start);

const tauriRead = patch.indexOf('TOP.__TAURITAVERN__');
const hardGuard = patch.indexOf('if (!tauriHost) return;');
const styleInstall = patch.indexOf('function installStyle()');
assert.ok(tauriRead >= 0 && hardGuard > tauriRead && styleInstall > hardGuard, 'Tauri 环境硬隔离必须发生在任何样式或监听器安装之前');
assert.ok(patch.includes('/iPad|iPhone|iPod/i.test(ua)'), '缺少 Tauri iOS 平台识别');
assert.ok(patch.includes('/Windows/i.test(ua)'), '缺少 Tauri Windows 平台识别');

assert.ok(patch.includes("'#pmm-preset-regex-transfer-overlay,#pmm-diff-detail-portal'"), '安全区范围没有严格限制在两个指定弹层');
assert.ok(patch.includes("element.setAttribute('data-tt-mobile-surface', 'fullscreen-window')"), '没有使用 TauriTavern 官方全屏安全区契约');
assert.ok(patch.includes('--tt-inset-top') && patch.includes('--tt-viewport-bottom-inset'), '安全区没有读取 TauriTavern 顶部和底部 inset');
assert.ok(patch.includes('saveInlineGeometry(element)'), '没有清除会压过 Tauri 安全区规则的原内联几何样式');
assert.ok(patch.includes("safeObserver.observe(DOC.documentElement, { childList: true, subtree: true })"), '没有覆盖稍后动态创建的正则／对比详情弹层');

assert.ok(patch.includes("DOC.addEventListener('pointerdown', onPointerDown"), 'Tauri Windows 没有安装指针拖拽入口');
assert.ok(patch.includes("source.setAttribute('draggable', 'false')"), '没有在本次手势中关闭会触发禁止标志的原生 draggable');
assert.ok(patch.includes("fireDrag('dragstart'"), '没有复用工坊原有 dragstart 数据逻辑');
assert.ok(patch.includes("fireDrag('dragover'"), '没有复用工坊原有 dragover 落点逻辑');
assert.ok(patch.includes("fireDrag('drop'"), '没有复用工坊原有 drop 搬运逻辑');
assert.ok(patch.includes("const ROOT_SELECTOR = '#preset-manager-main-panel'"), '拖拽适配没有限制在预设工坊内部');
assert.ok(patch.includes("if (!isWindows) return;\n    DOC.addEventListener('pointerdown'"), 'Windows 拖拽监听器缺少平台条件');
assert.ok(!patch.includes('body.ondrag'), '不应接管页面或其他扩展的全局拖拽属性');

assert.ok(patch.includes('V2.90 已加载：TauriTavern'), '缺少 v2.90 TauriTavern 加载标记');

console.log('v2.90 TauriTavern 适配测试通过：iOS 仅修两个安全区弹层，Windows 仅接管工坊内部拖拽。');
