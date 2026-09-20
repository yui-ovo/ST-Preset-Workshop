import fs from 'node:fs';
import {workshopFixture} from './workshop-browser-fixture.mjs';
export async function phonePerformanceFixture({entries=300,themeSource=null,layoutSource=null}={}){
  const source=fs.readFileSync(new URL('../../dist/workshop-v3.02.js',import.meta.url),'utf8');
  for(const selector of ['.preset-panel[data-v-71128760]','.prompt-card[data-v-3e8fd3dc]','.prompt-editor__textarea[data-v-01bebc6e]'])if(!source.includes(selector))throw Error('Native scoped selector changed: '+selector);
  const marker=source.indexOf('/* ===== 5. 双屏模式'),start=source.lastIndexOf('`',marker),end=source.indexOf('`',marker);
  const mobileCSS=source.slice(start+1,end);
  if(mobileCSS.includes('${')||!mobileCSS.includes('grid-template-rows:'))throw Error('Native mobile CSS extraction changed');
  const panel=index=>`<section class="preset-panel" data-v-71128760><header class="pm-header" data-v-71128760><div class="header-card"><button class="theme-btn" title="黑色">日夜</button><button class="action-card">保存</button></div></header><div class="pm-content" data-v-71128760><div class="prompt-panel__list stress-list">${Array.from({length:entries},(_,i)=>`<div class="prompt-item" data-v-d8d679d6><div class="prompt-card" data-v-3e8fd3dc><span class="prompt-card__name" data-v-3e8fd3dc>面板 ${index} 条目 ${i}</span><button class="prompt-card__role" data-v-3e8fd3dc>系统</button></div></div>`).join('')}<textarea class="prompt-editor__textarea" data-v-01bebc6e>保留的正文草稿</textarea></div></div></section>`;
  return workshopFixture({themeSource,layoutSource,transformHTML:html=>{
    const a=html.indexOf('<div id="preset-manager-main-panel">'),b=html.indexOf('<div id="preset-manager-floating-panel">',a);
    html=html.slice(0,a)+`<div id="preset-manager-main-panel"><div class="pm-panel-container pm-panel-container--merge-mode"><div class="pm-main-wrapper">${panel(1)}<div class="side-panel-root"><div class="side-panel"><div class="side-panel-content">工具栏</div></div></div></div>${panel(2)}</div></div>\n`+html.slice(b);
    html=html.replace('.preset-panel{position:relative!important;width:100%!important;height:300px!important}','').replace('#preset-manager-main-panel{position:relative!important;width:100%!important;height:350px!important}','');
    return html.replace('<link rel="stylesheet" href="/native.css">',`<link rel="stylesheet" href="/native.css"><style id="pmm-fixture-native-mobile">${mobileCSS}</style><style>html,body{height:100%;margin:0}.stress-list{overflow:auto;min-height:0;flex:1}.prompt-item{flex:none}</style>`);
  }});
}
