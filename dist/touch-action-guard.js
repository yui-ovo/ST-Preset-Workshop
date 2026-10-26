import {runtimeResource as own} from './runtime-resources.js';

// Touch has no hover: a hidden toolbar must be revealed by a completed tap
// before a later tap can execute one of its actions. Mouse/keyboard stay native.
export function installTouchActionGuard(host) {
  const key='__PMM_TOUCH_ACTION_GUARD__', doc=host.document;
  host[key]?.cleanup?.();
  const cards='.prompt-card,.prompt-item,.section-header,.category-header';
  const areas='.prompt-card__actions,.prompt-item__actions,.section-header__actions,.category-header__actions';
  const root='#preset-manager-main-panel';
  const style=own(doc).createElement('style');
  style.textContent=`html[data-pmm-touch-tools] ${root} :is(${areas}){opacity:0!important}
    html[data-pmm-touch-tools] ${root} :is(${areas})[data-pmm-tools-shown]{opacity:1!important;visibility:visible!important}
    html[data-pmm-touch-tools] ${root} .prompt-card > .prompt-card__actions[data-pmm-tools-shown],
    html[data-pmm-touch-tools] ${root} .prompt-card > .prompt-card__actions[data-pmm-tools-shown] > .prompt-card__action{display:flex!important;visibility:visible!important;pointer-events:auto!important}
    html[data-pmm-touch-tools] ${root} .prompt-card--favorited > .prompt-card__actions{opacity:1!important}
    html[data-pmm-touch-tools] ${root} .prompt-card--favorited > .prompt-card__actions:not([data-pmm-tools-shown]) > .prompt-card__action:not(.prompt-card__action--favorited){visibility:hidden!important;pointer-events:none!important}
    html[data-pmm-touch-tools] ${root} .prompt-card__action--favorite:not([aria-pressed="true"]){background:transparent!important;border-color:var(--pm-border,transparent)!important}
    html[data-pmm-touch-tools] ${root} .prompt-card__action--favorite:not([aria-pressed="true"]) i{color:var(--pm-text-secondary)!important;opacity:.6!important}`;
  own(doc.head).append(style);
  if(host.matchMedia('(hover:none), (pointer:coarse)').matches) doc.documentElement.setAttribute('data-pmm-touch-tools','');
  let shown=[], activeCard=null, gesture=null, pending=null;
  const cardFor=target=>target?.closest?.(root)?target.closest(cards):null;
  const toolFor=target=>target?.closest?.(areas);
  function clear() {
    for(const area of shown) area.removeAttribute('data-pmm-tools-shown');
    shown=[];activeCard=null;
  }
  function reveal(card) {
    if(activeCard===card)return;
    clear();activeCard=card;
    shown=Array.from(card.querySelectorAll(areas)).filter(area=>area.closest(cards)===card);
    for(const area of shown) area.setAttribute('data-pmm-tools-shown','');
  }
  function block(event) {event.preventDefault();event.stopImmediatePropagation();}
  function hiddenQuickToggleOverlap(card,target,point) {
    if(!card.closest(root)?.classList.contains('pmm-mobile-layout-enabled'))return false;
    const rect=card.getBoundingClientRect(),width=host.__PMM_MOBILE_QUICK_TOGGLE_TEST72__?.HOT_ZONE_WIDTH || 72;
    if(point.x<rect.right-width || point.x>rect.right || point.y<rect.top || point.y>rect.bottom)return false;
    const toggle=host.__PMM_MOBILE_QUICK_TOGGLE_TEST72__?.toggleFor(card);
    if(!toggle)return false;
    const hit=toggle.getBoundingClientRect();
    // Keep the real visible switch one-tap. The extra blank hot zone overlaps
    // the star's future position while the mobile toolbar is display:none.
    if(toggle.contains(target) || (hit.width>0 && point.x>=hit.left && point.x<=hit.right && point.y>=hit.top && point.y<=hit.bottom))return false;
    return Array.from(card.querySelectorAll(areas)).some(area=>{
      const css=host.getComputedStyle(area);
      return area.closest(cards)===card && (css.display==='none' || Number(css.opacity)<.99);
    });
  }
  function start(event,point,id) {
    pending=null;gesture=null;
    doc.documentElement.setAttribute('data-pmm-touch-tools','');
    const card=cardFor(event.target), area=toolFor(event.target);
    if(card!==activeCard)clear();
    if(!card || card.matches('.prompt-card--expanded'))return;
    const ready=area && (event.target.closest('.prompt-card__action--favorited') || (activeCard===card && area.hasAttribute('data-pmm-tools-shown'))) && Number(host.getComputedStyle(area).opacity)>=.99;
    gesture={id,card,area,start:point,firstReveal:activeCard!==card,blocked:(!!area&&!ready)||(!area&&hiddenQuickToggleOverlap(card,event.target,point)),moved:false};
    // Do not stop touch scrolling, or the always-visible toggle outside actions.
    if(gesture.blocked)event.stopImmediatePropagation();
  }
  function move(point,id) {
    if(gesture?.id!==id)return;
    if(Math.hypot(point.x-gesture.start.x,point.y-gesture.start.y)>10){gesture.moved=true;clear();}
  }
  function end(event,point,id,cancelled=false) {
    if(gesture?.id!==id)return;
    move(point,id);
    const current=gesture;gesture=null;
    if(cancelled || current.moved) {
      clear();
      if(current.area)pending={card:current.card,until:Date.now()+1000};
      return;
    }
    reveal(current.card);
    if(current.blocked){pending={card:current.card,until:Date.now()+1000};block(event);}
    else if(current.firstReveal && !current.area)pending={card:current.card,onlyTools:true,until:Date.now()+1000};
  }
  const point=event=>({x:event.clientX,y:event.clientY});
  const down=event=>{
    if(event.pointerType==='mouse'){clear();gesture=pending=null;doc.documentElement.removeAttribute('data-pmm-touch-tools');return;}
    if(!['touch','pen'].includes(event.pointerType))return;
    if(event.isPrimary===false){if(gesture)gesture.moved=true;clear();return;}
    start(event,point(event),event.pointerId);
  };
  const moving=event=>{
    if(event.pointerType==='mouse' && !gesture){clear();pending=null;doc.documentElement.removeAttribute('data-pmm-touch-tools');return;}
    move(point(event),event.pointerId);
  };
  const up=event=>end(event,point(event),event.pointerId);
  const cancel=event=>end(event,point(event),event.pointerId,true);
  const touchStart=event=>{
    if('PointerEvent' in host)return;
    if(event.touches.length!==1){if(gesture)gesture.moved=true;clear();return;}
    const touch=event.changedTouches[0];start(event,point(touch),touch.identifier);
  };
  const touchMove=event=>{if(!('PointerEvent' in host))for(const touch of event.changedTouches)move(point(touch),touch.identifier);};
  const touchEnd=event=>{if(!('PointerEvent' in host))for(const touch of event.changedTouches)end(event,point(touch),touch.identifier,event.type==='touchcancel');};
  const click=event=>{
    if(!event.isTrusted || !event.detail)return;
    const card=cardFor(event.target),area=toolFor(event.target);
    if(pending && Date.now()<pending.until && pending.card===card && (!pending.onlyTools||area)){block(event);pending=null;return;}
    if(doc.documentElement.hasAttribute('data-pmm-touch-tools') && area && card &&
      !event.target.closest('.prompt-card__action--favorited') &&
      (activeCard!==card || Number(host.getComputedStyle(area).opacity)<.99)){
      block(event);reveal(card);
    }
  };
  const scroll=()=>{if(gesture){gesture.moved=true;clear();}};
  const bindings=[['pointerdown',down],['pointermove',moving],['pointerup',up],['pointercancel',cancel],
    ['touchstart',touchStart],['touchmove',touchMove],['touchend',touchEnd],['touchcancel',touchEnd],['click',click],['scroll',scroll]];
  // Window capture runs before the legacy document-level quick-toggle hot zone.
  for(const [type,handler] of bindings)own(host).addEventListener(type,handler,{capture:true,passive:false});
  function cleanup(){
    for(const [type,handler] of bindings)own(host).removeEventListener(type,handler,true);
    clear();gesture=pending=null;style.remove();doc.documentElement.removeAttribute('data-pmm-touch-tools');
    if(host[key]?.cleanup===cleanup)delete host[key];
  }
  host[key]={cleanup};
}
