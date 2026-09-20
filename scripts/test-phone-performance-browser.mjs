import assert from 'node:assert/strict';
import fs from 'node:fs';
import {phonePerformanceFixture} from './lib/phone-performance-fixture.mjs';
import {browserPage} from './lib/browser-cdp.mjs';
const fixture=await phonePerformanceFixture(),page=await browserPage();
const report={version:JSON.parse(fs.readFileSync(new URL('../manifest.json',import.meta.url))).version,themes:[],drags:[]},errors=[];
page.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description||e.exceptionDetails.text));
await page.send('Performance.enable');
const metrics=async()=>Object.fromEntries((await page.send('Performance.getMetrics')).metrics.filter(m=>/^(LayoutCount|RecalcStyleCount|LayoutDuration|RecalcStyleDuration|TaskDuration)$/.test(m.name)).map(m=>[m.name,m.value]));
const settle=()=>page.evaluate(async()=>{await new Promise(r=>setTimeout(r,500));});
try{
 for(const [name,width,height,touch] of [['phone portrait',390,844,true],['phone landscape',844,390,true],['desktop',1440,1024,false]]){
  await page.viewport(width,height,touch);await page.goto(fixture.url);await settle();
  for(const action of ['tone','skin','follow']){
   await page.evaluate(()=>{__PMM_THEME_SYSTEM__.setTheme('aqua');__PMM_THEME_SYSTEM__.setTone('light');});await settle();
   const before=await metrics();
   const result=await page.evaluate(async action=>{
    const t=__PMM_THEME_SYSTEM__,start=performance.now();
    if(action==='tone')t.setTone('dark');else if(action==='skin')t.setTheme('glass');else t.toggleFollow();
    await Promise.resolve();await Promise.resolve();await Promise.resolve();
    const callback=performance.now()-start,panels=[...document.querySelectorAll('.preset-panel')];
    const vars=panels.map(n=>({own:getComputedStyle(n).getPropertyValue('--pmm-theme-motion-to').trim(),layer:getComputedStyle(n,'::after').getPropertyValue('--pmm-theme-motion-to').trim(),entry:getComputedStyle(n.querySelector('.prompt-card')).getPropertyValue('--pmm-theme-motion-to').trim()}));
    const animations=document.getAnimations(),entries=animations.filter(a=>a.effect?.target?.closest?.('.prompt-item:not(.prompt-item--expanded)')),entryAnimations=entries.length,entryDetails=entries.map(a=>({target:a.effect.target.className,property:a.transitionProperty}));
    await new Promise(r=>setTimeout(r,500));
    return{callback,vars,entryAnimations,entryDetails,layersAfter:document.querySelectorAll('.pmm-theme-surface-motion').length};
   },action);
   const after=await metrics();result.metrics=Object.fromEntries(Object.keys(before).map(k=>[k,after[k]-before[k]]));
   for(const v of result.vars){assert.notEqual(v.own,'transparent');assert.equal(v.layer,v.own,'Pseudo layer explicitly inherits its own surface background');assert.equal(v.entry,'transparent','Animation-only backgrounds must not inherit into hundreds of entries');}
   if(touch)assert.equal(result.entryAnimations,0,JSON.stringify({name,action,entries:result.entryDetails}));assert.equal(result.layersAfter,0);
   report.themes.push({name,action,...result});
  }
  await page.evaluate(()=>{__PMM_THEME_SYSTEM__.setTheme('glass');__PMM_THEME_SYSTEM__.setTone('dark');});await settle();
  const before=await metrics();
  const result=await page.evaluate(async touch=>{
   const container=document.querySelector('.pm-panel-container'),root=document.getElementById('preset-manager-main-panel');
   const panels=[...container.querySelectorAll(':scope > .pm-main-wrapper > .preset-panel,:scope > .preset-panel')];
   const handle=container.querySelector('.pmm-split-handle--top,.pmm-split-handle--left'),vertical=handle.classList.contains('pmm-split-handle--top');
   const rect=Element.prototype.getBoundingClientRect,computed=window.getComputedStyle,set=CSSStyleDeclaration.prototype.setProperty,store=Storage.prototype.setItem;
   const r=rect.call(handle),sx=r.x+r.width/2,sy=r.y+r.height/2;
   const storage=()=>localStorage.getItem('pmm_mobile_layout_shared_v2');
   const originalStyle=panels.map(n=>{const c=computed(n);return{blur:c.backdropFilter,transition:c.transition,shadow:c.boxShadow,background:c.background}});
   const event=(type,x,y)=>(type==='pointerdown'?handle:document).dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,isPrimary:true,pointerId:71,pointerType:touch?'touch':'mouse',button:0,buttons:type==='pointerup'?0:1,clientX:x,clientY:y}));
   const size=()=>panels.map(n=>{const r=rect.call(n);return vertical?r.height:r.width;});
   const initial=size();event('pointerdown',sx,sy);const down=size(),saved=storage();
   const reads={rect:0,computed:0,rootRatio:0,storage:0};
   Element.prototype.getBoundingClientRect=function(...args){reads.rect++;return rect.apply(this,args);};
   window.getComputedStyle=function(...args){reads.computed++;return computed.apply(this,args);};
   CSSStyleDeclaration.prototype.setProperty=function(key,...args){if(this===root.style&&key.startsWith('--pmm-user-split-'))reads.rootRatio++;return set.call(this,key,...args);};
   Storage.prototype.setItem=function(...args){reads.storage++;return store.apply(this,args);};
   const frames=[];let duringFlags=0,blur=[];
   try{
    for(let i=0;i<24;i++){
     const delta=4+i*2;event('pointermove',sx+(vertical?0:delta),sy+(vertical?delta:0));await new Promise(requestAnimationFrame);
     if(i===0){duringFlags=panels.filter(n=>n.classList.contains('pmm-split-surface-resizing')).length;blur=panels.map(n=>computed(n).backdropFilter);}
     frames.push(size());
    }
   }finally{Element.prototype.getBoundingClientRect=rect;window.getComputedStyle=computed;CSSStyleDeclaration.prototype.setProperty=set;Storage.prototype.setItem=store;}
   const uncommitted=storage()===saved;
   event('pointerup',sx+(vertical?0:52),sy+(vertical?52:0));await new Promise(r=>setTimeout(r,500));
   const ratio=parseFloat(root.style.getPropertyValue('--pmm-user-split-top')),afterStyle=panels.map(n=>{const c=computed(n);return{blur:c.backdropFilter,transition:c.transition,shadow:c.boxShadow,background:c.background}});
   const committed=storage(),live=size();
   // Cancellation must restore the last committed ratio and release every temporary surface flag.
   const now=rect.call(handle),x=now.x+now.width/2,y=now.y+now.height/2;
   event('pointerdown',x,y);event('pointermove',x+(vertical?0:-40),y+(vertical?-40:0));await new Promise(requestAnimationFrame);event('pointercancel',x,y);await new Promise(r=>setTimeout(r,500));
   return{vertical,initial,down,reads,duringFlags,blur,frames,uncommitted,ratio,originalStyle,afterStyle,live,cancelled:size(),cancelSaved:storage()===committed,flagsAfter:document.querySelectorAll('.pmm-split-surface-resizing').length};
  },touch);
  const after=await metrics();result.metrics=Object.fromEntries(Object.keys(before).map(k=>[k,after[k]-before[k]]));
  assert.deepEqual(result.down,result.initial,'Grabbing a handle cannot jump the ratio');
  assert.deepEqual(result.reads,{rect:0,computed:0,rootRatio:0,storage:0},'Drag preview only writes the grid once per frame');
  assert.equal(result.duringFlags,touch?2:0);if(touch)assert.deepEqual(result.blur,['none','none']);
  assert(result.frames.at(-1)[0]>result.initial[0]&&result.frames.at(-1)[1]<result.initial[1],'Both pane sizes follow the drag before release');
  assert(result.uncommitted&&result.cancelSaved);assert.equal(result.flagsAfter,0);assert.deepEqual(result.afterStyle,result.originalStyle,'The resting material and transitions remain identical');
  for(let i=0;i<2;i++)assert(Math.abs(result.live[i]-result.cancelled[i])<1,'Cancel restores both pane sizes');
  await page.goto(fixture.url);await settle();
  assert.equal(await page.evaluate(()=>parseFloat(document.getElementById('preset-manager-main-panel').style.getPropertyValue('--pmm-user-split-top'))),result.ratio,'Reload keeps the released ratio');
  report.drags.push({name,...result});console.log('Phone performance regression passed:',name);
 }
 assert.deepEqual(errors,[]);
 if(process.env.PMM_BROWSER_REPORT)fs.writeFileSync(process.env.PMM_BROWSER_REPORT,JSON.stringify(report,null,2)+'\n');
 console.log('Passed: surface-only motion variables, native scoped DOM, phone ratio preview, save/cancel/reload, material restoration and unchanged desktop path.');
}finally{await page.close();await fixture.close();}
