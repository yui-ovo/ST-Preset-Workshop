import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8')).replace(/pmmRuntimeResource\((\w+)\)/g, '$1');
const start = source.indexOf('function _pmmBindAndroidRangeGestureGuard');
const end = source.indexOf('function makeControl(control)', start);
assert.ok(start >= 0 && end > start, '无法定位安卓滑杆手势保护');

const helperSource = source.slice(start, end);
assert.ok(source.includes('touch-action:pan-y!important'), '布局滑杆没有允许纵向原生滚动');
assert.ok(helperSource.includes("gesture.mode = 'vertical'"), '没有识别纵向滚动手势');
assert.ok(helperSource.includes("gesture.mode = 'horizontal'"), '没有保留横向滑杆调节');
assert.ok(helperSource.includes('Date.now() + 160'), '没有拦截纵向滚动结束后的延迟 input');

class FakeInput {
  constructor(value = '10') {
    this.value = value;
    this.dataset = {};
    this.listeners = new Map();
    this.style = { setProperty: (name, value) => { this.style[name] = value; } };
  }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== listener));
  }
  dispatch(type, properties = {}) {
    const event = { type, pointerType:'touch', pointerId:1, clientX:0, clientY:0, ...properties };
    for (const listener of this.listeners.get(type) || []) listener(event);
  }
}

const bindGuard = vm.runInNewContext(
  `(() => { ${helperSource}; return _pmmBindAndroidRangeGestureGuard; })()`,
  { IS_ANDROID:true, isMobile:() => true, TOP:{ PointerEvent:function PointerEvent() {} }, Date },
);

const verticalInput = new FakeInput('10');
const verticalCommits = [];
const verticalGuard = bindGuard(verticalInput, value => verticalCommits.push(value));
assert.equal(verticalInput.style['touch-action'], 'pan-y');
verticalInput.dispatch('pointerdown', { clientX:100, clientY:100 });
verticalInput.value = '18';
assert.equal(verticalGuard.handleInput(), true);
assert.equal(verticalInput.value, '10', '方向未确定前不应立即改值');
verticalInput.dispatch('pointermove', { clientX:102, clientY:132 });
verticalInput.value = '20';
verticalGuard.handleInput();
verticalInput.dispatch('pointerup', { clientX:102, clientY:132 });
assert.deepEqual(verticalCommits, [], '纵向滚动不应提交滑杆值');
assert.equal(verticalInput.value, '10', '纵向滚动后应恢复原值');

const horizontalInput = new FakeInput('10');
const horizontalCommits = [];
const horizontalGuard = bindGuard(horizontalInput, value => horizontalCommits.push(value));
horizontalInput.dispatch('pointerdown', { clientX:100, clientY:100 });
horizontalInput.value = '12';
horizontalGuard.handleInput();
horizontalInput.dispatch('pointermove', { clientX:132, clientY:102 });
horizontalInput.value = '15';
horizontalGuard.handleInput();
horizontalInput.dispatch('pointerup', { clientX:132, clientY:102 });
assert.equal(horizontalCommits.at(-1), '15', '明确横向拖动应提交最终滑杆值');

const tapInput = new FakeInput('10');
const tapCommits = [];
const tapGuard = bindGuard(tapInput, value => tapCommits.push(value));
tapInput.dispatch('pointerdown', { clientX:100, clientY:100 });
tapInput.value = '13';
tapGuard.handleInput();
tapInput.dispatch('pointerup', { clientX:101, clientY:101 });
assert.deepEqual(tapCommits, ['13'], '轻点轨道仍应修改滑杆');

assert.ok(source.includes('V2.86 已加载：安卓布局滑杆仅在明确横向手势时调节，纵向手势继续滚动。'), '缺少 v2.86 修复标记');
console.log('v2.86 安卓滑杆测试通过：纵向滚动不改值，横向拖动与轻点仍可调节。');
