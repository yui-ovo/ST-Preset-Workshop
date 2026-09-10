import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const workshop = read('dist/workshop-v3.02.js');
const themes = read('dist/workshop-theme-system.js');
const floating = read('dist/workshop-floating-controller.js');
function between(source, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert(a >= 0 && b > a, `Cannot locate ${start}`);
  return source.slice(a, b);
}
function element() {
  const values = new Map(), priorities = new Map(), classes = new Set(), listeners = new Map();
  let styleMutations=0;
  return {
    nodeType:1, dataset:{}, listeners, get styleMutations(){return styleMutations;},
    style:{ getPropertyValue:key => values.get(key) || '', getPropertyPriority:key=>priorities.get(key)||'', setProperty(key,value,priority=''){styleMutations++;values.set(key,value);priorities.set(key,priority);}, removeProperty(key){values.delete(key);priorities.delete(key);}, get cssText(){return [...values].map(([k,v])=>k+':'+v+(priorities.get(k)?' !important':'')).join(';');}, set cssText(text){styleMutations++;values.clear();priorities.clear();for(const item of text.split(';')){const colon=item.indexOf(':');if(colon<0)continue;const key=item.slice(0,colon).trim(),raw=item.slice(colon+1).trim(),priority=/!important$/.test(raw)?'important':'';if(priorities.get(key)&&!priority)continue;values.set(key,raw.replace(/\s*!important$/,''));priorities.set(key,priority);}} },
    classList:{ add:(...names) => names.forEach(name => classes.add(name)), remove:(...names) => names.forEach(name => classes.delete(name)), contains:name => classes.has(name), toggle(name, force) { const next = force ?? !classes.has(name); if (next) classes.add(name); else classes.delete(name); return next; } },
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type, callback) { if (listeners.get(type) === callback) listeners.delete(type); },
    querySelector:() => null, querySelectorAll:() => [], matches:() => false,
    createElement:() => element(), body:{appendChild(){}}, getBoundingClientRect:()=>({left:0,top:0,width:1000,height:1000}),
    appendChild:() => {}, remove:() => {}, setAttribute:() => {},
  };
}
function frames() {
  const queue = new Map(); let id = 0;
  return { queue, request:fn => { queue.set(++id, fn); return id; }, cancel:key => queue.delete(key), flush() { const batch = [...queue.values()]; queue.clear(); batch.forEach(fn => fn()); } };
}

function bootTheme(theme='aqua', tone='light') {
  const roots=[], observers=[], microtasks=[], events=[], timers=frames();
  const doc={...element(),documentElement:element(),body:element(),head:element(),getElementById:()=>null,createElement:element};
  doc.querySelectorAll=selector=>selector.includes('#preset-manager-main-panel')?roots:[];
  const palette={'--SmartThemeBlurTintColor':'rgba(46,84,112,.7)','--SmartThemeBodyColor':'#e3eff9','--SmartThemeQuoteColor':'#8ad5ed'};
  class Observer {
    constructor(callback){this.callback=callback;this.targets=[];observers.push(this);}
    observe(target,options){this.targets.push({target,options});}
    disconnect(){this.disconnected=true;}
  }
  const storage=new Map([['pmm_visual_theme_v1',theme],['preset-manager-theme-mode',tone]]);
  const top={document:doc,localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},queueMicrotask:fn=>microtasks.push(fn),dispatchEvent:event=>events.push(event),getComputedStyle:()=>({getPropertyValue:key=>palette[key]||''}),setTimeout:timers.request,clearTimeout:timers.cancel};
  top.top=top;
  vm.runInNewContext(themes.replace('export default API;',''),{window:top,document:doc,MutationObserver:Observer,CustomEvent:class {constructor(type,init){this.type=type;this.detail=init.detail;}},console});
  const flush=()=>{let count=0;while(microtasks.length){assert(++count<20,'Theme commits must settle without an observer loop');microtasks.shift()();}};
  return {api:top.__PMM_THEME_SYSTEM__,top,doc,roots,observers,events,palette,storage,flush,microtasks,timers};
}

// Saved themes apply synchronously; all four late surfaces receive the same palette.
for(const theme of ['aqua','glass','violet','theme'])for(const tone of ['light','dark']){
  const env=bootTheme(theme,tone),{api,doc,roots,observers,flush}=env;
  const tokens=api.getTokens();
  assert.equal(tokens,api.themes[theme][tone]);
  assert.equal(doc.documentElement.style.getPropertyValue('--pmm-theme-control'),tokens.control);
  for(const id of ['preset-manager-main-panel','preset-manager-floating-panel','pmm-mobile-layout-card','pmm-unified-floating-handle']){
    const node=element();node.id=id;node.matches=()=>true;roots.push(node);
  }
  const mount=observers.find(observer=>observer.targets.some(({target,options})=>target===doc.body&&options.childList));
  assert(mount);assert(!mount.targets.some(({options})=>options.subtree));
  mount.callback([{addedNodes:roots}]);flush();
  for(const node of roots){
    assert.equal(node.style.getPropertyValue('--pm-control-bg'),tokens.control);
    assert.equal(node.style.getPropertyValue('--fp-text-color'),tokens.text);
    assert.equal(node.style.getPropertyValue('--pmm-floating-bg'),tokens.floating);
    assert.equal(node.dataset.pmmVisualTheme,theme);assert.equal(node.dataset.pmmThemeTone,tone);
  }
}

// A native click and its Vue update commit one complete theme before the next paint.
{
  const env=bootTheme('aqua','light'),{api,doc,events,flush,microtasks,timers}=env;
  const before=api.getTokens();
  api.setTone('dark');
  doc.listeners.get('click')({target:{closest:()=>({getAttribute:()=> '黑色模式'})}});
  assert.equal(api.getTokens(),before,'Do not recolor only part of the UI in capture phase');
  microtasks.shift()();assert.equal(api.getTokens(),before,'Allow the native Vue flush to finish');
  flush();assert.equal(events.length,2,'Startup plus exactly one day/night commit');
  assert.equal(api.getTone(),'dark');assert.equal(doc.documentElement.dataset.pmmThemeTone,'dark');
  assert(!doc.documentElement.classList.contains('pmm-theme-transition'),'Theme submission cannot wait for a capture animation');
  timers.flush();assert(!doc.documentElement.classList.contains('pmm-theme-transition'));
}

// Follow actual Tavern colors, track custom CSS changes, and restore the chosen skin.
{
  const env=bootTheme('glass','light'),{api,doc,palette,events,flush,observers}=env;
  let prevented=0;
  doc.listeners.get('click')({target:{closest:()=>({getAttribute:()=> '跟随酒馆美化'})},preventDefault(){prevented++;},stopImmediatePropagation(){prevented++;}});
  flush();assert.equal(prevented,2);assert.equal(api.getTheme(),'glass');assert.equal(api.isFollowingTavern(),true);
  assert.equal(api.getTone(),'dark','Auto mode follows Tavern background, not OS mode');
  const blue=api.getTokens();assert.notEqual(blue.surface,api.themes.theme.dark.surface);
  palette['--SmartThemeBlurTintColor']='rgba(97,44,93,.75)';palette['--SmartThemeQuoteColor']='#d6a4d4';
  const css=observers.find(observer=>observer.targets.some(({target})=>target===doc.head));
  css.callback([{target:{nodeType:1,id:'customCSS'},addedNodes:[]}]);flush();
  assert.notEqual(api.getTokens().surface,blue.surface);assert.notEqual(api.getTokens().floating,blue.floating);
  assert.notEqual(api.getTokens().control,blue.control);assert.notEqual(api.getTokens().accent,blue.accent);
  const eventCount=events.length;
  css.callback([{target:{nodeType:1,id:'pmm-theme-system-style'},addedNodes:[]}]);flush();
  assert.equal(events.length,eventCount,'Our own CSS cannot schedule another theme repaint');
  api.toggleFollow();flush();assert.equal(api.getTheme(),'glass');assert.equal(api.isFollowingTavern(),false);assert.equal(api.getTokens(),api.themes.glass.light);
  api.setTone('light');api.destroy();flush();assert.equal(events.length,eventCount+1,'Disposed instances cannot overwrite the new runtime');
}

// Editable material counters choose readable text across light, dark and colored Tavern backgrounds.
{
  const rgb=value=>{const match=value.match(/rgba?\(([^)]+)\)/);assert(match,value);const [r,g,b,a=1]=match[1].split(',').map(Number);return{r,g,b,a};};
  const over=(fore,back)=>({r:fore.r*fore.a+back.r*(1-fore.a),g:fore.g*fore.a+back.g*(1-fore.a),b:fore.b*fore.a+back.b*(1-fore.a),a:1});
  const luminance=color=>[color.r,color.g,color.b].map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
  for(const theme of ['glass','theme'])for(const tone of ['light','dark'])for(const backdrop of ['rgb(245,245,245)','rgb(22,24,30)','rgb(55,90,126)','rgb(120,73,112)']){
    const env=bootTheme(theme,tone);env.palette['--SmartThemeBlurTintColor']=backdrop;env.api.apply();
    const tokens=env.api.getTokens(),surface=over(rgb(tokens.surface),rgb(backdrop)),base=over(rgb(tokens.raised),surface);
    const count=rgb(env.doc.documentElement.style.getPropertyValue('--pmm-theme-count'));
    const a=luminance(count),b=luminance(base),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    assert(ratio>=4.5,`${theme}/${tone} counter contrast on ${backdrop}: ${ratio}`);
  }
}

// Frozen source bytes remain exact; only explicit main corrections and the count exception are allowed.
{
  const frozen=JSON.parse(read('scripts/fixtures/workshop-frozen-visuals.json'));
  const hash=value=>createHash('sha256').update(value).digest('hex');
  const baseline=between(themes,'/* PMM_FROZEN_VISUAL_BASELINE_BEGIN: exact pre-round CSS; aqua and violet */','/* PMM_FROZEN_VISUAL_BASELINE_END */').split('*/').slice(1).join('*/');
  assert.equal(hash(baseline),frozen.cssSha256);
  assert.equal(hash(between(themes,'  aqua:Object.freeze({','  glass:Object.freeze({')),frozen.aquaTokensSha256);
  assert.equal(hash(between(themes,'  violet:Object.freeze({','  theme:Object.freeze({')),frozen.violetTokensSha256);
  const allAdditions=between(themes,'/* PMM_FROZEN_VISUAL_BASELINE_END */','`;DOC.head');
  const approvedMain=between(allAdditions,'/* PMM_APPROVED_AQUA_MAIN_BEGIN:','/* PMM_APPROVED_AQUA_MAIN_END */');
  const rules=approvedMain.split('\n').filter(line=>line.startsWith('html'));
  assert.equal(rules.length,2);
  assert(rules.every(line=>line.includes('#preset-manager-main-panel .section-group')&&!line.includes('floating')));
  assert(!/rgba?\(|#[0-9a-f]{3,8}\b|blur|opacity|font-size/.test(approvedMain),'Approved main fixes must reuse the accepted palette and layout');
  const approvedBranch=between(allAdditions,'/* PMM_APPROVED_BRANCH_STRIP_BEGIN:','/* PMM_APPROVED_BRANCH_STRIP_END */');
  const branchRules=approvedBranch.split('\n').filter(line=>line.startsWith('html'));
  assert.equal(branchRules.length,4);
  for(const rule of branchRules){
    assert(rule.startsWith('html[data-pmm-visual-theme] body #preset-manager-main-panel .pm-panel-container--branch-mode > .preset-panel .pm-header '));
    const declarations=rule.slice(rule.indexOf('{')+1,-1).split(';');
    assert(declarations.every(value=>/^(background|color|-webkit-text-fill-color|border-color):var\(--pmm-theme-(raised|control|text|muted|border)\)!important$/.test(value)), 'Branch exception cannot change layout or material tokens');
  }
  const approvedRail=between(allAdditions,'/* PMM_APPROVED_FUNCTION_RAIL_BEGIN:','/* PMM_APPROVED_FUNCTION_RAIL_END */');
  const railRules=approvedRail.split('\n').filter(line=>line.startsWith('html'));
  assert.equal(railRules.length,5);
  assert(railRules.every(rule=>rule.startsWith('html[data-pmm-visual-theme] body #preset-manager-main-panel .side-panel-root')));
  assert(!/rgba?\(|#[0-9a-f]{3,8}\b|blur|padding|width|height|font-size|shadow/.test(approvedRail),'Rail fixes cannot introduce a new material or layout');
  const additions=allAdditions.replace(approvedMain,'').replace(approvedBranch,'').replace(approvedRail,'');
  const aquaRules=additions.split('\n').filter(line=>line.includes('[data-pmm-visual-theme="aqua"]'));
  assert.equal(aquaRules.length,1);assert(aquaRules[0].includes('.section-header>.section-header__count'));
  assert(!/background|font-weight|border|padding|blur/.test(aquaRules[0]),'The approved aqua exception is count text only');
  assert(!additions.includes('[data-pmm-visual-theme="violet"]'),'No new violet visual overrides');
  assert(!additions.includes('html[data-pmm-visual-theme]'),'New general skin selectors cannot alter frozen materials');
  const layout=read('dist/workshop-layout-controller.js');
  assert(layout.includes('@media(orientation:landscape){html body #preset-manager-main-panel .pm-header .title-action-btn>span{display:none!important}}'));
  assert(layout.includes('font-size:var(--pmm-header-icon-size,calc(var(--pmm-header-button-size,32px)*.38))'));
}
// Footer actions copy the retained original notification ON recipe, including its dark variant.
{
  const layout=read('dist/workshop-layout-controller.js');
  const footer=between(layout,'/* The reference is the original notification ON style.','/* Moving surfaces');
  const reference=between(workshop,'  .pmm-layout-notice-btn.pmm-layout-notice-btn--active{','  #pmm-mobile-layout-card[data-pmm-layout-theme="dark"]{');
  for(const declaration of reference.slice(reference.indexOf('{')+1,reference.indexOf('}')).split(';').map(value=>value.trim()).filter(Boolean)){
    if(declaration.startsWith('border-color:'))assert(footer.includes(declaration.replace('border-color:','border:1px solid ')));
    else assert(footer.includes(declaration),'All footer actions must retain original ON colors');
  }
  const dark=between(workshop,'  #pmm-mobile-layout-card[data-pmm-layout-theme="dark"] .pmm-layout-notice-btn.pmm-layout-notice-btn--active{','  #preset-manager-main-panel .pmm-split-handle{');
  for(const declaration of dark.slice(dark.indexOf('{')+1,dark.indexOf('}')).split(';').map(value=>value.trim()).filter(Boolean))assert(footer.includes(declaration));
  assert(footer.includes('.pmm-layout-card__footer>button{'));
  assert(!footer.includes('#pmm-mobile-layout-card#pmm-mobile-layout-card button{'),'The reference notification cannot be flattened by an all-button override');
}
// System material never depends on Tavern hues; the wand has its own persistent switch.
for(const tone of ['light','dark']){
  const {api,palette,storage,flush}=bootTheme('theme',tone),base=api.getTokens();
  palette['--SmartThemeBlurTintColor']='rgb(12,180,205)';palette['--SmartThemeQuoteColor']='#00ffe2';api.apply();
  assert.equal(api.getTokens(),base);assert(!api.isFollowingTavern());
  assert(!JSON.stringify(api.themes.theme).includes('SmartTheme'));
  api.toggleFollow();flush();assert(api.isFollowingTavern());assert.notEqual(api.getTokens().surface,base.surface);
  assert.equal(storage.get('pmm_visual_theme_v1'),'theme');assert.equal(storage.get('pmm_follow_tavern_v1'),'1');
  api.toggleFollow();flush();assert.equal(api.getTokens(),base);assert.equal(storage.get('preset-manager-theme-mode'),tone);
  api.toggleFollow();flush();api.setTheme('violet');flush();assert(!api.isFollowingTavern());assert.equal(api.getTokens(),api.themes.violet[tone]);
  api.destroy();
}

// Exercise the actual toolbar scope: its theme cache cannot live in another IIFE.
{
  const root = element(), card = element(), auto = element(); let applied = 0;
  auto.isConnected = true;
  card.querySelector = selector => selector.includes('主题模式') ? auto : null;
  root.querySelectorAll = selector => selector === '.theme-switch-card' ? [card] : [];
  const doc = { ...element(), documentElement:{ dataset:{ pmmVisualTheme:'violet', pmmThemeTone:'dark' } } };
  doc.querySelectorAll = () => [root];
  const top = { document:doc, __PMM_THEME_SYSTEM__:{ apply:() => applied++ } };
  doc.defaultView = top;
  const preamble = between(workshop, ';(() => {', '  const CSS = `').replace(';(() => {', '');
  const controls = between(workshop, '  function ensureWorkshopControls(doc)', '  TOP.__pmmThemeButtonsCleanup');
  const ensure = vm.runInNewContext(`(() => { ${preamble}\n${controls}\nreturn ensureWorkshopControls; })()`, { window:{ parent:top }, document:doc, ensureBranchEntryVisibilityControls() {} });
  ensure(doc);
  assert.equal(applied, 1, 'First-open toolbar theme initialization must complete without a ReferenceError');
}

// Runtime aqua toolbar buttons use the same existing CSS as their neighboring actions.
for(const skin of ['aqua','glass','violet','theme'])for(const follow of [false,true]){
  const button=element(),icon={className:''};button.closest=()=>({});button.querySelector=()=>icon;
  button.style.setProperty('background','stale inline color');
  const source=between(workshop,'  function setRuntimeButtonVisual(','  function setFabSwitchVisual(');
  const apply=vm.runInNewContext(`(() => {${source};return setRuntimeButtonVisual;})()`,{TOP:{__PMM_THEME_SYSTEM__:{getTheme:()=>skin,isFollowingTavern:()=>follow}}});
  apply(button,'fa-solid fa-sun','日间模式',true);
  assert.equal(button.style.getPropertyValue('background'),skin==='aqua'&&!follow?'':'color-mix(in srgb,var(--pmm-theme-control,var(--pm-control-bg)) 78%,var(--pmm-theme-accent,var(--pm-accent)) 22%)');
  assert.equal(icon.className,'fa-solid fa-sun');
}

// Exercise the real native theme setter: its colors must wait for the shared commit callback.
{
  const start=workshop.indexOf('setThemeMode:async function(n){'),endMarker='const t=ne();t.themeMode=n,await te(t)}';
  const end=workshop.indexOf(endMarker,start)+endMarker.length;assert(start>0&&end>start);
  const mode={value:'light'},storage=new Map();let callback=null,updates=0,saved=null;
  const host={localStorage:{setItem:(key,value)=>storage.set(key,value)},__PMM_THEME_SYSTEM__:{setTone:(tone,commit)=>{assert.equal(tone,'dark');callback=commit;}}};host.top=host;
  const setter=vm.runInNewContext(`({${workshop.slice(start,end)}}).setThemeMode`,{window:host,e:mode,o:()=>updates++,ne:()=>({}),te:async value=>saved=value.themeMode});
  await setter('dark');assert.equal(mode.value,'light');assert.equal(updates,0);assert.equal(saved,'dark');
  callback();assert.equal(mode.value,'dark');assert.equal(updates,1);
}

// The actual theme module commits before paint and uses background-only layers, including touch.
function motionTheme(){
  const env=bootTheme('aqua','light'),surface=element();surface.isConnected=true;env.roots.push(surface);
  env.doc.startViewTransition=()=>{throw Error('Input must not wait for a document screenshot');};
  surface.getClientRects=()=>{throw Error('Theme motion must not measure the preset tree');};
  return {...env,surface};
}
for(const device of ['desktop','phone','tablet']){
  const env=motionTheme();let native=0;
  env.top.matchMedia=query=>({matches:device!=='desktop'&&query.includes('pointer: coarse')});
  env.top.navigator={maxTouchPoints:device==='tablet'?10:device==='phone'?5:0};
  env.api.setTone('dark',()=>native++);env.flush();
  assert.equal(native,1);assert.equal(env.api.getTokens(),env.api.themes.aqua.dark);assert.equal(env.events.length,2);
  assert(env.surface.classList.contains('pmm-theme-surface-motion'));
  assert.equal(env.surface.style.getPropertyValue('--pmm-theme-motion-from'),env.api.themes.aqua.light.surface);
  assert.equal(env.surface.style.getPropertyValue('--pmm-theme-motion-to'),env.api.themes.aqua.dark.surface);
  env.timers.flush();assert(!env.surface.classList.contains('pmm-theme-surface-motion'));env.api.destroy();
}
// A pending request can be superseded or disposed before the native setter runs.
for(const action of ['mount','reverse','destroy']){
  const env=motionTheme();let dark=0,light=0;
  env.api.setTone('dark',()=>dark++);
  if(action==='mount'){
    const observer=env.observers.find(observer=>observer.targets.some(({target,options})=>target===env.doc.body&&options.childList));
    observer.callback([{addedNodes:[{...element(),matches:()=>true}]}]);
  }else if(action==='reverse')env.api.setTone('light',()=>light++);
  else env.api.destroy();
  env.flush();assert.equal(dark,action==='mount'?1:0);assert.equal(light,action==='reverse'?1:0);
  assert.equal(env.doc.documentElement.dataset.pmmThemeTone,action==='mount'?'dark':'light');env.api.destroy();
}
for(const capability of ['reduced','hidden']){
  const env=motionTheme();let native=0;
  if(capability==='hidden')env.doc.visibilityState='hidden';
  else env.top.matchMedia=query=>({matches:query.includes('reduced-motion')});
  env.api.setTone('dark',()=>native++);env.flush();assert.equal(native,1);assert(!env.surface.classList.contains('pmm-theme-surface-motion'));env.api.destroy();
}
// All three gestures stop visual work; requests stay coalesced until the last gesture ends.
{
  const env=motionTheme();let native=0;
  env.api.setTone('dark');env.flush();assert(env.surface.classList.contains('pmm-theme-surface-motion'));
  for(const owner of ['floating','split','controller'])env.api.beginInteraction(owner);
  assert(!env.surface.classList.contains('pmm-theme-surface-motion'));
  env.api.setTone('light',()=>native++);env.api.setTheme('glass');env.flush();
  assert.equal(native,0);assert.equal(env.api.getTokens(),env.api.themes.aqua.dark);
  env.api.endInteraction('floating');env.api.endInteraction('split');env.flush();assert.equal(native,0);
  env.api.endInteraction('controller');env.flush();assert.equal(native,1);assert.equal(env.api.getTokens(),env.api.themes.glass.light);
  env.api.destroy();assert.equal(env.timers.queue.size,0);
}

// Slider, numeric input and preset shortcuts share the same live ratio path.
{
  const root = element(), state = { values:{ splitRatio:50 }, customized:{ splitRatio:true } }; let saves = 0;
  const control = { key:'splitRatio', unit:'%' };
  const context = { root, card:null, currentState:() => state, CUSTOM_CLASSES:{ splitRatio:'custom-split' }, persistSoon:() => saves++ };
  const source = between(workshop, '  function applyControlValue(control, save = false)', '  function _pmmBindAndroidRangeGestureGuard');
  const apply = vm.runInNewContext(`(() => { ${source}; return applyControlValue; })()`, context);
  for (const ratio of [30,50,70]) {
    state.values.splitRatio = ratio;
    apply(control);
    assert.equal(root.style.getPropertyValue('--pmm-user-split-top'), `${ratio}fr`);
    assert.equal(root.style.getPropertyValue('--pmm-user-split-left'), `${ratio}fr`);
    assert.equal(root.style.getPropertyValue('--pmm-user-split-bottom'), `${100-ratio}fr`);
    assert.equal(root.style.getPropertyValue('--pmm-user-split-right'), `${100-ratio}fr`);
  }
  assert.equal(saves, 0, 'Preview cannot write storage');
  apply(control, true);
  assert.equal(saves, 1);
}

// A burst of split pointermoves must measure once, render once and save on release.
for (const vertical of [true,false]) {
  const raf = frames(), doc = element(), root = element(); let measurements = 0, saves = 0, stateReads = 0, captured = 0;
  const themeEnv=motionTheme();themeEnv.api.setTone('dark');themeEnv.flush();
  const geometry = { vertical, origin:0, available:1000 };
  const state = { values:{ splitRatio:50 }, customized:{ splitRatio:false } };
  const previews = [];
  const edge = vertical ? 'top' : 'left';
  const container=element();
  const handle = { ...element(), closest:() => container, classList:{ contains:name => name.endsWith(`--${edge}`) }, setPointerCapture(id){assert.equal(id,1);captured++;},hasPointerCapture:()=>true,releasePointerCapture(){captured--;} };
  const source = between(workshop, '  function resizeFromPoint(', '  function resetSplitRatio()') + between(workshop, '  function beginSplitResize(event)', '  function makeHandle(edge)');
  const begin = vm.runInNewContext(`(() => { let activeResizeCleanup=null; ${source}; return beginSplitResize; })()`, {
    DOC:doc, root, TOP:{}, VIEW:{ __PMM_THEME_SYSTEM__:themeEnv.api, requestAnimationFrame:raf.request, cancelAnimationFrame:raf.cancel }, MODE_SELECTOR:'split', Date,
    CONTROLS:[{ key:'splitRatio' }], currentState:() => { stateReads++; return state; }, clamp:(_key,value) => Math.max(28,Math.min(72,value)),
    measureSplitGeometry:() => { measurements++; return geometry; },
    applyControlValue:() => previews.push(state.values.splitRatio), persistSoon:() => saves++, updateOutputs() {}, resetSplitRatio() {}, flushDeferredLayout() {},
  });
  const pointer = (type, value) => ({ type, pointerId:1, currentTarget:handle, clientX:value, clientY:value, preventDefault() {}, stopPropagation() {} });
  begin(pointer('pointerdown', 500));
  assert.equal(captured,1);
  begin({type:'touchstart'});
  doc.listeners.get('pointerup')({...pointer('pointerup',500),pointerId:2});
  assert.equal(captured,1,'Companion touch and unrelated pointer releases must leave the drag active');
  for (let value=510;value<=700;value++) doc.listeners.get('pointermove')(pointer('pointermove',value));
  assert(!themeEnv.surface.classList.contains('pmm-theme-surface-motion'),'Split movement stops theme animation');
  themeEnv.api.setTone('light');themeEnv.flush();assert.equal(themeEnv.doc.documentElement.dataset.pmmThemeTone,'dark');
  assert.equal(measurements, 1);
  assert.equal(previews.length, 0);
  assert.equal(raf.queue.size, 1);
  raf.flush();
  assert.deepEqual(previews, [], 'Drag preview cannot invalidate inherited variables on the full main panel');
  const property=vertical?'grid-template-rows':'grid-template-columns';
  assert.equal(container.style.getPropertyValue(property),'','Dragging must not reflow the preset lists');
  assert.equal(saves, 0);
  for(const value of [651,652]){
    doc.listeners.get('pointermove')(pointer('pointermove',value));raf.flush();
    assert.equal(state.values.splitRatio,value/10,'Fine pointer movement must not jump in whole percentage steps');
  }
  assert.equal(stateReads,1,'Dragging must reuse the initial device state without querying viewport/media on each frame');
  doc.listeners.get('pointermove')(pointer('pointermove',300));
  doc.listeners.get('pointerup')(pointer('pointerup',320));
  themeEnv.flush();assert.equal(themeEnv.doc.documentElement.dataset.pmmThemeTone,'light');themeEnv.api.destroy();
  assert.equal(state.values.splitRatio, 32, 'Pointerup must flush the final pending preview');
  assert.equal(captured,0);
  assert.deepEqual(previews,[32], 'Only release writes the final root variables');
  assert.equal(container.style.getPropertyValue(property),'');
  assert.equal(container.style.getPropertyValue('transition'),'');
  assert.equal(saves, 1);
  assert.equal(raf.queue.size, 0);
  assert.equal(doc.listeners.size, 0);
}

// Cancelling a ratio gesture restores both the saved ratio and pre-existing inline grid styles.
for(const vertical of [true,false])for(const endType of ['pointercancel','lostpointercapture','blur']){
  const raf=frames(),doc=element(),root=element(),container=element();let saves=0,commits=0;
  const property=vertical?'grid-template-rows':'grid-template-columns';container.style.setProperty(property,'previous-grid');container.style.setProperty('transition','previous-transition');
  const state={values:{splitRatio:50},customized:{splitRatio:false}},edge=vertical?'top':'left';
  const handle={...element(),closest:()=>container,classList:{contains:name=>name.endsWith('--'+edge)}};
  const view={...element(),requestAnimationFrame:raf.request,cancelAnimationFrame:raf.cancel};
  const source=between(workshop,'  function resizeFromPoint(','  function resetSplitRatio()')+between(workshop,'  function beginSplitResize(event)','  function makeHandle(edge)');
  const begin=vm.runInNewContext(`(() => {let activeResizeCleanup=null;${source};return beginSplitResize;})()`,{
    DOC:doc,root,TOP:{},VIEW:view,MODE_SELECTOR:'split',Date,CONTROLS:[{key:'splitRatio'}],currentState:()=>state,
    clamp:(_key,value)=>Math.max(28,Math.min(72,value)),measureSplitGeometry:()=>({vertical,origin:0,available:1000}),applyControlValue:()=>commits++,persistSoon:()=>saves++,updateOutputs(){},resetSplitRatio(){},flushDeferredLayout(){},
  });
  begin({type:'pointerdown',currentTarget:handle,clientX:500,clientY:500,preventDefault(){},stopPropagation(){}});
  doc.listeners.get('pointermove')({clientX:600,clientY:600,getCoalescedEvents:()=>[{clientX:680,clientY:680}]});raf.flush();
  assert.equal(state.values.splitRatio,68);assert.equal(commits,0);assert.equal(container.style.getPropertyValue(property),'previous-grid','Only the lightweight divider is previewed');
  (endType==='blur'?view.listeners:endType==='lostpointercapture'?handle.listeners:doc.listeners).get(endType)({type:endType,clientX:0,clientY:0});
  assert.equal(state.values.splitRatio,50);assert.equal(state.customized.splitRatio,false);assert.equal(saves,0);assert.equal(commits,0,'Cancelled previews never rewrite main layout');
  assert.equal(container.style.getPropertyValue(property),'previous-grid');assert.equal(container.style.getPropertyValue('transition'),'previous-transition');
  assert.equal(doc.listeners.size,0);assert.equal(handle.listeners.size,0);assert.equal(view.listeners.size,0);assert.equal(raf.queue.size,0);
}

// Floating movement uses cached geometry and only transforms the two visible surfaces.
for (const expanded of [false,true]) {
  const raf = frames(), handle = element(), panel = element(), root = element();
  const source = between(floating, 'function paintDrag()', 'function clearDragPaint()');
  let captures = 0;
  const gesture = { id:1, sx:100, sy:100, bx:100, by:100, expanded, moved:false, panel:expanded ? panel : null, target:{ setPointerCapture:() => captures++ }, g:{ vw:1200, vh:800, bannerH:240 } };
  const move = vm.runInNewContext(`(() => { let dragFrame=0; ${source}; return onMove; })()`, {
    gesture, handle, root, TOP:{ requestAnimationFrame:raf.request }, clearLong() {}, cancelPendingTap() {}, controlSize:() => ({ w:46,h:46 }),
  });
  for (let x=110;x<=300;x++) move({ pointerId:1, clientX:x, clientY:200, preventDefault() {}, stopPropagation() {} });
  assert.equal(captures, 1);
  assert.equal(raf.queue.size, 1, 'A burst of samples queues only one paint');
  assert.equal(handle.style.getPropertyValue('transform'),'translate3d(10px,100px,0)','First motion is visible immediately');raf.flush();
  assert.equal(handle.style.getPropertyValue('transform'), 'translate3d(200px,100px,0)');
  assert.equal(panel.style.getPropertyValue('transform'), expanded ? 'translate3d(200px,100px,0)' : '');
  move({pointerId:1,clientX:310,clientY:200,getCoalescedEvents:()=>[{clientX:320,clientY:240}],preventDefault(){},stopPropagation(){}});
  raf.flush();assert.equal(handle.style.getPropertyValue('transform'),'translate3d(220px,140px,0)','Paint the freshest available coalesced sample');
  move({pointerId:1,clientX:320.5,clientY:240.25,preventDefault(){},stopPropagation(){}});
  raf.flush();assert.equal(handle.style.getPropertyValue('transform'),'translate3d(220.5px,140.25px,0)','Preserve subpixel movement on high-density screens');
  const lastTransform=handle.style.getPropertyValue('transform');
  move({pointerId:1,clientX:NaN,clientY:NaN});
  move({pointerId:2,clientX:500,clientY:500});
  assert.equal(handle.style.getPropertyValue('transform'),lastTransform,'Invalid or unrelated pointers must not repaint');
}

// A restored expansion must show its actual banner, or leave a round ball when the banner is absent.
for(const mounted of [false,true]){
  const handle=element(),panel=element(),root=element();const state={visible:true,expanded:true};
  root.querySelector=()=>mounted?panel:null;
  const source=between(floating,'function restorePanelDisplay()','function schedule()');
  const run=vm.runInNewContext(`(()=>{let renderFrame=0,managedPanel=null,managedDisplay=null;${source};return render;})()`,{
    handle,root,gesture:null,STORE:{getState:()=>state,update:patch=>Object.assign(state,patch)},ensurePosition:()=>({x:100,y:100}),resolveSide:()=> 'right',paint(){},
  });
  run();assert.equal(handle.classList.contains('is-expanded'),mounted);
  assert.equal(panel.style.getPropertyValue('display'),mounted?'flex':'');
  assert.equal(state.expanded,mounted);
}

// Replacing/unloading the floating owner restores native display, but leaves later external writes alone.
for(const [value,priority] of [['',''],['none',''],['grid','important']]){
  const first=element(),second=element();
  if(value)first.style.setProperty('display',value,priority);
  const source=between(floating,'function restorePanelDisplay()','function render()');
  const api=vm.runInNewContext(`(()=>{let managedPanel=null,managedDisplay=null;${source};return{setPanelDisplay,restorePanelDisplay};})()`);
  api.setPanelDisplay(first,true);assert.equal(first.style.getPropertyValue('display'),'flex');
  api.setPanelDisplay(second,false);assert.equal(first.style.getPropertyValue('display'),value);assert.equal(first.style.getPropertyPriority('display'),priority);
  api.restorePanelDisplay();assert.equal(second.style.getPropertyValue('display'),'');
  api.setPanelDisplay(first,true);first.style.setProperty('display','block','important');api.restorePanelDisplay();
  assert.equal(first.style.getPropertyValue('display'),'block','Cleanup cannot overwrite another owner');
}

// Android's direction guard must feed the same frame queue as ordinary range input.
for (const direction of ['horizontal','vertical','closed']) {
  const raf = frames(), input = element(), lock = element(), output = element(), label = element();
  input.value = '50'; input.isConnected = true;
  const row = element();
  row.querySelector = selector => selector === 'input' ? input : selector.includes('row__label') ? label : selector.includes('lock') ? lock : output;
  const state = { values:{ splitRatio:50 }, customized:{} }, previews = [];
  const source = between(workshop, '  function _pmmBindAndroidRangeGestureGuard', '  function cardViewportBounds(');
  const make = vm.runInNewContext(`(() => { ${source}; return makeControl; })()`, {
    DOC:{ createElement:() => row }, VIEW:{ requestAnimationFrame:raf.request, cancelAnimationFrame:raf.cancel },
    TOP:{ PointerEvent:class {} }, IS_ANDROID:true, isMobile:() => true, currentState:() => state,
    isControlLocked:() => false, valueRange:() => [28,72], clamp:(_key,value) => Number(value),
    applyControlValue:(_control,save) => previews.push({ value:state.values.splitRatio, save }), updateOutputs() {}, Date,
  });
  make({ key:'splitRatio', label:'ratio', unit:'%', step:.1 });
  const dispatch = (type,x=100,y=100) => input.listeners.get(type)?.({ pointerId:1, pointerType:'touch', clientX:x,clientY:y });
  dispatch('pointerdown');
  input.value = '52'; dispatch('input');
  assert.equal(input.value, '50', 'Pending direction cannot change the layout');
  dispatch('pointermove', direction === 'vertical' ? 101 : 130, direction === 'vertical' ? 130 : 101);
  for (let value=53;value<=70;value++) { input.value = String(value); dispatch('input'); }
  assert.equal(previews.length, 0, 'Guarded input cannot bypass the frame queue');
  if (direction === 'closed') input.isConnected = false;
  raf.flush();
  if (direction === 'horizontal') {
    assert.equal(previews.length, 1);
    assert.equal(state.values.splitRatio, 70);
    input.value = '68'; dispatch('input');
    dispatch('pointerup'); dispatch('change');
    assert.deepEqual(previews.at(-1), { value:68,save:true });
    assert.equal(raf.queue.size, 0);
  } else {
    assert.equal(previews.length, 0);
    assert.equal(state.values.splitRatio, 50, 'Scrolling or closing the card must not apply a delayed preview');
  }
}

// Remember Close at the end even when native buttons arrive after the first layout.
{
  const raf=frames(),bindings=new Map(),observers=[];
  const state={headerMode:'single',rememberHeaderScroll:true,headerPositions:{main:{left:180,atEnd:true}},headerScrollLeft:180};
  let saves=0;
  class Observer {
    constructor(callback){this.callback=callback;observers.push(this);}
    observe(){} disconnect(){this.disconnected=true;}
  }
  const source=between(workshop,'  function bindHeaderMemory','  function normalizeHeaderActions');
  const bind=vm.runInNewContext(`(() => { ${source}; return bindHeaderMemory; })()`,{
    VIEW:{requestAnimationFrame:raf.request,cancelAnimationFrame:raf.cancel},state,headerMemoryBindings:bindings,MutationObserverCtor:Observer,persistSoon:()=>saves++,
  });
  const header=()=>({...element(),isConnected:true,scrollLeft:0,clientWidth:120,scrollWidth:120});
  const first=header();bind(first,'main');raf.flush();assert.equal(first.scrollLeft,0);
  first.listeners.get('scroll')();assert.equal(saves,0,'Programmatic initial scrolling cannot overwrite memory');
  first.scrollWidth=720;observers[0].callback([]);raf.flush();assert.equal(first.scrollLeft,600,'Restore the end after buttons mount');
  first.listeners.get('pointerdown')();first.scrollLeft=235;first.listeners.get('scroll')();
  assert.equal(state.headerPositions.main.left,235);assert.equal(state.headerPositions.main.atEnd,false);
  first.scrollLeft=600;first.listeners.get('click')({target:{closest:()=>({})}});
  assert.equal(state.headerPositions.main.atEnd,true,'Capture the final position before Close unmounts the header');
  first.isConnected=false;
  const second=header();second.scrollWidth=520;bind(second,'main');raf.flush();
  assert.equal(second.scrollLeft,400,'Reopen at Close, including a changed viewport width');
  assert.equal(first.listeners.size,0);assert(observers[0].disconnected);
  const secondary=header();secondary.scrollWidth=920;bind(secondary,'secondary');raf.flush();
  assert.equal(secondary.scrollLeft,0,'The second preset must not inherit the main preset position');
  state.rememberHeaderScroll=false;
  second.listeners.get('pointerdown')();second.scrollLeft=90;second.listeners.get('scroll')();
  assert.equal(state.headerPositions.main.left,600,'Disabled memory cannot record changes');
  const third=header();third.scrollWidth=920;bind(third,'main');raf.flush();assert.equal(third.scrollLeft,0);
  state.rememberHeaderScroll=true;state.headerMode='multi';
  third.listeners.get('pointerdown')();third.scrollLeft=25;third.listeners.get('scroll')();
  assert.equal(state.headerPositions.main.left,600,'Multirow layout cannot overwrite single-row memory');
  for(const binding of bindings.values())binding.cleanup();assert.equal(raf.queue.size,0);
}

// The final floating pointerup can be newer than all pointermoves. No tail frame remains.
for(const expanded of [false,true]){
  const raf=frames(),handle=element(),panel=element(),root=element();let committed=null,painted=0;
  const source=between(floating,'function onUp(event)','function onCancel(event)');
  const update=between(floating,'function updateDragPoint(event)','function onMove(event)');
  const event={pointerId:1,clientX:340,clientY:240,preventDefault(){},stopPropagation(){}};
  const release=vm.runInNewContext(`(() => { let gesture={id:1,fromHandle:true,moved:true,bx:100,by:100,sx:100,sy:100,expanded:${expanded},g:{vw:1000,vh:800,bannerH:240},target:{}};let renderFrame=TOP.requestAnimationFrame(()=>{throw Error('stale render')});${update}
${source};return onUp; })()`,{
    handle,panel,root,TOP:{requestAnimationFrame:raf.request,cancelAnimationFrame:raf.cancel},Date,controlSize:()=>({w:46,h:46}),clearLong(){},clearDragPaint(){},settle:point=>committed=point,render:()=>painted++,
  });
  release(event);assert.equal(committed.x,340);assert.equal(committed.y,240);assert.equal(painted,1);assert.equal(raf.queue.size,0);
}

// Card movement measures once, paints without a trailing frame, and commits the release coordinate.
for(const touch of [false,true]){
  const raf=frames(),doc=element(),card=element(),state={};let measurements=0,bounds=0,saves=0;
  const themeEnv=motionTheme();themeEnv.api.setTone('dark');themeEnv.flush();
  card.getBoundingClientRect=()=>{measurements++;return{left:100,top:100,width:300,height:400};};
  const source=between(workshop,'  function writeCardPosition(', '  function fitCardToViewport(')+between(workshop,'  function beginCardDrag(event)','  function parseLayoutThemeColor');
  const begin=vm.runInNewContext(`(() => {let activeCardDragCleanup=null;${source};return beginCardDrag;})()`,{
    card,DOC:doc,VIEW:{__PMM_THEME_SYSTEM__:themeEnv.api,requestAnimationFrame:raf.request,cancelAnimationFrame:raf.cancel},state,
    cardViewportBounds:()=>{bounds++;return{originX:0,originY:0,scaleX:1,scaleY:1};},clampCardPosition:(left,top)=>({left,top}),STORE_PROFILE:()=> 'phone-landscape',persistSoon:()=>saves++,flushDeferredLayout(){},
  });
  const event=(type,x,y)=>({type,clientX:touch?undefined:x,clientY:touch?undefined:y,...(touch?{touches:type==='touchend'?[]:[{clientX:x,clientY:y}],changedTouches:[{clientX:x,clientY:y}]}:{}),target:{closest:()=>null},preventDefault(){},stopPropagation(){}});
  begin(event(touch?'touchstart':'pointerdown',100,100));
  doc.listeners.get(touch?'touchmove':'pointermove')(event(touch?'touchmove':'pointermove',110,100));
  assert(!themeEnv.surface.classList.contains('pmm-theme-surface-motion'));
  themeEnv.api.setTone('light');themeEnv.flush();assert.equal(themeEnv.doc.documentElement.dataset.pmmThemeTone,'dark');
  for(let x=110;x<=300;x++)doc.listeners.get(touch?'touchmove':'pointermove')(event(touch?'touchmove':'pointermove',x,200));
  assert.equal(measurements,1);assert.equal(bounds,1);assert.equal(raf.queue.size,1,'A burst of card samples queues only one paint');assert.equal(saves,0);raf.flush();
  assert.equal(card.style.getPropertyValue('transform'),'translate3d(200px,100px,0)');
  doc.listeners.get(touch?'touchend':'pointerup')(event(touch?'touchend':'pointerup',330,240));
  assert.equal(card.style.getPropertyValue('left'),'330px');assert.equal(card.style.getPropertyValue('top'),'240px');
  assert.equal(card.style.getPropertyValue('transform'),'');assert.equal(raf.queue.size,0);assert.equal(doc.listeners.size,0);assert.equal(saves,1);
  assert.equal(state.cardPositions['phone-landscape'].left,330);
  themeEnv.flush();assert.equal(themeEnv.doc.documentElement.dataset.pmmThemeTone,'light');themeEnv.api.destroy();
}


// Device defaults, saved custom values and range limits must agree with each viewport.
{
  const constants=between(workshop,'  const DEFAULTS = Object.freeze({','  const CUSTOM_CLASSES = Object.freeze({');
  const functions=between(workshop,'  function clamp(key, value)','  function loadState()');
  let current, reads=0;
  const size={width:360,height:780};
  const view={get innerWidth(){reads++;return size.width;},get innerHeight(){reads++;return size.height;}};
  const api=vm.runInNewContext(`(() => {${constants}\n${functions};return {makeLayoutState,valueRange,refreshDeviceValues};})()`,{VIEW:view,LEGACY_PRESET_WIDTH_BASE:108,currentState:()=>current});
  for(const [width,height] of [[360,780],[800,1100],[1280,800],[800,360],[1280,1800]]){
    Object.assign(size,{width,height});
    current=api.makeLayoutState();
    assert.equal(api.valueRange('controllerWidth')[1],width);
    assert.equal(api.valueRange('floatingWidth')[1],width);
    assert.equal(api.valueRange('controllerHeight')[1],height);
    assert.equal(api.valueRange('floatingHeight')[1],height);
    assert(api.valueRange('floatingHeight')[0]<api.valueRange('floatingHeight')[1],'The full-screen upper bound cannot consume the useful lower range');
    assert(current.values.controllerWidth<=width&&current.values.controllerHeight<=height);
    assert.equal(current.values.floatingWidth,Math.floor(width/2),'Default banner width is exactly half the device viewport');
    assert.equal(current.values.floatingHeight,Math.floor(height/2),'Default expanded banner must fill half the screen even on tall tablets');
    assert.equal(current.values.floatingFont,11);
    assert.equal(api.makeLayoutState({floatingFont:8},{floatingFont:true}).values.floatingFont,8);
    assert.equal(api.makeLayoutState({floatingFont:30},{floatingFont:true}).values.floatingFont,22);
    assert.equal(api.makeLayoutState({floatingFont:8},{}).values.floatingFont,11);
    assert(api.valueRange('floatingWidth')[0]<current.values.floatingWidth);
    assert(api.valueRange('floatingHeight')[0]<current.values.floatingHeight);
    const larger=api.makeLayoutState({floatingWidth:width*.9,floatingHeight:height*.9},{floatingWidth:true,floatingHeight:true});
    assert.equal(larger.values.floatingWidth,width*.9);assert.equal(larger.values.floatingHeight,height*.9);
    const maximum=api.makeLayoutState({floatingWidth:width+100,floatingHeight:height+100},{floatingWidth:true,floatingHeight:true});
    assert.equal(maximum.values.floatingWidth,width);assert.equal(maximum.values.floatingHeight,height);
    for(const key of ['itemGap','groupGap','floatingGap','headerGap']){
      assert.equal(api.valueRange(key)[0],-50);
      assert.equal(api.makeLayoutState({[key]:-60},{[key]:true}).values[key],-50);
    }
    const saved=api.makeLayoutState({controllerWidth:500,controllerHeight:400},{controllerWidth:true,controllerHeight:true});
    assert.equal(saved.values.controllerWidth,Math.min(500,width));
    assert.equal(saved.values.controllerHeight,Math.min(400,height));
    assert.equal(api.makeLayoutState({controllerWidth:810},{}).values.controllerWidth,current.values.controllerWidth,'Uncustomized old values must migrate to device defaults');
  }
  const before=reads;for(let i=0;i<100;i++)api.valueRange('splitRatio');
  assert.equal(reads,before,'Ratio hot path must not read the viewport');
  size.width=800;current=api.makeLayoutState({controllerWidth:700},{controllerWidth:true});
  size.width=360;api.refreshDeviceValues();assert.equal(current.values.controllerWidth,360);
}

// Touch-only WebViews resize vertically; a second finger cannot end the active gesture.
{
  const doc=element(),root=element(),container=element(),raf=frames();let saves=0;
  const state={values:{splitRatio:50},customized:{splitRatio:false}};
  const handle={...element(),ownerDocument:doc,closest:()=>container};handle.classList.add('pmm-split-handle--top');
  const source=between(workshop,'  function resizeFromPoint(','  function resetSplitRatio()')+between(workshop,'  function beginSplitResize(event)','  function ensureHandles(');
  const begin=vm.runInNewContext(`(() => {let activeResizeCleanup=null;${source};return beginSplitResize;})()`,{
    DOC:doc,root,TOP:{},VIEW:{requestAnimationFrame:raf.request,cancelAnimationFrame:raf.cancel},Date,MODE_SELECTOR:'split',
    CONTROLS:[{key:'splitRatio'}],currentState:()=>state,clamp:(_key,n)=>Math.max(28,Math.min(72,n)),
    measureSplitGeometry:()=>({vertical:true,origin:0,available:1000}),applyControlValue(){},persistSoon:()=>saves++,updateOutputs(){},resetSplitRatio(){},flushDeferredLayout(){},
  });
  const point=(identifier,y)=>({identifier,clientX:20,clientY:y});
  begin({type:'touchstart',currentTarget:handle,touches:[point(7,500)],preventDefault(){},stopPropagation(){}});
  doc.listeners.get('touchmove')({touches:[point(8,300),point(7,640)]});raf.flush();
  assert.equal(state.values.splitRatio,64);
  doc.listeners.get('touchend')({type:'touchend',changedTouches:[point(8,300)]});
  assert.equal(saves,0);assert(doc.listeners.has('touchmove'));
  doc.listeners.get('touchend')({type:'touchend',changedTouches:[point(7,650)]});
  assert.equal(state.values.splitRatio,65);assert.equal(saves,1);assert.equal(doc.listeners.size,0);
}

// The controller keeps the accepted outer-arrow placement and reuses its existing icon DOM.
{
  const host=element(),rail=element(),root=element();let appended=0;
  const button=element();button.parentElement=rail;button.querySelector=()=>({});
  rail.querySelector=()=>null;
  root.querySelector=selector=>selector==='.pmm-layout-trigger'?button:null;
  rail.appendChild=()=>appended++;
  const source=between(workshop,'  function ensureTrigger(sideRoot)','  function syncTriggerVisibility()');
  const ensure=vm.runInNewContext(`(() => {let trigger=null;${source};return ensureTrigger;})()`,{root,card:null,MODE_SELECTOR:'split',DOC:{createElement:()=>{throw Error('duplicate trigger');}},onTriggerClick(){}});
  ensure(rail);ensure(rail);
  assert.equal(appended,0,'Keep the previous outer arrow without moving or recreating it');
  assert.equal(typeof button.onclick,'function');
}

// Toolbar rebuilds keep exactly one floating visibility switch and one state owner.
{
  const host=element(),root=element();let visible=true,toggles=0;
  const buttons=Array.from({length:3},()=>({...element(),parentElement:host}));
  for(const button of buttons)button.remove=()=>buttons.splice(buttons.indexOf(button),1);
  root.querySelectorAll=()=>buttons.slice();
  const autoToggle={after(button){button.parentElement=host;button.previousElementSibling=this;if(!buttons.includes(button))buttons.push(button);}};
  // Exercise creation as well as stale duplicate removal.
  const source=between(workshop,"        const switches = Array.from(root.querySelectorAll('.pmm-mobile-fab-toggle'));",'      });\n    });\n  }');
  const env={root,doc:{createElement:()=>element()},TOP:{__PMM_FLOATING_STORE__:{getState:()=>({visible})}},FAB_RUNTIME_TOKEN:Symbol(),themeHost:host,autoToggle,setFabSwitchVisual(){},fabIsEnabled:()=>visible,setFabEnabled(next){visible=next;toggles++;}};
  vm.runInNewContext(`(()=>{${source}})()`,env);assert.equal(buttons.length,1);
  buttons.length=0;vm.runInNewContext(`(()=>{${source}})()`,env);vm.runInNewContext(`(()=>{${source}})()`,env);
  assert.equal(buttons.length,1);buttons[0].listeners.get('click')({preventDefault(){},stopPropagation(){}});
  assert.equal(visible,false);assert.equal(toggles,1);
}

// A detached controller is not open; the next tap must mount it rather than close a stale reference.
{
  const card={isConnected:false},top={};let opens=0,closes=0;
  const source=between(workshop,'  TOP.__PMM_LAYOUT_CARD_API__ = {','  function bindHeaderMemory(');
  vm.runInNewContext(source,{TOP:top,card,openCard(){opens++;card.isConnected=true;},closeCard(){closes++;card.isConnected=false;}});
  assert.equal(top.__PMM_LAYOUT_CARD_API__.isOpen(),false);
  top.__PMM_LAYOUT_CARD_API__.toggle();assert.equal(opens,1);assert.equal(closes,0);
  assert.equal(top.__PMM_LAYOUT_CARD_API__.isOpen(),true);
}

// Expanded-panel measurements respect custom heights up to the full screen.
for(const height of [360,780,1100]){
  const geometry={vh:height},panel={getBoundingClientRect:()=>({width:328,height:80}),querySelector:()=>({style:{display:''}})};
  const source=between(floating,'function measurePanel()','function defaultPosition()');
  vm.runInNewContext(`${source};measurePanel();`,{root:{querySelector:()=>panel},geometry,DOC:{documentElement:{}},TOP:{getComputedStyle:()=>({getPropertyValue:()=> '560'})}});
  assert.equal(geometry.bannerH,Math.min(560,height));
  assert(floating.includes('max-height:min(var(--pmm-floating-max-height,50dvh),calc(100dvh - var(--pmm-banner-y,0px)))'));
}

// Search filters existing rows without losing values, then restores the complete list.
{
  const search=element(),body=element(),empty=element();search.value='';body.children=[];
  body.appendChild=node=>body.children.push(node);
  const rows=['条幅宽度','中控面板宽度','分组名称字号'].map(text=>({...element(),textContent:text,value:17,querySelector:()=>({textContent:text})}));
  body.children.push(...rows);
  const panel={querySelector:()=>search};
  const source=between(workshop,"    const search = panel.querySelector('.pmm-layout-search');",'    panel.querySelector("[data-pmm-layout-close]")');
  vm.runInNewContext(`(()=>{${source}})()`,{panel,body,DOC:{createElement:()=>empty},TOP:{}});
  search.value='宽度';search.listeners.get('input')();assert.deepEqual(rows.map(row=>row.hidden),[false,false,true]);
  search.value='没有此项';search.listeners.get('input')();assert(!empty.hidden);
  search.value='';search.listeners.get('input')();assert(rows.every(row=>!row.hidden&&row.value===17));assert(empty.hidden);
}

// A late controller inherits cached tokens without reading layout or restarting a theme animation.
{
  const env=bootTheme('aqua','dark');
  env.top.getComputedStyle=()=>{throw Error('Mounting a control panel forced a main-page style calculation');};
  const observer=env.observers.find(observer=>observer.targets.some(({target,options})=>target===env.doc.body&&options.childList));
  const card={...element(),matches:()=>true};
  for(let i=0;i<100;i++)observer.callback([{addedNodes:[card]}]);
  assert.equal(card.style.getPropertyValue('--pmm-theme-control'),env.api.themes.aqua.dark.control);
  assert.equal(env.microtasks.length,0);assert.equal(env.events.length,1,'Opening settings cannot rescan main theme buttons');
  env.api.destroy();
}
// Material switching uses the same immediate commit; late surfaces never receive mixed tokens.
{
  const env=motionTheme();env.top.navigator={maxTouchPoints:5};env.api.setTheme('violet');
  const pendingCard={...element(),matches:()=>true};env.roots.push(pendingCard);
  const mount=env.observers.find(observer=>observer.targets.some(({target,options})=>target===env.doc.body&&options.childList));
  mount.callback([{addedNodes:[pendingCard]}]);assert.equal(pendingCard.dataset.pmmVisualTheme,'aqua');
  env.flush();assert.equal(env.api.getTokens(),env.api.themes.violet.light);assert.equal(pendingCard.dataset.pmmVisualTheme,'violet');
  assert.equal(pendingCard.style.getPropertyValue('--pmm-theme-control'),env.api.themes.violet.light.control);
  env.api.setTheme('violet');env.flush();assert.equal(env.events.length,2);env.api.destroy();
}
// Dock geometry is flush to both device edges and leaves the half-screen banner inside the viewport.
for(const vw of [320,360,390,768,1024]){
  const g={vw,vh:900,ball:46,handleW:28,handleH:64,bannerW:vw/2,bannerH:400};
  const state={expanded:false},commits=[];
  const code=between(floating,'function controlSize(','function measurePanel(')+between(floating,'function clampPosition(','function ensurePosition(')+between(floating,'function settle(','function singleTap(');
  const api=vm.runInNewContext(`(()=>{${code};return{settle,clampPosition,panelPoint,resolveSide};})()`,{
    geometry:g,STORE:{getState:()=>state,commit:patch=>{Object.assign(state,patch);commits.push(patch);}},
  });
  for(const [x,dock] of [[8,'left'],[vw-50,'right']]){
    api.settle({x,y:100,dock:'free'});assert.equal(state.position.dock,dock);
    assert.equal(state.position.x,dock==='left'?0:vw-28);
    state.expanded=true;const expanded=api.clampPosition(state.position);
    assert.equal(expanded.x,dock==='left'?0:vw-28);
    const banner=api.panelPoint(expanded,api.resolveSide(expanded));
    assert(banner.x>=0&&banner.x+g.bannerW<=vw);
    state.expanded=false;
  }
  api.settle({x:vw/2-23,y:100,dock:'free'});assert.equal(state.position.dock,'free');
  assert.equal(commits.length,3,'Only releases persist a position');
}
// Full-screen custom banners remain inside the viewport at both edges and protect the handle corner.
for(const vw of [320,390,768,1024])for(const bannerW of [vw/2,vw*.9,vw])for(const bannerH of [300,800]){
  const g={vw,vh:800,ball:46,handleW:28,handleH:64,bannerW,bannerH};
  const code=between(floating,'function controlSize(','function measurePanel(')+between(floating,'function clampPosition(','function ensurePosition(');
  const api=vm.runInNewContext(`(()=>{${code};return{clampPosition,panelPoint,resolveSide};})()`,{geometry:g,STORE:{getState:()=>({expanded:true})}});
  for(const dock of ['free','left','right']){
    const position=api.clampPosition({x:vw/2,y:600,dock}),point=api.panelPoint(position,api.resolveSide(position));
    assert(point.x>=0&&point.x+bannerW<=vw);assert(point.y>=0&&point.y+bannerH<=800);
    if(bannerW===vw){assert.equal(point.x,0);assert([0,vw-28].includes(position.x),'A full-width banner keeps the handle at an edge');}
    if(bannerH===800)assert.equal(point.y,0);
  }
}
// Width only changes outer geometry; font alone changes the content scale, in either order.
{
  const root=element(),doc={...element(),documentElement:element(),querySelectorAll:()=>[root]};
  const code=between(workshop,'  function applyFloatingWidth(', '  function setFloatingVariables()');
  const api=vm.runInNewContext(`(()=>{${code};return {width:applyFloatingWidth,font:applyFloatingFont};})()`,{TOP:{},floatingDocuments:()=>[doc],layoutViewport:()=>({width:390,height:844}),setLayoutVariable:(node,key,value)=>node.style.setProperty(key,value)});
  for(const font of [11,8,22]){
    api.font(font);
    for(const width of [117,195,300,390,900]){
      api.width(width);
      assert.equal(root.style.getPropertyValue('--pmm-mobile-floating-width'),`${Math.min(width,390)}px`);
      assert.equal(Number(root.style.getPropertyValue('--pmm-banner-content-scale')),font/11,'Width cannot change the explicit font scale');
    }
  }
  api.width(195);api.font(8);assert.equal(root.style.getPropertyValue('--pmm-mobile-floating-width'),'195px');
  assert.equal(doc.documentElement.style.getPropertyValue('--pmm-banner-content-scale'),'');
  assert.equal(doc.documentElement.style.getPropertyValue('--pmm-mobile-floating-width'),'');
  assert(floating.includes('>.panel-wrapper>:is(.panel-header,.quick-edit-dropdown){zoom:var(--pmm-banner-content-scale,1)'));
  assert(!floating.includes('>.panel-wrapper{zoom:'),'The drag surface and pointer coordinates must not be zoomed');
}
// The native tablet/desktop cap remains upstream, but unified geometry has higher specificity.
{
  assert(workshop.includes('.floating-panel-root:not(.pmm-floating-mobile) .panel-select--preset{'));
  const rules=floating.slice(floating.indexOf('/* One line at every width.'),floating.indexOf('/* Half-screen defaults;'));
  assert(rules.includes('>.panel-header{flex-flow:row nowrap!important;white-space:nowrap!important}'));
  assert(!floating.includes('.panel-header{flex-wrap:wrap!important}'));
  assert(rules.includes('#preset-manager-floating-panel#preset-manager-floating-panel .pmm-unified-floating-root .panel-section:has(.panel-select--preset){flex:1 1 0!important;width:auto!important;min-width:0!important;max-width:none!important}'));
  assert(rules.includes('.panel-select--preset{box-sizing:border-box!important;flex:1 1 0!important;width:0!important;min-width:0!important;max-width:none!important;'));
  assert(!/max-width:(160|100|130)px/.test(rules),'Name space cannot keep the legacy maximum');
  assert(rules.includes('.pmm-unified-floating-root>.panel-wrapper{width:min(var(--pmm-mobile-floating-width,50vw),100vw'));
}
// A newly mounted controller is never visible until its final coordinates and transform are ready.
for(const [vw,vh] of [[360,780],[800,1100],[1280,800]])for(const saved of [false,true])for(const full of [false,true]){
  const card=element(),doc=element(),current={values:{controllerWidth:full?vw:Math.min(vw-24,620),controllerHeight:full?vh:Math.min(vh*.76,640),controllerFont:12}};
  const state={cardPositions:saved?{profile:{left:5000,top:5000}}:{}};let measured=0,appended=0;
  card.getBoundingClientRect=()=>{measured++;assert.equal(appended,1);assert.equal(card.style.getPropertyValue('visibility'),'hidden');assert.equal(card.style.getPropertyValue('transform'),'none');return{left:0,top:0,width:current.values.controllerWidth,height:current.values.controllerHeight};};
  doc.body.appendChild=node=>{appended++;assert.equal(node,card);assert(!node.classList.contains('pmm-layout-card--open'));assert.equal(node.style.getPropertyValue('visibility'),'hidden');card.isConnected=true;};
  const code=between(workshop,'  function cardViewportBounds(', '  function STORE_PROFILE()')+between(workshop,'  function openCard()', '  function onTriggerClick(');
  const open=vm.runInNewContext(`(()=>{let card=null,saveTimer=0,cardSnapshot=null;${code};return openCard;})()`,{
    DOC:doc,state,CONTROLS:[],VIEW:{innerWidth:vw,innerHeight:vh,requestAnimationFrame(){throw Error('First visible placement must not wait for another frame');}},
    TOP:{__PMM_FLOATING_STORE__:{getState:()=>({keyboardEditing:true})}},STORE_PROFILE:()=> 'profile',buildCard:()=>card,refreshDeviceValues(){},updateOutputs(){},clearTimeout(){},
    currentState:()=>current,setLayoutVariable:(node,key,value)=>node.style.setProperty(key,value),trigger:null,
  });
  open();assert.equal(measured,2);assert.equal(card.style.getPropertyValue('visibility'),'');assert(card.classList.contains('pmm-layout-card--positioned'));assert(card.classList.contains('pmm-layout-card--open'));
  const x=parseFloat(card.style.getPropertyValue('left')),y=parseFloat(card.style.getPropertyValue('top'));
  assert.equal(x,(vw-current.values.controllerWidth)/2,'Every new open centers, ignoring old saved coordinates');assert.equal(y,(vh-current.values.controllerHeight)/2);
  assert(x>=0&&x+current.values.controllerWidth<=vw);assert(y>=0&&y+current.values.controllerHeight<=vh);
  open();assert.equal(measured,2,'An already-open controller keeps its position');
}
// Sliding vertically along an edge must not introduce a sideways jump at pointermove or release.
for(const dock of ['left','right']){
  const gesture={dock,bx:dock==='left'?0:332,by:100,sx:20,sy:100,expanded:false,size:{w:28,h:28},g:{vw:360,vh:800}};
  const move=vm.runInNewContext(`${between(floating,'function updateDragPoint(event)','function onMove(event)')};updateDragPoint;`,{gesture});
  move({clientX:20,clientY:180});assert.equal(gesture.dx,0);assert.equal(gesture.dy,80);
}
// The square dock opens on the first release; banner taps call the native Vue action exactly once.
for(const fromHandle of [false,true]){
  let opened=0,entries=0,waits=0;
  const release=vm.runInNewContext(`(()=>{let gesture={id:1,fromHandle:${fromHandle},dock:'right',moved:false,target:{}};let renderFrame=0;${between(floating,'function onUp(event)','function onCancel(event)')};return onUp;})()`,{
    root:{__pmmQuickEntries:{toggle:()=>entries++}},handle:{blur(){}},clearLong(){},clearDragPaint(){},cancelPendingTap(){},
    STORE:{getState:()=>({expanded:false})},setExpanded:value=>{assert.equal(value,true);opened++;},singleTap:()=>waits++,
  });
  release({pointerId:1,preventDefault(){},stopPropagation(){}});
  assert.equal(opened,fromHandle?1:0);assert.equal(entries,fromHandle?0:1);assert.equal(waits,0);
}
// Cancel detaches the dialog, restores only changed settings, and invalidates geometry once.
for(const changed of [false,true]){
  const controls=['groupFont','floatingWidth','floatingFont','controllerWidth'].map(key=>({key}));
  const baseline={mobile:{values:{groupFont:12,floatingWidth:180,floatingFont:11,controllerWidth:344},customized:{}},headerMode:'multi',glyph:'☰'};
  const live=structuredClone(baseline),calls=[],events=[],sequence=[];
  if(changed){live.mobile.values.groupFont=16;live.mobile.values.floatingWidth=170;live.mobile.values.floatingFont=8;live.mobile.values.controllerWidth=300;}
  const closing={remove:()=>sequence.push('detach'),querySelectorAll:()=>controls.map(()=>({__pmmControlCleanup:save=>{assert.equal(save,false);sequence.push('row');}})),__pmmSearchCleanup:()=>sequence.push('search')};
  const api=vm.runInNewContext(`(()=>{let state=live,cardSnapshot=baseline,card=closing;${between(workshop,'  function closeCard(saveChanges','  function openCard()')};return{closeCard,getState:()=>state,getCard:()=>card};})()`,{
    live,baseline,closing,CONTROLS:controls,activeCardDragCleanup:null,trigger:null,root:null,isMobile:()=>true,
    VIEW:{clearTimeout(){}},cardStatusTimer:0,TOP:{dispatchEvent:event=>events.push(event.type)},CustomEvent:class{constructor(type){this.type=type;}},applyControlValue:control=>calls.push(control.key),persistSoon:()=>{throw Error('Cancel must not save');},
  });
  api.closeCard(false);assert.equal(api.getCard(),null);assert.equal(api.getState(),baseline);
  assert(sequence.indexOf('search')<sequence.indexOf('detach'),'Release keyboard ownership before detaching the focused search field');
  assert(sequence.indexOf('detach')<sequence.indexOf('row'),'Input cleanup cannot relayout the visible dialog');
  assert.deepEqual(calls,changed?['groupFont','floatingWidth','floatingFont']:[]);
  assert.deepEqual(events,changed?['pmm:floating-metrics-change']:[]);
}

console.log('统一 UI 交互回归通过：主题冻结、主界面例外范围、统一切换/快速反向/降级、比例预览、触摸/指针捕获、设备范围、唯一开关、搜索、半屏默认/全屏上限/比例缩放与横滑记忆。');

// One CSS mutation per theme surface, no loss of drag geometry or inline priorities.
{
  const env=bootTheme(),{api,doc,roots,observers,flush}=env;
  const card=element();card.id='pmm-mobile-layout-card';card.matches=()=>true;roots.push(card);
  card.style.setProperty('left','123.5px','important');card.style.setProperty('transform','translate3d(10px,20px,0)','important');
  const mount=observers.find(observer=>observer.targets.some(({target,options})=>target===doc.body&&options.childList));
  mount.callback([{addedNodes:[card]}]);
  const before=card.styleMutations,htmlBefore=doc.documentElement.styleMutations;
  api.setTheme('glass');flush();
  assert.equal(doc.documentElement.styleMutations-htmlBefore,1,'A theme change must not emit one style mutation for every variable');
  assert.equal(card.styleMutations-before,3,'One palette batch plus two transition endpoints on an animated surface');
  assert.equal(card.style.getPropertyValue('--pmm-theme-control'),api.getTokens().control);
  assert.equal(card.style.getPropertyValue('left'),'123.5px');assert.equal(card.style.getPropertyPriority('left'),'important');
  assert.equal(card.style.getPropertyValue('transform'),'translate3d(10px,20px,0)');
  const unchanged=card.styleMutations;api.apply();assert.equal(card.styleMutations,unchanged);
  let work=0;
  api.beginInteraction('floating');api.beginInteraction('split');
  for(let i=0;i<240;i++)assert(api.deferWork('layout',()=>work++));
  api.deferWork('closed-panel',()=>{throw Error('A destroyed panel cannot update later');});api.cancelWork('closed-panel');
  api.endInteraction('floating');assert.equal(work,0);api.endInteraction('split');assert.equal(work,1);
  assert.equal(api.deferWork('layout',()=>work++),false);
  api.beginInteraction('controller');api.deferWork('layout',()=>work++);api.destroy();api.endInteraction('controller');assert.equal(work,1);
}
