import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workshop = (await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8')).replace(/pmmRuntimeResource\((\w+)\)/g, '$1');

for (const snippet of [
  "const currentlyLight = lightButton.classList.contains('active')",
  "const currentlyDark = darkButton.classList.contains('active')",
  'if (currentlyDark) lightButton.click()',
  'else if (currentlyLight && autoButton) autoButton.click()',
  'else darkButton.click()',
  "? 'fa-solid fa-wand-magic-sparkles'",
  "? '跟随酒馆美化（点击切换夜间）'",
  "? '夜间模式（点击切换日间）'",
  "? '日间模式（点击切换跟随美化）'",
]) {
  assert.ok(workshop.includes(snippet), `v2.62 缺少手机三态主题循环：${snippet}`);
}

assert.ok(
  !workshop.includes("autoToggle.className = 'theme-btn pmm-runtime-theme-btn pmm-mobile-auto-theme'"),
  '手机端仍然创建了单独的魔法棒按钮',
);

const clickStart = workshop.indexOf("const currentlyLight = lightButton.classList.contains('active')");
const clickEnd = workshop.indexOf('setTimeout(() => ensureWorkshopControls(doc), 0)', clickStart);
const clickFlow = workshop.slice(clickStart, clickEnd);
assert.ok(
  clickFlow.indexOf('currentlyDark') < clickFlow.indexOf('lightButton.click()')
    && clickFlow.indexOf('currentlyLight') < clickFlow.indexOf('autoButton.click()'),
  '手机主题按钮的循环顺序不正确',
);

console.log('v2.62 手机主题测试通过：同一个按钮按夜间→日间→魔法棒→夜间循环。');
