import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../dist/worldbook-snapshots.js',import.meta.url),'utf8');

assert.match(source,/class="pmm-wbs-entry-switch-input" type="checkbox"[^>]*style="opacity:0!important"[^>]*><span class="pmm-wbs-entry-switch-track"/,'Theme-styled checkbox is not isolated behind a custom track');
assert.match(source,/\.pmm-wbs-entry-switch \{[^}]*width:44px;[^}]*height:36px;/,'Compact switch is missing its larger invisible touch target');
assert.match(source,/\.pmm-wbs-entry-switch-track \{[^}]*width:32px;[^}]*height:19px;/,'Visible snapshot switch did not return to the previous compact size');
assert.match(source,/\.pmm-wbs-entry-switch-input:checked\+\.pmm-wbs-entry-switch-track \{[^}]*background:var\(--pm-accent/,'Enabled switch does not follow the active theme accent');
assert.match(source,/\.pmm-wbs-entry-switch-input:checked\+\.pmm-wbs-entry-switch-track:before \{ left:15px; \}/,'Enabled switch does not slide its thumb to the right');
assert.doesNotMatch(source,/input\[data-toggle\]:(?:before|after)/,'Theme-prone checkbox pseudo-elements are still used to draw snapshot switches');

console.log('test.90 回归通过：快照条目用独立滑轨隔离酒馆勾选框美化，并恢复紧凑外观与大点击区。');
