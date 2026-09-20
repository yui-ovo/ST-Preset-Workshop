import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {phonePerformanceFixture} from './lib/phone-performance-fixture.mjs';
import {browserPage} from './lib/browser-cdp.mjs';
// Optional published ref gives a reproducible comparison; this probe never writes Tavern data.
const ref=process.env.PMM_BASE_REF,old=ref&&execFileSync('git',['show',ref+':dist/workshop-v3.02.js'],{encoding:'utf8',maxBuffer:16*1024*1024});
const themeSource=ref?execFileSync('git',['show',ref+':dist/workshop-theme-system.js'],{encoding:'utf8'}):null;
const layoutSource=old&&old.slice(old.indexOf('/* ===== PMM_MOBILE_LAYOUT_TUNER_V1'),old.indexOf('/* ===== PMM_FLOATING_PANEL_BATCH_V1'));
const fixture=await phonePerformanceFixture({themeSource,layoutSource}),page=await browserPage(),report={baseline:ref||null};
await page.send('Performance.enable');
const metrics=async()=>Object.fromEntries((await page.send('Performance.getMetrics')).metrics.filter(m=>/Layout|RecalcStyle|ScriptDuration|TaskDuration/.test(m.name)).map(m=>[m.name,m.value]));
try{
 await page.viewport(390,844,true);await page.goto(fixture.url);await page.evaluate(async()=>{await new Promise(r=>setTimeout(r,600))});
 report.geometry=await page.evaluate(()=>({handles:[...document.querySelectorAll('.pmm-split-handle')].map(n=>({cls:n.className,rect:n.getBoundingClientRect().toJSON()})),panels:[...document.querySelectorAll('.preset-panel')].map(n=>({rect:n.getBoundingClientRect().toJSON(),transition:getComputedStyle(n).transition,blur:getComputedStyle(n).backdropFilter})),container:getComputedStyle(document.querySelector('.pm-panel-container')).gridTemplateRows}));
 for(const action of ['tone','skin']){
  const before=await metrics();
  const sample=await page.evaluate(async action=>{
   const theme=__PMM_THEME_SYSTEM__,start=performance.now();if(action==='tone')theme.setTone('dark');else theme.setTheme('glass');
   await Promise.resolve();await Promise.resolve();await Promise.resolve();
   const callback=performance.now()-start;const animations=document.getAnimations().map(a=>({cls:a.effect?.target?.className,prop:a.transitionProperty||a.animationName}));
   await new Promise(r=>setTimeout(r,600));return{callback,animations};
  },action);
  const after=await metrics();report[action]={...sample,metrics:Object.fromEntries(Object.keys(before).map(k=>[k,after[k]-before[k]]))};
 }
 const before=await metrics();
 report.drag=await page.evaluate(async()=>{
  const handle=document.querySelector('.pmm-split-handle--top'),r=handle.getBoundingClientRect();
  const event=(type,x,y)=>(type==='pointerdown'?handle:document).dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,isPrimary:true,pointerId:44,pointerType:'touch',button:0,buttons:1,clientX:x,clientY:y}));
  const panels=[...document.querySelectorAll('.preset-panel')],frames=[];
  event('pointerdown',r.x+10,r.y+10);
  for(let i=0;i<24;i++){event('pointermove',r.x+10,r.y+14+i*3);await new Promise(requestAnimationFrame);frames.push({animations:document.getAnimations().map(a=>({cls:a.effect?.target?.className,prop:a.transitionProperty||a.animationName})),heights:panels.map(n=>n.getBoundingClientRect().height),time:performance.now()});}
  event('pointerup',r.x+10,r.y+83);await new Promise(r=>setTimeout(r,300));return frames;
 });
 const after=await metrics();report.dragMetrics=Object.fromEntries(Object.keys(before).map(k=>[k,after[k]-before[k]]));
 if(process.env.PMM_BROWSER_REPORT)fs.writeFileSync(process.env.PMM_BROWSER_REPORT,JSON.stringify(report,null,2));
 console.log(JSON.stringify({geometry:report.geometry,tone:report.tone.metrics,toneCallback:report.tone.callback,toneAnimations:report.tone.animations.length,skin:report.skin.metrics,skinCallback:report.skin.callback,skinAnimations:report.skin.animations.length,drag:report.dragMetrics,dragAnimations:report.drag.slice(0,2).map(r=>r.animations)},null,2));
}finally{await page.close();await fixture.close();}
