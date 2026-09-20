import assert from 'node:assert/strict';
import fs from 'node:fs';
import {workshopFixture} from './lib/workshop-browser-fixture.mjs';
import {browserPage} from './lib/browser-cdp.mjs';

const fixture=await workshopFixture(),page=await browserPage();
const report={version:JSON.parse(fs.readFileSync(new URL('../manifest.json',import.meta.url))).version,gestures:[],skins:[]};
const errors=[];
page.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description||e.exceptionDetails.text));
const viewports=[['phone portrait',390,844,true],['phone landscape',844,390,true],['tablet portrait',800,1100,true],['tablet landscape',1100,800,true],['desktop',1440,1024,false]];
const settle=()=>page.evaluate(async()=>{await new Promise(r=>setTimeout(r,400));});
try{
  for(const [name,width,height,touch] of viewports){
    await page.viewport(width,height,touch);await page.goto(fixture.url);await settle();
    await page.evaluate(()=>{
      const handle=document.getElementById('pmm-unified-floating-handle');
      window.dockTest={
        api:__PMM_FLOATING_CONTROLLER__,store:__PMM_FLOATING_STORE__,handle,
        async frame(){await new Promise(requestAnimationFrame);},
        event(type,x,y){(type==='pointerdown'?handle:window).dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,isPrimary:true,pointerId:57,pointerType:'touch',button:0,buttons:type==='pointerup'?0:1,clientX:x,clientY:y}));},
        box(){const r=handle.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};},
        async dock(side,ball){this.api.setExpanded(false);document.documentElement.style.setProperty('--pmm-floating-ball-size',ball+'px');window.dispatchEvent(new CustomEvent('pmm:floating-metrics-change'));this.store.setPosition({x:0,y:100,dock:side});await this.frame();await this.frame();await new Promise(r=>setTimeout(r,180));}
      };
    });
    for(const side of ['left','right'])for(const ball of [46,96]){
      const result=await page.evaluate(async({side,ball})=>{
        const t=dockTest;await t.dock(side,ball);
        const original=t.box(),sx=original.x+original.width/2,sy=original.y+original.height/2,sign=side==='left'?1:-1;
        const style=getComputedStyle(document.documentElement),coarse=matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0;
        const expectedExpanded={width:parseFloat(style.getPropertyValue('--pmm-floating-handle-width'))||(coarse?28:26),height:parseFloat(style.getPropertyValue('--pmm-floating-handle-height'))||(coarse?64:58)};
        const originalPosition=JSON.stringify(t.store.getState().position);
        t.event('pointerdown',sx,sy);
        const reads={rect:0,computed:0,storage:0},rect=Element.prototype.getBoundingClientRect,computed=window.getComputedStyle,set=Storage.prototype.setItem;
        Element.prototype.getBoundingClientRect=function(...args){reads.rect++;return rect.apply(this,args);};
        window.getComputedStyle=function(...args){reads.computed++;return computed.apply(this,args);};
        Storage.prototype.setItem=function(...args){reads.storage++;return set.apply(this,args);};
        let vertical,small,detached,previewUncommitted;
        try{
          t.event('pointermove',sx,sy+20);await t.frame();vertical=t.handle.classList.contains('is-docked');
          t.event('pointermove',sx+sign*7,sy+20);await t.frame();small=t.handle.classList.contains('is-docked');
          t.event('pointermove',sx+sign*10,sy+20);await t.frame();detached=!t.handle.classList.contains('is-docked');
          previewUncommitted=JSON.stringify(t.store.getState().position)===originalPosition;
        }finally{Element.prototype.getBoundingClientRect=rect;window.getComputedStyle=computed;Storage.prototype.setItem=set;}
        const preview=t.box();
        t.event('pointerup',sx+sign*10,sy+20);await t.frame();
        const released={...t.store.getState().position},releasedBox=t.box();
        // A cancelled inward preview must restore the dock and its persisted position.
        await t.dock(side,ball);const saved=JSON.stringify(t.store.getState().position),b=t.box(),x=b.x+b.width/2,y=b.y+b.height/2;
        t.event('pointerdown',x,y);t.event('pointermove',x+sign*10,y);await t.frame();t.event('pointercancel',x+sign*10,y);await t.frame();
        const cancelled=t.handle.classList.contains('is-docked')&&JSON.stringify(t.store.getState().position)===saved;
        // The same gesture can deliberately return to the edge and dock again.
        t.event('pointerdown',x,y);t.event('pointermove',x+sign*30,y);await t.frame();
        const edge=side==='left'?2:document.documentElement.clientWidth-2;
        t.event('pointermove',edge,y);t.event('pointerup',edge,y);await t.frame();const redocked=t.store.getState().position.dock;
        // Edge taps retain their immediate opening behavior and the expanded handle size.
        const d=t.box();t.event('pointerdown',d.x+d.width/2,d.y+20);t.event('pointerup',d.x+d.width/2,d.y+20);await t.frame();
        const opened=t.api.getState().expanded,expanded=t.box();t.api.setExpanded(false);await t.frame();
        return{original,vertical,small,detached,previewUncommitted,preview,released,releasedBox,reads,cancelled,redocked,opened,expanded,expectedExpanded};
      },{side,ball});
      assert.equal(result.original.width,touch?16:14);assert.equal(result.original.height,42);
      assert(result.vertical&&result.small,'Vertical movement and less than 8px inward movement retain the edge tab');
      assert(result.detached&&result.previewUncommitted,'An inward 10px gesture restores the ball before release, without committing state');
      assert.equal(result.preview.width,ball);assert.equal(result.preview.height,ball);
      assert.equal(result.released.dock,'free','A short inward release cannot snap the newly enlarged ball back');
      assert(result.releasedBox.x>=0&&result.releasedBox.right<=width&&result.releasedBox.bottom<=height);
      assert.deepEqual(result.reads,{rect:0,computed:0,storage:0});
      assert(result.cancelled&&result.opened);assert.equal(result.redocked,side);
      assert.equal(result.expanded.width,result.expectedExpanded.width);assert.equal(result.expanded.height,result.expectedExpanded.height);
      report.gestures.push({name,side,ball,...result});
    }
    // After release, reload must retain the free state, including the position near the edge.
    const saved=await page.evaluate(async()=>{
      const t=dockTest;await t.dock('right',46);const r=t.box(),x=r.x+r.width/2,y=r.y+20;
      t.event('pointerdown',x,y);t.event('pointermove',x-10,y);t.event('pointerup',x-10,y);await t.frame();
      await new Promise(r=>setTimeout(r,300));return t.api.getState().position;
    });
    await page.goto(fixture.url);await settle();
    assert.deepEqual(await page.evaluate(()=>__PMM_FLOATING_CONTROLLER__.getState().position),saved,'Reload preserves the freed position');
    // Only the dock gets the native edge material proportions; skin tokens keep their owner.
    for(const skin of ['aqua','glass','violet','native'])for(const tone of ['light','dark']){
      const result=await page.evaluate(async({skin,tone})=>{
        const api=__PMM_FLOATING_CONTROLLER__,store=__PMM_FLOATING_STORE__,el=document.getElementById('pmm-unified-floating-handle');
        __PMM_THEME_SYSTEM__.setTheme(skin);__PMM_THEME_SYSTEM__.setTone(tone);api.setExpanded(false);store.setPosition({x:120,y:100,dock:'free'});
        await new Promise(r=>setTimeout(r,400));
        // Inspect settled material; shape transition clock timing is tested separately from gesture response.
        const sample=()=>{for(const animation of el.getAnimations())if(animation.transitionProperty==='opacity'||animation.transitionProperty?.endsWith('-radius'))animation.finish();const c=getComputedStyle(el);return{width:c.width,height:c.height,background:c.background,color:c.color,borderColor:c.borderTopColor,blur:c.backdropFilter,shadow:c.boxShadow,opacity:c.opacity,radii:[c.borderTopLeftRadius,c.borderTopRightRadius,c.borderBottomRightRadius,c.borderBottomLeftRadius]};};
        const free=sample();store.setPosition({x:0,y:100,dock:'right'});await new Promise(r=>setTimeout(r,300));const dock=sample();
        store.setPosition({x:120,y:100,dock:'free'});await new Promise(r=>setTimeout(r,300));return{free,dock,restored:sample()};
      },{skin,tone});
      assert.equal(result.dock.width,(touch?16:14)+'px');assert.equal(result.dock.height,'42px');
      assert.deepEqual(result.dock.radii,['8px','0px','0px','8px']);assert.equal(result.dock.opacity,touch?'0.58':'0.85');
      for(const key of ['background','color','borderColor'])assert.equal(result.dock[key],result.free[key],`Dock ${key} continues following the ${skin}/${tone} skin`);
      assert.deepEqual(result.restored,result.free,'Returning to the ball restores its original appearance');
      report.skins.push({name,skin,tone,...result});
    }
    console.log('Floating dock passed:',name);
  }
  assert.deepEqual(errors,[]);
  if(process.env.PMM_BROWSER_REPORT)fs.writeFileSync(process.env.PMM_BROWSER_REPORT,JSON.stringify(report,null,2)+'\n');
  console.log('Floating dock browser passed: short inward detach, release/reload, cancel, redock, immediate opening, native edge shape, skin follow and zero gesture reads.');
}finally{await page.close();await fixture.close();}
