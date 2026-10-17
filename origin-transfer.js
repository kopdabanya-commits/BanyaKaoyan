/* One-time, same-browser copy from the existing Worker to the ECS fallback.
   No records or credentials are sent to GitHub, URLs, or server logs. */
(function(root){'use strict';
const SOURCE='https://english-ii-plan.kopdabanya.workers.dev';
const DEST='https://124.70.128.201';
const RECORDS=['yantu_english_2026_m1','yantu_politics_2026_v1'];
const KEYS=[...RECORDS,'yantu_english_plan_v2','yantu_theme_v1','banya_active_subject_v1',
 'banya_cloud_sync_config_v1','banya_cloud_sync_meta_v1_english',
 'banya_cloud_sync_meta_v1_politics','banya_cloud_sync_last_ok_v1'];
const PREFIX='banya-origin-copy-v1';
let pending=null;
const isSource=root.location.origin===SOURCE,isDest=root.location.origin===DEST;
function status(message){const el=document.getElementById('banya-origin-copy-status');if(el)el.textContent=message;}
function panel(){
 if(isSource)return '<section class="setting-section" aria-label="无需 VPN 的备用入口"><h2>换到无需 VPN 的入口</h2><p class="setting-note">先保持 VPN 连上这个旧入口。点一次后会在新页面复制两科本机记录和同步设置；旧入口记录不会删除。请等新页面显示记录后再关闭旧页面。</p><button type="button" class="cta secondary" data-banya-origin-copy="start">复制到华为云入口</button><p class="setting-note" id="banya-origin-copy-status" role="status"></p></section>';
 if(isDest)return '<section class="setting-section" aria-label="备用入口说明"><h2>华为云备用入口</h2><p class="setting-note">这是同一套板牙考研。若旧记录尚未出现，请开 VPN 回原入口，在设置中点“复制到华为云入口”；旧记录会留在原处。</p><p class="setting-note" id="banya-origin-copy-status" role="status"></p></section>';
 return '';
}
function validate(values){
 if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).some(k=>!KEYS.includes(k)))throw Error('复制内容不属于板牙考研');
 if(!RECORDS.some(k=>typeof values[k]==='string'))throw Error('旧入口尚无可复制的本机记录');
 if(JSON.stringify(values).length>3000000)throw Error('本机记录过大，请改用分科备份');
 if(values[RECORDS[0]]!==undefined)root.PlannerCore.normalizeState(JSON.parse(values[RECORDS[0]]));
 if(values[RECORDS[1]]!==undefined)root.PoliticsCore.normalize(JSON.parse(values[RECORDS[1]]));
 if(values.yantu_english_plan_v2!==undefined&&!root.PlannerCore.validPlan(JSON.parse(values.yantu_english_plan_v2)))throw Error('英语计划缓存无效');
 if(values.banya_cloud_sync_config_v1!==undefined){const config=JSON.parse(values.banya_cloud_sync_config_v1);if(!config||config.endpoint!==DEST||typeof config.token!=='string'||config.token.length<32)throw Error('同步配置无效，请先在旧入口检查云同步');}
 for(const [key,value] of Object.entries(values))if(typeof value!=='string'||!KEYS.includes(key))throw Error('复制内容格式无效');
}
function start(){
 if(!isSource)return;
 try{
  const values={};for(const key of KEYS){const value=localStorage.getItem(key);if(value!==null)values[key]=value;}
  validate(values);
  const nonce=Array.from(root.crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
  const popup=root.open(DEST+'/#banya-copy='+nonce,'_blank');
  if(!popup)throw Error('浏览器拦截了新页面，请允许打开新标签页后重试');
  pending={popup,nonce,values};status('正在打开华为云入口，请等新页面完成复制。');
 }catch(err){status(err.message||'复制未开始，旧记录仍在原入口。');}
}
function accept(values){
 validate(values);
 if(KEYS.some(key=>values[key]!==undefined&&localStorage.getItem(key)!==null))throw Error('新入口已有记录，为防止覆盖已停止自动复制。旧入口记录仍在。');
 const written=[];
 try{for(const key of KEYS){if(values[key]===undefined)continue;localStorage.setItem(key,values[key]);written.push(key);if(localStorage.getItem(key)!==values[key])throw Error('新入口保存校验失败');}}
 catch(err){for(const key of written)localStorage.removeItem(key);throw err;}
}
root.addEventListener('message',event=>{
 const d=event.data;if(!d||d.type!==PREFIX)return;
 if(isSource){
  if(!pending||event.origin!==DEST||event.source!==pending.popup||d.nonce!==pending.nonce)return;
  if(d.action==='ready'){pending.popup.postMessage({type:PREFIX,action:'copy',nonce:pending.nonce,values:pending.values},DEST);return;}
  if(d.action==='done'){status('已复制到新入口。旧入口记录仍保留，请在新页面核对两科。');pending=null;return;}
  if(d.action==='error'){status('新入口未完成复制：'+String(d.message||'请稍后重试').slice(0,150));pending=null;}
  return;
 }
 if(!isDest||event.origin!==SOURCE||event.source!==root.opener)return;
 const nonce=new URLSearchParams(root.location.hash.slice(1)).get('banya-copy');
 if(!nonce||d.nonce!==nonce||d.action!=='copy')return;
 try{
  accept(d.values);root.opener.postMessage({type:PREFIX,action:'done',nonce},SOURCE);
  root.history.replaceState(null,'',root.location.pathname+root.location.search);
  root.location.reload();
 }catch(err){root.opener.postMessage({type:PREFIX,action:'error',nonce,message:err.message||'保存失败'},SOURCE);status(err.message||'保存失败，旧入口记录仍在。');}
});
root.addEventListener('load',()=>{
 if(!isDest||!root.opener)return;
 const nonce=new URLSearchParams(root.location.hash.slice(1)).get('banya-copy');
 if(/^[0-9a-f]{32}$/.test(nonce||''))root.opener.postMessage({type:PREFIX,action:'ready',nonce},SOURCE);
});
document.addEventListener('click',event=>{if(event.target.closest('[data-banya-origin-copy="start"]'))start();});
root.BanyaOriginTransfer={panel};
})(typeof window==='object'?window:globalThis);
