const TOP = (() => { try { return window.top || window; } catch (_) { return window; } })();
const API_KEY = '__PMM_FLOATING_STORE__';
const STORAGE_KEY = 'pmm_floating_state_v1';
const LEGACY_KEY = 'pmui_v5';
const LEGACY_MIGRATION_KEY = 'pmm_floating_legacy_migrated_v1';

function profileForViewport() {
  const width=Math.max(1,Number(TOP.innerWidth||1)),height=Math.max(1,Number(TOP.innerHeight||1));
  const coarse=Boolean(TOP.matchMedia?.('(pointer: coarse)')?.matches)||Number(TOP.navigator?.maxTouchPoints||0)>0;
  return `${coarse?(Math.min(width,height)>=600?'tablet':'phone'):'desktop'}-${width>height?'landscape':'portrait'}`;
}
function readJson(key){try{return JSON.parse(TOP.localStorage?.getItem(key)||'null')}catch(_){return null}}
function initialState(){
  const saved=readJson(STORAGE_KEY)||{};let existingVisibility=true;
  try{existingVisibility=TOP.localStorage?.getItem('pmm_mobile_fab_visible_v1')!=='0'}catch(_){}
  const profiles=saved.profiles&&typeof saved.profiles==='object'?saved.profiles:{};let legacy=null;
  try{if(TOP.localStorage?.getItem(LEGACY_MIGRATION_KEY)!=='1'){legacy=readJson(LEGACY_KEY);TOP.localStorage?.setItem(LEGACY_MIGRATION_KEY,'1')}}catch(_){}
  const profile=profileForViewport();
  if(!profiles[profile]&&legacy&&Number.isFinite(Number(legacy.hx))&&Number.isFinite(Number(legacy.hy)))profiles[profile]={x:Number(legacy.hx),y:Number(legacy.hy),dock:'free'};
  return{version:1,visible:saved.visible==null?existingVisibility&&legacy?.vis!==0:saved.visible!==false,expanded:Boolean(saved.expanded),position:profiles[profile]||null,side:saved.side==='left'?'left':'right',profile,profiles,gesture:'idle',keyboardEditing:false};
}
function createStore(){
  let state=initialState();const listeners=new Set();let saveTimer=0;
  const snapshot=()=>({...state,position:state.position?{...state.position}:null});
  const cleanPosition=position=>({x:Number(position?.x)||0,y:Number(position?.y)||0,dock:['left','right'].includes(position?.dock)?position.dock:'free'});
  function persistSoon(){TOP.clearTimeout(saveTimer);saveTimer=TOP.setTimeout(()=>{try{TOP.localStorage?.setItem(STORAGE_KEY,JSON.stringify({version:1,visible:state.visible,expanded:state.expanded,side:state.side,profiles:state.profiles}))}catch(_){}},120)}
  function emit(reason){const value=snapshot();for(const listener of listeners)try{listener(value,reason)}catch(error){console.error('[预设工坊][FloatingStore]',error)}}
  function update(patch,reason='update',persist=true){const next=typeof patch==='function'?patch(snapshot()):patch;if(!next||typeof next!=='object')return snapshot();state={...state,...next};if(persist)persistSoon();emit(reason);return snapshot()}
  function commit(patch,reason='commit',persist=true){
    const next={...patch};
    if(next.position){const position=cleanPosition(next.position);next.position=position;next.profiles={...state.profiles,[state.profile]:position}}
    state={...state,...next};if(persist)persistSoon();emit(reason);return snapshot();
  }
  function setPosition(position,reason='position',persist=true){if(!position)return snapshot();return commit({position},reason,persist)}
  function syncProfile(){const profile=profileForViewport();if(profile===state.profile)return snapshot();state={...state,profile,position:state.profiles[profile]||null,gesture:'idle'};emit('profile');return snapshot()}
  return Object.freeze({getState:snapshot,update,commit,setPosition,syncProfile,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener)},destroy(){TOP.clearTimeout(saveTimer);listeners.clear()}});
}
try{TOP[API_KEY]?.destroy?.()}catch(_){}
TOP[API_KEY]=createStore();globalThis[API_KEY]=TOP[API_KEY];export default TOP[API_KEY];
