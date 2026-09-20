import assert from 'node:assert/strict';
import fs from 'node:fs';
import {workshopFixture} from './lib/workshop-browser-fixture.mjs';
import {browserPage} from './lib/browser-cdp.mjs';
const fixture=await workshopFixture({entries:600,themeSource:process.env.PMM_THEME_SOURCE&&fs.readFileSync(process.env.PMM_THEME_SOURCE,'utf8'),floatingSource:process.env.PMM_FLOATING_SOURCE&&fs.readFileSync(process.env.PMM_FLOATING_SOURCE,'utf8')});
const page=await browserPage(),baseline=process.env.PMM_RECORD_BASELINE==='1',report={version:JSON.parse(fs.readFileSync(new URL('../manifest.json',import.meta.url))).version,docks:[],themes:[]};
const errors=[];page.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description||e.exceptionDetails.text));
const settle=()=>page.evaluate(async()=>{await new Promise(r=>setTimeout(r,450));});
try{
 for(const [width,height] of [[800,1100],[1100,800]]){
  await page.viewport(width,height,true);await page.goto(fixture.url);await settle();
  for(const ball of [46,96])for(const side of ['left','right']){
   await page.evaluate(async({ball})=>{__PMM_FLOATING_CONTROLLER__.setExpanded(false);document.documentElement.style.setProperty('--pmm-floating-ball-size',ball+'px');window.dispatchEvent(new CustomEvent('pmm:floating-metrics-change'));__PMM_FLOATING_STORE__.setPosition({x:300,y:100,dock:'free'});await new Promise(r=>setTimeout(r,300));},{ball});
   const result=await page.evaluate(async({side,width})=>{
    const el=document.getElementById('pmm-unified-floating-handle'),r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
    const event=(target,type,clientX,clientY)=>target.dispatchEvent(new PointerEvent(type,{bubbles:true,isPrimary:true,pointerId:45,pointerType:'touch',button:0,buttons:type==='pointerup'?0:1,clientX,clientY}));
    const startWidth=document.documentElement.clientWidth,startScroll=document.documentElement.scrollWidth;
    event(el,'pointerdown',x,y);event(window,'pointermove',side==='right'?width-1:1,y);event(window,'pointerup',side==='right'?width-1:1,y);
    const frames=[];
    for(let i=0;i<24;i++){await new Promise(requestAnimationFrame);const p=el.getBoundingClientRect();frames.push({x:p.x,right:p.right,y:p.y,bottom:p.bottom,width:p.width,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,innerWidth,visualWidth:visualViewport.width});}
    return{startWidth,startScroll,frames,state:__PMM_FLOATING_CONTROLLER__.getState()};
   },{side,width});
   const worst=Math.max(...result.frames.map(f=>f.right-width)),growth=Math.max(...result.frames.map(f=>f.scrollWidth-result.startScroll));
   report.docks.push({width,height,ball,side,worstOverflow:worst,scrollGrowth:growth,state:result.state.position,frames:result.frames});
   console.log('dock',JSON.stringify({width,height,ball,side,worstOverflow:worst,scrollGrowth:growth}));
   if(!baseline){assert(result.frames.every(f=>f.x>=-.5&&f.right<=width+.5),'Every docking frame stays inside the tablet viewport');assert.equal(growth,0,'Docking cannot add horizontal scrollable overflow');}
  }
 }
 // Reopening, reloading and an inflated innerWidth must not revive an off-screen saved position.
 await page.viewport(800,1100,true);await page.goto(fixture.url);await settle();
 const boundaries=await page.evaluate(async()=>{
  const api=__PMM_FLOATING_CONTROLLER__,store=__PMM_FLOATING_STORE__,handle=document.getElementById('pmm-unified-floating-handle');
  const snapshot=()=>{const r=handle.getBoundingClientRect();return{x:r.x,right:r.right,bottom:r.bottom,scroll:document.documentElement.scrollWidth}};
  const results=[];
  for(const expanded of [true,false,true,false]){api.setExpanded(expanded);await new Promise(requestAnimationFrame);results.push(snapshot());}
  const descriptor=Object.getOwnPropertyDescriptor(window,'innerWidth');Object.defineProperty(window,'innerWidth',{value:940,configurable:true});
  store.setPosition({x:2200,y:100,dock:'right'});window.dispatchEvent(new Event('resize'));await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);results.push(snapshot());
  Object.defineProperty(window,'innerWidth',descriptor);
  api.setExpanded(true);await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
  let autoEvents=0;const onAuto=()=>autoEvents++;window.addEventListener('pmm:banner-default-width',onAuto);
  const vv=visualViewport,oldHeight=Object.getOwnPropertyDescriptor(vv,'height');Object.defineProperty(vv,'height',{value:500,configurable:true});
  store.setPosition({x:200,y:1400,dock:'free'});window.dispatchEvent(new Event('resize'));await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);const reduced=snapshot();
  if(oldHeight)Object.defineProperty(vv,'height',oldHeight);else delete vv.height;
  window.dispatchEvent(new Event('resize'));await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);window.removeEventListener('pmm:banner-default-width',onAuto);return{results,reduced,autoEvents};
 });
 if(!baseline){assert(boundaries.results.every(r=>r.x>=0&&r.right<=800.5),'Reopen and stale viewport widths cannot put the control outside the layout viewport');assert(boundaries.reduced.bottom<=500.5,'Browser visible height is the bottom bound');assert.equal(boundaries.autoEvents,0,'A shorter visual viewport is not a device rotation and must not recalculate automatic width');}
 report.boundaries=boundaries;await settle();await page.goto(fixture.url);await settle();
 const restored=await page.evaluate(()=>{const r=document.getElementById('pmm-unified-floating-handle').getBoundingClientRect();return{left:r.left,right:r.right,bottom:r.bottom};});
 if(!baseline)assert(restored.left>=0&&restored.right<=800.5&&restored.bottom<=1100.5);report.restored=restored;
 await page.viewport(1100,800,true);await page.goto(fixture.url);await settle();await page.evaluate(()=>__PMM_LAYOUT_CARD_API__.open());await settle();
 for(const action of ['tone','follow','skin']){
  const result=await page.evaluate(async action=>{
   const theme=__PMM_THEME_SYSTEM__;theme.setTheme('aqua');theme.setTone('light');await new Promise(r=>setTimeout(r,450));
   const t=performance.now();if(action==='tone')theme.setTone('dark');else if(action==='follow')theme.toggleFollow();else theme.setTheme('glass');
   await Promise.resolve();await Promise.resolve();await Promise.resolve();
   const callbacks=performance.now()-t;
   const rects=[];const animations=document.getAnimations();const entries=animations.filter(a=>a.effect?.target?.closest?.('.stress-list'));
   const perFrame=[];let last=performance.now();for(let i=0;i<24;i++){await new Promise(requestAnimationFrame);const now=performance.now();perFrame.push(now-last);last=now;}
   return{callbacks,totalAnimations:animations.length,entryAnimations:entries.length,frameTimes:perFrame};
  },action);
  report.themes.push({action,...result});console.log('theme',JSON.stringify({action,...result}));
  if(!baseline)assert.equal(result.entryAnimations,0,'Theme animation count must not grow with preset entry count');
  await settle();
 }
 // Many expanded bodies must use one read phase, one write phase, then animation inspection.
 await settle();
 const bodyBatch=await page.evaluate(async()=>{
  const cards=[...document.querySelectorAll('.stress-list .prompt-card')].slice(0,20);
  for(const card of cards){const ta=document.createElement('textarea');ta.className='prompt-editor__textarea';ta.setAttribute('data-v-01bebc6e','');ta.textContent='正文';ta.style.setProperty('--pmm-entry-text','#123456');card.appendChild(ta);}
  const styles=new Set(cards.map(n=>n.querySelector('textarea').style)),timeline=[],computed=window.getComputedStyle,set=CSSStyleDeclaration.prototype.setProperty,animations=Element.prototype.getAnimations;
  window.getComputedStyle=function(...args){timeline.push('read');return computed.apply(this,args);};
  CSSStyleDeclaration.prototype.setProperty=function(key,...args){if(key==='--pmm-entry-text'&&styles.has(this))timeline.push('write');return set.call(this,key,...args);};
  Element.prototype.getAnimations=function(...args){timeline.push('animations');return animations.apply(this,args);};
  __PMM_THEME_SYSTEM__.syncEntryText();await Promise.resolve();
  window.getComputedStyle=computed;CSSStyleDeclaration.prototype.setProperty=set;Element.prototype.getAnimations=animations;
  return{timeline,writes:timeline.filter(x=>x==='write').length};
 });
 if(!baseline){assert.equal(bodyBatch.writes,20);assert(bodyBatch.timeline.lastIndexOf('read')<bodyBatch.timeline.indexOf('write'),'No background read after an editor color write');assert(bodyBatch.timeline.lastIndexOf('write')<bodyBatch.timeline.indexOf('animations'),'Animation inspection follows all editor writes');}
 report.bodyBatch=bodyBatch;
 assert.deepEqual(errors,[]);if(process.env.PMM_BROWSER_REPORT)fs.writeFileSync(process.env.PMM_BROWSER_REPORT,JSON.stringify(report,null,2)+'\n');
 console.log(baseline?'Recorded pre-fix browser reproduction.':'Tablet docking and large-preset theme regression passed.');
}finally{await page.close();await fixture.close();}
