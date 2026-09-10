const TOP = (() => { try { return window.top || window; } catch (_) { return window; } })();
const DOC = TOP.document;
const STORE = TOP.__PMM_FLOATING_STORE__;
const API_KEY = '__PMM_LAYOUT_CONTROLLER__';
const STYLE_ID = 'pmm-layout-controller-style';
try { TOP[API_KEY]?.destroy?.(); } catch (_) {}

const cleanup = [];
let opening = null;
function listen(target,type,fn,options){target?.addEventListener?.(type,fn,options);cleanup.push(()=>target?.removeEventListener?.(type,fn,options?.capture??options));}
function profile(){
  STORE?.syncProfile?.();
  return STORE?.getState?.().profile || 'desktop-landscape';
}
function syncProfile(){
  const value=profile();
  DOC.documentElement.dataset.pmmViewportProfile=value;
  const panel=DOC.querySelector('#preset-manager-main-panel');
  if(panel)panel.dataset.pmmViewportProfile=value;
}
async function open(source="api"){
  if(opening)return opening;
  opening=(async()=>{
    syncProfile();
    let card=TOP.__PMM_LAYOUT_CARD_API__;
    if(typeof card?.open!=="function"){
      const bridge=DOC.__pmmWorkshopOpenBridge||globalThis.document?.__pmmWorkshopOpenBridge;
      if(typeof bridge?.open!=="function"||(await bridge.open())===false)return false;
      for(let attempt=0;attempt<8&&typeof card?.open!=="function";attempt++){
        await new Promise(resolve=>TOP.requestAnimationFrame(resolve));
        card=TOP.__PMM_LAYOUT_CARD_API__;
      }
    }
    if(typeof card?.open!=="function")return false;
    card.open();
    const panel=DOC.querySelector("#pmm-mobile-layout-card");
    panel?.setAttribute("data-open-source",source);
    TOP.__PMM_THEME_SYSTEM__?.mountPicker?.(panel);
    return true;
  })().finally(()=>{opening=null});
  return opening;
}
function close(){TOP.__PMM_LAYOUT_CARD_API__?.close?.();}
function toggle(source='api'){
  const card=TOP.__PMM_LAYOUT_CARD_API__;
  if(card?.isOpen?.()){close();return Promise.resolve(true)}
  return open(source);
}
function installStyle(){
  DOC.getElementById(STYLE_ID)?.remove();const style=DOC.createElement('style');style.id=STYLE_ID;style.textContent=`
html body #pmm-mobile-layout-card{position:fixed!important;left:50%!important;top:50%!important;width:min(var(--pmm-controller-width,620px),calc(100vw - 24px))!important;height:min(var(--pmm-controller-height,640px),calc(100dvh - 24px))!important;max-height:calc(100dvh - 24px)!important;z-index:2147483500!important;isolation:isolate!important;font-size:var(--pmm-controller-font,12px)!important}
html body #preset-manager-main-panel .pm-header{box-sizing:border-box!important;width:100%!important;display:grid!important;grid-template-columns:minmax(0,calc(50% - var(--pmm-header-gap,4px)/2)) minmax(0,calc(50% - var(--pmm-header-gap,4px)/2))!important;align-items:stretch!important;height:auto!important;min-height:0!important;column-gap:var(--pmm-header-gap,4px)!important;row-gap:0!important;padding:var(--pmm-header-gap,4px)!important}
html body #preset-manager-main-panel .pm-header>.header-left{grid-column:1!important;display:flex!important;width:auto!important;min-width:0!important;max-width:none!important;height:auto!important;align-self:stretch!important;align-items:stretch!important}
html body #preset-manager-main-panel .pm-header>.header-right{grid-column:2!important;display:flex!important;width:auto!important;min-width:0!important;max-width:none!important;height:auto!important;align-self:stretch!important;align-content:center!important;align-items:center!important;justify-content:flex-end!important;flex-flow:row wrap!important;gap:var(--pmm-header-gap,4px)!important}
html body #preset-manager-main-panel .pm-header>.header-right>.title-actions{display:contents!important}
html body #preset-manager-main-panel .pm-header>.header-right>.theme-switch-card{display:contents!important}
html body #preset-manager-main-panel.pmm-layout-header-single-row .pm-header>.header-right{flex-wrap:nowrap!important;justify-content:flex-start!important;overflow-x:auto!important;overflow-y:hidden!important;overscroll-behavior-x:contain!important;overscroll-behavior-y:none!important;touch-action:pan-x!important;scroll-behavior:auto!important;-webkit-overflow-scrolling:touch!important;scrollbar-width:none!important;-ms-overflow-style:none!important}\nhtml body #preset-manager-main-panel.pmm-layout-header-single-row .pm-header>.header-right::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}
html body #preset-manager-main-panel.pmm-layout-header-single-row .pm-header>.header-right::before{content:"";flex:1 0 0;min-width:0;height:1px}
html body .pmm-layout-header-mode{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;padding:8px 2px;border-bottom:1px solid var(--pmm-theme-border,var(--pm-border))}
html body .pmm-layout-header-mode>span{font-size:12px;color:var(--pmm-layout-text,var(--pmm-theme-text))}
html body .pmm-layout-header-mode>div{display:flex;gap:5px}
html body .pmm-layout-header-mode button{min-height:30px;padding:3px 9px;border:1px solid var(--pmm-theme-border,var(--pm-border));border-radius:8px;background:var(--pmm-theme-control,var(--pm-control-bg));color:var(--pmm-theme-text,var(--pm-text-primary));box-shadow:none}
html body .pmm-layout-header-mode button.is-active{background:var(--pmm-theme-accent,var(--pm-accent));color:var(--pmm-theme-active-text,#fff)}\nhtml body .pmm-layout-scroll-memory{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 2px;border-bottom:1px solid var(--pmm-theme-border,var(--pm-border));font-size:12px;color:var(--pmm-theme-text,var(--pm-text-primary))}html body .pmm-layout-scroll-memory input{width:18px;height:18px;accent-color:var(--pmm-theme-accent,var(--pm-accent))}\nhtml body #pmm-mobile-layout-card .pmm-layout-row__label,html body #pmm-mobile-layout-card .pmm-theme-picker__label,html body #pmm-mobile-layout-card .pmm-layout-header-mode>span,html body #pmm-mobile-layout-card .pmm-layout-scroll-memory>span{font-size:var(--pmm-controller-font,12px)!important}html body #pmm-mobile-layout-card .pmm-layout-row__value,html body #pmm-mobile-layout-card .pmm-layout-soft-btn,html body #pmm-mobile-layout-card .pmm-layout-dnd-btn,html body #pmm-mobile-layout-card .pmm-layout-done-btn{font-size:calc(var(--pmm-controller-font,12px)*.9)!important}
html body #preset-manager-main-panel .pm-header>.header-left .title-card{display:flex!important;width:100%!important;height:100%!important;min-width:0!important;max-width:100%!important;padding:0!important;margin:0!important;align-items:stretch!important;overflow:hidden!important}
html body #preset-manager-main-panel .pm-header>.header-left .title-content{display:flex!important;flex:1 1 auto!important;flex-direction:column!important;width:100%!important;min-width:0!important;height:100%!important;align-items:stretch!important;justify-content:center!important}
html body #preset-manager-main-panel .pm-header>.header-left .title-row{display:flex!important;flex:1 1 auto!important;width:100%!important;min-width:0!important;align-items:stretch!important}
html body #preset-manager-main-panel .pm-header>.header-left .title-select,html body #preset-manager-main-panel .pm-header>.header-left .title-input{flex:1 1 auto!important;width:100%!important;min-width:0!important;max-width:none!important;height:auto!important;min-height:var(--pmm-header-button-size,32px)!important;line-height:1.25!important;padding-block:4px!important;text-align:center!important;text-align-last:center!important}
html body #preset-manager-main-panel .pm-header>.header-right .action-card,html body #preset-manager-main-panel .pm-header>.header-right .close-card,html body #preset-manager-main-panel .pm-header>.header-right .pmm-preset-search-btn,html body #preset-manager-main-panel .pm-header>.header-right .title-edit-btn,html body #preset-manager-main-panel .pm-header>.header-right .title-action-btn,html body #preset-manager-main-panel .pm-header>.header-right .theme-btn,html body #preset-manager-main-panel .pm-header>.header-right .u-mb{box-sizing:border-box!important;flex:0 0 var(--pmm-header-button-size,32px)!important;width:var(--pmm-header-button-size,32px)!important;min-width:var(--pmm-header-button-size,32px)!important;height:var(--pmm-header-button-size,32px)!important;min-height:var(--pmm-header-button-size,32px)!important;margin:0!important;padding:0!important}
html body #preset-manager-main-panel .pm-header>.header-right .action-card,html body #preset-manager-main-panel .pm-header>.header-right .close-card,html body #preset-manager-main-panel .pm-header>.header-right .pmm-preset-search-btn,html body #preset-manager-main-panel .pm-header>.header-right .title-edit-btn,html body #preset-manager-main-panel .pm-header>.header-right .title-action-btn,html body #preset-manager-main-panel .pm-header>.header-right .theme-btn,html body #preset-manager-main-panel .pm-header>.header-right .u-mb{border:0!important;border-radius:8px!important;display:flex!important;align-items:center!important;justify-content:center!important;background:var(--pmm-theme-control,var(--pm-control-bg))!important;color:var(--pmm-theme-text,var(--pm-text-primary))!important;box-shadow:none!important;transform:none!important;overflow:hidden!important}
/* Native action labels are separate span nodes; icon size is independent. */
@media(orientation:landscape){html body #preset-manager-main-panel .pm-header .title-action-btn>span{display:none!important}}
html body #preset-manager-main-panel .pm-header>.header-right :is(.card-icon i,.title-action-btn>i,.close-card>i,.title-edit-btn>i,.pmm-preset-search-btn>i,.theme-btn>i){font-size:var(--pmm-header-icon-size,calc(var(--pmm-header-button-size,32px)*.38))!important;line-height:1!important}
html body #preset-manager-main-panel .pm-header>.header-right .header-card::before{display:none!important}
html body #preset-manager-main-panel .side-panel-root .panel-buttons>.pmm-layout-trigger.pmm-layout-trigger--divider{box-sizing:border-box!important;position:relative!important;inset:auto!important;display:flex!important;visibility:visible!important;pointer-events:auto!important;flex:0 0 28px!important;width:28px!important;min-width:28px!important;height:32px!important;padding:0!important;margin:0!important;align-items:center!important;justify-content:center!important;border:1px solid var(--pm-border,var(--pmm-theme-border))!important;border-radius:8px!important;background:var(--pmm-theme-control,var(--pm-control-bg))!important;color:var(--pmm-theme-text,var(--pm-text-primary))!important;box-shadow:none!important;transform:none!important;z-index:2!important;touch-action:manipulation!important}
html body #preset-manager-main-panel .side-panel-root .panel-buttons>.pmm-layout-trigger--divider .pmm-layout-trigger__arrow{display:flex!important;width:100%!important;height:100%!important;align-items:center!important;justify-content:center!important;border:0!important;background:transparent!important;box-shadow:none!important;font-size:19px!important;line-height:1!important;pointer-events:none!important}
html body #preset-manager-main-panel .pm-header>.header-left .pmm-preset-search-btn,html body #preset-manager-main-panel .pm-header>.header-left .title-edit-btn,html body #preset-manager-main-panel .pm-header>.header-left .title-actions{display:none!important}html body #preset-manager-main-panel .pm-header>.header-right .card-icon{width:100%!important;height:100%!important;margin:0!important;border:0!important;border-radius:inherit!important;background:transparent!important;box-shadow:none!important}html body #preset-manager-main-panel .pm-header>.header-right .card-icon i{font-size:calc(var(--pmm-header-button-size,32px)*.38)!important}html body #preset-manager-main-panel .pm-header>.header-right .title-action-btn i{display:block!important;margin:0!important;font-size:calc(var(--pmm-header-button-size,32px)*.38)!important;line-height:1!important}.header-right .title-edit-btn{opacity:.82!important;color:inherit!important}
html body .pmm-layout-number-editor{box-sizing:border-box;width:68px;min-width:48px;max-width:100%;height:30px;margin:0;padding:2px 6px;border:1px solid var(--pmm-layout-accent,var(--pm-quote-color,#6b8cff));border-radius:7px;background:var(--pmm-layout-control,rgba(127,127,127,.12));color:inherit;-webkit-text-fill-color:currentColor;font:inherit;font-size:16px;text-align:right;outline:0}
html[data-pmm-viewport-profile^="tablet"] body #pmm-mobile-layout-card{width:min(var(--pmm-controller-width,620px),calc(100vw - 24px))!important;height:min(var(--pmm-controller-height,640px),calc(100dvh - 24px))!important;max-height:calc(100dvh - 24px)!important;font-size:13px!important}html[data-pmm-viewport-profile^="tablet"] body #pmm-mobile-layout-card .pmm-layout-card__body{padding-inline:18px!important;gap:8px!important}html[data-pmm-viewport-profile^="tablet"] body #pmm-mobile-layout-card .pmm-layout-row__label{font-size:12px!important}html[data-pmm-viewport-profile^="tablet"] body #pmm-mobile-layout-card .pmm-layout-step-btn{width:28px!important;height:28px!important;min-width:28px!important;border-radius:50%!important}html[data-pmm-viewport-profile^="tablet"] body #pmm-mobile-layout-card .pmm-layout-range-line{grid-template-columns:28px minmax(0,1fr) 28px!important}
html[data-pmm-viewport-profile$="landscape"] body #pmm-mobile-layout-card .pmm-layout-card__body{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;column-gap:16px!important;align-items:start!important}
html[data-pmm-viewport-profile^="phone"] body #preset-manager-main-panel .pm-header{--pmm-header-gap:3px}html[data-pmm-viewport-profile^="phone"] body #pmm-mobile-layout-card{width:min(var(--pmm-controller-width,344px),calc(100vw - 16px))!important;height:min(var(--pmm-controller-height,620px),calc(100dvh - 16px))!important;max-height:calc(100dvh - 16px)!important}
html body #preset-manager-main-panel .pm-header>.header-left .title-card>.card-icon{display:none!important}
html body #preset-manager-main-panel.pmm-layout-custom-preset-name-font .title-select,html body #preset-manager-main-panel.pmm-layout-custom-preset-name-font .title-input,html body #preset-manager-main-panel.pmm-layout-custom-preset-name-font .title-text{font-size:var(--pmm-user-preset-name-font)!important}
html body #preset-manager-main-panel.pmm-layout-custom-body-font .prompt-card__content,html body #preset-manager-main-panel.pmm-layout-custom-body-font .prompt-item__content,html body #preset-manager-main-panel.pmm-layout-custom-body-font textarea{font-size:var(--pmm-user-body-font)!important}
html body #preset-manager-main-panel.pmm-layout-custom-header-icon .pm-header .card-icon i{font-size:var(--pmm-header-icon-size)!important}
html body #preset-manager-main-panel.pmm-layout-custom-row-button .prompt-card button,html body #preset-manager-main-panel.pmm-layout-custom-row-button .prompt-item button{width:var(--pmm-row-button-size)!important;height:var(--pmm-row-button-size)!important;min-width:var(--pmm-row-button-size)!important}
html body #preset-manager-main-panel.pmm-layout-custom-outer-padding .pm-overlay{padding:var(--pmm-main-padding)!important}
html body #preset-manager-main-panel.pmm-layout-custom-main-height .pm-panel-container{height:var(--pmm-main-height)!important;max-height:var(--pmm-main-height)!important}
html body #preset-manager-main-panel.pmm-layout-custom-main-width .pm-panel-container{width:var(--pmm-main-width)!important;max-width:var(--pmm-main-width)!important}
html body .pmm-layout-glyph-row{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) 96px;align-items:center;gap:10px;padding:8px 2px;border-bottom:1px solid var(--pmm-theme-border,var(--pm-border))}
html body .pmm-layout-glyph-row input{box-sizing:border-box;width:96px;min-width:0;height:32px;padding:4px 8px;border:1px solid var(--pmm-theme-border,var(--pm-border));border-radius:8px;background:var(--pmm-theme-control,var(--pm-control-bg));color:var(--pmm-theme-text,var(--pm-text-primary));font-size:16px;text-align:center}
@media(pointer:coarse){html body #preset-manager-main-panel .preset-panel,html body #preset-manager-main-panel .pm-header{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}}
html body #preset-manager-main-panel .pm-panel-container--merge-mode>.preset-panel,html body #preset-manager-main-panel .pm-panel-container--branch-mode>.preset-panel,html body #preset-manager-main-panel .pm-panel-container--favorite-mode>.preset-panel,html body #preset-manager-main-panel .pm-panel-container--merge-mode>.pm-main-wrapper>.preset-panel,html body #preset-manager-main-panel .pm-panel-container--branch-mode>.pm-main-wrapper>.preset-panel,html body #preset-manager-main-panel .pm-panel-container--favorite-mode>.pm-main-wrapper>.preset-panel,html body #preset-manager-main-panel .pm-panel-container--merge-mode .pm-header,html body #preset-manager-main-panel .pm-panel-container--branch-mode .pm-header,html body #preset-manager-main-panel .pm-panel-container--favorite-mode .pm-header{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
html body #pmm-mobile-layout-card .pmm-layout-card__footer{flex:0 0 auto!important;flex-wrap:wrap!important;justify-content:center!important;gap:10px!important}
html body #pmm-mobile-layout-card .pmm-layout-card__footer>button{box-sizing:border-box!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:28px!important;padding:3px 12px!important;border:1px solid var(--pmm-theme-border,var(--pm-border))!important;border-radius:999px!important;line-height:1.3!important;white-space:nowrap!important;appearance:none!important;-webkit-appearance:none!important}
html body #pmm-mobile-layout-card .pmm-layout-split-ratio{grid-column:1/-1!important}
html body #pmm-mobile-layout-card .pmm-layout-split-presets{display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-top:4px;color:var(--pmm-theme-text);font-size:var(--pmm-controller-font,12px)}
html body #pmm-mobile-layout-card .pmm-layout-split-presets>span{margin-right:auto}
html body #pmm-mobile-layout-card .pmm-layout-split-presets>button{min-height:28px;padding:3px 12px;border:1px solid var(--pmm-theme-border);border-radius:999px;background:var(--pmm-theme-control);color:var(--pmm-theme-text);font:inherit;box-shadow:none}
html body #pmm-mobile-layout-card .pmm-layout-split-presets>button.is-active{border-color:var(--pmm-theme-accent)}
html body #pmm-mobile-layout-card.pmm-layout-card--dragging{will-change:transform;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;box-shadow:none!important}
@media(min-width:769px){html body #preset-manager-main-panel.pmm-layout-custom-split-ratio :is(.pm-panel-container--merge-mode,.pm-panel-container--branch-mode,.pm-panel-container--favorite-mode){grid-template-columns:minmax(0,var(--pmm-user-split-left)) auto minmax(0,var(--pmm-user-split-right))!important}}
html body #pmm-mobile-layout-card .pmm-layout-header-mode>.pmm-layout-scroll-memory{grid-column:1/-1;display:flex!important;width:100%;box-sizing:border-box;border-bottom:0;gap:12px;margin-top:4px}
html body #pmm-mobile-layout-card .pmm-layout-scroll-memory input{display:block!important;flex:0 0 34px;width:34px!important;height:20px!important;appearance:none!important;-webkit-appearance:none!important;border:1px solid var(--pmm-theme-border);border-radius:999px;background:var(--pmm-theme-control);box-shadow:inset 0 2px 4px rgba(0,0,0,.14);position:relative;cursor:pointer}
html body #pmm-mobile-layout-card .pmm-layout-scroll-memory input::after{content:"";position:absolute;left:2px;top:2px;width:14px;height:14px;border-radius:50%;background:var(--pmm-theme-text);box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .18s ease}
html body #pmm-mobile-layout-card .pmm-layout-scroll-memory input:checked{background:var(--pmm-theme-accent)}
html body #pmm-mobile-layout-card .pmm-layout-scroll-memory input:checked::after{transform:translateX(14px);background:var(--pmm-theme-active-text)}

html body #pmm-mobile-layout-card .pmm-layout-search{box-sizing:border-box!important;flex:0 0 auto!important;width:calc(100% - 32px)!important;height:28px!important;min-height:28px!important;margin:0 16px 6px!important;padding:3px 8px!important;border:0!important;border-bottom:1px solid var(--pmm-theme-border)!important;border-radius:0!important;background:transparent!important;color:var(--pmm-theme-text)!important;-webkit-text-fill-color:var(--pmm-theme-text)!important;font:inherit!important;font-size:var(--pmm-controller-font,12px)!important;box-shadow:none!important;outline:none!important}
html body #pmm-mobile-layout-card .pmm-layout-search:focus{font-size:16px!important;border-bottom-color:var(--pmm-theme-accent)!important}
html body #pmm-mobile-layout-card .pmm-layout-search::placeholder{color:var(--pmm-theme-muted);-webkit-text-fill-color:var(--pmm-theme-muted)}
html body #pmm-mobile-layout-card .pmm-layout-card__body{flex:1 1 auto!important;min-height:0!important;touch-action:pan-y!important}
html body #pmm-mobile-layout-card .pmm-layout-card__body>.pmm-layout-row{flex-shrink:0!important}
html body #pmm-mobile-layout-card .pmm-layout-range:disabled{pointer-events:none!important}
html body #pmm-mobile-layout-card .pmm-layout-card__body>[hidden]{display:none!important}
html body #pmm-mobile-layout-card .pmm-layout-search-empty{grid-column:1/-1;text-align:center;color:var(--pmm-theme-muted);font:inherit}
html body #preset-manager-main-panel .pmm-split-handle{pointer-events:auto!important;touch-action:none!important}
html body #preset-manager-main-panel .pmm-split-handle::before{content:"";position:absolute;inset:-6px;pointer-events:auto}
/* Negative spacing uses overlap margins; CSS gap itself cannot be negative. */
html body #preset-manager-main-panel.pmm-layout-custom-item-gap :is(.prompt-panel__list,.section-content,.category-content){gap:max(0px,var(--pmm-user-item-gap)) 0!important}
html body #preset-manager-main-panel.pmm-layout-custom-item-gap :is(.prompt-panel__list,.section-content,.category-content)>.prompt-item+ .prompt-item{margin-top:min(0px,var(--pmm-user-item-gap))!important}
html body #preset-manager-main-panel.pmm-layout-custom-header-gap .pm-header{--pmm-header-gap:inherit!important;grid-template-columns:minmax(0,calc(50% - max(0px,var(--pmm-header-gap))/2)) minmax(0,calc(50% - max(0px,var(--pmm-header-gap))/2))!important;column-gap:max(0px,var(--pmm-header-gap))!important;padding:max(0px,var(--pmm-header-gap))!important}
html body #preset-manager-main-panel.pmm-layout-custom-header-gap .pm-header>.header-right{gap:max(0px,var(--pmm-header-gap))!important;margin-left:min(0px,var(--pmm-header-gap))!important}

/* Separate touch targets keep locking independent from slider position. */
html body #pmm-mobile-layout-card .pmm-layout-row__tools{gap:8px!important}
html body #pmm-mobile-layout-card .pmm-layout-row__lock{touch-action:manipulation!important;flex-shrink:0!important}
html body #pmm-mobile-layout-card .pmm-layout-row__value{touch-action:manipulation!important}
@media(pointer:coarse){
html body #pmm-mobile-layout-card .pmm-layout-row__head{min-height:44px!important;margin-bottom:6px!important;gap:8px!important}
html body #pmm-mobile-layout-card .pmm-layout-row__lock{width:44px!important;min-width:44px!important;height:44px!important;min-height:44px!important}
html body #pmm-mobile-layout-card .pmm-layout-row__value{min-height:44px!important;min-width:64px!important}
html body #pmm-mobile-layout-card .pmm-layout-range-line{grid-template-columns:44px minmax(0,1fr) 44px!important;gap:8px!important}
html body #pmm-mobile-layout-card .pmm-layout-step-btn,html body #pmm-mobile-layout-card .pmm-layout-range{height:44px!important;min-height:44px!important}
html body #pmm-mobile-layout-card .pmm-layout-step-btn{width:44px!important;min-width:44px!important}
}

/* One geometry contract outranks legacy mobile/snapshot fixed widths. Colors stay in the theme. */
html body #preset-manager-main-panel#preset-manager-main-panel .pm-header{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;grid-auto-flow:row!important;column-gap:max(0px,var(--pmm-header-gap,4px))!important;align-items:stretch!important}
html body #preset-manager-main-panel#preset-manager-main-panel .pm-header>:is(.header-left,.header-right){box-sizing:border-box!important;float:none!important;width:100%!important;min-width:0!important;max-width:100%!important;margin:0!important;flex:none!important;grid-row:1!important}
html body #preset-manager-main-panel#preset-manager-main-panel .pm-header>.header-left{grid-column:1!important;overflow:hidden!important}
html body #preset-manager-main-panel#preset-manager-main-panel .pm-header>.header-left :is(.title-card,.title-content,.title-row){box-sizing:border-box!important;width:100%!important;min-width:0!important;max-width:100%!important;flex:1 1 0!important;margin:0!important}
html body #preset-manager-main-panel#preset-manager-main-panel .pm-header>.header-left :is(.title-select,.title-input){box-sizing:border-box!important;width:100%!important;min-width:0!important;max-width:100%!important;flex:1 1 0!important}
html body #preset-manager-main-panel#preset-manager-main-panel .pm-header>.header-right{grid-column:2!important;display:flex!important;flex-direction:row!important;flex-wrap:wrap!important;direction:ltr!important;justify-content:flex-end!important;align-content:center!important;gap:max(0px,var(--pmm-header-gap,4px))!important}
html body #preset-manager-main-panel#preset-manager-main-panel .pm-header>.header-right :is(.title-actions,.theme-switch-card){display:contents!important}
html body #preset-manager-main-panel#preset-manager-main-panel .pm-header>.header-right :is(button,.header-card,.title-actions,.theme-switch-card,.pmm-preset-search-btn){order:0!important}
html body #preset-manager-main-panel#preset-manager-main-panel.pmm-layout-header-single-row .pm-header>.header-right{flex-wrap:nowrap!important;justify-content:flex-start!important}
html body #preset-manager-main-panel#preset-manager-main-panel.pmm-layout-header-single-row .pm-header>.header-right::before{content:"";flex:1 0 0!important}
/* An explicitly placed handle must not push auto-placed panels into an implicit grid column. */
@media(max-width:768px){
html body #preset-manager-main-panel#preset-manager-main-panel :is(.pm-panel-container--merge-mode,.pm-panel-container--branch-mode,.pm-panel-container--favorite-mode)>:is(.preset-panel,.pmm-split-handle),
html body #preset-manager-main-panel#preset-manager-main-panel :is(.pm-panel-container--merge-mode,.pm-panel-container--branch-mode,.pm-panel-container--favorite-mode)>.pm-main-wrapper>:is(.preset-panel,.side-panel-root){grid-column:1!important;min-width:0!important}
}
html body #preset-manager-main-panel#preset-manager-main-panel .pmm-split-handle{width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important;z-index:100!important;touch-action:none!important}
html body .pmm-split-preview{position:fixed!important;pointer-events:none!important;background:var(--SmartThemeQuoteColor,#6b8cff);contain:layout style;will-change:transform;box-shadow:none!important;transition:none!important}
html body .pmm-split-preview::after{content:attr(data-ratio);position:absolute;right:8px;top:5px;padding:4px 8px;border-radius:6px;background:#243244;color:white;font:12px/1.4 sans-serif;white-space:nowrap}
html body .pmm-split-preview[data-axis="x"]::after{right:auto;left:5px;top:8px}
/* The reference is the original notification ON style. All footer actions use it. */
html body #pmm-mobile-layout-card#pmm-mobile-layout-card .pmm-layout-card__footer>button{box-sizing:border-box!important;min-height:36px!important;padding:4px 12px!important;border:1px solid color-mix(in srgb,var(--pm-accent-color,#4a9eff) 64%,transparent)!important;border-radius:999px!important;background:color-mix(in srgb,var(--pm-accent-color,#4a9eff) 22%,transparent)!important;color:color-mix(in srgb,var(--pm-accent-color,#4a9eff) 68%,var(--pmm-layout-text))!important;-webkit-text-fill-color:color-mix(in srgb,var(--pm-accent-color,#4a9eff) 68%,var(--pmm-layout-text))!important;font-family:inherit!important;font-size:calc(var(--pmm-controller-font,12px)*.9)!important;font-weight:540!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 2px 8px rgba(42,48,58,.08)!important;touch-action:manipulation!important}
html body #pmm-mobile-layout-card#pmm-mobile-layout-card .pmm-layout-card__footer>[data-pmm-layout-top-notifications][aria-pressed="false"]{border-color:rgba(255,255,255,.30)!important;background:rgba(116,122,132,.11)!important;color:var(--pmm-layout-text)!important;-webkit-text-fill-color:var(--pmm-layout-text)!important}
html body #pmm-mobile-layout-card#pmm-mobile-layout-card[data-pmm-layout-theme="dark"] .pmm-layout-card__footer>button{border-color:color-mix(in srgb,var(--pm-accent-color,#4a9eff) 72%,transparent)!important;background:color-mix(in srgb,var(--pm-accent-color,#4a9eff) 25%,transparent)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 3px 10px rgba(0,0,0,.12)!important}
html body #pmm-mobile-layout-card#pmm-mobile-layout-card[data-pmm-layout-theme="dark"] .pmm-layout-card__footer>[data-pmm-layout-top-notifications][aria-pressed="false"]{border-color:rgba(255,255,255,.07)!important;background:rgba(255,255,255,.055)!important}
@media(pointer:coarse){html body #pmm-mobile-layout-card#pmm-mobile-layout-card .pmm-layout-card__footer>button{min-height:44px!important}html body #pmm-mobile-layout-card#pmm-mobile-layout-card :is(.pmm-layout-step-btn,.pmm-layout-icon-btn,.pmm-layout-row__lock){width:44px!important;min-width:44px!important;height:44px!important}html body #pmm-mobile-layout-card#pmm-mobile-layout-card .pmm-layout-range-line{grid-template-columns:44px minmax(0,1fr) 44px!important}}
/* Moving surfaces keep a compositor layer; expensive live blur returns after release. */
html body #pmm-mobile-layout-card{contain:layout style;will-change:transform}
html body #pmm-mobile-layout-card#pmm-mobile-layout-card.pmm-layout-card--dragging,
html body #pmm-unified-floating-handle#pmm-unified-floating-handle.is-dragging,
html body #preset-manager-floating-panel#preset-manager-floating-panel .pmm-unified-floating-root.is-dragging>.panel-wrapper{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;box-shadow:none!important;transition:none!important;animation:none!important}

/* Upstream snapshot actions keep their behavior after moving into the unified right half. */
html[data-pmm-viewport-profile] body #preset-manager-main-panel .pm-panel-container.pmm-switch-snapshot-capture-mode .pm-header>.header-right .title-actions :is([title="导入"],[title="导出"],[title="保存开关"],[title^="同步开关"]){display:none!important}
@media(min-width:769px){
html[data-pmm-viewport-profile] body #preset-manager-main-panel .pm-panel-container.pmm-desktop-home-panel-expanded>.pm-main-wrapper{flex:1 1 auto!important;width:auto!important;min-width:0!important;max-width:none!important}
html[data-pmm-viewport-profile] body #preset-manager-main-panel .pm-panel-container>.pm-main-wrapper .pm-header>.header-left.pmm-desktop-home-title-host{flex:1 1 auto!important;width:auto!important;min-width:0!important;max-width:none!important}
}
`;DOC.head.appendChild(style);cleanup.push(()=>style.remove());
}
function onOpenEvent(event){void open(event?.detail?.source||'event')}
function install(){installStyle();syncProfile();listen(TOP,'pmm:open-layout-controller',onOpenEvent);listen(TOP,'orientationchange',()=>TOP.setTimeout(syncProfile,160),{passive:true});listen(TOP,'resize',()=>{if(!STORE?.getState?.().keyboardEditing)syncProfile()},{passive:true});}
const API=Object.freeze({open,close,toggle,getProfile:profile,destroy(){while(cleanup.length)try{cleanup.pop()()}catch(_){}delete DOC.documentElement.dataset.pmmViewportProfile;delete TOP[API_KEY]}});
TOP[API_KEY]=API;globalThis[API_KEY]=API;install();export default API;
