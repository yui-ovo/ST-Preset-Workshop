const TOP=(()=>{try{return window.top||window}catch(_){return window}})();
const DOC=TOP.document,STORE=TOP.__PMM_FLOATING_STORE__;
const API_KEY='__PMM_FLOATING_CONTROLLER__',STYLE_ID='pmm-floating-controller-style',HANDLE_ID='pmm-unified-floating-handle';
if(!STORE)throw new Error('[预设工坊] floating store 未加载');
try{TOP[API_KEY]?.destroy?.()}catch(_){}

const cleanup=[];const boundHeaders=new WeakSet(),boundCollapses=new WeakSet();
let managedPanel=null,managedDisplay=null,expandFrame=0,bannerSizing=null;
let root=null,handle=null,gesture=null,renderFrame=0,resizeFrame=0,orientationTimer=0,tapTimer=0,longTimer=0,lastTapAt=0,lastTapPoint=null,suppressMouseUntil=0,panelResizeObserver=null;
let geometry={vw:1,vh:1,coarse:false,bannerW:180,bannerH:240,ball:46,handleW:28,handleH:64};
function listen(target,type,fn,options){target?.addEventListener?.(type,fn,options);cleanup.push(()=>target?.removeEventListener?.(type,fn,options?.capture??options))}
function docs(){const result=[DOC];try{if(document&&!result.includes(document))result.push(document)}catch(_){}return result}
function refreshViewport(){geometry.vw=Math.max(1,TOP.innerWidth||DOC.documentElement.clientWidth||1);geometry.vh=Math.max(1,TOP.innerHeight||DOC.documentElement.clientHeight||1);geometry.bannerW=Math.min(geometry.bannerW,geometry.vw);geometry.coarse=Boolean(TOP.matchMedia?.('(pointer: coarse)')?.matches)||Number(TOP.navigator?.maxTouchPoints||0)>0;const style=TOP.getComputedStyle(DOC.documentElement);geometry.ball=parseFloat(style.getPropertyValue("--pmm-floating-ball-size"))||(geometry.coarse?46:42);geometry.handleW=parseFloat(style.getPropertyValue("--pmm-floating-handle-width"))||(geometry.coarse?28:26);geometry.handleH=parseFloat(style.getPropertyValue("--pmm-floating-handle-height"))||(geometry.coarse?64:58)}
function controlSize(expanded,g=geometry,dock='free'){if(expanded)return{w:g.handleW,h:g.handleH};const size=dock==='free'?g.ball:Math.max(28,g.handleW);return{w:size,h:size}}
function measurePanel(){const panel=root?.querySelector?.(':scope > .panel-wrapper');if(!panel)return;const rect=panel.getBoundingClientRect();if(rect.width>80)geometry.bannerW=rect.width;if(rect.height>20)geometry.bannerH=rect.height;const quick=panel.querySelector('.quick-edit-dropdown');if(quick&&quick.style.display!=='none'){const cap=parseFloat(TOP.getComputedStyle(DOC.documentElement).getPropertyValue('--pmm-floating-max-height'))||Math.floor(geometry.vh/2);geometry.bannerH=Math.min(cap,geometry.vh)}}
function defaultPosition(){const s=controlSize(false);return{x:Math.round((geometry.vw-s.w)/2),y:Math.max(8,Math.round(geometry.vh*.035)),dock:'free'}}
function clampPosition(position,expanded=STORE.getState().expanded,g=geometry){
  const dock=['left','right'].includes(position?.dock)?position.dock:'free',s=controlSize(expanded,g,dock),groupH=expanded?Math.max(s.h,g.bannerH):s.h;
  let x=dock==='left'?0:dock==='right'?Math.max(0,g.vw-s.w):Math.min(Math.max(4,Number(position?.x)||4),Math.max(4,g.vw-s.w-4));
  // A full-width banner shares its edge with the handle; reserve that corner in its header.
  if(expanded&&g.bannerW+s.w+16>g.vw)x=x+s.w/2<=g.vw/2?0:Math.max(0,g.vw-s.w);
  const marginY=Math.min(6,Math.max(0,(g.vh-groupH)/2));
  return{x:Math.round(x),y:Math.round(Math.min(Math.max(marginY,Number(position?.y)||marginY),Math.max(marginY,g.vh-groupH-marginY))),dock};
}
function resolveSide(position,g=geometry){const s=controlSize(true,g),gap=8,right=g.vw-(position.x+s.w+gap)-4,left=position.x-gap-4;if(right>=g.bannerW&&left>=g.bannerW)return position.x+s.w/2<=g.vw/2?'right':'left';if(right>=g.bannerW)return'right';if(left>=g.bannerW)return'left';return right>=left?'right':'left'}
function panelPoint(position,side,g=geometry){const s=controlSize(true,g),wanted=side==='right'?position.x+s.w+8:position.x-g.bannerW-8,margin=Math.min(4,Math.max(0,(g.vw-g.bannerW)/2));return{x:Math.round(Math.min(Math.max(margin,wanted),Math.max(margin,g.vw-g.bannerW-margin))),y:position.y}}
function ensurePosition(){const state=STORE.getState(),next=clampPosition(state.position||defaultPosition(),state.expanded);if(!state.position||next.x!==state.position.x||next.y!==state.position.y)STORE.commit({position:next},'clamp');return next}
function paintVariable(node,key,value){if(node?.style.getPropertyValue(key)!==value)node?.style.setProperty(key,value)}
function applyBannerSizing(){
  if(!root||!bannerSizing)return;
  paintVariable(root,'--pmm-mobile-floating-width',bannerSizing.width+'px');
  paintVariable(root,'--pmm-banner-content-scale',String(bannerSizing.scale));
}
function setBannerWidth(width,scale=1){
  if(!Number.isFinite(width)||width<=0||!Number.isFinite(scale)||scale<=0)return;
  bannerSizing={width,scale:Math.min(1,scale)};
  // Cache for late mounts; slider input never writes an inherited document-level variable.
  applyBannerSizing();
}
function paint(position,side){const point=panelPoint(position,side);paintVariable(handle,'--pmm-floating-x',position.x+'px');paintVariable(handle,'--pmm-floating-y',position.y+'px');if(handle.dataset.side!==side)handle.dataset.side=side;if(root){if(root.dataset.side!==side)root.dataset.side=side;paintVariable(root,'--pmm-banner-x',point.x+'px');paintVariable(root,'--pmm-banner-y',point.y+'px');paintVariable(root,'--pmm-banner-max-width',geometry.vw+'px');const overlap=STORE.getState().expanded&&geometry.bannerW+geometry.handleW+16>geometry.vw?(position.x+geometry.handleW/2<=geometry.vw/2?'left':'right'):'none';if(root.dataset.handleOverlap!==overlap)root.dataset.handleOverlap=overlap;paintVariable(root,'--pmm-banner-handle-gutter',geometry.handleW+8+'px')}}
function restorePanelDisplay(){
  if(managedPanel&&managedDisplay&&managedPanel.style.getPropertyPriority('display')==='important'&&managedPanel.style.getPropertyValue('display')===managedDisplay.owned){
    if(managedDisplay.value)managedPanel.style.setProperty('display',managedDisplay.value,managedDisplay.priority);
    else managedPanel.style.removeProperty('display');
  }
  managedPanel=null;managedDisplay=null;
}
function setPanelDisplay(panel,expanded){
  if(panel!==managedPanel){restorePanelDisplay();if(panel){managedPanel=panel;managedDisplay={value:panel.style.getPropertyValue('display'),priority:panel.style.getPropertyPriority('display')}}}
  if(!panel)return;
  const display=expanded?'flex':'none';managedDisplay.owned=display;
  if(panel.style.getPropertyValue('display')!==display||panel.style.getPropertyPriority('display')!=='important')panel.style.setProperty('display',display,'important');
}
function render(){
  renderFrame=0;if(!handle||gesture?.moved)return;
  let state=STORE.getState();
  const panel=root?.querySelector?.(':scope > .panel-wrapper');
  // Never show the expanded handle without a mounted banner alongside it.
  if(state.expanded&&!panel){STORE.update({expanded:false},'banner-unavailable',false);state=STORE.getState()}
  const position=ensurePosition(),side=resolveSide(position);
  setPanelDisplay(panel,state.expanded);
  if(root){root.classList.add('pmm-unified-floating-root');root.classList.toggle('is-expanded',state.expanded);root.classList.toggle('is-hidden',!state.visible)}
  handle.hidden=!state.visible;handle.classList.toggle('is-expanded',state.expanded);handle.setAttribute('aria-expanded',String(state.expanded));
  handle.classList.toggle('is-docked',!state.expanded&&position.dock!=='free');
  if(handle.dataset.dock!==position.dock)handle.dataset.dock=position.dock;
  paint(position,side);
}
function schedule(){if(!renderFrame)renderFrame=TOP.requestAnimationFrame(render)}
function setExpanded(value,reason='toggle'){
  const panel=root?.querySelector?.(':scope > .panel-wrapper');
  const before=STORE.getState(),expanded=Boolean(value)&&Boolean(panel),position=before.position||defaultPosition(),old=controlSize(before.expanded,geometry,position.dock),next=controlSize(expanded,geometry,position.dock);
  const adjusted=clampPosition({x:position.x+(old.w-next.w)/2,y:position.y+(old.h-next.h)/2,dock:position.dock},expanded);
  if(expanded){
    panel.style.removeProperty('animation');
    TOP.__PMM_WINDOW_STACK__?.open('floating',[DOC.getElementById('preset-manager-floating-panel'),handle]);
  }else{
    TOP.__PMM_WINDOW_STACK__?.close('floating');
    handle?.style.removeProperty('z-index');
  }
  STORE.commit({position:adjusted,expanded,side:resolveSide(adjusted)},reason);
  if(renderFrame)TOP.cancelAnimationFrame(renderFrame);render();
  if(expandFrame)TOP.cancelAnimationFrame(expandFrame);expandFrame=0;
  if(expanded)expandFrame=TOP.requestAnimationFrame(()=>{expandFrame=0;measurePanel();schedule()});
}
function openController(source='floating'){const api=TOP.__PMM_LAYOUT_CONTROLLER__;if(typeof api?.open==='function')return api.open(source);TOP.dispatchEvent(new CustomEvent('pmm:open-layout-controller',{detail:{source}}));return false}
async function openMain(source='floating'){for(const doc of docs()){try{const bridge=doc?.__pmmWorkshopOpenBridge;if(typeof bridge?.open==='function'&&(await bridge.open())!==false)return true}catch(_){}}const edit=DOC.querySelector('#preset-manager-floating-panel .panel-action[title="打开编辑面板"]');if(edit){edit.click();return true}return false}
function clearLong(){TOP.clearTimeout(longTimer);longTimer=0}
function blurActiveEditor(){for(const doc of docs()){const active=doc?.activeElement;if(active?.matches?.('input,textarea,select,[contenteditable="true"]'))try{active.blur()}catch(_){}}}
function interactiveTarget(target){return target?.closest?.('button,select,input,textarea,a,[contenteditable="true"],.panel-action,.panel-section,.panel-collapse,.quick-edit-dropdown')}
function onDown(event){
  if(event.isPrimary===false||event.button!=null&&event.button!==0||gesture)return;const fromHandle=event.currentTarget===handle;if(!fromHandle&&interactiveTarget(event.target))return;
  if(fromHandle)blurActiveEditor();const state=STORE.getState(),position=ensurePosition();gesture={id:event.pointerId,fromHandle,target:event.currentTarget,sx:event.clientX,sy:event.clientY,bx:position.x,by:position.y,expanded:state.expanded,panel:state.expanded?root?.querySelector?.(':scope > .panel-wrapper')||null:null,moved:false,longPressed:false,g:{...geometry},size:controlSize(state.expanded,geometry,position.dock),dock:position.dock};
  if(gesture.panel){const point=panelPoint(position,resolveSide(position),geometry);gesture.minDX=Math.max(-position.x,-point.x);gesture.maxDX=Math.min(geometry.vw-position.x-gesture.size.w,geometry.vw-point.x-geometry.bannerW)}
  if(fromHandle&&tapTimer){TOP.clearTimeout(tapTimer);tapTimer=0}
  event.preventDefault();
  if(fromHandle){event.stopPropagation();try{handle.setPointerCapture(event.pointerId)}catch(_){} }
  clearLong();longTimer=TOP.setTimeout(()=>{if(!gesture||gesture.moved)return;gesture.longPressed=true;gesture.suppressClick=true;cancelPendingTap();openController('longpress')},360);
}
function paintDrag(){
  if(!gesture?.moved)return;
  const transform=`translate3d(${gesture.dx}px,${gesture.dy}px,0)`;
  if(gesture.paintedTransform===transform)return;
  gesture.paintedTransform=transform;
  handle.style.setProperty('transform',transform,'important');
  gesture.panel?.style.setProperty('transform',transform,'important');
}
function updateDragPoint(event){
  const samples=event.getCoalescedEvents?.();
  const point=samples?.length?samples[samples.length-1]:event;
  if(!Number.isFinite(point.clientX)||!Number.isFinite(point.clientY))return null;
  const g=gesture.g,s=gesture.size||controlSize(gesture.expanded,g),height=gesture.expanded?Math.max(s.h,g.bannerH):s.h;
  const margin=gesture.dock==='left'||gesture.dock==='right'?0:4;
  gesture.dx=Math.min(Math.max(margin,gesture.bx+point.clientX-gesture.sx),Math.max(margin,g.vw-s.w-margin))-gesture.bx;
  if(gesture.minDX!=null)gesture.dx=Math.min(gesture.maxDX,Math.max(gesture.minDX,gesture.dx));
  const marginY=Math.min(6,Math.max(0,(g.vh-height)/2));
  gesture.dy=Math.min(Math.max(marginY,gesture.by+point.clientY-gesture.sy),Math.max(marginY,g.vh-height-marginY))-gesture.by;
  return point;
}
function onMove(event){
  if(!gesture||(gesture.id!=null&&event.pointerId!==gesture.id))return;
  const point=updateDragPoint(event);
  if(!point||!gesture.moved&&Math.hypot(point.clientX-gesture.sx,point.clientY-gesture.sy)<4)return;
  if(!gesture.moved){
    gesture.moved=true;clearLong();cancelPendingTap();gesture.suppressClick=true;
    TOP.__PMM_THEME_SYSTEM__?.beginInteraction?.('floating');
    handle.classList.add('is-dragging');handle.style.setProperty('transition','none','important');
    if(gesture.panel){root?.classList.add('is-dragging');gesture.panel.style.setProperty('animation','none','important');}
    try{gesture.target.setPointerCapture(event.pointerId)}catch(_){}
  }
  // Only two cached compositor surfaces are written; no frame queue can trail pointerup.
  paintDrag();event.preventDefault();event.stopPropagation();
}
function clearDragPaint(){handle?.classList.remove('is-dragging');if(handle){handle.style.removeProperty('transform');handle.style.removeProperty('transition');}root?.classList.remove('is-dragging');root?.querySelector?.(':scope > .panel-wrapper')?.style.removeProperty('transform')}
function settle(position,g=geometry){
  const expanded=STORE.getState().expanded,s=controlSize(expanded,g),distance=Math.min(72,Math.max(40,g.vw*.08));
  const dock=position.x<distance?'left':g.vw-position.x-s.w<distance?'right':'free';
  const next=clampPosition({...position,dock},expanded,g);
  STORE.commit({position:next,side:resolveSide(next,g)},'drag-end');
}
function cancelPendingTap(){TOP.clearTimeout(tapTimer);tapTimer=0;lastTapAt=0;lastTapPoint=null}
function singleTap(event){const now=Date.now(),near=lastTapPoint&&Math.hypot(event.clientX-lastTapPoint.x,event.clientY-lastTapPoint.y)<22;if(near&&now-lastTapAt<=280){cancelPendingTap();void openMain('doubleclick');return}cancelPendingTap();lastTapAt=now;lastTapPoint={x:event.clientX,y:event.clientY};tapTimer=TOP.setTimeout(()=>{tapTimer=0;lastTapAt=0;lastTapPoint=null;setExpanded(!STORE.getState().expanded,'tap')},300)}
function onUp(event){
  if(!gesture||(gesture.id!=null&&event.pointerId!==gesture.id))return;if(gesture.moved)updateDragPoint(event);const done=gesture;gesture=null;clearLong();try{done.target.releasePointerCapture?.(done.id)}catch(_){}clearDragPaint();
  if(done.moved){TOP.__PMM_THEME_SYSTEM__?.endInteraction?.('floating');if(!done.fromHandle){done.target.__pmmSuppressClick=true;suppressMouseUntil=Date.now()+420}const final={x:done.bx+(done.dx||0),y:done.by+(done.dy||0),dock:'free'};settle(final,done.g);if(renderFrame)TOP.cancelAnimationFrame(renderFrame);renderFrame=0;render();event.preventDefault();event.stopPropagation();return}
  if(done.longPressed){if(!done.fromHandle){done.target.__pmmSuppressClick=true;suppressMouseUntil=Date.now()+420}event.preventDefault();event.stopPropagation();return}
  if(done.fromHandle){handle?.blur?.();if(done.dock&&done.dock!=='free'){cancelPendingTap();setExpanded(!STORE.getState().expanded,'dock-tap')}else singleTap(event);event.preventDefault();event.stopPropagation()}
  else root?.__pmmQuickEntries?.toggle?.()
}
function onCancel(event){if(gesture?.id!=null&&event?.pointerId!=null&&gesture.id!==event.pointerId)return;try{gesture?.target?.releasePointerCapture?.(gesture.id)}catch(_){}gesture=null;TOP.__PMM_THEME_SYSTEM__?.endInteraction?.('floating');clearLong();cancelPendingTap();clearDragPaint();schedule()}
function suppressNativeMouse(event){if(Date.now()>=suppressMouseUntil)return;event.preventDefault();event.stopImmediatePropagation()}
function suppressSyntheticClick(event){
  if(gesture?.suppressClick||event.currentTarget.__pmmSuppressClick){event.preventDefault();event.stopImmediatePropagation();event.currentTarget.__pmmSuppressClick=false;return}
  if(event.target?.closest?.('.panel-section')&&!event.target?.closest?.('select,option,button,input')){event.preventDefault();event.stopImmediatePropagation();root?.__pmmQuickEntries?.open?.()}
}
function installStyle(doc){if(!doc?.head||doc.getElementById(STYLE_ID))return;const style=doc.createElement('style');style.id=STYLE_ID;style.textContent=`
#${HANDLE_ID}{position:fixed;left:var(--pmm-floating-x);top:var(--pmm-floating-y);width:var(--pmm-floating-ball-size,46px);height:var(--pmm-floating-ball-size,46px);z-index:2147483640;display:flex!important;pointer-events:auto!important;align-items:center;justify-content:center;box-sizing:border-box;padding:0;border:1px solid var(--pmm-floating-border,rgba(255,255,255,.42));border-radius:999px;background:var(--pmm-floating-bg,rgba(35,45,58,.82));color:var(--pmm-floating-text,#fff);box-shadow:var(--pmm-floating-shadow,0 10px 30px rgba(0,0,0,.34));backdrop-filter:blur(var(--pmm-floating-blur,20px));-webkit-backdrop-filter:blur(var(--pmm-floating-blur,20px));touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;cursor:grab;transition:width .24s ease,height .24s ease,border-radius .24s ease,opacity .24s ease!important;will-change:transform;contain:layout style paint}#${HANDLE_ID}[hidden]{display:none!important}#${HANDLE_ID}.is-expanded{width:var(--pmm-floating-handle-width,28px);height:var(--pmm-floating-handle-height,64px);border-radius:13px}#${HANDLE_ID}.is-dragging{cursor:grabbing;transition:none!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}#${HANDLE_ID} span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;transition:opacity .18s ease,transform .24s ease}#${HANDLE_ID} .pmm-ball-glyph{font-size:calc(var(--pmm-floating-ball-size,46px)*.41)}#${HANDLE_ID} .pmm-handle-glyph{font-size:var(--pmm-floating-handle-font,14px);opacity:0;transform:rotate(-15deg)}#${HANDLE_ID}.is-expanded .pmm-ball-glyph{opacity:0;transform:rotate(15deg)}#${HANDLE_ID}.is-expanded .pmm-handle-glyph{opacity:1;transform:none}#${HANDLE_ID}[data-side="left"] .pmm-handle-glyph{transform:rotate(180deg)}
#preset-manager-floating-panel{display:block!important;visibility:visible!important;pointer-events:none!important;position:fixed!important;inset:0!important;width:0!important;height:0!important;overflow:visible!important;z-index:2147483000!important}#preset-manager-floating-panel .pmm-unified-floating-root{position:fixed!important;left:0!important;top:0!important;right:auto!important;bottom:auto!important;width:0!important;height:0!important;display:block!important;overflow:visible!important;pointer-events:none!important}#preset-manager-floating-panel .pmm-unified-floating-root>.edge-tab{display:none!important}#preset-manager-floating-panel .pmm-unified-floating-root>.panel-wrapper{position:fixed!important;max-height:min(var(--pmm-floating-max-height,50dvh),calc(100dvh - var(--pmm-banner-y,0px)))!important;left:var(--pmm-banner-x)!important;top:var(--pmm-banner-y)!important;width:min(var(--pmm-mobile-floating-width,50vw),100vw,var(--pmm-banner-max-width,100vw))!important;max-width:100vw!important;box-sizing:border-box!important;display:none!important;pointer-events:auto!important;border:1px solid var(--pmm-floating-border,var(--fp-border-color))!important;border-radius:14px!important;background:var(--pmm-banner-bg,var(--fp-glass-bg))!important;color:var(--pmm-floating-text,var(--fp-text-color))!important;box-shadow:var(--pmm-banner-shadow,var(--pmm-floating-shadow,0 12px 38px rgba(0,0,0,.36)))!important;backdrop-filter:blur(var(--pmm-banner-blur,var(--pmm-floating-blur,20px)))!important;-webkit-backdrop-filter:blur(var(--pmm-banner-blur,var(--pmm-floating-blur,20px)))!important;overflow:hidden!important;will-change:transform}#preset-manager-floating-panel .pmm-unified-floating-root.is-expanded>.panel-wrapper{display:flex!important;animation:pmm-banner-in .24s ease-out both}#preset-manager-floating-panel .pmm-unified-floating-root.is-hidden{display:none!important}#preset-manager-floating-panel .pmm-unified-floating-root.is-dragging>.panel-wrapper{transition:none!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}.pmm-unified-floating-root .panel-header{box-sizing:border-box!important;display:flex!important;align-items:center!important;min-height:42px!important;height:auto!important;padding:8px!important;line-height:1.2!important;overflow:visible!important;touch-action:none}.pmm-unified-floating-root .panel-section{display:flex!important;align-items:center!important;min-width:0!important;min-height:26px!important;overflow:visible!important}.pmm-unified-floating-root .panel-section:has(.panel-select--preset){flex:1 1 130px!important}.pmm-unified-floating-root .panel-section:has(.panel-select--branch){flex:0 1 92px!important}.pmm-unified-floating-root .panel-action{flex:0 0 26px!important;margin:0!important}.pmm-unified-floating-root .panel-divider{flex:0 0 1px!important;margin-inline:1px!important}.pmm-unified-floating-root .panel-collapse{flex:0 0 16px!important}.pmm-unified-floating-root .panel-select{box-sizing:border-box!important;width:100%!important;min-width:0!important;max-width:none!important;height:26px!important;min-height:26px!important;line-height:24px!important;padding-block:0!important;vertical-align:middle!important}.pmm-unified-floating-root .panel-select--preset{min-width:0!important;max-width:none!important;text-overflow:clip!important}.pmm-unified-floating-root .quick-edit-dropdown{max-height:min(var(--pmm-floating-max-height,560px),calc(100dvh - 24px))!important;overflow:hidden!important}.pmm-unified-floating-root .dropdown-content{min-height:180px;max-height:min(calc(var(--pmm-floating-max-height,560px) - 86px),calc(100dvh - 110px));overflow-y:auto!important;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y}.pmm-unified-floating-root .category-content,.pmm-unified-floating-root .prompt-list{display:flex!important;flex-direction:column!important;gap:var(--pmm-floating-item-gap,2px)!important}.pmm-unified-floating-root .category-header__name,.pmm-unified-floating-root .section-header__name{font-size:var(--pmm-floating-group-font,11px)!important}.pmm-unified-floating-root .prompt-item__name{font-size:var(--pmm-floating-name-font,11px)!important;line-height:1.3!important}.pmm-unified-floating-root .prompt-item__content,.pmm-unified-floating-root textarea{font-size:var(--pmm-floating-body-font,11px)!important}.pmm-unified-floating-root .prompt-item:not(.prompt-item--expanded){min-height:var(--pmm-floating-item-height,34px)!important}.pmm-unified-floating-root .prompt-item button,.pmm-unified-floating-root .inline-editor__footer button{width:var(--pmm-floating-button-size,24px)!important;height:var(--pmm-floating-button-size,24px)!important;min-width:var(--pmm-floating-button-size,24px)!important}@keyframes pmm-banner-in{from{opacity:0}to{opacity:1}}@media(pointer:fine){#${HANDLE_ID}{width:var(--pmm-floating-ball-size,42px);height:var(--pmm-floating-ball-size,42px)}#${HANDLE_ID}.is-expanded{width:var(--pmm-floating-handle-width,26px);height:var(--pmm-floating-handle-height,58px)}}@media(prefers-reduced-motion:reduce){#${HANDLE_ID},#${HANDLE_ID} span{transition:none!important}.pmm-unified-floating-root>.panel-wrapper{animation:none!important}}
.pmm-unified-floating-root .panel-header{gap:2px!important;padding-inline:5px!important}
.pmm-unified-floating-root .panel-section:has(.panel-select--preset){flex:1 1 auto!important;min-width:0!important}
.pmm-unified-floating-root .panel-section:has(.panel-select--branch){flex:0 0 64px!important;min-width:64px!important}
.pmm-unified-floating-root .panel-select--preset{display:block!important;flex:1 1 auto!important;min-width:0!important;overflow:hidden!important;white-space:nowrap!important;text-overflow:clip!important}
.pmm-unified-floating-root .panel-select--branch{width:49px!important;min-width:49px!important;max-width:49px!important;padding-inline:2px!important}
.pmm-unified-floating-root .section-icon{flex:0 0 auto!important}
#preset-manager-floating-panel .pmm-unified-floating-root .panel-header{padding-left:18px!important;padding-right:5px!important;align-items:center!important;min-height:44px!important}
#preset-manager-floating-panel .floating-panel-root.pmm-unified-floating-root .panel-section .panel-select{height:28px!important;min-height:28px!important;line-height:normal!important;padding:0 4px!important;margin:0!important;text-align:left!important;text-align-last:left!important;vertical-align:middle!important;appearance:none!important;-webkit-appearance:none!important;text-overflow:clip!important}
#preset-manager-floating-panel .pmm-unified-floating-root>.panel-wrapper{translate:none!important;transform:none!important;transition-property:background-color,color,border-color,box-shadow!important}
/* One bounded column: only the entry list scrolls, so its last item stays reachable. */
#preset-manager-floating-panel .pmm-unified-floating-root>.panel-wrapper{flex-direction:column!important}
#preset-manager-floating-panel .pmm-unified-floating-root .panel-header{flex:0 0 auto!important}
#preset-manager-floating-panel .pmm-unified-floating-root .quick-edit-dropdown{flex:1 1 auto!important;min-height:0!important;max-height:none!important}
#preset-manager-floating-panel .pmm-unified-floating-root .dropdown-content{flex:1 1 auto!important;min-height:0!important;max-height:none!important;overflow-y:auto!important}
#preset-manager-floating-panel .pmm-unified-floating-root :is(.dropdown-header,.search-bar){flex-shrink:0!important}
#${HANDLE_ID}{translate:none!important;transition-property:width,height,border-radius,opacity!important}
#${HANDLE_ID}.is-dragging{transition:none!important;animation:none!important}
@media(pointer:coarse){
#preset-manager-floating-panel .pmm-unified-floating-root .quick-edit-dropdown,
#preset-manager-floating-panel .pmm-unified-floating-root .prompt-item,
#preset-manager-floating-panel .pmm-unified-floating-root .category-group{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;transition:none!important}
}

/* Docked entry uses the compact handle width, sits flush at either edge, and opens immediately. */
html body #${HANDLE_ID}#${HANDLE_ID}.is-docked{width:max(28px,var(--pmm-floating-handle-width,28px))!important;height:max(28px,var(--pmm-floating-handle-width,28px))!important;border-radius:12px!important}
html body #${HANDLE_ID}#${HANDLE_ID}.is-docked:not(.is-dragging){box-shadow:0 2px 8px color-mix(in srgb,var(--pmm-floating-border) 24%,transparent),var(--pmm-theme-highlight)!important}
html body #${HANDLE_ID}#${HANDLE_ID}.is-docked .pmm-ball-glyph{opacity:0}
html body #${HANDLE_ID}#${HANDLE_ID}.is-docked .pmm-handle-glyph{opacity:.9;transform:none!important;font-size:0!important}
html body #${HANDLE_ID}#${HANDLE_ID}.is-docked[data-dock="left"]{border-left:0;border-top-left-radius:3px!important;border-bottom-left-radius:3px!important}
html body #${HANDLE_ID}#${HANDLE_ID}.is-docked[data-dock="right"]{border-right:0;border-top-right-radius:3px!important;border-bottom-right-radius:3px!important}
html body #${HANDLE_ID}#${HANDLE_ID}.is-docked .pmm-handle-glyph::before{content:"";position:static;width:6px;height:6px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(-45deg)}
html body #${HANDLE_ID}#${HANDLE_ID}.is-docked[data-dock="right"] .pmm-handle-glyph::before{transform:rotate(135deg)}
#preset-manager-floating-panel .pmm-unified-floating-root .pmm-entries-toggle{flex:0 0 auto;min-height:32px;padding:3px 6px;border:1px solid var(--pmm-theme-border);border-radius:6px;background:var(--pmm-theme-control);color:var(--pmm-theme-text);font-size:11px;touch-action:manipulation}

/* Scale native text, controls and spacing together; the draggable outer surface stays unzoomed. */
#preset-manager-floating-panel .pmm-unified-floating-root>.panel-wrapper>:is(.panel-header,.quick-edit-dropdown){zoom:var(--pmm-banner-content-scale,1);min-width:0!important}
#preset-manager-floating-panel .pmm-unified-floating-root>.panel-wrapper>.quick-edit-dropdown{max-height:none!important}
#preset-manager-floating-panel .pmm-unified-floating-root[data-handle-overlap="left"]>.panel-wrapper>.panel-header{padding-left:var(--pmm-banner-handle-gutter,36px)!important;min-height:max(44px,var(--pmm-floating-handle-height,64px))!important}
#preset-manager-floating-panel .pmm-unified-floating-root[data-handle-overlap="right"]>.panel-wrapper>.panel-header{padding-right:var(--pmm-banner-handle-gutter,36px)!important;min-height:max(44px,var(--pmm-floating-handle-height,64px))!important}

/* Half-screen phone banners wrap controls without squeezing away the preset name. */
@media(max-width:560px){
#preset-manager-floating-panel .pmm-unified-floating-root .panel-header{flex-wrap:wrap!important}
#preset-manager-floating-panel .pmm-unified-floating-root .panel-section:has(.panel-select--preset){flex:1 1 90px!important}
#preset-manager-floating-panel .pmm-unified-floating-root .dropdown-header{flex-wrap:wrap!important}
}

/* Half-screen defaults; explicit dimensions may fill the whole device viewport. */
#preset-manager-floating-panel .pmm-unified-floating-root>.panel-wrapper.dropdown-open{height:min(var(--pmm-floating-max-height,50dvh),calc(100dvh - var(--pmm-banner-y,0px)))!important}

#preset-manager-floating-panel .pmm-unified-floating-root>.panel-wrapper{max-height:min(var(--pmm-floating-max-height,50dvh),calc(100dvh - var(--pmm-banner-y,0px)))!important}
#preset-manager-floating-panel .pmm-unified-floating-root :is(.category-content,.prompt-list){gap:max(0px,var(--pmm-floating-item-gap,2px))!important}
html.pmm-floating-negative-gap #preset-manager-floating-panel .pmm-unified-floating-root :is(.category-content,.prompt-list)>*+*{margin-top:min(0px,var(--pmm-floating-item-gap,2px))!important}
`;doc.head.appendChild(style);cleanup.push(()=>style.remove())}
function findRoot(){for(const doc of docs()){const found=doc.querySelector?.('#preset-manager-floating-panel .floating-panel-root');if(found)return found}return null}
function watchPanel(){panelResizeObserver?.disconnect();panelResizeObserver=null;const panel=root?.querySelector?.(':scope > .panel-wrapper');if(panel&&typeof TOP.ResizeObserver==='function'){panelResizeObserver=new TOP.ResizeObserver(()=>{if(!gesture){measurePanel();schedule()}});panelResizeObserver.observe(panel)}}
function bindRoot(){const found=findRoot();if(found!==root){root=found;applyBannerSizing();root?.querySelectorAll('.pmm-preset-visible-label').forEach(label=>label.remove());watchPanel();measurePanel();schedule()}const header=root?.querySelector?.(':scope > .panel-wrapper > .panel-header');if(header&&!boundHeaders.has(header)){boundHeaders.add(header);listen(header,'pointerdown',onDown,{capture:true,passive:false});listen(header,'click',suppressSyntheticClick,{capture:true})}if(header&&!header.querySelector('.pmm-entries-toggle')){const button=header.ownerDocument.createElement('button');button.type='button';button.className='pmm-entries-toggle';button.textContent='条目';button.title='展开或收起当前预设条目';button.setAttribute('aria-label',button.title);listen(button,'click',event=>{event.stopPropagation();root?.__pmmQuickEntries?.toggle?.()});header.appendChild(button);cleanup.push(()=>button.remove())}const collapse=root?.querySelector?.(':scope > .panel-wrapper .panel-collapse');if(collapse&&!boundCollapses.has(collapse)){boundCollapses.add(collapse);listen(collapse,'click',()=>TOP.queueMicrotask(()=>setExpanded(false,'collapse')))}}
function installObservers(){
  for(const doc of docs()){
    let mount=null,observedRoot=null,observedPanel=null;
    const relevantNode=node=>node.nodeType===1&&(node.matches?.('#preset-manager-floating-panel,.floating-panel-root,.panel-wrapper,.panel-header,.panel-collapse')||node.querySelector?.('#preset-manager-floating-panel,.floating-panel-root,.panel-wrapper,.panel-header,.panel-collapse'));
    const mountObserver=new MutationObserver(records=>{
      if(records.some(record=>[...record.addedNodes,...record.removedNodes].some(relevantNode)))attach();
    });
    const attach=()=>{
      const next=doc.querySelector('#preset-manager-floating-panel');
      const nextRoot=next?.querySelector('.floating-panel-root')||null;
      const nextPanel=nextRoot?.querySelector(':scope > .panel-wrapper')||null;
      if(next!==mount||nextRoot!==observedRoot||nextPanel!==observedPanel){
        mountObserver.disconnect();mount=next;observedRoot=nextRoot;observedPanel=nextPanel;
        if(mount)mountObserver.observe(mount,{childList:true});
        if(observedRoot)mountObserver.observe(observedRoot,{childList:true});
        if(observedPanel)mountObserver.observe(observedPanel,{childList:true});
      }
      bindRoot();
    };
    const bodyObserver=new MutationObserver(records=>{
      if(records.some(record=>[...record.addedNodes,...record.removedNodes].some(node=>node.nodeType===1&&(node.id==='preset-manager-floating-panel'||node.querySelector?.('#preset-manager-floating-panel')))))attach();
    });
    bodyObserver.observe(doc.body||doc.documentElement,{childList:true});
    attach();cleanup.push(()=>{bodyObserver.disconnect();mountObserver.disconnect()});
  }
}
function onViewportChange(){if(gesture||STORE.getState().keyboardEditing)return;if(resizeFrame)TOP.cancelAnimationFrame(resizeFrame);resizeFrame=TOP.requestAnimationFrame(()=>{resizeFrame=0;refreshViewport();measurePanel();STORE.syncProfile();const next=clampPosition(STORE.getState().position||defaultPosition());STORE.commit({position:next,side:resolveSide(next)},'viewport');schedule()})}
function readGlyph(){try{const saved=JSON.parse(TOP.localStorage?.getItem("pmm_mobile_layout_shared_v2")||"{}");return String(saved?.glyph||"☰").slice(0,4)||"☰"}catch(_){return"☰"}}
function install(){refreshViewport();for(const doc of docs()){installStyle(doc);doc.documentElement?.classList.remove('pmm-mobile-toolbar-ready');doc.getElementById('pm-mobile-fab-standalone')?.remove()}DOC.getElementById(HANDLE_ID)?.remove();handle=DOC.createElement('button');handle.id=HANDLE_ID;handle.type='button';handle.tabIndex=-1;handle.setAttribute('aria-label','预设悬浮入口：单击展开，双击打开主界面，长按打开中控');handle.innerHTML="<span class=\"pmm-ball-glyph\" aria-hidden=\"true\"></span><span class=\"pmm-handle-glyph\" aria-hidden=\"true\">‹</span>";handle.querySelector(".pmm-ball-glyph").textContent=readGlyph();DOC.body.appendChild(handle);cleanup.push(()=>handle?.remove());listen(handle,'pointerdown',onDown,{passive:false});listen(handle,'click',event=>{event.preventDefault();event.stopImmediatePropagation();handle?.blur?.()},{capture:true,passive:false});listen(TOP,'pointermove',onMove,{capture:true,passive:false});listen(TOP,'pointerup',onUp,{capture:true,passive:false});listen(TOP,'pointercancel',onCancel,{capture:true,passive:true});listen(DOC,'mouseup',suppressNativeMouse,{capture:true,passive:false});listen(TOP,"pmm:floating-glyph-change",event=>{const glyph=handle?.querySelector(".pmm-ball-glyph");if(glyph){const value=String(event?.detail?.glyph||"☰").slice(0,4);if(glyph.textContent!==value)glyph.textContent=value}});listen(TOP,'pmm:floating-metrics-change',()=>{refreshViewport();const state=STORE.getState(),position=clampPosition(state.position||defaultPosition(),state.expanded);STORE.commit({position,side:resolveSide(position)},'metrics',false);schedule()});listen(TOP,'resize',onViewportChange,{passive:true});listen(TOP,'orientationchange',()=>{TOP.clearTimeout(orientationTimer);orientationTimer=TOP.setTimeout(()=>{orientationTimer=0;onViewportChange()},160)},{passive:true});cleanup.push(STORE.subscribe((_state,reason)=>{if(reason!=='drag-frame')schedule()}));installObservers();bindRoot();render();if(STORE.getState().expanded)TOP.__PMM_WINDOW_STACK__?.open('floating',[DOC.getElementById('preset-manager-floating-panel'),handle])}
const API=Object.freeze({getState:STORE.getState,setBannerWidth,setVisible(value){const visible=Boolean(value);try{TOP.localStorage?.setItem('pmm_mobile_fab_visible_v1',visible?'1':'0')}catch(_){}STORE.update({visible},'visibility')},setExpanded,toggle(){setExpanded(!STORE.getState().expanded,'toggle')},openController,resetPosition(){const position=defaultPosition();STORE.commit({position,side:resolveSide(position)},'reset-position')},destroy(){onCancel();TOP.__PMM_WINDOW_STACK__?.close('floating');cancelPendingTap();clearLong();if(expandFrame)TOP.cancelAnimationFrame(expandFrame);expandFrame=0;restorePanelDisplay();if(renderFrame)TOP.cancelAnimationFrame(renderFrame);if(resizeFrame)TOP.cancelAnimationFrame(resizeFrame);TOP.clearTimeout(orientationTimer);orientationTimer=0;panelResizeObserver?.disconnect();while(cleanup.length)try{cleanup.pop()()}catch(_){}root?.classList.remove('pmm-unified-floating-root','is-expanded','is-hidden','is-dragging');if(root){delete root.dataset.handleOverlap;root.style.removeProperty('--pmm-banner-handle-gutter')}delete TOP[API_KEY]}});
TOP[API_KEY]=API;globalThis[API_KEY]=API;install();if(handle){handle.oncontextmenu=event=>{event.preventDefault();event.stopPropagation();return false};handle.onselectstart=()=>false}export default API;
