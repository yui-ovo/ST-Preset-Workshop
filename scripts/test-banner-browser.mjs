import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createServer} from 'node:http';
import {browserPage} from './lib/browser-cdp.mjs';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const workshop=read('dist/workshop-v3.02.js');
// Use all shipped native component styles, including Vue's scoped textarea rule.
const nativeCss=[...workshop.matchAll(/\.push\(\[e\.id,('(?:\\.|[^'\\])*'),''/g)].map(m=>vm.runInNewContext(m[1])).join('\n');
assert(nativeCss.includes('.prompt-editor__textarea[data-v-01bebc6e]'));
assert(workshop.includes("'span',{class:'prompt-editor__label'},'内容正文'"));
assert(workshop.includes("class:'pmm-preset-name-field'"));
const start=workshop.indexOf('/* ===== PMM_MOBILE_LAYOUT_TUNER_V1'),end=workshop.indexOf('/* ===== PMM_FLOATING_PANEL_BATCH_V1',start);
const routes=new Map([['/native.css',nativeCss],['/layout.js',workshop.slice(start,end)]]);
for(const file of ['workshop-floating-store.js','workshop-theme-system.js','workshop-floating-controller.js'])routes.set('/'+file,read('dist/'+file));
const nativeFonts=new URL('../../SillyTavern/public/',import.meta.url);
const hasNativeFonts=fs.existsSync(new URL('css/fontawesome.min.css',nativeFonts));
if(hasNativeFonts){routes.set('/fontawesome.css',fs.readFileSync(new URL('css/fontawesome.min.css',nativeFonts)));routes.set('/webfonts/fa-solid-900.woff2',fs.readFileSync(new URL('webfonts/fa-solid-900.woff2',nativeFonts)));}
const banner=`<div class="floating-panel-root"><div class="panel-wrapper" style="display:none"><div class="panel-header">
<div class="panel-action" title="打开编辑面板"><i class="fa-solid fa-edit"></i></div><div class="panel-divider"></div>
<div class="panel-section"><i class="fa-solid fa-sliders section-icon" title="预设"></i><span class="pmm-preset-name-field"><select class="panel-select panel-select--preset" title="选择预设"><option value="诸神黄昏2.17">诸神黄昏2.17</option></select><span class="pmm-preset-name-text" aria-hidden="true">诸神黄昏2.17</span></span></div>
<div class="panel-section"><i class="fa-solid fa-code-branch section-icon" title="分支"></i><select class="panel-select panel-select--branch"><option>默认</option></select></div><div class="panel-collapse"><i></i></div>
</div><div class="quick-edit-dropdown" style="display:none"><div class="dropdown-content">条目列表</div></div></div></div>`;
const html=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${hasNativeFonts?'<link rel="stylesheet" href="/fontawesome.css">':''}<link rel="stylesheet" href="/native.css"><style>
body{margin:0;background:#eee;--SmartThemeBlurTintColor:#eee;--SmartThemeBodyColor:#fff;--SmartThemeQuoteColor:#729dcc}
</style><div id="preset-manager-main-panel"><section class="preset-panel" style="--pm-text-primary:#fff;--pm-card-bg:#f4f6f8"><div class="prompt-group"><div class="prompt-editor" data-v-01bebc6e><div class="prompt-editor__content-section" data-v-01bebc6e><div class="prompt-editor__content-header" data-v-01bebc6e><span class="prompt-editor__label" data-v-01bebc6e>内容正文</span></div><textarea class="prompt-editor__textarea" data-v-01bebc6e>日间内容正文：诸神黄昏2.17</textarea></div></div></div></section></div><div id="preset-manager-floating-panel">${banner}</div>
<script>window.pmmTopNotificationsEnabled=()=>false;window.pmmSetTopNotificationsEnabled=()=>{};window.fixture={entries:0};window.setFixtureName=name=>{const select=document.querySelector('.panel-select--preset');select.replaceChildren(new Option(name,name,true,true));select.dispatchEvent(new Event('change',{bubbles:true}));};
window.bindFixtureEntries=()=>{const root=document.querySelector('.floating-panel-root');root.__pmmQuickEntries={toggle(){fixture.entries++;const list=root.querySelector('.quick-edit-dropdown');list.style.display=list.style.display==='none'?'':'none';}};};bindFixtureEntries();
if(!localStorage.getItem('pmm_visual_theme_v1'))localStorage.setItem('pmm_visual_theme_v1','aqua');if(!localStorage.getItem('preset-manager-theme-mode'))localStorage.setItem('preset-manager-theme-mode','light');</script>
<script type="module" src="/layout.js"></script><script type="module" src="/workshop-floating-store.js"></script><script type="module" src="/workshop-theme-system.js"></script><script type="module" src="/workshop-floating-controller.js"></script>`;
const server=createServer((req,res)=>{const path=new URL(req.url,'http://localhost').pathname;res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(routes.get(path)||html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const page=await browserPage();page.on('Page.javascriptDialogOpening',()=>page.send('Page.handleJavaScriptDialog',{accept:true}));const errors=[];page.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description||e.exceptionDetails.text));
const settle=()=>page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>setTimeout(r,260));await Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getTiming().iterations)).map(a=>a.finished.catch(()=>{})));});
const metrics=()=>page.evaluate(()=>{
 const q=s=>document.querySelector(s),panel=q('.panel-wrapper'),field=q('.pmm-preset-name-field'),label=q('.pmm-preset-name-text'),select=q('.panel-select--preset');
 const canvas=document.createElement('canvas'),context=canvas.getContext('2d'),style=getComputedStyle(select);context.font=style.font;
 const name=label.textContent,measured=context.measureText(name).width;
 const chain=[q('.panel-section:has(.panel-select--preset)'),field,select,label].map(n=>{const s=getComputedStyle(n);return{node:n.className,overflow:s.overflow,textOverflow:s.textOverflow,whiteSpace:s.whiteSpace}});
 return {header: [...q('.panel-header').children].map(n=>({class:n.className,width:n.getBoundingClientRect().width,basis:getComputedStyle(n).flexBasis,padding:getComputedStyle(n).padding,margin:getComputedStyle(n).margin})),headerPadding:getComputedStyle(q('.panel-header')).padding,width:panel.getBoundingClientRect().width,available:field.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),measured,name,chain,selectFont:style.font,selectColor:getComputedStyle(select).color,selectFill:getComputedStyle(select).webkitTextFillColor,model:__PMM_LAYOUT_CARD_API__.getBannerWidth(),duplicate:!!q('.pmm-entries-toggle'),entries:fixture.entries};
});
const report={version:JSON.parse(read('manifest.json')).version,browser:(await page.send('Browser.getVersion')).product,nativeIconFont:hasNativeFonts,viewports:[],colors:[]};
const origin='http://127.0.0.1:'+server.address().port;
const openControl=async()=>{await page.evaluate(()=>__PMM_LAYOUT_CARD_API__.open());await settle();};
const saveControl=async()=>{await page.evaluate(()=>document.querySelector('[data-pmm-layout-done]').click());await settle();await page.evaluate(()=>__PMM_LAYOUT_CARD_API__.close());await settle();};
try{
 for(const [name,width,height,mobile] of [['phone portrait',390,844,true],['phone landscape',844,390,true],['tablet portrait',800,1100,true],['tablet landscape',1100,800,true],['desktop',1440,1024,false]].filter(item=>!process.env.PMM_BROWSER_CASE||item[0]===process.env.PMM_BROWSER_CASE)){
  console.log('Testing',name);
  await page.viewport(width,height,mobile);await page.goto(origin);await page.evaluate(()=>localStorage.clear());await page.goto(origin);await settle();
  await page.evaluate(()=>__PMM_FLOATING_CONTROLLER__.setExpanded(true));await settle();
  const initial=await metrics();assert.equal(initial.duplicate,false);assert.equal(initial.model.automatic,true);
  for(const node of initial.chain){assert.equal(node.textOverflow,'clip');assert.equal(node.whiteSpace,'nowrap');if(!node.node.includes('panel-select--preset'))assert.equal(node.overflow,'hidden',JSON.stringify(initial));}
  assert(initial.available>=initial.measured-1,`${name}: full initial name does not fit ${JSON.stringify(initial)}`);
  assert.equal(initial.selectColor,'rgba(0, 0, 0, 0)');assert.equal(initial.selectFill,'rgba(0, 0, 0, 0)');
  assert(initial.width<=width);assert.notEqual(initial.width,width/2);
  // Exercise the original header gesture, above and left of the pencil's center.
  await page.evaluate(()=>{const header=document.querySelector('.panel-header'),pencil=header.querySelector('[title="打开编辑面板"]').getBoundingClientRect();const init={bubbles:true,isPrimary:true,pointerId:8,pointerType:'touch',button:0,clientX:pencil.left-2,clientY:pencil.top+2};header.dispatchEvent(new PointerEvent('pointerdown',init));window.dispatchEvent(new PointerEvent('pointerup',init));});
  assert.equal((await metrics()).entries,1);
  await page.evaluate(()=>{const header=document.querySelector('.panel-header'),pencil=header.querySelector('[title="打开编辑面板"]').getBoundingClientRect();const init={bubbles:true,isPrimary:true,pointerId:9,pointerType:'touch',button:0,clientX:pencil.left-2,clientY:pencil.top+2};header.dispatchEvent(new PointerEvent('pointerdown',init));window.dispatchEvent(new PointerEvent('pointerup',init));});
  assert.equal((await metrics()).entries,2);
  await page.evaluate(()=>setFixtureName('诸神黄昏新名称2.17'));await settle();
  const changed=await metrics();assert(changed.width>initial.width);assert(changed.available>=changed.measured-1);
  await page.evaluate(()=>setFixtureName('诸神黄昏'.repeat(150)));await settle();
  const long=await metrics();assert(Math.abs(long.width-width)<2,`${name}: long name width ${long.width}`);assert(long.available<long.measured);assert(!/\.{3}|…/.test(long.name));
  await page.evaluate(()=>setFixtureName('诸神黄昏2.17'));await settle();assert.equal((await metrics()).width,initial.width,JSON.stringify({initial,current:await metrics()}));
  // The real controller input and Save button must establish manual ownership.
  await openControl();const manual=mobile?280:600;
  await page.evaluate(value=>{const lock=document.querySelector('[data-pmm-layout-lock="floatingWidth"]');if(document.querySelector('[data-pmm-layout-input="floatingWidth"]').disabled)lock.click();const input=document.querySelector('[data-pmm-layout-input="floatingWidth"]');input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},manual);await settle();
  assert.equal((await metrics()).model.width,manual);assert.equal((await metrics()).model.automatic,false);
  await saveControl();await page.goto(origin);await settle();await page.evaluate(()=>__PMM_FLOATING_CONTROLLER__.setExpanded(true));await settle();
  assert.equal((await metrics()).model.width,manual);assert.equal((await metrics()).width,manual);
  await page.evaluate(()=>setFixtureName('改名以后仍然保持手动保存的宽度'));await settle();assert.equal((await metrics()).width,manual);
  await page.evaluate(()=>{const root=document.querySelector('.floating-panel-root');window.fixtureRoot=root.cloneNode(true);root.remove();});await settle();
  await page.evaluate(()=>{document.getElementById('preset-manager-floating-panel').appendChild(fixtureRoot);bindFixtureEntries();__PMM_FLOATING_CONTROLLER__.setExpanded(true);});await settle();
  await page.evaluate(()=>__PMM_FLOATING_CONTROLLER__.setExpanded(true));await settle();assert.equal((await metrics()).width,manual);
  await page.evaluate(()=>setFixtureName('诸神黄昏2.17'));await settle();
  await openControl();await page.evaluate(()=>document.querySelector('[data-pmm-layout-reset]').click());await settle();
  const reset=await metrics();assert.equal(reset.model.automatic,true);assert.equal(reset.width,initial.width);assert.notEqual(reset.width,width/2);
  await saveControl();await page.goto(origin);await settle();await page.evaluate(()=>__PMM_FLOATING_CONTROLLER__.setExpanded(true));await settle();assert.equal((await metrics()).width,initial.width);
  report.viewports.push({name,width,height,automatic:initial.width,manual,reset:reset.width,clip:initial.chain.map(n=>n.textOverflow)});
 }
 // Read both final text properties against the actual entry background in all eight states.
 const beforeColors=await metrics();
 for(const touchMode of [true,false])for(const hostTone of ['light','dark'])for(const theme of ['aqua','glass','violet','theme'])for(const tone of ['light','dark']){
  if(hostTone==='light'&&theme==='aqua'&&tone==='light'){await page.viewport(touchMode?390:1440,touchMode?844:1024,touchMode);await settle();}
  await page.evaluate(({theme,tone,hostTone})=>{document.body.style.backgroundColor=hostTone==='light'?'#eee':'#15191f';document.body.style.setProperty('--SmartThemeBlurTintColor',hostTone==='light'?'#eee':'#15191f');const panel=document.querySelector('.preset-panel');panel.style.setProperty('--pm-card-bg',tone==='light'?'rgb(249,250,251)':'rgb(31,41,55)');panel.style.setProperty('--pm-text-primary','#fff');__PMM_THEME_SYSTEM__.setTheme(theme);__PMM_THEME_SYSTEM__.setTone(tone);}, {theme,tone,hostTone});await settle();
  const colors=await page.evaluate(()=>{const node=document.querySelector('.prompt-editor__textarea'),s=getComputedStyle(node);return{color:s.color,fill:s.webkitTextFillColor,background:s.backgroundColor};});
  const point=await page.evaluate(()=>{const r=document.querySelector('.prompt-editor__textarea').getBoundingClientRect();return{x:Math.floor(r.x+r.width/2),y:Math.floor(r.y+r.height/2),width:1,height:1,scale:1}});
  const capture=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  colors.paintedBackground=await page.evaluate(async({data,point})=>{const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');ctx.drawImage(img,-point.x,-point.y);const [r,g,b]=ctx.getImageData(0,0,1,1).data;return `rgb(${r}, ${g}, ${b})`;},{data:capture.data,point});
  const rgb=value=>value.match(/[\d.]+/g).slice(0,3).map(Number),luminance=value=>rgb(value).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
  const contrast=value=>{const a=luminance(value),b=luminance(colors.paintedBackground);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
  if(contrast(colors.color)<4.5||contrast(colors.fill)<4.5){
    const diagnosis=await page.evaluate(async()=>{const node=document.querySelector('.prompt-editor__textarea'),parents=[];for(let n=node;n;n=n.parentElement){const s=getComputedStyle(n);parents.push({class:n.className,tag:n.tagName,background:s.backgroundColor,image:s.backgroundImage,opacity:s.opacity,before:getComputedStyle(n,'::before').backgroundImage,after:getComputedStyle(n,'::after').backgroundImage});}__PMM_THEME_SYSTEM__.syncEntryText(node);await new Promise(r=>setTimeout(r,300));return{parents,color:getComputedStyle(node).color,fill:getComputedStyle(node).webkitTextFillColor,entry:node.style.getPropertyValue('--pmm-entry-text')};});
    console.log('COLOR_DIAGNOSIS',JSON.stringify({hostTone,theme,tone,colors,diagnosis}));
  }
  assert(contrast(colors.color)>=4.5,`${theme}/${tone} color ${JSON.stringify(colors)}`);assert(contrast(colors.fill)>=4.5,`${theme}/${tone} fill ${JSON.stringify(colors)}`);
  // Disable only the approved entry text rule: every material/layout property must be identical.
  const comparison=await page.evaluate(()=>{const style=document.getElementById('pmm-theme-system-style'),node=document.querySelector('.prompt-editor__textarea'),properties=['background','background-color','background-image','opacity','border','border-radius','box-shadow','filter','backdrop-filter','padding','margin','width','height','font-size','line-height','resize'];const snapshot=()=>Object.fromEntries(properties.map(k=>[k,getComputedStyle(node).getPropertyValue(k)]));const originalTransition=node.style.transition;node.style.setProperty('transition','none','important');const withFix=snapshot(),css=style.textContent;style.textContent=css.replace(/\/\* PMM_APPROVED_ENTRY_TEXT_BEGIN[\s\S]*?\/\* PMM_APPROVED_ENTRY_TEXT_END \*\//,'');const withoutFix=snapshot(),before={color:getComputedStyle(node).color,fill:getComputedStyle(node).webkitTextFillColor};const rules=[];const visit=ruleset=>{for(const rule of ruleset){if(rule.cssRules)visit(rule.cssRules);if(rule.selectorText){try{if(node.matches(rule.selectorText)&&['color','-webkit-text-fill-color'].some(k=>rule.style.getPropertyValue(k)))rules.push({selector:rule.selectorText,color:rule.style.getPropertyValue('color'),fill:rule.style.getPropertyValue('-webkit-text-fill-color'),important:rule.style.getPropertyPriority('color')});}catch{}}}};for(const sheet of document.styleSheets)visit(sheet.cssRules);style.textContent=css;if(originalTransition)node.style.transition=originalTransition;else node.style.removeProperty('transition');return{withFix,withoutFix,before,rules};});
  assert.deepEqual(comparison.withFix,comparison.withoutFix);
  report.colors.push({touchMode,hostTone,theme,tone,...colors,contrast:Number(contrast(colors.fill).toFixed(2)),withoutBodyRule:comparison.before,matchedRules:theme==='violet'&&tone==='light'?comparison.rules:undefined});
 }
 await settle();
 assert.equal((await metrics()).width,beforeColors.width,'Theme and screenshot diagnostics cannot resize an unchanged automatic name');
 // Real DOM reads are counted only for the shipped runtime, after the fixture has settled.
 await page.evaluate(()=>{
  fixture.reads={rect:0,computed:0,text:0};
  const rect=Element.prototype.getBoundingClientRect,computed=window.getComputedStyle,text=CanvasRenderingContext2D.prototype.measureText;
  Element.prototype.getBoundingClientRect=function(...args){fixture.reads.rect++;return rect.apply(this,args)};
  window.getComputedStyle=function(...args){fixture.reads.computed++;return computed.apply(this,args)};
  CanvasRenderingContext2D.prototype.measureText=function(...args){fixture.reads.text++;return text.apply(this,args)};
 });
 const frames=async(count,move=false)=>page.evaluate(async({count,move})=>{fixture.reads={rect:0,computed:0,text:0};for(let i=0;i<count;i++)await new Promise(resolve=>requestAnimationFrame(()=>{if(move)window.dispatchEvent(new PointerEvent('pointermove',{isPrimary:true,pointerId:25,pointerType:'touch',buttons:1,clientX:fixture.dragX+20+i,clientY:fixture.dragY+20+i/4}));resolve()}));return fixture.reads;},{count,move});
 assert.deepEqual(await frames(30),{rect:0,computed:0,text:0},'Idle frames cannot poll styles, geometry or text');
 await page.evaluate(()=>{const handle=document.getElementById('pmm-unified-floating-handle'),r=handle.getBoundingClientRect();fixture.dragX=r.x+10;fixture.dragY=r.y+10;handle.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,isPrimary:true,pointerId:25,pointerType:'touch',button:0,clientX:fixture.dragX,clientY:fixture.dragY}));});
 const dragReads=await frames(60,true);assert.deepEqual(dragReads,{rect:0,computed:0,text:0},'Pointermove and its animation frames cannot measure');
 await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup',{isPrimary:true,pointerId:25,pointerType:'touch',button:0,clientX:fixture.dragX+79,clientY:fixture.dragY+35})));await settle();
 const beforeReload=await metrics();
 await page.evaluate(()=>{__PMM_FLOATING_CONTROLLER__.setExpanded(false);__PMM_FLOATING_CONTROLLER__.setExpanded(true);});await settle();
 assert.equal((await metrics()).width,beforeReload.width);
 // An unchanged auto default is reused on reopening. Font edits invalidate it once.
 await openControl();
 await page.evaluate(()=>{const input=document.querySelector('[data-pmm-layout-input="floatingFont"]');if(input.disabled)document.querySelector('[data-pmm-layout-lock="floatingFont"]').click();input.value='16.5';input.dispatchEvent(new Event('input',{bubbles:true}));});await settle();
 const largeFont=await metrics();assert(largeFont.width>beforeReload.width);assert(largeFont.model.automatic);assert(largeFont.available>=largeFont.measured-1,JSON.stringify({beforeReload,largeFont}));
 await saveControl();await page.goto(origin);await settle();await page.evaluate(()=>__PMM_FLOATING_CONTROLLER__.setExpanded(true));await settle();
 assert.equal((await metrics()).width,largeFont.width,'Saved automatic font context survives reload without a different width');
 report.performance={idleFrames:30,dragFrames:60,dragReads,fontAutoWidth:largeFont.width};
 assert.equal(errors.length,0,errors.join('\n'));
 console.log(JSON.stringify(report,null,2));
 if(process.env.PMM_BROWSER_REPORT)fs.writeFileSync(process.env.PMM_BROWSER_REPORT,JSON.stringify(report,null,2)+'\n');
 console.log(`真实 Chromium 回归通过：${report.viewports.length} 类屏幕、最终 clip、唯一入口、内容默认/重置、保存/reload/重挂载、八种正文状态在浅/深宿主背景下可读，材质不变。`);
}finally{await page.close();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
