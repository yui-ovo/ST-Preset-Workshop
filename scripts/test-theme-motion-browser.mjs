import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createServer} from 'node:http';
import {browserPage} from './lib/browser-cdp.mjs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const workshop=read('dist/workshop-v3.02.js');
const css=[...workshop.matchAll(/\.push\(\[e\.id,('(?:\\.|[^'\\])*'),''/g)].map(m=>vm.runInNewContext(m[1])).join('\n');
const start=workshop.indexOf('/* ===== PMM_MOBILE_LAYOUT_TUNER_V1'),end=workshop.indexOf('/* ===== PMM_FLOATING_PANEL_BATCH_V1',start);
const routes=new Map([['/native.css',css],['/layout.js',workshop.slice(start,end)],['/theme.js',read('dist/workshop-theme-system.js')]]);
for(const file of ['workshop-floating-store.js','workshop-floating-controller.js'])routes.set('/'+file,read('dist/'+file));
// Real shipped native CSS, independent layout controller and theme module; no Tavern user data.
const html=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/native.css"><style>
body{margin:0;background:#eee;--SmartThemeBlurTintColor:#eee;--SmartThemeBodyColor:#17202b}
#preset-manager-main-panel{position:relative!important;width:100%!important;height:350px!important}
.preset-panel{position:relative!important;width:100%!important;height:300px!important}
#preset-manager-floating-panel{position:relative!important;top:0!important;left:0!important;width:300px!important}
.panel-wrapper{position:relative!important;width:300px!important;height:100px!important}
</style><div id="preset-manager-main-panel"><div class="preset-panel"><header class="pm-header"><div class="header-card"><button class="theme-btn">日夜</button><button class="action-card">保存</button></div></header><div class="prompt-card"><span class="prompt-name">条目正文与开关</span></div><textarea class="prompt-editor__textarea" data-v-01bebc6e>可读正文</textarea></div></div>
<div id="preset-manager-floating-panel"><div class="floating-panel-root"><div class="panel-wrapper" style="display:none"><div class="panel-header">
<div class="panel-action" title="打开编辑面板"><i class="fa-solid fa-edit"></i></div><div class="panel-divider"></div>
<div class="panel-section"><i class="fa-solid fa-sliders section-icon" title="预设"></i><span class="pmm-preset-name-field"><select class="panel-select panel-select--preset" title="选择预设"><option value="诸神黄昏2.17">诸神黄昏2.17</option></select><span class="pmm-preset-name-text" aria-hidden="true">诸神黄昏2.17</span></span></div>
<div class="panel-section"><i class="fa-solid fa-code-branch section-icon" title="分支"></i><select class="panel-select panel-select--branch"><option>默认</option></select></div><div class="panel-collapse"><i></i></div>
</div><div class="quick-edit-dropdown" style="display:none"><div class="dropdown-content">条目列表</div></div></div></div></div>
<script>window.pmmTopNotificationsEnabled=()=>false;window.pmmSetTopNotificationsEnabled=()=>{};localStorage.setItem('pmm_visual_theme_v1','aqua');localStorage.setItem('preset-manager-theme-mode','light');</script><script type="module" src="/layout.js"></script><script type="module" src="/workshop-floating-store.js"></script><script type="module" src="/theme.js"></script><script type="module" src="/workshop-floating-controller.js"></script>`;
const server=createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(routes.get(p)||html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const page=await browserPage(),errors=[],report={version:JSON.parse(read('manifest.json')).version,cases:[]};
page.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description||e.exceptionDetails.text));
const settle=()=>page.evaluate(async()=>{await new Promise(r=>setTimeout(r,380));});
const surfaces=['.preset-panel','.pm-header','.panel-wrapper','#pmm-mobile-layout-card'];
try{
 for(const [name,width,height,touch] of [['phone',390,844,true],['tablet landscape',1100,800,true],['desktop',1440,1024,false]]){
  await page.viewport(width,height,touch);await page.goto('http://127.0.0.1:'+server.address().port);await settle();await page.evaluate(()=>{__PMM_LAYOUT_CARD_API__.open();__PMM_FLOATING_CONTROLLER__.setExpanded(true);});await settle();
  for(const [skin,tone] of [['aqua','dark'],['aqua','light'],['glass','light'],['violet','light'],['theme','light'],['theme','dark']]){
   const motion=await page.evaluate(async({skin,tone,surfaces})=>{
    const theme=__PMM_THEME_SYSTEM__,nodes=surfaces.map(s=>document.querySelector(s));
    const properties=['background','box-shadow','border','backdrop-filter','opacity','padding','width','height'];
    const material=()=>nodes.map(n=>Object.fromEntries(properties.map(k=>[k,getComputedStyle(n).getPropertyValue(k)])));
    const before=material();
    // Pausing CSS animations also requires holding their single cleanup deadline.
    // All other timers run normally; later rapid/gesture checks use the real clock.
    const nativeTimeout=window.setTimeout;let finishTheme=null;
    window.setTimeout=(fn,ms,...args)=>{if(fn.name==='stopTransition'){finishTheme=()=>fn(...args);return 0;}return nativeTimeout(fn,ms,...args);};
    theme.setTheme(skin);theme.setTone(tone);
    await Promise.resolve();await Promise.resolve();await Promise.resolve();
    window.setTimeout=nativeTimeout;
    const active=nodes.map(n=>n.classList.contains('pmm-theme-surface-motion'));
    nodes.forEach(n=>getComputedStyle(n,'::after').animationName);
    const layers=document.getAnimations().filter(a=>a.animationName?.startsWith('pmm-theme-layer'));
    layers.forEach(a=>a.pause());await Promise.all(layers.map(a=>a.ready));
    const colors=()=>['.action-card','.prompt-card','#pmm-mobile-layout-card button'].map(s=>{const n=document.querySelector(s),c=getComputedStyle(n);return{node:s,bg:c.backgroundColor,duration:c.transitionDuration,properties:c.transitionProperty};});
    const stages=[];
    for(const time of [0,70,140,280]){
     layers.forEach(a=>a.currentTime=time);
     stages.push(nodes.filter(n=>n.classList.contains('pmm-theme-surface-motion')).map(n=>({from:getComputedStyle(n,'::before').opacity,to:getComputedStyle(n,'::after').opacity,blend:getComputedStyle(n,'::after').mixBlendMode,duration:getComputedStyle(n,'::after').animationDuration})));
    }
    const origins=nodes.map(n=>getComputedStyle(n,'::before').background);
    const controls=colors();layers.forEach(a=>a.finish());finishTheme?.();
    return{before,origins,active,count:layers.length,stages,controls,tone:theme.getTone(),skin:theme.getTheme()};
   },{skin,tone,surfaces});
   assert.equal(motion.skin,skin);assert.equal(motion.tone,tone);assert(motion.count>=4,JSON.stringify({name,skin,tone,motion}));
   for(let i=0;i<motion.active.length;i++)if(motion.active[i])assert.equal(motion.origins[i],motion.before[i].background,`${name}/${skin}/${tone}: old surface ${surfaces[i]} must not jump at fade start`);
   for(const stage of motion.stages.slice(1,-1))for(const pair of stage){assert(+pair.to>0&&+pair.to<1);assert(Math.abs(+pair.from + +pair.to - 1)<.001);assert.equal(pair.blend,'plus-lighter');assert.equal(pair.duration,'0.28s');}
   for(const control of motion.controls){if(control.node==='.prompt-card'){assert.notEqual(control.duration,'0.28s','Entry rows must not receive the toolbar animation');continue;}assert.equal(control.duration,'0.28s',JSON.stringify({name,control}));assert(!/transform|filter|width|height|all/.test(control.properties));}
   await settle();
   const final=await page.evaluate(surfaces=>{
    const nodes=surfaces.map(s=>document.querySelector(s)),keys=['background','box-shadow','border','backdrop-filter','opacity','padding','width','height'];
    const material=()=>nodes.map(n=>Object.fromEntries(keys.map(k=>[k,getComputedStyle(n).getPropertyValue(k)])));
    const withMotion=material(),style=document.getElementById('pmm-theme-system-style'),source=style.textContent;
    // The entire motion block is last in the stylesheet. Compare to the exact same material without it.
    style.textContent=source.slice(0,source.indexOf('/* PMM_THEME_MOTION:'));
    const withoutMotion=material();style.textContent=source;
    return{withMotion,withoutMotion,active:document.querySelectorAll('.pmm-theme-surface-motion').length,changing:document.documentElement.classList.contains('pmm-theme-changing')};
   },surfaces);
   assert.deepEqual(final.withMotion,final.withoutMotion,'Animation must return to the same frozen material and layout');assert.equal(final.active,0);assert.equal(final.changing,false);
   report.cases.push({name,skin,tone,layers:motion.count,stages:motion.stages,controls:motion.controls});
  }
  // The production animation advances without JavaScript geometry/style measurements.
  const performance=await page.evaluate(async()=>{
   const theme=__PMM_THEME_SYSTEM__;theme.setTheme('aqua');theme.setTone('light');await new Promise(r=>setTimeout(r,380));
   const reads={computed:0,rect:0,entryChecks:[]};let frame=0;const computed=window.getComputedStyle,rect=Element.prototype.getBoundingClientRect;
   theme.setTone('dark');await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();
   window.getComputedStyle=function(...a){reads.computed++;reads.entryChecks.push({frame,entry:new Error().stack.includes('styleFor')});return computed.apply(this,a)};Element.prototype.getBoundingClientRect=function(...a){reads.rect++;return rect.apply(this,a)};
   for(frame=0;frame<24;frame++)await new Promise(requestAnimationFrame);
   window.getComputedStyle=computed;Element.prototype.getBoundingClientRect=rect;return reads;
  });assert.equal(performance.rect,0);assert(performance.computed<=12,JSON.stringify(performance));assert(performance.entryChecks.every(r=>r.entry));assert(new Set(performance.entryChecks.map(r=>r.frame)).size<=3,'Only finite entry-background events may recheck text; no per-frame reads');report.cases.at(-1).performance=performance;
  await page.evaluate(async()=>{const t=__PMM_THEME_SYSTEM__;for(let i=0;i<16;i++){t.setTheme(['glass','violet','aqua','theme'][i%4]);t.setTone(i%2?'dark':'light');await new Promise(requestAnimationFrame);}t.setTheme('aqua');t.setTone('light');});await settle();
  const quick=await page.evaluate(()=>({skin:__PMM_THEME_SYSTEM__.getTheme(),tone:__PMM_THEME_SYSTEM__.getTone(),layers:document.querySelectorAll('.pmm-theme-surface-motion').length}));assert.deepEqual(quick,{skin:'aqua',tone:'light',layers:0});
  const gesture=await page.evaluate(async()=>{const t=__PMM_THEME_SYSTEM__;t.setTone('dark');await Promise.resolve();await Promise.resolve();t.beginInteraction('test-drag');const stopped=document.querySelectorAll('.pmm-theme-surface-motion').length;t.setTone('light');await Promise.resolve();await Promise.resolve();const during=t.getTokens()===t.themes.aqua.dark;t.endInteraction('test-drag');await Promise.resolve();await Promise.resolve();return{stopped,during,after:t.getTokens()===t.themes.aqua.light};});assert.deepEqual(gesture,{stopped:0,during:true,after:true});await settle();
  await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await page.evaluate(async()=>{__PMM_THEME_SYSTEM__.setTone('dark');await Promise.resolve();await Promise.resolve();});
  assert.equal(await page.evaluate(()=>document.querySelectorAll('.pmm-theme-surface-motion').length),0);await page.send('Emulation.setEmulatedMedia',{features:[]});
 }
 assert.deepEqual(errors,[]);if(process.env.PMM_BROWSER_REPORT)fs.writeFileSync(process.env.PMM_BROWSER_REPORT,JSON.stringify(report,null,2)+'\n');
 console.log('Theme motion browser passed: 18 touch/desktop tone/skin transitions, intermediate crossfade, synchronized controls, exact final material, rapid switching, gesture deferral, reduced motion, zero geometry reads, bounded entry-color event checks and no per-frame style loop.');
}finally{await page.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}
