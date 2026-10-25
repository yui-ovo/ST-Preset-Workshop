import assert from 'node:assert/strict';
import {createRuntimeScope} from '../dist/runtime-resources.js';
const self = new EventTarget(); self.Event=Event; self.parent={};
const scope=createRuntimeScope(self), target=new EventTarget();
let ours=0, other=0;
const cb=()=>ours++;
target.addEventListener('ping',()=>other++);
scope.own(target).addEventListener('ping',cb);
scope.own(target).addEventListener('ping',cb); // native deduplication is retained
assert.equal(scope.stats().listeners,1);
target.dispatchEvent(new Event('ping'));assert.equal(ours,1);assert.equal(other,1);
const timerCalls=[], pending=new Map();
const clock={
  setTimeout(fn){pending.set('timer',fn);return 1;},requestAnimationFrame(fn){pending.set('frame',fn);return 1;},
  clearTimeout(id){timerCalls.push(['timer',id]);},cancelAnimationFrame(id){timerCalls.push(['frame',id]);},
};
scope.own(clock).setTimeout(()=>ours++,100);scope.own(clock).requestAnimationFrame(()=>ours++);
assert.equal(scope.stats().timers,2,'Frames and timers may return the same numeric ID');
let disconnected=0;
const observer={observe(){},disconnect(){disconnected++;}};scope.own(observer).observe({});
const globals={cleanup(){disconnected++;}};self.parent.__PMM_TEST__=globals;
scope.dispose();scope.dispose();
assert.deepEqual(scope.stats(),{listeners:0,observers:0,timers:0,emitters:0});
assert.equal(disconnected,2);assert.equal(self.parent.__PMM_TEST__,undefined);
assert.deepEqual(timerCalls,[['timer',1],['frame',1]]);
target.dispatchEvent(new Event('ping'));assert.equal(ours,1);assert.equal(other,2);
for(const cb of pending.values())cb();assert.equal(ours,1,'Queued callbacks cannot restart a disposed runtime');
scope.own(target).addEventListener('ping',cb);assert.equal(scope.stats().listeners,0);
console.log('Runtime resources: independent listeners, deduplication, timer-ID collisions, observers, late callbacks and idempotent cleanup passed');
