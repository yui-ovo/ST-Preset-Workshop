import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundlePath = path.join(root, 'dist', 'workshop-v3.02.js');
const runtimePath = path.join(root, 'patches', 'test24-group-select-nesting.js');
let source = fs.readFileSync(bundlePath, 'utf8');

function replaceOnce(label, before, after) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
  'range-created child section metadata',
  "const g=a[p];let u;u=ke(g.name)?Ee(g.name):g.name;const x={id:`section_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,displayName:u,itemIds:m};return t.manualNoGroups=!1",
  "const g=a[p];let u;u=ke(g.name)?Ee(g.name):g.name;const _pmmSourceSection=t.sections.find(e=>m.every(n=>e.itemIds.includes(n))),_pmmCanNest=!!_pmmSourceSection&&m.length<_pmmSourceSection.itemIds.length,_pmmParentSectionId=_pmmCanNest?String(_pmmSourceSection.parentSectionId||_pmmSourceSection.id||''):'',_pmmSelectedPositions=_pmmSourceSection?m.map(e=>_pmmSourceSection.itemIds.indexOf(e)).filter(e=>e>=0):[],_pmmLastSelectedIndex=_pmmSelectedPositions.length?Math.max(..._pmmSelectedPositions):-1,_pmmParentBeforeItemId=_pmmCanNest&&_pmmLastSelectedIndex>=0?String(_pmmSourceSection.itemIds[_pmmLastSelectedIndex+1]||''):'';const x={id:`section_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,displayName:u,itemIds:m,parentSectionId:_pmmParentSectionId,parentBeforeItemId:_pmmParentBeforeItemId};return t.manualNoGroups=!1",
);

replaceOnce(
  'legacy range group nesting inference',
  "function p(e){const n=a(e),t=n.prompts,A=new Map;",
  "function p(e){const n=a(e),t=n.prompts;for(let _pmmChildIndex=0;_pmmChildIndex<n.sections.length;_pmmChildIndex++){const _pmmChild=n.sections[_pmmChildIndex];if(!_pmmChild||_pmmChild.parentSectionId||!String(_pmmChild.id||'').startsWith('section_')||!Array.isArray(_pmmChild.itemIds)||!_pmmChild.itemIds.length)continue;const _pmmCandidates=n.sections.slice(0,_pmmChildIndex).filter(e=>Array.isArray(e.itemIds)&&e.itemIds.length>_pmmChild.itemIds.length&&_pmmChild.itemIds.every(n=>e.itemIds.includes(n))).sort((e,n)=>e.itemIds.length-n.itemIds.length),_pmmParent=_pmmCandidates[0];if(!_pmmParent)continue;_pmmChild.parentSectionId=String(_pmmParent.parentSectionId||_pmmParent.id||'');const _pmmPositions=_pmmChild.itemIds.map(e=>_pmmParent.itemIds.indexOf(e)).filter(e=>e>=0),_pmmLastIndex=_pmmPositions.length?Math.max(..._pmmPositions):-1;_pmmChild.parentBeforeItemId=_pmmLastIndex>=0?String(_pmmParent.itemIds[_pmmLastIndex+1]||''):''}const A=new Map;",
);

replaceOnce(
  'organized section parent metadata',
  "collapsed:n.collapsedSections.has(e.id),groupDisabled:n.disabledSections.has(e.id),shouldShowHeader:!0})",
  "collapsed:n.collapsedSections.has(e.id),groupDisabled:n.disabledSections.has(e.id),parentSectionId:String(e.parentSectionId||''),parentBeforeItemId:String(e.parentBeforeItemId||''),shouldShowHeader:!0})",
);

replaceOnce(
  'section dynamic attributes',
  "Ht=['data-section-id','onDragover','onDragleave','onDrop']",
  "Ht=['data-section-id','data-parent-section-id','data-parent-before-item-id','data-item-count','data-enabled-count','data-selected-count','onDragover','onDragleave','onDrop']",
);

replaceOnce(
  'rendered section metadata',
  "'data-section-id':A.section.id,onDragover:",
  "'data-section-id':A.section.id,'data-parent-section-id':A.section.parentSectionId||'','data-parent-before-item-id':A.section.parentBeforeItemId||'','data-item-count':A.section.items.length,'data-enabled-count':A.section.items.filter(e=>e.enabled!==!1).length,'data-selected-count':A.section.items.filter(e=>Y(e.id)).length,onDragover:",
);

if (source.includes('PMM_GROUP_SELECT_NESTING_TEST24')) throw new Error('test.24 patch is already installed');
source += `\n\n${fs.readFileSync(runtimePath, 'utf8').trim()}\n`;
fs.writeFileSync(bundlePath, source, 'utf8');
console.log('Applied test.24 group selection and nested-section patch.');
