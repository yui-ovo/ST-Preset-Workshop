import fs from 'node:fs';
import vm from 'node:vm';
import {createServer} from 'node:http';
// The served page has a separate origin and never loads or writes Tavern user data.
export async function workshopFixture({themeSource=null,floatingSource=null,entries=1,layoutSource=null,transformHTML=null}={}){
const read=f=>fs.readFileSync(new URL('../../'+f,import.meta.url),'utf8');
const workshop=read('dist/workshop-v3.02.js');
const css=[...workshop.matchAll(/\.push\(\[e\.id,('(?:\\.|[^'\\])*'),''/g)].map(m=>vm.runInNewContext(m[1])).join('\n');
const start=workshop.indexOf('/* ===== PMM_MOBILE_LAYOUT_TUNER_V1'),end=workshop.indexOf('/* ===== PMM_FLOATING_PANEL_BATCH_V1',start);
const routes=new Map([['/native.css',css],['/layout.js',layoutSource||workshop.slice(start,end)],['/theme.js',themeSource || read('dist/workshop-theme-system.js')]]);
for(const file of ['workshop-floating-store.js','workshop-floating-controller.js'])routes.set('/'+file,file==='workshop-floating-controller.js'&&floatingSource?floatingSource:read('dist/'+file));
// Real shipped native CSS, independent layout controller and theme module; no Tavern user data.
let html=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/native.css"><style>
body{margin:0;background:#eee;--SmartThemeBlurTintColor:#eee;--SmartThemeBodyColor:#17202b}
#preset-manager-main-panel{position:relative!important;width:100%!important;height:350px!important}
.preset-panel{position:relative!important;width:100%!important;height:300px!important}
#preset-manager-floating-panel{position:relative!important;top:0!important;left:0!important;width:300px!important}
.panel-wrapper{position:relative!important;width:300px!important;height:100px!important}
</style><div id="preset-manager-main-panel"><div class="preset-panel"><header class="pm-header"><div class="header-card"><button class="theme-btn">日夜</button><button class="action-card">保存</button></div></header>${`<div class="stress-list" style="overflow:auto;min-height:0;height:180px">${Array.from({length:entries},(_,i)=>`<div class="prompt-card"><span class="prompt-card__name">条目 ${i}</span><button class="prompt-item__role">系统</button><span class="prompt-item__name">测试内容</span></div>`).join('')}</div>`}<textarea class="prompt-editor__textarea" data-v-01bebc6e>可读正文</textarea></div></div>
<div id="preset-manager-floating-panel"><div class="floating-panel-root"><div class="panel-wrapper" style="display:none"><div class="panel-header">
<div class="panel-action" title="打开编辑面板"><i class="fa-solid fa-edit"></i></div><div class="panel-divider"></div>
<div class="panel-section"><i class="fa-solid fa-sliders section-icon" title="预设"></i><span class="pmm-preset-name-field"><select class="panel-select panel-select--preset" title="选择预设"><option value="诸神黄昏2.17">诸神黄昏2.17</option></select><span class="pmm-preset-name-text" aria-hidden="true">诸神黄昏2.17</span></span></div>
<div class="panel-section"><i class="fa-solid fa-code-branch section-icon" title="分支"></i><select class="panel-select panel-select--branch"><option>默认</option></select></div><div class="panel-collapse"><i></i></div>
</div><div class="quick-edit-dropdown" style="display:none"><div class="dropdown-content">条目列表</div></div></div></div></div>
<script>window.pmmTopNotificationsEnabled=()=>false;window.pmmSetTopNotificationsEnabled=()=>{};localStorage.setItem('pmm_visual_theme_v1','aqua');localStorage.setItem('preset-manager-theme-mode','light');</script><script type="module" src="/layout.js"></script><script type="module" src="/workshop-floating-store.js"></script><script type="module" src="/theme.js"></script><script type="module" src="/workshop-floating-controller.js"></script>`;
if(transformHTML)html=transformHTML(html);
const server=createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(routes.get(p)||html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
return{url:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(r=>{server.close(r);server.closeAllConnections();})};
}
