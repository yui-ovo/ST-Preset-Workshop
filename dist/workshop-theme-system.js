const TOP=(()=>{try{return window.top||window}catch(_){return window}})();
const DOC=TOP.document;
const API_KEY='__PMM_THEME_SYSTEM__';
const STORAGE_KEY='pmm_visual_theme_v1';
const FOLLOW_KEY='pmm_follow_tavern_v1';
const MIGRATION_KEY='pmm_visual_theme_migrated_v1';
const STYLE_ID='pmm-theme-system-style';
try{TOP[API_KEY]?.destroy?.()}catch(_){}

const THEMES=Object.freeze({
  aqua:Object.freeze({
    name:'折射玻璃',identity:'水光折射与清透层次',
    light:{surface:'linear-gradient(128deg,rgba(255,255,255,.54) 0%,rgba(226,246,252,.30) 38%,rgba(115,184,224,.23) 64%,rgba(255,255,255,.42) 100%)',raised:'linear-gradient(145deg,rgba(255,255,255,.54),rgba(165,214,238,.25))',control:'rgba(151,205,234,.24)',border:'rgba(75,142,187,.48)',text:'#10263a',muted:'rgba(16,38,58,.70)',accent:'#397fae',activeText:'#fff',blur:'26px',shadow:'0 10px 26px rgba(49,102,139,.16)',highlight:'inset 0 1px 0 rgba(255,255,255,.82)',floating:'linear-gradient(145deg,rgba(255,255,255,.60),rgba(133,194,224,.32))'},
    dark:{surface:'linear-gradient(180deg,rgba(255,255,255,.24),rgba(255,255,255,.06) 42%),linear-gradient(152deg,rgba(120,160,196,.42),rgba(74,112,148,.48) 46%,rgba(30,52,78,.60))',raised:'rgba(54,82,108,.66)',control:'rgba(178,212,240,.26)',border:'rgba(188,218,242,.55)',text:'#fff',muted:'rgba(240,247,253,.76)',accent:'#a8cdf0',activeText:'#0f1c2a',blur:'30px',shadow:'0 14px 38px rgba(4,14,26,.42)',highlight:'inset 0 1px 0 rgba(255,255,255,.30)',floating:'linear-gradient(145deg,rgba(132,175,210,.58),rgba(32,58,84,.72))'},
  }),
  glass:Object.freeze({
    name:'毛玻璃',identity:'雾灰色磨砂、柔散光与半透明层次',
    light:{surface:'rgba(170,172,176,.54)',raised:'rgba(214,216,219,.20)',control:'rgba(209,212,216,.48)',border:'rgba(99,104,112,.28)',text:'#202831',muted:'rgba(32,40,49,.76)',accent:'#526477',activeText:'#f1f4f7',blur:'20px',shadow:'0 10px 26px rgba(38,46,58,.22)',highlight:'inset 0 1px 0 rgba(240,243,247,.62)',floating:'rgba(168,172,178,.60)',controller:'rgba(166,170,176,.60)'},
    dark:{surface:'rgba(64,67,72,.64)',raised:'rgba(173,179,187,.12)',control:'rgba(153,163,176,.22)',border:'rgba(187,195,206,.26)',text:'#edf1f7',muted:'rgba(237,241,247,.76)',accent:'#c0cedf',activeText:'#24303f',blur:'20px',shadow:'0 10px 28px rgba(15,22,32,.34)',highlight:'inset 0 1px 0 rgba(223,232,244,.26)',floating:'rgba(77,82,90,.68)',controller:'rgba(70,75,83,.66)'},
  }),
  violet:Object.freeze({
    name:'紫黑',identity:"黑色基底与克制紫晶高光",
    light:{surface:"linear-gradient(150deg,rgba(34,29,40,.88),rgba(62,42,74,.82) 52%,rgba(27,24,32,.90))",raised:"rgba(70,51,82,.72)",control:"rgba(180,132,211,.18)",border:"rgba(184,139,210,.46)",text:"#fff9ff",muted:"rgba(250,237,255,.76)",accent:"#c294dd",activeText:"#201625",blur:"22px",shadow:"0 9px 24px rgba(25,18,30,.24)",highlight:"inset 0 1px 0 rgba(255,255,255,.18)",floating:"linear-gradient(150deg,rgba(76,54,88,.82),rgba(29,25,35,.90))"},
    dark:{surface:"linear-gradient(155deg,rgba(30,28,35,.94),rgba(15,14,18,.97) 72%)",raised:"rgba(42,37,49,.82)",control:"rgba(137,108,170,.20)",border:"rgba(164,137,194,.42)",text:"#faf8fc",muted:"rgba(250,248,252,.70)",accent:"#aa8bc8",activeText:"#151119",blur:"22px",shadow:"0 10px 30px rgba(0,0,0,.40)",highlight:"inset 0 1px 0 rgba(255,255,255,.16)",floating:"linear-gradient(150deg,rgba(52,44,61,.80),rgba(18,16,22,.92))"},
  }),
  theme:Object.freeze({
    name:'跟随系统',identity:'独立的日间浅灰与夜间炭灰磨砂主题',
    light:{surface:"rgba(255,255,255,.96)",raised:"rgba(248,249,251,.98)",control:"rgba(229,233,239,.96)",border:"rgba(83,90,101,.30)",text:"#17202b",muted:"rgba(23,32,43,.72)",accent:"#526071",activeText:"#fff",blur:"14px",shadow:"0 4px 14px rgba(25,32,42,.11)",highlight:"inset 0 1px 0 rgba(255,255,255,.72)",floating:"rgba(255,255,255,.96)"},
    dark:{surface:"rgba(15,17,21,.93)",raised:"rgba(28,31,37,.95)",control:"rgba(255,255,255,.14)",border:"rgba(207,211,219,.28)",text:"#f7f9fc",muted:"rgba(235,240,247,.78)",accent:"#b9c3d1",activeText:"#101217",blur:"16px",shadow:"0 6px 20px rgba(0,0,0,.30)",highlight:"inset 0 1px 0 rgba(255,255,255,.15)",floating:"rgba(17,19,24,.93)"},
  }),
});

const cleanup=[];
let current='aqua',followTavern=false,applyQueued=false,pendingTone=null,themeTimer=0,lastTokens=null,lastVariables=null,disposed=false;
const THEME_TARGETS='#preset-manager-main-panel,#preset-manager-floating-panel,#pmm-mobile-layout-card,#pmm-unified-floating-handle';
function readStorage(key){try{return TOP.localStorage?.getItem(key)||''}catch(_){return''}}
function writeStorage(key,value){try{TOP.localStorage?.setItem(key,value)}catch(_){}}
function parseColor(value){
  const text=String(value||'').trim(),hex=text.match(/^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i);
  if(hex){let raw=hex[1];if(raw.length<5)raw=[...raw].map(c=>c+c).join('');return{r:parseInt(raw.slice(0,2),16),g:parseInt(raw.slice(2,4),16),b:parseInt(raw.slice(4,6),16),a:raw.length===8?parseInt(raw.slice(6),16)/255:1}}
  const rgb=text.match(/^rgba?\(([^)]+)\)$/i);if(!rgb)return null;
  const parts=rgb[1].trim().split(/[\s,/]+/);if(parts.length<3)return null;
  const channel=x=>Math.max(0,Math.min(255,parseFloat(x)*(x.endsWith('%')?2.55:1)));
  const color={r:channel(parts[0]),g:channel(parts[1]),b:channel(parts[2]),a:parts[3]==null?1:parseFloat(parts[3])/(parts[3].endsWith('%')?100:1)};
  return Object.values(color).every(Number.isFinite)?color:null;
}
function rgba(color,alpha=color.a??1){return `rgba(${Math.round(color.r)},${Math.round(color.g)},${Math.round(color.b)},${Math.round(alpha*1000)/1000})`}
function mix(a,b,weight){return{r:a.r+(b.r-a.r)*weight,g:a.g+(b.g-a.g)*weight,b:a.b+(b.b-a.b)*weight,a:1}}
function luminance(color){const rgb=['r','g','b'].map(k=>{const v=color[k]/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]}
function contrast(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
function readableText(background,preferred){
  const bg=parseColor(background)||parseColor('#223344'),wanted=parseColor(preferred);
  if(wanted&&contrast(bg,wanted)>=4.5)return rgba(wanted);
  const light=parseColor('#f8fbff'),dark=parseColor('#14202b');const best=contrast(bg,light)>contrast(bg,dark)?light:dark;return rgba(contrast(bg,best)>=4.5?best:parseColor('#08121c'));
}
function nativePalette(){
  const nodes=[DOC.body,DOC.querySelector?.('#chat'),DOC.documentElement].filter(Boolean);
  const styles=nodes.map(node=>TOP.getComputedStyle?.(node)).filter(Boolean);
  const find=names=>{for(const name of names)for(const style of styles){const value=style.getPropertyValue?.(name)||style[name];const color=parseColor(value);if(color&&color.a>.08)return color}return null};
  const text=find(['--SmartThemeBodyColor','color']);
  const background=find(['--SmartThemeBlurTintColor','--SmartThemeChatTintColor','backgroundColor'])||parseColor(text&&luminance(text)>.5?'#223040':'#e5edf5');
  return{background,text,accent:find(['--SmartThemeQuoteColor'])||mix(background,parseColor('#599ac9'),.65),border:find(['--SmartThemeBorderColor'])};
}
function frozenToneLuminance(value){const text=String(value||"").trim();const hex=text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);if(hex){let raw=hex[1];if(raw.length===3)raw=raw.split("").map(char=>char+char).join("");return(.2126*parseInt(raw.slice(0,2),16)+.7152*parseInt(raw.slice(2,4),16)+.0722*parseInt(raw.slice(4,6),16))/255}const m=text.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+))?/i);if(!m||m[4]!=null&&Number(m[4])<.08)return null;return(.2126*Number(m[1])+.7152*Number(m[2])+.0722*Number(m[3]))/255}
function frozenEnvironmentTone(){
  let mode="";try{mode=TOP.localStorage?.getItem("preset-manager-theme-mode")||""}catch(_){}
  if(mode==="light"||mode==="dark")return mode;
  const nodes=[DOC.body,DOC.documentElement].filter(Boolean);
  for(const node of nodes){const style=TOP.getComputedStyle(node);for(const value of [style.getPropertyValue("--SmartThemeBlurTintColor"),style.backgroundColor]){const lum=frozenToneLuminance(value);if(lum!=null)return lum<.47?"dark":"light"}}
  const bodyColor=TOP.getComputedStyle(DOC.body||DOC.documentElement).getPropertyValue("--SmartThemeBodyColor");
  const bodyLum=frozenToneLuminance(bodyColor);if(bodyLum!=null)return bodyLum>.55?"dark":"light";
  return TOP.matchMedia?.("(prefers-color-scheme:dark)")?.matches?"dark":"light";
}
function environmentTone(){
  if(followTavern)return luminance(nativePalette().background)<.3?'dark':'light';
  const mode=readStorage('preset-manager-theme-mode');if(mode==='light'||mode==='dark')return mode;
  if(current==='aqua'||current==='violet')return frozenEnvironmentTone();
  return TOP.matchMedia?.('(prefers-color-scheme:dark)')?.matches?'dark':'light';
}
function followedTokens(tone){
  const palette=nativePalette(),light=tone==='light',white=parseColor('#ffffff'),black=parseColor('#101821');
  const base=mix(palette.background,light?white:black,light?.18:.14);
  const control=mix(base,light?white:palette.accent,light?.28:.18);
  const text=readableText(rgba(base),palette.text&&rgba(palette.text));
  return{surface:rgba(base,.86),raised:rgba(mix(base,light?white:palette.accent,.12),.65),control:rgba(control,.88),border:rgba(palette.border||mix(base,parseColor(text),.38),.6),text,muted:rgba(parseColor(text),.73),accent:rgba(palette.accent),activeText:readableText(rgba(palette.accent)),blur:'12px',shadow:light?'0 12px 28px rgba(20,38,55,.2)':'0 14px 32px rgba(0,0,0,.38)',highlight:light?'inset 0 1px 0 rgba(255,255,255,.7)':'inset 0 1px 0 rgba(255,255,255,.22)',floating:rgba(mix(base,palette.accent,.12),.85),controller:rgba(base,.76)};
}
function loadTheme(){const saved=readStorage(STORAGE_KEY);if(saved in THEMES)return saved;try{if(readStorage(MIGRATION_KEY)!=='1'){const legacy=JSON.parse(readStorage('pmui_v5')||'null');writeStorage(MIGRATION_KEY,'1');if(legacy?.skin in THEMES)return legacy.skin}}catch(_){}return'aqua'}
function composite(foreground,background){const alpha=foreground.a??1;return mix(background,foreground,alpha)}
function countColor(tokens){
  const background=nativePalette().background;
  const surface=parseColor(tokens.surface)||parseColor(tokens.surface.match(/rgba?\([^)]+\)/)?.[0])||background;
  const raised=parseColor(tokens.raised)||surface;
  const base=composite(raised,composite(surface,background));
  const accent=parseColor(tokens.accent)||parseColor(tokens.text);
  if(accent&&contrast(base,accent)>=4.5)return rgba(accent);
  const target=parseColor(readableText(rgba(base),tokens.text));
  for(let weight=.1;weight<1;weight+=.1){const candidate=mix(accent||target,target,weight);if(contrast(base,parseColor(rgba(candidate)))>=4.5)return rgba(candidate)}
  return rgba(target);
}
function variables(t){
  return{'--pmm-theme-count':countColor(t),'--pmm-theme-surface':t.surface,'--pmm-theme-raised':t.raised,'--pmm-theme-control':t.control,'--pmm-theme-controller':t.controller||t.surface,'--pmm-theme-border':t.border,'--pmm-theme-text':t.text,'--pmm-theme-muted':t.muted,'--pmm-theme-accent':t.accent,'--pmm-theme-active-text':t.activeText,'--pmm-theme-badge-text':readableText(t.accent,t.activeText),'--pmm-theme-blur':t.blur,'--pmm-theme-shadow':t.shadow+','+t.highlight,'--pmm-theme-highlight':t.highlight,'--pmm-theme-floating':t.floating,'--pmm-floating-bg':t.floating,'--pmm-floating-text':t.text,'--pmm-floating-border':t.border,'--pmm-floating-blur':t.blur,'--pmm-floating-shadow':t.shadow+','+t.highlight,'--pmm-banner-bg':t.surface,'--pmm-banner-blur':t.blur,'--pmm-banner-shadow':t.shadow+','+t.highlight,'--pmm-layout-accent':t.accent,'--pmm-layout-control':t.control,'--pm-panel-bg':t.surface,'--pm-bar-bg':t.raised,'--pm-card-bg':t.raised,'--pm-card-bg-translucent':t.control,'--pm-control-bg':t.control,'--pm-glass-bg':t.surface,'--pm-hover-bg':t.control,'--pm-border':t.border,'--pm-text-primary':t.text,'--pm-text-secondary':t.muted,'--pm-accent':t.accent,'--pm-accent-color':t.accent,'--pm-quote-color':t.accent,'--fp-glass-bg':t.floating,'--fp-glass-hover-bg':t.raised,'--fp-card-bg':t.raised,'--fp-card-bg-translucent':t.control,'--fp-border-color':t.border,'--fp-text-color':t.text,'--fp-accent-color':t.accent,'--qe-glass-bg':t.surface,'--qe-glass-hover-bg':t.control,'--qe-card-bg':t.raised,'--qe-border-color':t.border,'--qe-text-color':t.text,'--qe-text-secondary':t.muted,'--qe-accent-color':t.accent};
}
function hydrateRoot(root,tone=DOC.documentElement.dataset.pmmThemeTone,vars=lastVariables,attributes=null){
  if(!root||!vars)return;
  // Late surfaces inherit the committed palette, while another theme is pending or deferred by a gesture.
  attributes ||= {pmmFollowTavern:DOC.documentElement.dataset.pmmFollowTavern??String(followTavern),pmmVisualTheme:DOC.documentElement.dataset.pmmVisualTheme||current,pmmThemeTone:tone};
  for(const [key,value] of Object.entries(attributes))if(root.dataset[key]!==value)root.dataset[key]=value;
  for(const [key,value] of Object.entries(vars))if(root.style.getPropertyValue(key)!==value)root.style.setProperty(key,value);
}
function apply(forcedTone,animate=false){
  const tone=forcedTone==='light'||forcedTone==='dark'?forcedTone:environmentTone();
  const tokens=followTavern?followedTokens(tone):THEMES[current][tone],vars=variables(tokens);
  const roots=Array.from(DOC.querySelectorAll(THEME_TARGETS));
  const changed=DOC.documentElement.dataset.pmmFollowTavern!==String(followTavern)||DOC.documentElement.dataset.pmmVisualTheme!==current||DOC.documentElement.dataset.pmmThemeTone!==tone||JSON.stringify(lastTokens)!==JSON.stringify(tokens)||DOC.documentElement.style.getPropertyValue('--pmm-theme-count')!==vars['--pmm-theme-count'];
  if(!changed&&roots.every(root=>root.dataset.pmmVisualTheme===current&&root.dataset.pmmThemeTone===tone&&root.style.getPropertyValue('--pmm-theme-count')===vars['--pmm-theme-count']))return;
  const before=animate&&changed&&lastTokens?{tokens:lastTokens,theme:DOC.documentElement.dataset.pmmVisualTheme,tone:DOC.documentElement.dataset.pmmThemeTone,following:DOC.documentElement.dataset.pmmFollowTavern==='true'}:null;
  const attributes={pmmFollowTavern:String(followTavern),pmmVisualTheme:current,pmmThemeTone:tone};
  for(const doc of [DOC,document].filter((item,index,array)=>item&&array.indexOf(item)===index)){
    hydrateRoot(doc.documentElement,tone,vars,attributes);
  }
  for(const root of roots)hydrateRoot(root,tone,vars,attributes);
  for(const button of DOC.querySelectorAll('[data-pmm-theme-choice]'))button.classList.toggle('is-active',button.dataset.pmmThemeChoice===current);
  lastTokens=tokens;lastVariables=vars;
  if(before){stopTransition();startSurfaceMotion(before)}
  TOP.dispatchEvent(new CustomEvent('pmm:theme-applied',{detail:{theme:current,tone}}));
}
let pendingAnimation=false,pendingNativeMode=null,themeRevision=0;
const interactions=new Set();
let motionSurfaces=[],motionVariant=false;
function stopTransition(){
  TOP.clearTimeout(themeTimer);themeTimer=0;
  for(const node of motionSurfaces){
    node.classList.remove('pmm-theme-surface-motion','pmm-theme-motion-alt');
    node.style.removeProperty('--pmm-theme-motion-from');
    node.style.removeProperty('--pmm-theme-motion-to');
  }
  motionSurfaces=[];
}
function surfaceBackground(snapshot,kind){
  const {tokens,theme,tone,following}=snapshot;
  if(kind==='controller'&&!following){
    if(theme==='aqua')return tone==='light'?'rgba(235,247,252,.985)':'rgba(27,47,68,.985)';
    if(theme==='violet')return 'rgba(31,26,37,.985)';
  }
  if(kind==='controller')return tokens.controller||tokens.surface;
  if(kind==='header')return tokens.raised;
  if(kind==='handle')return tokens.floating;
  return tokens.surface;
}
function startSurfaceMotion(before){
  if(interactions.size||DOC.visibilityState==='hidden'||TOP.matchMedia?.('(prefers-reduced-motion:reduce)')?.matches)return;
  const after={tokens:lastTokens,theme:current,tone:DOC.documentElement.dataset.pmmThemeTone,following:followTavern};
  const selectors=[['#preset-manager-main-panel .preset-panel','surface'],['#preset-manager-main-panel .pm-header','header'],['#preset-manager-floating-panel .panel-wrapper','surface'],['#pmm-mobile-layout-card','controller'],['#pmm-unified-floating-handle','handle']];
  const seen=new Set();motionVariant=!motionVariant;
  for(const [selector,kind] of selectors)for(const node of DOC.querySelectorAll(selector)){
    if(seen.has(node)||node.isConnected===false||node.hidden||node.style.getPropertyValue('display')==='none'||node.closest?.('[hidden],.pmm-wb-native-hidden,.pmm-unified-floating-root.is-hidden'))continue;
    seen.add(node);
    const from=surfaceBackground(before,kind),to=surfaceBackground(after,kind);
    if(from===to)continue;
    node.style.setProperty('--pmm-theme-motion-from',from);
    node.style.setProperty('--pmm-theme-motion-to',to);
    node.classList.toggle('pmm-theme-motion-alt',motionVariant);
    node.classList.add('pmm-theme-surface-motion');motionSurfaces.push(node);
  }
  if(motionSurfaces.length)themeTimer=TOP.setTimeout(stopTransition,400);
}
function commitThemeChange(tone,animate,nativeMode,revision){
  if(disposed||revision!==themeRevision)return;
  const before=lastTokens&&{tokens:lastTokens,theme:DOC.documentElement.dataset.pmmVisualTheme,tone:DOC.documentElement.dataset.pmmThemeTone,following:DOC.documentElement.dataset.pmmFollowTavern==='true'};
  stopTransition();
  if(pendingNativeMode===nativeMode)pendingNativeMode=null;
  // Commit in this microtask. Animation never gates input on a document screenshot or next frame.
  nativeMode?.();apply(tone||environmentTone());
  if(animate&&before)startSurfaceMotion(before);
}
function beginInteraction(owner){interactions.add(owner);if(motionSurfaces.length)stopTransition()}
function endInteraction(owner){
  if(!interactions.delete(owner)||interactions.size)return;
  if(pendingTone||pendingNativeMode||pendingAnimation)requestApply();
}
function requestApply(tone=null,animate=false){
  if(disposed)return;
  themeRevision++;
  if(tone)pendingTone=tone;pendingAnimation ||= animate;if(applyQueued)return;applyQueued=true;
  // Merge capture, Vue handler and API requests before any visible color is changed.
  TOP.queueMicrotask(()=>TOP.queueMicrotask(()=>{
    if(disposed)return;
    applyQueued=false;
    if(interactions.size)return;
    const next=pendingTone,animation=pendingAnimation,nativeMode=pendingNativeMode,revision=themeRevision;
    pendingTone=null;pendingAnimation=false;
    commitThemeChange(next,animation,nativeMode,revision);
  }));
}
function setNativeMode(mode){for(const win of [TOP,window])try{win.localStorage?.setItem('preset-manager-theme-mode',mode)}catch(_){}}
function setTheme(theme){
  if(!(theme in THEMES))return false;
  if(theme===current&&!followTavern)return true;
  current=theme;followTavern=false;writeStorage(FOLLOW_KEY,'0');
  writeStorage(STORAGE_KEY,current);requestApply(null,true);return true;
}
function setTone(tone,nativeMode=null){if(tone!=='light'&&tone!=='dark')return;if(nativeMode)pendingNativeMode=nativeMode;followTavern=false;writeStorage(FOLLOW_KEY,'0');setNativeMode(tone);requestApply(tone,true)}
function toggleFollow(){followTavern=!followTavern;writeStorage(FOLLOW_KEY,followTavern?'1':'0');requestApply(null,true);return followTavern}
function mountPicker(card){
  const body=card?.querySelector?.('.pmm-layout-card__body');if(!body||body.querySelector('.pmm-theme-picker'))return;
  const picker=DOC.createElement('section');picker.className='pmm-theme-picker';picker.innerHTML='<span class="pmm-theme-picker__label">视觉主题</span><div class="pmm-theme-picker__choices"></div>';
  const choices=picker.querySelector('.pmm-theme-picker__choices');
  for(const [key,definition] of Object.entries(THEMES)){const button=DOC.createElement('button');button.type='button';button.dataset.pmmThemeChoice=key;button.title=definition.identity;button.innerHTML=`<span class="pmm-theme-swatch" aria-hidden="true"></span><span>${definition.name}</span>`;button.addEventListener('click',()=>setTheme(key));choices.appendChild(button)}
  for(const button of choices.children)button.classList.toggle('is-active',button.dataset.pmmThemeChoice===current);
  body.prepend(picker);hydrateRoot(card);
}
function installStyle(){
  DOC.getElementById(STYLE_ID)?.remove();const style=DOC.createElement('style');style.id=STYLE_ID;style.textContent=`
/* PMM_FROZEN_VISUAL_BASELINE_BEGIN: exact pre-round CSS; aqua and violet */
html[data-pmm-visual-theme] body #preset-manager-main-panel .preset-panel{background:var(--pmm-theme-surface)!important;color:var(--pmm-theme-text)!important;border-color:var(--pmm-theme-border)!important;box-shadow:var(--pmm-theme-shadow)!important;backdrop-filter:blur(var(--pmm-theme-blur))!important;-webkit-backdrop-filter:blur(var(--pmm-theme-blur))!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel .pm-header{background:var(--pmm-theme-raised)!important;color:var(--pmm-theme-text)!important;border-color:var(--pmm-theme-border)!important;backdrop-filter:blur(var(--pmm-theme-blur))!important;-webkit-backdrop-filter:blur(var(--pmm-theme-blur))!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel .header-card{color:var(--pmm-theme-text)!important;border-color:var(--pmm-theme-border)!important;background:var(--pmm-theme-control)!important}html[data-pmm-visual-theme] body #preset-manager-floating-panel .panel-action,html[data-pmm-visual-theme] body #preset-manager-floating-panel .panel-collapse{color:var(--pmm-theme-text)!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel .title-select,html[data-pmm-visual-theme] body #preset-manager-main-panel .title-input,html[data-pmm-visual-theme] body #preset-manager-main-panel .search-card__input,html[data-pmm-visual-theme] body #preset-manager-floating-panel .panel-select,html[data-pmm-visual-theme] body #preset-manager-floating-panel .quick-edit-dropdown input,html[data-pmm-visual-theme] body #preset-manager-floating-panel .quick-edit-dropdown textarea{background:var(--pmm-theme-control)!important;color:var(--pmm-theme-text)!important;-webkit-text-fill-color:var(--pmm-theme-text)!important;border-color:var(--pmm-theme-border)!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel .prompt-card,html[data-pmm-visual-theme] body #preset-manager-main-panel .section-group,html[data-pmm-visual-theme] body #preset-manager-floating-panel .quick-edit-dropdown .prompt-item,html[data-pmm-visual-theme] body #preset-manager-floating-panel .category-group{background:var(--pmm-theme-raised)!important;color:var(--pmm-theme-text)!important;border-color:var(--pmm-theme-border)!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel .title-text,html[data-pmm-visual-theme] body #preset-manager-main-panel .prompt-card__name,html[data-pmm-visual-theme] body #preset-manager-main-panel .prompt-item__name,html[data-pmm-visual-theme] body #preset-manager-main-panel .section-header__name,html[data-pmm-visual-theme] body #preset-manager-floating-panel .prompt-item__name,html[data-pmm-visual-theme] body #preset-manager-floating-panel .category-header__name{color:var(--pmm-theme-text)!important;-webkit-text-fill-color:var(--pmm-theme-text)!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel .prompt-card__role,html[data-pmm-visual-theme] body #preset-manager-main-panel .prompt-item__role,html[data-pmm-visual-theme] body #preset-manager-floating-panel .prompt-item__role{background:var(--pmm-theme-control)!important;color:var(--pmm-theme-text)!important;border-color:var(--pmm-theme-border)!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel .prompt-item--selected,html[data-pmm-visual-theme] body #preset-manager-main-panel .prompt-card--selected,html[data-pmm-visual-theme] body #preset-manager-floating-panel .prompt-item--selected{border-color:var(--pmm-theme-accent)!important;box-shadow:0 0 0 1px var(--pmm-theme-accent),var(--pmm-theme-highlight)!important}
html[data-pmm-visual-theme] body #pmm-mobile-layout-card{background:var(--pmm-theme-surface)!important;color:var(--pmm-theme-text)!important;border-color:var(--pmm-theme-border)!important;box-shadow:var(--pmm-theme-shadow)!important;backdrop-filter:blur(var(--pmm-theme-blur))!important;-webkit-backdrop-filter:blur(var(--pmm-theme-blur))!important;--pmm-layout-text:var(--pmm-theme-text)!important}
html[data-pmm-visual-theme="theme"][data-pmm-theme-tone="light"] body #pmm-mobile-layout-card{background:rgba(255,255,255,.985)!important}
html[data-pmm-visual-theme="theme"][data-pmm-theme-tone="dark"] body #pmm-mobile-layout-card{background:rgba(18,21,27,.985)!important}
html[data-pmm-visual-theme="aqua"][data-pmm-theme-tone="light"] body #pmm-mobile-layout-card{background:rgba(235,247,252,.985)!important}
html[data-pmm-visual-theme="aqua"][data-pmm-theme-tone="dark"] body #pmm-mobile-layout-card{background:rgba(27,47,68,.985)!important}
html[data-pmm-visual-theme="violet"] body #pmm-mobile-layout-card{background:rgba(31,26,37,.985)!important}
html[data-pmm-visual-theme="glass"][data-pmm-theme-tone="light"] body #pmm-mobile-layout-card{background:rgba(244,246,248,.98)!important}
html[data-pmm-visual-theme="glass"][data-pmm-theme-tone="dark"] body #pmm-mobile-layout-card{background:rgba(27,29,34,.98)!important}
html[data-pmm-visual-theme] body #pmm-mobile-layout-card :where(.pmm-theme-picker__choices button,.pmm-layout-header-mode button){color:var(--pmm-theme-text)!important;-webkit-text-fill-color:var(--pmm-theme-text)!important;background:var(--pmm-theme-control)!important;border-color:var(--pmm-theme-border)!important;opacity:1!important;filter:none!important;text-shadow:none!important}
html[data-pmm-visual-theme] body #pmm-mobile-layout-card .pmm-layout-row,html[data-pmm-visual-theme] body #pmm-mobile-layout-card .pmm-layout-card__body,html[data-pmm-visual-theme] body #pmm-mobile-layout-card .pmm-layout-card__footer{filter:none!important;opacity:1!important;color:var(--pmm-theme-text)!important}
html[data-pmm-visual-theme] body #pmm-mobile-layout-card .pmm-layout-row__label,html[data-pmm-visual-theme] body #pmm-mobile-layout-card .pmm-layout-row__value,html[data-pmm-visual-theme] body #pmm-mobile-layout-card .pmm-layout-icon-btn,html[data-pmm-visual-theme] body #pmm-mobile-layout-card .pmm-layout-step-btn{color:var(--pmm-theme-text)!important;-webkit-text-fill-color:var(--pmm-theme-text)!important;text-shadow:none!important}
html[data-pmm-visual-theme] body #pmm-mobile-layout-card .pmm-layout-soft-btn,html[data-pmm-visual-theme] body #pmm-mobile-layout-card .pmm-layout-dnd-btn,html[data-pmm-visual-theme] body #pmm-mobile-layout-card .pmm-layout-done-btn,html[data-pmm-visual-theme] body #pmm-mobile-layout-card .pmm-layout-number-editor,html[data-pmm-visual-theme] body #pmm-mobile-layout-card .pmm-layout-glyph-row input{background:var(--pmm-theme-control)!important;color:var(--pmm-theme-text)!important;-webkit-text-fill-color:var(--pmm-theme-text)!important;border-color:var(--pmm-theme-border)!important;box-shadow:none!important}
html[data-pmm-visual-theme] body #pmm-mobile-layout-card :disabled{opacity:.42!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel .pm-header i,html[data-pmm-visual-theme] body #preset-manager-main-panel .prompt-card i,html[data-pmm-visual-theme] body #preset-manager-main-panel .section-header i{color:var(--pmm-theme-text)!important;-webkit-text-fill-color:var(--pmm-theme-text)!important;opacity:1!important;filter:none!important;text-shadow:none!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel .prompt-card__content,html[data-pmm-visual-theme] body #preset-manager-main-panel .prompt-item__content,html[data-pmm-visual-theme] body #preset-manager-main-panel .inline-editor__textarea{color:var(--pmm-theme-text)!important;-webkit-text-fill-color:var(--pmm-theme-text)!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel :disabled{opacity:.42}
html[data-pmm-visual-theme] body #preset-manager-main-panel .action-card.active,html[data-pmm-visual-theme] body #preset-manager-main-panel .action-card.primary,html[data-pmm-visual-theme] body #pmm-mobile-layout-card :where(.pmm-theme-picker__choices button,.pmm-layout-header-mode button).is-active{background:var(--pmm-theme-accent)!important;color:var(--pmm-theme-active-text)!important;-webkit-text-fill-color:var(--pmm-theme-active-text)!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel :where(.title-text,.title-select,.title-input,.section-header__name,.category-header__name,.prompt-card__name,.prompt-item__name,.prompt-card__content,.prompt-item__content,.btn-label,label,small),html[data-pmm-visual-theme] body #preset-manager-floating-panel :where(.category-header__name,.section-header__name,.prompt-item__name,.prompt-item__content,.btn-label,label,small){color:var(--pmm-theme-text)!important;-webkit-text-fill-color:var(--pmm-theme-text)!important;filter:none!important;text-shadow:none!important;opacity:1!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel :where(.action-card,.close-card,.theme-btn,.title-edit-btn,.title-action-btn,.pmm-preset-search-btn),html[data-pmm-visual-theme] body #preset-manager-floating-panel :where(.panel-action,.panel-collapse,.quick-edit-dropdown button){color:var(--pmm-theme-text)!important;-webkit-text-fill-color:var(--pmm-theme-text)!important;border-color:var(--pmm-theme-border)!important;filter:none!important;text-shadow:none!important;opacity:1!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel :where(.action-card,.close-card,.theme-btn,.title-edit-btn,.title-action-btn,.pmm-preset-search-btn):hover,html[data-pmm-visual-theme] body #preset-manager-floating-panel :where(.panel-action,.panel-collapse,.quick-edit-dropdown button):hover{background:var(--pmm-theme-raised)!important;color:var(--pmm-theme-text)!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel :where(.action-card,.close-card,.theme-btn,.title-edit-btn,.title-action-btn,.pmm-preset-search-btn):active,html[data-pmm-visual-theme] body #preset-manager-floating-panel :where(.panel-action,.panel-collapse,.quick-edit-dropdown button):active{background:var(--pmm-theme-accent)!important;color:var(--pmm-theme-active-text)!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel :disabled,html[data-pmm-visual-theme] body #preset-manager-floating-panel :disabled,html[data-pmm-visual-theme] body #pmm-mobile-layout-card :disabled{opacity:.62!important;filter:none!important}
html[data-pmm-visual-theme] body #pmm-mobile-layout-card :where(.pmm-layout-row__label,.pmm-layout-row__value,.pmm-theme-picker__label,.pmm-layout-header-mode>span){color:var(--pmm-theme-text)!important;-webkit-text-fill-color:var(--pmm-theme-text)!important;opacity:1!important;filter:none!important;text-shadow:none!important}
@media(pointer:coarse){html[data-pmm-visual-theme] body #preset-manager-main-panel .preset-panel,html[data-pmm-visual-theme] body #preset-manager-main-panel .pm-header,html[data-pmm-visual-theme] body #pmm-mobile-layout-card{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}}
html[data-pmm-visual-theme="theme"] body #preset-manager-main-panel :where(.theme-btn,.action-card .card-icon){background:rgba(127,127,127,.10)!important;box-shadow:none!important}
html[data-pmm-visual-theme="theme"][data-pmm-theme-tone="light"] body #preset-manager-main-panel :where(.theme-btn,.action-card,.action-card .card-icon,.close-card){color:#17202b!important;-webkit-text-fill-color:#17202b!important}
html[data-pmm-visual-theme="theme"][data-pmm-theme-tone="dark"] body #preset-manager-main-panel :where(.theme-btn,.action-card,.action-card .card-icon,.close-card){color:#f7f9fc!important;-webkit-text-fill-color:#f7f9fc!important}
html[data-pmm-visual-theme="theme"] body #preset-manager-main-panel .theme-btn.active{background:rgba(127,127,127,.18)!important;outline:1px solid var(--pmm-theme-border)!important;outline-offset:-1px!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel :where(.action-card,.theme-btn,.close-card,.pmm-preset-search-btn){background:var(--pmm-theme-control)!important;box-shadow:none!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel .action-card .card-icon{background:color-mix(in srgb,var(--pmm-theme-control) 76%,var(--pmm-theme-accent) 24%)!important;box-shadow:none!important}
html[data-pmm-visual-theme="theme"][data-pmm-theme-tone="light"] body #pmm-mobile-layout-card :where(.pmm-theme-picker__choices button,.pmm-layout-header-mode button).is-active{background:#334155!important;color:#fff!important;-webkit-text-fill-color:#fff!important}
html[data-pmm-visual-theme="theme"][data-pmm-theme-tone="dark"] body #pmm-mobile-layout-card :where(.pmm-theme-picker__choices button,.pmm-layout-header-mode button).is-active{background:#dbe4ef!important;color:#111827!important;-webkit-text-fill-color:#111827!important}
html[data-pmm-visual-theme="aqua"][data-pmm-theme-tone="light"] body #preset-manager-main-panel :where(.action-card,.theme-btn,.close-card,.pmm-preset-search-btn){background:rgba(92,166,209,.42)!important}
html[data-pmm-visual-theme="glass"][data-pmm-theme-tone="light"] body #preset-manager-main-panel :where(.action-card,.theme-btn,.close-card,.pmm-preset-search-btn){background:rgba(190,198,207,.32)!important}
html[data-pmm-visual-theme="violet"][data-pmm-theme-tone="light"] body #preset-manager-main-panel :where(.action-card,.theme-btn,.close-card,.pmm-preset-search-btn){background:rgba(105,72,126,.52)!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel :where(.section-header,.category-header){background:var(--pmm-theme-raised)!important;border-color:var(--pmm-theme-border)!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel :where(.section-header__count,.category-header__count){background:var(--pmm-theme-control)!important;color:var(--pmm-theme-text)!important;border-color:var(--pmm-theme-border)!important;opacity:1!important}
@media(pointer:coarse){html body #preset-manager-main-panel .title-action-btn span{display:none!important}html[data-pmm-visual-theme] body #preset-manager-main-panel :where(.pm-header,.header-card,.action-card,.theme-btn,.close-card,.title-edit-btn,.title-action-btn,.pmm-preset-search-btn),html[data-pmm-visual-theme] body #pmm-mobile-layout-card :where(button,input){transition:none!important}html[data-pmm-visual-theme] body #preset-manager-main-panel .prompt-item,html[data-pmm-visual-theme] body #preset-manager-main-panel .prompt-card,html[data-pmm-visual-theme] body #preset-manager-main-panel .prompt-card *{transition:none!important}html[data-pmm-visual-theme] body #preset-manager-main-panel .prompt-item{background:transparent!important}html[data-pmm-visual-theme] body #preset-manager-main-panel .prompt-card,html[data-pmm-visual-theme] body #preset-manager-main-panel .prompt-card:hover{background:var(--pmm-theme-raised)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}}
.pmm-theme-picker{grid-column:1/-1;display:flex;align-items:center;gap:10px;padding:8px 2px 12px;border-bottom:1px solid var(--pmm-theme-border)}.pmm-theme-picker__label{flex:0 0 auto;font-size:12px;font-weight:650;color:var(--pmm-theme-muted)}.pmm-theme-picker__choices{min-width:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;flex:1}.pmm-theme-picker__choices button{min-width:0;min-height:34px;display:flex;align-items:center;justify-content:center;gap:5px;padding:4px 6px;border:1px solid var(--pmm-theme-border);border-radius:9px;font-size:11px}.pmm-theme-swatch{width:10px;height:10px;flex:0 0 10px;border:1px solid currentColor;border-radius:50%;background:var(--pmm-theme-accent);box-shadow:var(--pmm-theme-highlight)}
@media(max-width:480px){.pmm-theme-picker{align-items:flex-start;flex-direction:column}.pmm-theme-picker__choices{width:100%;grid-template-columns:repeat(2,minmax(0,1fr))}}
/* PMM_FROZEN_VISUAL_BASELINE_END */
/* PMM_APPROVED_AQUA_MAIN_BEGIN: main group layering only; no floating selectors or new palette. */
html[data-pmm-visual-theme="aqua"]:not([data-pmm-follow-tavern="true"]) body #preset-manager-main-panel .section-group{box-shadow:var(--pmm-theme-highlight)!important}
html[data-pmm-visual-theme="aqua"]:not([data-pmm-follow-tavern="true"]) body #preset-manager-main-panel .section-group>.section-header{background:transparent!important}
/* PMM_APPROVED_AQUA_MAIN_END */
/* PMM_APPROVED_BRANCH_STRIP_BEGIN: branch title strip colors only; reuse each selected material. */
html[data-pmm-visual-theme] body #preset-manager-main-panel .pm-panel-container--branch-mode > .preset-panel .pm-header .pmm-branch-apply-row{background:var(--pmm-theme-raised)!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel .pm-panel-container--branch-mode > .preset-panel .pm-header :is(.title-select,.title-input,.pmm-branch-apply-select){background:var(--pmm-theme-control)!important;color:var(--pmm-theme-text)!important;-webkit-text-fill-color:var(--pmm-theme-text)!important;border-color:var(--pmm-theme-border)!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel .pm-panel-container--branch-mode > .preset-panel .pm-header :is(.title-select,.pmm-branch-apply-select) option{background:var(--pmm-theme-control)!important;color:var(--pmm-theme-text)!important;-webkit-text-fill-color:var(--pmm-theme-text)!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel .pm-panel-container--branch-mode > .preset-panel .pm-header .pmm-branch-apply-label{color:var(--pmm-theme-muted)!important}
/* PMM_APPROVED_BRANCH_STRIP_END */
/* PMM_APPROVED_FUNCTION_RAIL_BEGIN: branch/worldbook/favorites rail colors only. */
html[data-pmm-visual-theme] body #preset-manager-main-panel .side-panel-root{--pm-text-primary:var(--pmm-theme-text)!important;--pm-text-secondary:var(--pmm-theme-muted)!important;--pm-quote-color:var(--pmm-theme-accent)!important;--pm-border:var(--pmm-theme-border)!important;--pm-glass-bg:var(--pmm-theme-raised)!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel .side-panel-root .side-panel-content{background:var(--pmm-theme-raised)!important;border-color:var(--pmm-theme-border)!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel .side-panel-root :is(.panel-btn,.panel-collapse,.side-tab){color:var(--pmm-theme-text)!important;-webkit-text-fill-color:var(--pmm-theme-text)!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel .side-panel-root .panel-btn :is(i,.btn-label){color:var(--pmm-theme-text)!important;-webkit-text-fill-color:var(--pmm-theme-text)!important;opacity:1!important}
html[data-pmm-visual-theme] body #preset-manager-main-panel .side-panel-root .panel-btn--active{background:var(--pmm-theme-control)!important;border-color:var(--pmm-theme-accent)!important}
/* PMM_APPROVED_FUNCTION_RAIL_END */

html:is([data-pmm-visual-theme="glass"],[data-pmm-visual-theme="theme"],[data-pmm-follow-tavern="true"])[data-pmm-theme-tone] body #preset-manager-main-panel :is(.pm-overlay,.preset-panel,.side-panel-root,.pmm-branch-apply-row){--pm-panel-bg:var(--pmm-theme-surface)!important;--pm-bar-bg:var(--pmm-theme-raised)!important;--pm-card-bg:var(--pmm-theme-raised)!important;--pm-card-bg-translucent:var(--pmm-theme-control)!important;--pm-control-bg:var(--pmm-theme-control)!important;--pm-border:var(--pmm-theme-border)!important;--pm-text-primary:var(--pmm-theme-text)!important;--pm-text-secondary:var(--pmm-theme-muted)!important;--pm-accent:var(--pmm-theme-accent)!important;--pm-quote-color:var(--pmm-theme-accent)!important}
html:is([data-pmm-visual-theme="glass"],[data-pmm-visual-theme="theme"],[data-pmm-follow-tavern="true"])[data-pmm-theme-tone] body #preset-manager-main-panel .preset-panel{background:var(--pmm-theme-surface)!important;color:var(--pmm-theme-text)!important;border-color:var(--pmm-theme-border)!important;box-shadow:var(--pmm-theme-shadow)!important;backdrop-filter:blur(8px)!important;-webkit-backdrop-filter:blur(8px)!important}
html:is([data-pmm-visual-theme="glass"],[data-pmm-visual-theme="theme"],[data-pmm-follow-tavern="true"])[data-pmm-theme-tone] body #preset-manager-main-panel :is(.pm-header,.side-panel-content,.pmm-branch-apply-row){background:var(--pmm-theme-raised)!important;color:var(--pmm-theme-text)!important;border-color:var(--pmm-theme-border)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
html:is([data-pmm-visual-theme="glass"],[data-pmm-visual-theme="theme"],[data-pmm-follow-tavern="true"])[data-pmm-theme-tone] body #preset-manager-main-panel :is(.title-select,.title-input,.search-card__input,.pmm-branch-apply-select){background:var(--pmm-theme-control)!important;color:var(--pmm-theme-text)!important;-webkit-text-fill-color:var(--pmm-theme-text)!important;border-color:var(--pmm-theme-border)!important}
html:is([data-pmm-visual-theme="glass"],[data-pmm-visual-theme="theme"],[data-pmm-follow-tavern="true"])[data-pmm-theme-tone] body #preset-manager-floating-panel :is(.panel-select,.quick-edit-dropdown input,.quick-edit-dropdown textarea){background:var(--pmm-theme-control)!important;color:var(--pmm-theme-text)!important;-webkit-text-fill-color:var(--pmm-theme-text)!important;border-color:var(--pmm-theme-border)!important}
html:is([data-pmm-visual-theme="glass"],[data-pmm-visual-theme="theme"],[data-pmm-follow-tavern="true"])[data-pmm-theme-tone] body #preset-manager-main-panel .section-group{background:transparent!important;box-shadow:none!important}
html:is([data-pmm-visual-theme="glass"],[data-pmm-visual-theme="theme"],[data-pmm-follow-tavern="true"])[data-pmm-theme-tone] body #preset-manager-main-panel :is(.section-header,.category-header,.prompt-card),html:is([data-pmm-visual-theme="glass"],[data-pmm-visual-theme="theme"],[data-pmm-follow-tavern="true"])[data-pmm-theme-tone] body #preset-manager-floating-panel :is(.category-header,.prompt-item){background:var(--pmm-theme-raised)!important;color:var(--pmm-theme-text)!important;border-color:var(--pmm-theme-border)!important}
html:is([data-pmm-visual-theme="glass"],[data-pmm-visual-theme="theme"],[data-pmm-follow-tavern="true"])[data-pmm-theme-tone] body #preset-manager-main-panel :is(.title-text,.title-select,.title-input,.section-header__name,.category-header__name,.prompt-card__name,.prompt-item__name,.prompt-card__content,.prompt-item__content,.pmm-branch-apply-label,.inline-editor__textarea),html:is([data-pmm-visual-theme="glass"],[data-pmm-visual-theme="theme"],[data-pmm-follow-tavern="true"])[data-pmm-theme-tone] body #preset-manager-floating-panel :is(.category-header__name,.prompt-item__name,.prompt-item__content){color:var(--pmm-theme-text)!important;-webkit-text-fill-color:var(--pmm-theme-text)!important;text-shadow:none!important}
html:is([data-pmm-visual-theme="glass"],[data-pmm-visual-theme="theme"],[data-pmm-follow-tavern="true"])[data-pmm-theme-tone] body #preset-manager-main-panel :is(.section-header__icon,.prompt-card__role,.prompt-item__role),html:is([data-pmm-visual-theme="glass"],[data-pmm-visual-theme="theme"],[data-pmm-follow-tavern="true"])[data-pmm-theme-tone] body #preset-manager-floating-panel :is(.section-header__icon,.prompt-item__role){background:var(--pmm-theme-accent)!important;border:1px solid var(--pmm-theme-border)!important;color:var(--pmm-theme-badge-text)!important;border-radius:6px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 2px 4px rgba(0,0,0,.15)!important}
html:is([data-pmm-visual-theme="glass"],[data-pmm-visual-theme="theme"],[data-pmm-follow-tavern="true"])[data-pmm-theme-tone] body #preset-manager-main-panel :is(.section-header__icon,.prompt-card__role,.prompt-item__role) i,html:is([data-pmm-visual-theme="glass"],[data-pmm-visual-theme="theme"],[data-pmm-follow-tavern="true"])[data-pmm-theme-tone] body #preset-manager-floating-panel :is(.section-header__icon,.prompt-item__role) i{color:var(--pmm-theme-badge-text)!important;-webkit-text-fill-color:var(--pmm-theme-badge-text)!important;opacity:1!important}
html:is([data-pmm-visual-theme="glass"],[data-pmm-visual-theme="theme"],[data-pmm-follow-tavern="true"])[data-pmm-theme-tone] body #preset-manager-main-panel .section-group--disabled>.section-header .section-header__icon{background:#b83b45!important}
html:is([data-pmm-visual-theme="glass"],[data-pmm-visual-theme="theme"],[data-pmm-follow-tavern="true"])[data-pmm-theme-tone] body #preset-manager-main-panel .section-group--disabled>.section-header .section-header__icon i{color:#fff!important;-webkit-text-fill-color:#fff!important}
html:is([data-pmm-visual-theme="glass"],[data-pmm-visual-theme="theme"],[data-pmm-follow-tavern="true"])[data-pmm-theme-tone] body #preset-manager-main-panel :is(.section-header__count,.category-header__count){background:var(--pmm-theme-control)!important;color:var(--pmm-theme-text)!important;border-color:var(--pmm-theme-border)!important;opacity:1!important}
html:is([data-pmm-visual-theme="glass"],[data-pmm-visual-theme="theme"],[data-pmm-follow-tavern="true"])[data-pmm-theme-tone] body #preset-manager-main-panel .pm-header :is(.action-card,.close-card,.theme-btn,.title-edit-btn,.title-action-btn,.pmm-preset-search-btn){background:var(--pmm-theme-control)!important;color:var(--pmm-theme-text)!important;-webkit-text-fill-color:var(--pmm-theme-text)!important;border-color:var(--pmm-theme-border)!important}
html:is([data-pmm-visual-theme="glass"],[data-pmm-visual-theme="theme"],[data-pmm-follow-tavern="true"])[data-pmm-theme-tone] body #preset-manager-main-panel .pm-header :is(.card-icon,i){color:var(--pmm-theme-text)!important;-webkit-text-fill-color:var(--pmm-theme-text)!important}
html:is([data-pmm-visual-theme="glass"],[data-pmm-visual-theme="theme"],[data-pmm-follow-tavern="true"])[data-pmm-theme-tone] body #preset-manager-main-panel :is(.prompt-item--selected,.prompt-card--selected){border-color:var(--pmm-theme-accent)!important}
html:is([data-pmm-visual-theme="glass"],[data-pmm-visual-theme="theme"],[data-pmm-follow-tavern="true"])[data-pmm-theme-tone] body #preset-manager-floating-panel :is(.floating-panel-root,.quick-edit-dropdown){--fp-glass-bg:var(--pmm-theme-floating)!important;--fp-glass-hover-bg:var(--pmm-theme-raised)!important;--fp-card-bg:var(--pmm-theme-raised)!important;--fp-card-bg-translucent:var(--pmm-theme-control)!important;--fp-border-color:var(--pmm-theme-border)!important;--fp-text-color:var(--pmm-theme-text)!important;--fp-text-secondary:var(--pmm-theme-muted)!important;--fp-accent-color:var(--pmm-theme-accent)!important;--qe-glass-bg:var(--pmm-theme-surface)!important;--qe-glass-hover-bg:var(--pmm-theme-control)!important;--qe-card-bg:var(--pmm-theme-raised)!important;--qe-border-color:var(--pmm-theme-border)!important;--qe-text-color:var(--pmm-theme-text)!important;--qe-text-secondary:var(--pmm-theme-muted)!important;--qe-accent-color:var(--pmm-theme-accent)!important;--pm-quote-color:var(--pmm-theme-accent)!important}
html[data-pmm-visual-theme="glass"][data-pmm-theme-tone] body #preset-manager-main-panel .preset-panel{backdrop-filter:blur(14px) saturate(65%)!important;-webkit-backdrop-filter:blur(14px) saturate(65%)!important}
html[data-pmm-visual-theme="glass"][data-pmm-theme-tone] body #preset-manager-floating-panel .pmm-unified-floating-root>.panel-wrapper{backdrop-filter:blur(20px) saturate(65%)!important;-webkit-backdrop-filter:blur(20px) saturate(65%)!important}
html[data-pmm-visual-theme="glass"][data-pmm-theme-tone] body #preset-manager-floating-panel .quick-edit-dropdown{background:var(--pmm-theme-raised)!important}
html[data-pmm-visual-theme="glass"][data-pmm-theme-tone] body #preset-manager-main-panel.pmm-layout-resizing .preset-panel,html[data-pmm-visual-theme="glass"][data-pmm-theme-tone] body #preset-manager-floating-panel .pmm-unified-floating-root.is-dragging>.panel-wrapper{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
html[data-pmm-visual-theme="aqua"] body #preset-manager-floating-panel .quick-edit-dropdown .section-header>.section-header__count{color:rgb(182,227,255)!important;-webkit-text-fill-color:rgb(182,227,255)!important;opacity:1!important;text-shadow:0 1px 1px rgba(24,77,115,.7)!important}
html:is([data-pmm-visual-theme="glass"],[data-pmm-visual-theme="theme"],[data-pmm-follow-tavern="true"])[data-pmm-theme-tone] body #preset-manager-floating-panel .quick-edit-dropdown :is(.section-header__count,.category-header__count){color:var(--pmm-theme-count)!important;-webkit-text-fill-color:var(--pmm-theme-count)!important;opacity:1!important;text-shadow:none!important}
html:is([data-pmm-visual-theme="glass"],[data-pmm-visual-theme="theme"],[data-pmm-follow-tavern="true"])[data-pmm-theme-tone] body #pmm-mobile-layout-card{background:var(--pmm-theme-controller)!important;box-shadow:var(--pmm-theme-shadow)!important;backdrop-filter:blur(var(--pmm-theme-blur))!important;-webkit-backdrop-filter:blur(var(--pmm-theme-blur))!important}
html:is([data-pmm-visual-theme="glass"],[data-pmm-visual-theme="theme"],[data-pmm-follow-tavern="true"])[data-pmm-theme-tone] body #pmm-mobile-layout-card :is(.pmm-theme-picker__choices button,.pmm-layout-header-mode button,.pmm-layout-card__footer>button,.pmm-layout-split-presets>button){border:0!important;outline:0!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 2px 4px rgba(0,0,0,.14)!important}
html body #pmm-unified-floating-handle.is-dragging,html body #pmm-mobile-layout-card.pmm-layout-card--dragging,html body #preset-manager-floating-panel .is-dragging>.panel-wrapper{transition:none!important;animation:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}

/* PMM_THEME_MOTION: two background layers only; no document capture, text repaint loop or hit testing. */
html body :is(#preset-manager-main-panel#preset-manager-main-panel .preset-panel,#preset-manager-main-panel#preset-manager-main-panel .pm-header,#preset-manager-floating-panel#preset-manager-floating-panel .panel-wrapper,#pmm-mobile-layout-card#pmm-mobile-layout-card,#pmm-unified-floating-handle#pmm-unified-floating-handle).pmm-theme-surface-motion{background:transparent!important;isolation:isolate!important;transition:none!important}
html body #preset-manager-main-panel .pm-header.pmm-theme-surface-motion{position:relative}
html body :is(#preset-manager-main-panel#preset-manager-main-panel .preset-panel,#preset-manager-main-panel#preset-manager-main-panel .pm-header,#preset-manager-floating-panel#preset-manager-floating-panel .panel-wrapper,#pmm-mobile-layout-card#pmm-mobile-layout-card,#pmm-unified-floating-handle#pmm-unified-floating-handle).pmm-theme-surface-motion *{transition:none!important}
html body :is(#preset-manager-main-panel#preset-manager-main-panel .preset-panel,#preset-manager-main-panel#preset-manager-main-panel .pm-header,#preset-manager-floating-panel#preset-manager-floating-panel .panel-wrapper,#pmm-mobile-layout-card#pmm-mobile-layout-card,#pmm-unified-floating-handle#pmm-unified-floating-handle).pmm-theme-surface-motion::before,html body :is(#preset-manager-main-panel#preset-manager-main-panel .preset-panel,#preset-manager-main-panel#preset-manager-main-panel .pm-header,#preset-manager-floating-panel#preset-manager-floating-panel .panel-wrapper,#pmm-mobile-layout-card#pmm-mobile-layout-card,#pmm-unified-floating-handle#pmm-unified-floating-handle).pmm-theme-surface-motion::after{content:""!important;position:absolute!important;inset:0!important;width:auto!important;height:auto!important;border:0!important;border-radius:inherit!important;pointer-events:none!important;transform:none!important;filter:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;box-shadow:none!important;animation-duration:360ms!important;animation-timing-function:cubic-bezier(.22,.61,.36,1)!important;animation-fill-mode:both!important;animation-delay:0s!important;animation-iteration-count:1!important;will-change:opacity}
html body :is(#preset-manager-main-panel#preset-manager-main-panel .preset-panel,#preset-manager-main-panel#preset-manager-main-panel .pm-header,#preset-manager-floating-panel#preset-manager-floating-panel .panel-wrapper,#pmm-mobile-layout-card#pmm-mobile-layout-card,#pmm-unified-floating-handle#pmm-unified-floating-handle).pmm-theme-surface-motion::before{z-index:-2!important;background:var(--pmm-theme-motion-from)!important;animation-name:pmm-theme-layer-out!important}
html body :is(#preset-manager-main-panel#preset-manager-main-panel .preset-panel,#preset-manager-main-panel#preset-manager-main-panel .pm-header,#preset-manager-floating-panel#preset-manager-floating-panel .panel-wrapper,#pmm-mobile-layout-card#pmm-mobile-layout-card,#pmm-unified-floating-handle#pmm-unified-floating-handle).pmm-theme-surface-motion::after{z-index:-1!important;background:var(--pmm-theme-motion-to)!important;animation-name:pmm-theme-layer-in!important}
html body :is(#preset-manager-main-panel#preset-manager-main-panel .preset-panel,#preset-manager-main-panel#preset-manager-main-panel .pm-header,#preset-manager-floating-panel#preset-manager-floating-panel .panel-wrapper,#pmm-mobile-layout-card#pmm-mobile-layout-card,#pmm-unified-floating-handle#pmm-unified-floating-handle).pmm-theme-surface-motion.pmm-theme-motion-alt::before{animation-name:pmm-theme-layer-out-alt!important}
html body :is(#preset-manager-main-panel#preset-manager-main-panel .preset-panel,#preset-manager-main-panel#preset-manager-main-panel .pm-header,#preset-manager-floating-panel#preset-manager-floating-panel .panel-wrapper,#pmm-mobile-layout-card#pmm-mobile-layout-card,#pmm-unified-floating-handle#pmm-unified-floating-handle).pmm-theme-surface-motion.pmm-theme-motion-alt::after{animation-name:pmm-theme-layer-in-alt!important}
@keyframes pmm-theme-layer-out{from{opacity:1}to{opacity:0}}@keyframes pmm-theme-layer-in{from{opacity:0}to{opacity:1}}
@keyframes pmm-theme-layer-out-alt{from{opacity:1}to{opacity:0}}@keyframes pmm-theme-layer-in-alt{from{opacity:0}to{opacity:1}}
@media(prefers-reduced-motion:reduce){html body :is(#preset-manager-main-panel#preset-manager-main-panel .preset-panel,#preset-manager-main-panel#preset-manager-main-panel .pm-header,#preset-manager-floating-panel#preset-manager-floating-panel .panel-wrapper,#pmm-mobile-layout-card#pmm-mobile-layout-card,#pmm-unified-floating-handle#pmm-unified-floating-handle).pmm-theme-surface-motion::before{opacity:0!important;animation:none!important}html body :is(#preset-manager-main-panel#preset-manager-main-panel .preset-panel,#preset-manager-main-panel#preset-manager-main-panel .pm-header,#preset-manager-floating-panel#preset-manager-floating-panel .panel-wrapper,#pmm-mobile-layout-card#pmm-mobile-layout-card,#pmm-unified-floating-handle#pmm-unified-floating-handle).pmm-theme-surface-motion::after{opacity:1!important;animation:none!important}}
`;DOC.head.appendChild(style);cleanup.push(()=>style.remove());
}
function onDocumentCapture(event){
  const button=event.target?.closest?.('#preset-manager-main-panel .theme-btn');if(!button)return;
  const title=button.getAttribute('title')||'';
  if(title.includes('主题模式')||title.includes('跟随酒馆美化')){event.preventDefault();event.stopImmediatePropagation();toggleFollow();return}
  if(title.includes('白色'))setTone('light');else if(title.includes('黑色'))setTone('dark');
}
function install(){
  current=loadTheme();followTavern=readStorage(FOLLOW_KEY)==='1';installStyle();DOC.addEventListener('click',onDocumentCapture,true);cleanup.push(()=>DOC.removeEventListener('click',onDocumentCapture,true));
  const stamps=new WeakMap();
  const nativeStamp=node=>String(node?.className||'').split(/\s+/).filter(name=>!name.startsWith('pmm-')).join(' ')+'|'+(node?.style?.cssText||'').split(';').filter(value=>/--SmartTheme|^\s*(background|color)\s*:/.test(value)).join(';');
  for(const node of [DOC.body,DOC.documentElement].filter(Boolean))stamps.set(node,nativeStamp(node));
  const observer=new MutationObserver(records=>{
    let changed=false;for(const target of new Set(records.map(record=>record.target))){const stamp=nativeStamp(target);if(stamps.get(target)!==stamp){stamps.set(target,stamp);changed=true}}
    if(changed&&(followTavern||environmentTone()!==DOC.documentElement.dataset.pmmThemeTone))requestApply(null,true);
  });
  for(const node of [DOC.documentElement,DOC.body].filter(Boolean))observer.observe(node,{attributes:true,attributeFilter:['class','style']});
  const mountObserver=new MutationObserver(records=>{
    for(const record of records)for(const node of record.addedNodes){
      if(node.nodeType!==1)continue;
      if(node.matches?.(THEME_TARGETS))hydrateRoot(node);
      else for(const root of node.querySelectorAll?.(THEME_TARGETS)||[])hydrateRoot(root);
    }
  });
  mountObserver.observe(DOC.body||DOC.documentElement,{childList:true});
  const headObserver=new MutationObserver(records=>{
    const ownStyle=node=>String((node?.nodeType===1?node:node?.parentElement)?.id||'').startsWith('pmm-');
    if(records.some(record=>!ownStyle(record.target)&&(!record.addedNodes?.length||Array.from(record.addedNodes).some(node=>!ownStyle(node)))))requestApply(null,true);
  });
  if(DOC.head)headObserver.observe(DOC.head,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['href','media','disabled']});
  const onStylesheetLoad=event=>{if(event.target?.matches?.('link[rel="stylesheet"]'))requestApply(null,true)};
  DOC.addEventListener('load',onStylesheetLoad,true);
  cleanup.push(()=>{observer.disconnect();mountObserver.disconnect();headObserver.disconnect();DOC.removeEventListener('load',onStylesheetLoad,true)});
  const media=TOP.matchMedia?.('(prefers-color-scheme:dark)'),change=()=>requestApply(null,true);
  media?.addEventListener?.('change',change);cleanup.push(()=>media?.removeEventListener?.('change',change));
  apply();
}
const API=Object.freeze({themes:THEMES,getTheme:()=>current,isFollowingTavern:()=>followTavern,getTone:environmentTone,getTokens:()=>lastTokens,setTheme,setTone,toggleFollow,apply,mountPicker,beginInteraction,endInteraction,destroy(){disposed=true;themeRevision++;pendingNativeMode=null;interactions.clear();stopTransition();TOP.clearTimeout(themeTimer);DOC.documentElement.classList.remove('pmm-theme-transition');while(cleanup.length)try{cleanup.pop()()}catch(_){}delete TOP[API_KEY]}});
TOP[API_KEY]=API;globalThis[API_KEY]=API;install();export default API;
