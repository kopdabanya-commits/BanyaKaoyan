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
 let hint=connected?(subjects.length?'已连接云端 · '+subjects.map(s=>NAMES[s]).join('、')+'自动同步':'已连接云端 · 尚无已备份记录'):'记录目前仅保存在这台手机';
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
 '<h2>同步与备份</h2>'+
 '<p class="setting-note">平时会自动同步。网络或服务器暂时不可用时，记录仍保存在这台手机，恢复连接后会重试；遇到版本冲突会停下，保护已有记录。</p>'+
 (!connected?'<form id="banya-cloud-config"><label class="input-line">HTTPS同步地址<input id="banya-cloud-url" type="url" required value="https://124.70.128.201" readonly></label>'+
 '<label class="input-line">私有同步密钥<input id="banya-cloud-token" type="password" required minlength="32" autocomplete="off" placeholder="在本机生成并安全保存"></label>'+
 '<button type="button" class="cta secondary small" data-banya-action="generate-token">在本机生成随机密钥</button>'+
 '<p class="setting-note">密钥不会提交到GitHub源码。请将其保存在密码管理器，再通过GitHub Actions Secrets安全配置到服务器；完成前不会上传学习记录。</p>'+
 '<button type="submit" class="cta small">验证并启用</button></form>':
 '<p class="setting-note">已连接云端。同步密钥只保存在本机。</p>'+
 '<button type="button" class="cta secondary small" data-banya-action="sync-now">↻ 立即同步</button>'+
 '<details><summary>遇到冲突或换手机时</summary><p class="setting-note">新科目开始使用后，如果云端为空，会自动建立备份；云端已有记录时会停下，不会覆盖。需要恢复时请先保存本机备份。</p>'+
 SUBJECTS.map(function(s){return '<div class="setting-section"><b>'+NAMES[s]+'</b> · '+(metaFor(s)?'已开始自动同步':'尚未有云端备份')+
 '<div class="p-buttons"><button class="cta secondary small" data-banya-action="upload" data-banya-subject="'+s+'">确认上传本机</button>'+
 '<button class="cta ghost small" data-banya-action="restore" data-banya-subject="'+s+'">从云端恢复</button></div></div>';}).join('')+
 '<button class="cta ghost small" data-banya-action="disconnect">停用并清除同步密钥</button></details>')+
 '<div class="button-row"><button type="button" class="cta secondary small" data-banya-action="export-local">下载本机备份</button><button type="button" class="cta ghost small" data-banya-action="import-local">从本机备份恢复</button></div>'+
 '<input type="file" id="banya-local-backup-file" accept=".json,application/json" hidden>'+
 '<p class="setting-note">备份含学习记录和同步版本，不含密钥；文件只下载到手机，不会上传 GitHub。服务器恢复后点“立即同步”即可重试。</p>'+
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
const LOCAL_PLAN='yantu_english_plan_v2';
const LOCAL_BACKUP_KEYS=[KEYS.english,KEYS.politics,LOCAL_PLAN];
const LOCAL_META_KEYS=SUBJECTS.map(subject=>META+subject);
function validBackupMeta(raw) {
 const meta=JSON.parse(raw);
 if(!meta||!Number.isSafeInteger(meta.revision)||meta.revision<1||
    typeof meta.hash!=='string'||!/^[0-9a-f]{64}$/.test(meta.hash))throw Error('备份中的同步版本信息无效');
}
function localBackupValues() {
 const values={};
 for(const key of LOCAL_BACKUP_KEYS){const raw=localStorage.getItem(key);if(raw!==null)values[key]=raw;}
 if(!Object.keys(values).length)throw Error('手机上还没有可备份的学习记录');
 if(values[KEYS.english]!==undefined)validLocal('english',values[KEYS.english]);
 if(values[KEYS.politics]!==undefined)validLocal('politics',values[KEYS.politics]);
 if(values[LOCAL_PLAN]!==undefined&&!root.PlannerCore.validPlan(JSON.parse(values[LOCAL_PLAN])))throw Error('英语计划缓存无效，备份已停止');
 for(const subject of SUBJECTS)if(values[KEYS[subject]]!==undefined){
  const raw=localStorage.getItem(META+subject);
  if(raw!==null)try{validBackupMeta(raw);values[META+subject]=raw;}catch{}
 }
 return values;
}
function exportLocal() {
 const backup={app:'banya-kaoyan-local',version:1,exportedAt:new Date().toISOString(),values:localBackupValues()};
 const url=URL.createObjectURL(new Blob([JSON.stringify(backup)],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;
 link.download='板牙考研_本机备份_'+new Date().toISOString().slice(0,10)+'.json';
 link.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
 notify('已请求下载本机备份，请确认文件保存在手机上。');
}
async function importLocal(file) {
 if(!file||file.size>4000000)throw Error('备份文件过大');
 const backup=JSON.parse(await file.text());
 if(backup.app!=='banya-kaoyan-local'||backup.version!==1||!backup.values||
    typeof backup.values!=='object'||Array.isArray(backup.values))throw Error('不是有效的板牙考研本机备份');
 const values=backup.values;
 if(!Object.keys(values).length||Object.keys(values).some(key=>![...LOCAL_BACKUP_KEYS,...LOCAL_META_KEYS].includes(key)))throw Error('备份内容不符合预期');
 for(const value of Object.values(values))if(typeof value!=='string')throw Error('备份内容不符合预期');
 if(values[KEYS.english]!==undefined)validLocal('english',values[KEYS.english]);
 if(values[KEYS.politics]!==undefined)validLocal('politics',values[KEYS.politics]);
 if(values[LOCAL_PLAN]!==undefined&&!root.PlannerCore.validPlan(JSON.parse(values[LOCAL_PLAN])))throw Error('备份中的英语计划无效');
 for(const subject of SUBJECTS)if(values[META+subject]!==undefined){
  if(values[KEYS[subject]]===undefined)throw Error('备份缺少同步版本对应的科目记录');
  validBackupMeta(values[META+subject]);
 }
 if(!root.confirm('恢复前请先下载并保存当前本机备份。此操作会替换文件中包含的科目记录，继续吗？'))return;
 const previous={};for(const key of [...LOCAL_BACKUP_KEYS,...LOCAL_META_KEYS])previous[key]=localStorage.getItem(key);
 try{
  for(const [key,value] of Object.entries(values))localStorage.setItem(key,value);
  for(const subject of SUBJECTS)if(values[KEYS[subject]]!==undefined&&values[META+subject]===undefined)localStorage.removeItem(META+subject);
 }catch(error){
  for(const key of [...LOCAL_BACKUP_KEYS,...LOCAL_META_KEYS]){if(previous[key]===null)localStorage.removeItem(key);else localStorage.setItem(key,previous[key]);}
  throw error;
 }
 root.location.reload();
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
 const raw=localStorage.getItem(KEYS[subject]);
 const state=validLocal(subject,raw),localHash=await fingerprint(raw);
 const cloud=await api(subject,'GET');
 if(!m){
  if(cloud.revision!==0)throw Error(NAMES[subject]+'云端已有记录，已停止自动上传；请先核对本机和云端');
  if(localStorage.getItem(KEYS[subject])!==raw)throw Error(NAMES[subject]+'本机记录刚刚改变，请稍后重试');
  localStorage.setItem(KEYS[subject]+'_before_initial_sync',raw);
  const created=await api(subject,'PUT',{expectedRevision:0,state:envelope(subject,state)});
  saveMeta(subject,created.revision,localHash);
  notify(NAMES[subject]+'已安全备份到云端。');
  return;
 }
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
 const enrolled=SUBJECTS.filter(s=>localStorage.getItem(KEYS[s])!==null);
 if(!enrolled.length){if(manual)notify('手机上还没有学习记录，开始使用后会自动备份。');return false;}
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
 if(action==='export-local'){try{exportLocal();}catch(err){notify(err.message||'本机备份未完成');}return;}
 if(action==='import-local'){document.getElementById('banya-local-backup-file')?.click();return;}
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
document.addEventListener('change',async function(e){
 if(e.target.id!=='banya-local-backup-file')return;
 try{await importLocal(e.target.files?.[0]);}catch(err){notify('恢复未完成：'+(err.message||'文件无法读取'));}
 finally{e.target.value='';}
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
