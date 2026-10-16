/* 板牙考研 M2.9: opt-in single-PWA, two-subject sync. No credentials in source. */
(function (root) {
'use strict';
const KEYS = {english:'yantu_english_2026_m1',politics:'yantu_politics_2026_v1'};
const NAMES = {english:'英语二',politics:'政治'};
const CONFIG = 'banya_cloud_sync_config_v1';
const API_ORIGIN = 'https://124.70.128.201';
const META = 'banya_cloud_sync_meta_v1_';
const LAST_OK = 'banya_cloud_sync_last_ok_v1';
const SUBJECTS = ['english','politics'];
let config = null, busy = false, message = '尚未连接云服务器；本机记录继续正常保存。';
try { const raw = localStorage.getItem(CONFIG); if(raw)config=JSON.parse(raw); } catch {}
function escaped(value) {
 return String(value == null ? '' : value).replace(/[&<>"']/g, function(c) {
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c];
 });
}
function endpoint(value) {
 const url = new URL(String(value).trim());
 if(url.origin !== API_ORIGIN || url.username || url.password || url.search || url.hash ||
    url.pathname !== '/')throw Error('为保护同步密钥，只允许经过验证的华为云 HTTPS 地址');
 return url.origin;
}
function validLocal(subject, raw) {
 if(!SUBJECTS.includes(subject) || raw === null)throw Error('该科尚无本机记录，禁止空白上传');
 const state=JSON.parse(raw);
 if(subject==='english')root.PlannerCore.normalizeState(state);
 else root.PoliticsCore.normalize(state);
 return state;
}
async function fingerprint(raw) {
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
function metaFor(subject) {
 try {const m=JSON.parse(localStorage.getItem(META+subject));return m&&Number.isSafeInteger(m.revision)&&m.revision>0&&typeof m.hash==='string'?m:null;}catch{return null;}
}
function saveMeta(subject,revision,hash) {
 localStorage.setItem(META+subject,JSON.stringify({revision,hash}));
}
function notify(text) {
 message=text;
 for(const id of ['banya-cloud-message','banya-quick-sync-status']) {
  const el=document.getElementById(id);if(el)el.textContent=text;
 }
}
function quickPanel() {
 const connected=!!(config&&config.endpoint&&config.token);
 const subjects=SUBJECTS.filter(s=>metaFor(s));
 let hint=connected?(subjects.length?'云端已连接 · 已启用'+subjects.map(s=>NAMES[s]).join('、'):'云端已连接 · 两科尚未建立首次同步'):'记录目前仅保存在这台手机';
 let last='';
 try{last=localStorage.getItem(LAST_OK)||'';}catch{}
 if(last&&subjects.length)hint+=' · 最近成功 '+escaped(last);
 return '<section class="quick-sync" aria-label="复习计划和学习记录刷新">'+
  '<div class="quick-sync-actions"><button type="button" class="quick-sync-button" data-action="check-updates" aria-label="刷新最新复习计划">↻ 刷新计划</button>'+
  '<button type="button" class="quick-sync-button" data-banya-action="sync-now" aria-label="立即同步手机学习记录到云端">☁ 同步记录</button></div>'+
  '<p class="quick-sync-hint" id="banya-quick-sync-status" role="status">'+escaped(message==='尚未连接云服务器；本机记录继续正常保存。'?hint:message)+'</p></section>';
}
function panel() {
 const connected=!!(config&&config.endpoint&&config.token);
 return '<section class="setting-section" aria-label="云端备份与同步">'+
 '<h2>云端同步 · 两科独立</h2>'+
 '<p class="setting-note">打卡立即保存本机。首次云同步需安全连接并逐科确认一次，之后每次打卡自动尝试同步，也可在今日页点击「☁ 同步记录」。遇到冲突不会覆盖旧记录。</p>'+
 (!connected?'<form id="banya-cloud-config"><label class="input-line">HTTPS同步地址<input id="banya-cloud-url" type="url" required value="https://124.70.128.201" readonly></label>'+
 '<label class="input-line">私有同步密钥<input id="banya-cloud-token" type="password" required minlength="32" autocomplete="off" placeholder="在本机生成并安全保存"></label>'+
 '<button type="button" class="cta secondary small" data-banya-action="generate-token">在本机生成随机密钥</button>'+
 '<p class="setting-note">密钥不会提交到GitHub源码。请将其保存在密码管理器，再通过GitHub Actions Secrets安全配置到服务器；完成前不会上传学习记录。</p>'+
 '<button type="submit" class="cta small">验证并启用</button></form>':
 '<p class="setting-note">已配置 '+escaped(config.endpoint)+'。密钥只保存在这台设备的浏览器本地存储中，不提交GitHub。</p>'+
 '<button type="button" class="cta secondary small" data-banya-action="sync-now">↻ 立即同步已启用科目</button>'+
 SUBJECTS.map(function(s){return '<div class="setting-section"><b>'+NAMES[s]+'</b> · '+(metaFor(s)?'已建立同步基线':'等待首次确认')+
 '<div class="p-buttons"><button class="cta secondary small" data-banya-action="upload" data-banya-subject="'+s+'">确认上传本机</button>'+
 '<button class="cta ghost small" data-banya-action="restore" data-banya-subject="'+s+'">从云端恢复</button></div></div>';}).join('')+
 '<button class="cta ghost small" data-banya-action="disconnect">停用并清除同步密钥</button>')+
 '<p class="setting-note" role="status" id="banya-cloud-message">'+escaped(message)+'</p></section>';
}
async function api(subject,method,body) {
 if(!config)throw Error('未配置云端');
 if(endpoint(config.endpoint)!==API_ORIGIN)throw Error('云端地址与验证过的HTTPS服务不一致');
 const controller=typeof AbortController==='function'?new AbortController():null;
 const timer=controller&&typeof setTimeout==='function'?setTimeout(()=>controller.abort(),10000):null;
 let res;
 try {
  res=await fetch(config.endpoint+'/v1/snapshot/'+subject,{
   method:method,mode:'cors',cache:'no-store',
   ...(controller?{signal:controller.signal}:{}),
   headers:{Authorization:'Bearer '+config.token,...(method==='PUT'?{'Content-Type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  });
 } catch(err) {
  if(err&&err.name==='AbortError')throw Error('云端响应超时，本机记录已保留，可稍后重试');
  throw Error('云端连接失败，本机记录已保留；请检查网络或稍后重试');
 } finally {if(timer!==null)clearTimeout(timer);}

 if(!res.ok){if(res.status===409)throw Error('409版本冲突：已停止覆盖，请先查看云端与本机记录');
  if(res.status===401)throw Error('同步密钥无效');throw Error('云服务器响应 '+res.status);
 }
 const data=await res.json();
 if(data.subject!==subject || !Number.isSafeInteger(data.revision) || data.revision<0)throw Error('云端响应格式错误');
 return data;
}
function remoteState(subject, data) {
 if(!data || !data.state || data.state.schema!=='banya.sync.v1' ||
    data.state.subject!==subject || !data.state.record)throw Error('云端记录不属于此科目或格式不正确');
 validLocal(subject, JSON.stringify(data.state.record));
 return data.state.record;
}
function envelope(subject,record) {return {schema:'banya.sync.v1',subject:subject,record:record};}
function downloadBackup(subject,raw) {
 if(!raw)return;
 const backup={app:subject==='english'?'yantu-english-ii':'yantu-politics',
  version:subject==='english'?2:1,exportedAt:new Date().toISOString(),state:JSON.parse(raw)};
 const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='板牙考研_'+NAMES[subject]+'_云同步前备份_'+new Date().toISOString().slice(0,10)+'.json';
 link.click();setTimeout(function(){URL.revokeObjectURL(url);},3000);
}
async function upload(subject) {
 const raw=localStorage.getItem(KEYS[subject]),record=validLocal(subject,raw);
 const cloud=await api(subject,'GET'),m=metaFor(subject);
 if(cloud.revision>0 && (!m || cloud.revision!==m.revision))
   throw Error('云端已有不同版本；为防覆盖，必须先人工核对，不能直接上传');
 downloadBackup(subject,raw);
 if(!root.confirm('已请求下载'+NAMES[subject]+'本机备份。请确认文件已保存，再上传当前记录。继续吗？'))return;
 const saved=await api(subject,'PUT',{expectedRevision:cloud.revision,state:envelope(subject,record)});
 saveMeta(subject,saved.revision,await fingerprint(raw));
 notify(NAMES[subject]+'已上传至云端，后续联网自动同步。');
}
async function restore(subject) {
 const cloud=await api(subject,'GET');
 if(cloud.revision===0)throw Error(NAMES[subject]+'云端尚无记录，不允许空白恢复');
 const record=remoteState(subject,cloud);
 const previous=localStorage.getItem(KEYS[subject]);
 if(previous!==null)validLocal(subject,previous);
 downloadBackup(subject,previous);
 if(!root.confirm('已请求下载原'+NAMES[subject]+'本机备份。确认保存后，才可以用云端记录替换此科本机记录。继续吗？'))return;
 if(localStorage.getItem(KEYS[subject])!==previous)throw Error('恢复期间本机记录发生变化，已取消覆盖');
 if(previous!==null)localStorage.setItem(KEYS[subject]+'_before_cloud_restore',previous);
 const raw=JSON.stringify(record);
 localStorage.setItem(KEYS[subject],raw);
 saveMeta(subject,cloud.revision,await fingerprint(raw));
 root.location.reload();
}
async function syncOne(subject) {
 const m=metaFor(subject);
 if(!m)return; // Absolutely no implicit first upload/restore.
 const raw=localStorage.getItem(KEYS[subject]);
 const state=validLocal(subject,raw),localHash=await fingerprint(raw);
 const cloud=await api(subject,'GET');
 if(cloud.revision<m.revision)throw Error(NAMES[subject]+'云端版本回退，已停止同步');
 if(cloud.revision===m.revision) {
  if(localHash===m.hash)return;
  const next=await api(subject,'PUT',{expectedRevision:m.revision,state:envelope(subject,state)});
  saveMeta(subject,next.revision,localHash);
  notify(NAMES[subject]+'本机更改已安全上传。');
  return;
 }
 // Different cloud revision + local edits: fail closed; neither side is overwritten.
 if(localHash!==m.hash)throw Error(NAMES[subject]+'本机与云端都发生更改，已停止同步。请先分别备份');
 const latest=remoteState(subject,cloud);
 const newRaw=JSON.stringify(latest);
 if(localStorage.getItem(KEYS[subject])!==raw)throw Error(NAMES[subject]+'在云端读取期间产生新记录，已停止覆盖');
 localStorage.setItem(KEYS[subject]+'_before_cloud_restore',raw);
 localStorage.setItem(KEYS[subject],newRaw);
 saveMeta(subject,cloud.revision,await fingerprint(newRaw));
 notify(NAMES[subject]+'收到新版云端记录，即将刷新显示。');
 root.location.reload();
}
async function syncAll(manual=false) {
 if(busy){if(manual)notify('同步正在进行，无须重复操作');return false;}
 if(!config){if(manual)notify('尚未连接云端。请先在设置中完成安全连接；手机打卡仍正常保存。');return false;}
 if(navigator.onLine===false){if(manual)notify('当前网络离线，打卡已保存在本机，联网后再同步');return false;}
 const enrolled=SUBJECTS.filter(s=>!!metaFor(s));
 if(!enrolled.length){if(manual)notify('云服务器已连接，但还没有首次上传。请在设置→云端同步中逐科确认一次。');return false;}
 busy=true;
 if(manual)notify('正在检查云端版本并同步学习记录…');
 const errors=[];
 try{
  for(const subject of enrolled){
   try{await syncOne(subject);}
   catch(err){errors.push(NAMES[subject]+'：'+(err.message||'同步失败'));}
  }
  if(errors.length){notify(errors.join('；')+'。本机记录未被覆盖。');return false;}
  const stamp=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
  try{localStorage.setItem(LAST_OK,stamp);}catch{}
  if(manual)notify('同步完成（'+stamp+'）：'+enrolled.map(s=>NAMES[s]).join('、')+'已与云端核对');
  return true;
 }finally{busy=false;}
}
document.addEventListener('submit',async function(e){
 if(e.target.id!=='banya-cloud-config')return;
 e.preventDefault();
 const submit=e.target.querySelector('button[type="submit"]');
 if(submit)submit.disabled=true;
 try{
  const url=endpoint(document.getElementById('banya-cloud-url').value);
  const token=document.getElementById('banya-cloud-token').value.trim();
  if(token.length<32)throw Error('同步密钥长度至少32位');
  const previous=config;
  config={endpoint:url,token:token};
  try{await api('english','GET');}catch(err){config=previous;throw err;}
  localStorage.setItem(CONFIG,JSON.stringify(config));
  notify('连接成功。请分别确认英语二和政治的首次上传或恢复。');
  root.location.reload();
 }catch(err){notify(err.message||'无法连接云服务');}
 finally{if(submit)submit.disabled=false;}
});
document.addEventListener('click',async function(e){
 const button=e.target.closest('[data-banya-action]');if(!button || busy)return;
 const action=button.dataset.banyaAction,subject=button.dataset.banyaSubject;
 if(action==='generate-token'){
  const field=document.getElementById('banya-cloud-token');
  if(!field)return;
  const bytes=new Uint8Array(48);
  crypto.getRandomValues(bytes);
  field.value=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  field.type='text';
  field.select();
  notify('已在此设备生成安全随机密钥。请复制并保存在个人密码管理器，再填写 GitHub Actions Secret BANYA_SYNC_TOKEN。不要把它发在聊天中。');
  return;
 }
 if(action==='sync-now'){button.disabled=true;try{await syncAll(true);}finally{button.disabled=false;}return;}
 if(action==='disconnect'){
  if(root.confirm('停用自动同步并删除本机同步密钥？已存在的学习记录不会被清除。')){
   localStorage.removeItem(CONFIG);config=null;for(const s of SUBJECTS)localStorage.removeItem(META+s);
   root.location.reload();
  }
  return;
 }
 if(!SUBJECTS.includes(subject))return;
 busy=true;button.disabled=true;
 try{if(action==='upload')await upload(subject);else if(action==='restore')await restore(subject);}
 catch(err){notify(err.message||'操作失败，本机记录未覆盖');}
 finally{busy=false;button.disabled=false;}
});
let localChangeTimer=null;
root.addEventListener('banya-local-change',function(){
 if(!config)return;
 if(localChangeTimer!==null&&typeof clearTimeout==='function')clearTimeout(localChangeTimer);
 if(typeof setTimeout==='function')localChangeTimer=setTimeout(function(){localChangeTimer=null;void syncAll();},900);
 else void syncAll();
});
root.addEventListener('online',function(){void syncAll();});
root.addEventListener('focus',function(){void syncAll();});
document.addEventListener('visibilitychange',function(){if(!document.hidden)void syncAll();});
setInterval(function(){void syncAll();},20000);
root.BanyaCloudSync={panel:panel,quickPanel:quickPanel,syncAll:syncAll,isConnected:()=>!!config};
})(window);
