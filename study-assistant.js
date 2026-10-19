// Native configured billing currency; no foreign-exchange estimate.
(function(root){root.BanyaAIBilling={format(s){const symbol=s.currency==='CNY'?'¥':'$';const budget=s.monthlyBudget??s.monthlyBudgetUsd??0,used=s.estimatedReserved??s.estimatedReservedUsd??0;const calls=s.monthlyCallLimit===null?'不设月调用次数上限':'调用 '+(s.monthlyCalls||0)+'/'+(s.monthlyCallLimit||0)+' 次';return '月预算 '+symbol+budget+' · '+calls+' · 已保守预留 '+symbol+Number(used).toFixed(3);}};})(typeof window!=='undefined'?window:globalThis);
/* Private, in-app DeepSeek assistant. Provider credentials never enter the browser. */
(function(root){'use strict';
const PENDING='banya_ai_pending_request_v1',SUBJECTS={english:'英语二',politics:'政治'};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
let epoch=0,pendingOperation=false,opened=false,busy=false,ready=false,uncertain=false,messages=[],draft=null,requestId='';
let homeEpoch=0;
const homeCache=new Map(),inputDrafts=new Map();
let activeSubject="english";
const MODES={discussion:"聊聊",day:"日计划",week:"周计划",diagnosis:"阶段分析"};
function icon(path){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="'+path+'" stroke-linecap="round" stroke-linejoin="round"/></svg>';}
function panel(subject='english'){
 const sub=SUBJECTS[subject]?subject:'english';
 return '<section class="assistant-home" data-ai-home-subject="'+sub+'"><header class="assistant-heading"><div><h1>学习助手</h1><p>一起理清思路，按自己的节奏来。</p></div><button type="button" class="assistant-config" data-activation-action="open" aria-label="AI 设置与费用">'+icon('M4 7h16M4 17h16M8 4v6m8 4v6')+'<span>设置</span></button></header>'
 +'<div class="assistant-status" aria-live="polite"><span class="status-dot"></span><span id="ai-home-status">'+(root.BanyaCloudSync?.isConnected()?'正在核对云端状态…':'先连接云同步，就能结合记录聊一聊')+'</span><button type="button" data-ai-action="refresh-home" data-ai-subject="'+sub+'" aria-label="刷新助手状态">刷新</button></div>'
 +'<section class="assistant-planning"><button class="assistant-chat" type="button" data-ai-action="open" data-ai-subject="'+sub+'"><span class="assistant-chat-symbol">'+icon('M4 5h16v12H9l-5 4V5m4 5h8m-8 4h5')+'</span><span><b>想聊聊接下来的安排？</b><small>说说你的想法，或从下面选一个开始</small></span><span aria-hidden="true">↗</span></button><div class="assistant-shortcuts">'
 +[['day','日计划','安排一天','M5 5h14v15H5V5m3-2v4m8-4v4M5 10h14m-9 4h4'],['week','周计划','调整一周','M4 5h16v15H4V5m4-2v4m8-4v4M4 10h16m-12 4h1m3 0h1m3 0h1'],['diagnosis','阶段分析','看看进展','M5 19V9m7 10V4m7 15v-7M3 21h18']].map(([mode,label,detail,path])=>'<button type="button" data-ai-action="plan" data-ai-mode="'+mode+'" data-ai-subject="'+sub+'">'+icon(path)+'<b>'+label+'</b><small>'+detail+'</small></button>').join('')+'</div><p class="assistant-assurance">主动发送才调用 AI，讨论不会直接改计划。</p></section>'
 +'<section class="assistant-brief"><div class="assistant-section-head"><h2>最近 7 天</h2><button type="button" data-diagnosis-action="open" data-diagnosis-subject="'+sub+'">查看记录 <span aria-hidden="true">›</span></button></div><div id="ai-home-brief"><p class="setting-note">结合已同步记录查看近况，没记录的部分不猜测。</p></div></section>'
 +'<section class="assistant-tools" aria-label="档案与计划管理"><button type="button" data-memory-action="open" data-memory-subject="'+sub+'"><span><b>学习档案与规则</b><small id="ai-home-profile">告诉助手你的目标、可用时间和习惯</small></span><span aria-hidden="true">›</span></button><div class="assistant-management"><button type="button" data-auto-action="open" data-subject="'+sub+'"><span><b>自动管理</b><small id="ai-home-auto">只在单独授权后启用</small></span><span aria-hidden="true">›</span></button><button type="button" data-auto-action="open" data-history="true" data-subject="'+sub+'"><span><b>调整历史</b><small id="ai-home-last">查看原因，必要时撤销</small></span><span aria-hidden="true">›</span></button></div></section></section>';
}
async function refreshHome(subject){
 const ticket=++homeEpoch,cloud=root.BanyaCloudSync;
 if(!cloud?.isConnected())return;
 if(navigator.onLine===false){if($('ai-home-status'))$('ai-home-status').textContent='当前离线，记录仍在本机；联网后可以继续聊';return;}
 function display(results){
  if(ticket!==homeEpoch||!$('ai-home-status')||document.querySelector?.('[data-ai-home-subject]')?.dataset.aiHomeSubject!==subject)return;
  const [ai,memory,analysis,auto]=results.map(r=>r.status==='fulfilled'?r.value:null);
  $('ai-home-status').textContent=ai?(ai.ready?'AI 已启用 · 按你的授权使用':'AI 未启用 · 查看记录不收费'):'云端状态暂不可用，可继续本机学习';
  if(memory?.entries)$('ai-home-profile').textContent=memory.entries.some(e=>e.active)?'已保存资料与要求，可以随时补充':'还没有学习档案，先记一条已确认的要求';
  if(analysis?.windows?.['7']){const w=analysis.windows['7'];$('ai-home-brief').innerHTML=(Number(w.recordedTasks)>0?'<div class="assistant-metrics"><span><b>'+Number(w.recordedTasks)+'</b><small>项有记录</small></span><span><b>'+Number(w.completed)+'</b><small>项已打卡</small></span></div><p class="setting-note">按近 7 天任务统计，不代表实际完成日期。</p>':'<p class="assistant-empty-note">还没有足够的近期记录。先按自己的节奏学，之后再一起看。</p>')+(Number(w.recordedTasks)>0?analysis.issues.slice(0,1):[]).map(i=>'<p class="assistant-finding">'+esc(i.recommendedAction)+'</p>').join('');}
  else $('ai-home-brief').innerHTML='<p class="setting-note">暂时无法读取云端近况。手机未同步的记录不在分析中。</p>';
  if(auto){const g=auto.grants?.find(g=>g.subject===subject);$('ai-home-auto').textContent=auto.control?.enabled&&g?.enabled?'本学科已授权 · 可随时暂停':'本学科自动管理未启用';const r=auto.runs?.find(r=>r.subject===subject);$('ai-home-last').textContent=r?({applied:'最近已调整计划，点开查看原因',undone:'最近一次调整已撤销',no_change:'最近维持原计划',pending:'最近一次仍在处理',unknown:'最近结果待核对',stopped:'最近一次已安全停止'}[r.status]||'查看最近的调整'):'还没有自动修改记录';}
 }
 const cached=homeCache.get(subject);if(cached&&Date.now()-cached.at<15000){display(cached.results);return;}
 const results=await Promise.allSettled(['status','profiles/'+subject,'analysis','auto/status'].map(path=>cloud.assistantRequest(path,path==='analysis'?'POST':'GET',path==='analysis'?{subject}:undefined)));
 if(ticket!==homeEpoch)return;homeCache.set(subject,{at:Date.now(),results});display(results);
}
document.addEventListener('banya-ai-status-change',()=>{homeCache.clear();const subject=document.querySelector?.('[data-ai-home-subject]')?.dataset.aiHomeSubject;if(subject)void refreshHome(subject);});
root.addEventListener?.('banya-local-change',()=>{homeCache.clear();});
function remember(scope){try{sessionStorage.setItem(PENDING,JSON.stringify({id:requestId,...scope}));}catch{}}
function forget(){try{sessionStorage.removeItem(PENDING);}catch{}}
function restored(){try{const r=JSON.parse(sessionStorage.getItem(PENDING));return r&&/^[A-Za-z0-9_-]{8,80}$/.test(r.id)&&SUBJECTS[r.subject]&&/^2026-\d{2}-\d{2}$/.test(r.start)&&/^2026-\d{2}-\d{2}$/.test(r.end)?r:null;}catch{return null;}}
function scope(){return {subject:$('ai-subject').value,start:$('ai-start').value,end:$('ai-end').value};}
function say(message){if(opened&&$('ai-state'))$('ai-state').textContent=message;}
function stashDraft(){if(opened&&$('ai-prompt'))inputDrafts.set(activeSubject,$('ai-prompt').value);}
function scopeLabel(){if(!opened)return;const mode=$('ai-mode').value||'discussion',short=v=>String(v||'').slice(5).replace('-','/');const date=mode==='discussion'?short($('ai-start').value)+'–'+short($('ai-end').value):mode==='diagnosis'?'近期记录':short($('ai-target').value)+(mode==='week'?' 起':'');if($('ai-scope-label'))$('ai-scope-label').textContent=SUBJECTS[$('ai-subject').value]+' · '+(MODES[mode]||MODES.discussion)+' · '+date;document.querySelectorAll?.('[data-ai-action="mode"]').forEach(b=>{const selected=b.dataset.aiMode===mode;b.setAttribute('aria-pressed',String(selected));});}
function defaultTarget(subject){const d=new Date();d.setDate(d.getDate()+1);const date=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),meta=(subject==='politics'?root.POLITICS_PLAN:root.STUDY_PLAN)?.meta;return meta?[meta.start,date,meta.end].sort()[1]:date;}

function friendly(error){return {planning_budget_unknown:'还不知道你能学多久。日计划可在范围设置里填当天分钟数；周计划请先在学习档案确认时间预算。',ai_monthly_limit_reached:'本月可用预算或调用额度不足，可在 AI 设置里核对。',ai_not_configured_or_not_approved:'AI 还没启用，请先在助手首页的 AI 设置中核对费用与启用状态。',ai_request_in_progress:'上一条还在思考，等它完成后再发送。',revision_conflict:'学习记录有了更新，先同步，再重新讨论会更准确。'}[error.code]||error.message||'暂时连不上，文字还在，稍后再试。';}

function controls(){if(!opened)return;const locked=busy||pendingOperation;for(const id of ['ai-subject','ai-start','ai-end','ai-mode','ai-target','ai-available','ai-review','ai-consent','ai-prompt'])if($(id))$(id).disabled=locked||uncertain||!ready;const send=$('ai-send');if(send)send.disabled=locked||uncertain||!ready;if(send){send.textContent=locked?'正在处理…':'发送';send.setAttribute?.('aria-busy',String(locked));}const query=$('ai-query');if(query){query.hidden=!requestId||(!uncertain&&!locked);query.disabled=locked;}document.querySelectorAll?.('[data-ai-action="mode"],[data-ai-action="suggest"]').forEach(b=>b.disabled=locked||uncertain||!ready);document.querySelectorAll?.('[data-ai-action="reset"]').forEach(b=>b.disabled=locked);const commit=$('ai-commit');if(commit)commit.disabled=locked||uncertain||!ready;}
function renderMessages(){if(opened){if($('ai-empty'))$('ai-empty').hidden=messages.length>0;$('ai-messages').innerHTML=messages.map(m=>'<div class="ai-message '+m.role+'"><small>'+(m.role==='user'?'你':'DeepSeek · 思考模式')+'</small><p>'+esc(m.content)+'</p></div>').join('');$('ai-messages').lastElementChild?.scrollIntoView?.({block:'start'});}}
function changeCard(c){
 const before=c.before?'<span>'+esc(c.before.date)+'</span><b>预计 '+esc(c.before.minutes)+' 分钟</b>':'<span>新增任务</span>';
 return '<div class="ai-change"><b>'+esc(c.after.title)+'</b><div class="ai-change-compare"><div><small>原安排</small>'+before+'</div><span aria-hidden="true">→</span><div><small>建议安排</small><span>'+esc(c.after.date)+'</span><b>预计 '+esc(c.after.minutes)+' 分钟</b></div></div>'+(c.before&&c.before.title!==c.after.title?'<p>原标题：'+esc(c.before.title)+'</p>':'')+(c.before?.detail!==c.after.detail?'<p>'+esc(c.after.detail)+'</p>':'')+'</div>';
}
function preview(result){
 if(!opened)return;
 const box=$('ai-preview');box.innerHTML='';
 if(result.status==='prepared'){
  box.innerHTML='<section class="ai-proposal"><h3>建议改动 · 尚未执行</h3>'+result.changes.map(changeCard).join('')+(result.previewOnly?'<p class="setting-note">这份规划仅供预览，尚未修改计划。</p>':'<button type="button" id="ai-commit" class="cta" data-ai-action="commit">确认同步这 '+result.changes.length+' 项</button>')+'<p class="setting-note">'+(result.previewOnly?'已有计划、打卡和全部学习记录保持原样。':'只改所示计划，已有完成、不做和全部学习记录保留。新记录或版本冲突会停止写入。')+'</p></section>';
 }else if(result.status==='applied'){
  box.innerHTML='<section class="ai-proposal"><h3>云端计划已更新</h3><p>手机是否已收取仍需同步确认。</p><button type="button" class="cta secondary" data-ai-action="receive">接收云端更新</button></section>';
 }
}
function showResult(result){
 draft=result;uncertain=['pending','unknown'].includes(result.status);if(opened&&MODES[result.planningMode]){$('ai-mode').value=result.planningMode;scopeLabel();}
 if(result.previewOnly&&!uncertain)forget();
 if(result.reply){const prior=messages.find(m=>m.role==='assistant'&&m.requestId===result.requestId);if(prior)prior.content=result.reply;else messages.push({role:'assistant',content:result.reply,requestId:result.requestId});}
 messages=messages.slice(-12);renderMessages();preview(result);
 if(result.analysis&&opened){const a=result.analysis;const html='<section class="ai-proposal"><h3>规划分析 · 仅建议</h3>'+a.findings.map(f=>'<p>'+esc(f.text)+'</p>').join('')+'<h3>可以这样做</h3>'+a.recommendations.map(t=>'<p>'+esc(t)+'</p>').join('')+'<h3>还不能确定</h3>'+a.uncertainties.map(t=>'<p>'+esc(t)+'</p>').join('')+a.reasons.map(r=>'<p>'+esc(result.changes?.find(c=>c.taskId===r.taskId)?.after?.title||'相关任务')+'：'+esc(r.reason)+'</p>').join('')+'<details><summary>查看依据</summary>'+a.evidence.map(e=>'<p>'+esc(e.detail)+'<br><small>'+esc(e.sourceRef)+'</small></p>').join('')+'</details></section>';$('ai-preview').innerHTML+=html;}

 const labels={prepared:'建议已准备好，核对后再确认同步。',discussion:'这次只讨论，没有修改计划。',rejected:'建议未通过计划保护校验，没有修改；请缩小改动或说明具体任务。',conflict:'记录或模板已变化，没有写入。请重新同步，再生成建议。',expired:'建议已过期，没有写入。请重新讨论。',unknown:'本次结果未能确认，没有自动重试；可能已产生调用费。先查询结果，再决定是否新开对话。',pending:'服务器仍在处理。稍后查询即可，不会再次调用模型。',applied:'服务器已保存。手机接收状态尚待确认。'};
 const reasons={completed_or_not_doing_task_is_protected:'已完成或不做的任务不能改动。',day_budget_exceeded:'某天安排过满，请减少预计时长或调整日期。',destination_date_outside_grant:'改动日期超出了本次选择范围。',source_date_outside_grant:'原任务不在本次选择范围。'};
 say((result.previewOnly?'仅分析和预览，不执行修改。 ':'')+((result.previewOnly&&result.status==='prepared')?'规划建议已准备，仅供预览。':(labels[result.status]||'请查询本次结果。'))+(reasons[result.validationCode]||''));controls();
}
function boundDates(subject){
 const meta=(subject==='english'?root.STUDY_PLAN:root.POLITICS_PLAN)?.meta;
 if(!meta)return;
 const d=new Date(),today=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 const shift=n=>{const date=new Date(today+'T12:00:00');date.setDate(date.getDate()+n);return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');};
 for(const id of ['ai-start','ai-end']){$(id).min=meta.start;$(id).max=meta.end;}
 $('ai-start').value=[meta.start,shift(-3),meta.end].sort()[1];$('ai-end').value=[meta.start,shift(10),meta.end].sort()[1];
}
function close(){stashDraft();epoch++;opened=false;messages=[];draft=null;$('modal').classList.add('hidden');$('modal').innerHTML='';document.body.classList.remove('modal-open');}
async function open(initialSubject='english'){
 const cloud=root.BanyaCloudSync;if(!cloud?.isConnected()){root.alert('请先在设置连接云同步，学习助手才有权读取你的记录。');return;}
 const ticket=++epoch;opened=true;busy=true;ready=false;messages=[];draft=null;requestId='';uncertain=false;
 const box=$('modal');box.innerHTML='<div class="modal-card ai-sheet" role="dialog" aria-modal="true" aria-labelledby="ai-chat-title"><header class="modal-head ai-chat-head"><div><h2 id="ai-chat-title">学习对话</h2><p>DeepSeek · 思考模式</p></div><div class="ai-head-actions"><button type="button" data-ai-action="reset">新对话</button><button type="button" class="close" data-ai-action="close" aria-label="关闭学习助手">×</button></div></header><div class="ai-mode-tabs" aria-label="选择讨论方式">'+Object.entries(MODES).map(([mode,label])=>'<button type="button" data-ai-action="mode" data-ai-mode="'+mode+'" aria-pressed="'+(mode==='discussion')+'">'+label+'</button>').join('')+'</div><div class="ai-workspace"><details class="ai-options" id="ai-options"><summary id="ai-scope-label">范围与分享</summary><div class="ai-scope"><label class="form-line"><span>科目</span><select id="ai-subject"><option value="english">英语二</option><option value="politics">政治</option></select></label><label class="form-line"><span>开始日期</span><input type="date" id="ai-start"></label><label class="form-line"><span>结束日期</span><input type="date" id="ai-end"></label></div><label class="form-line"><span>讨论方式</span><select id="ai-mode"><option value="discussion">聊聊</option><option value="day">日计划</option><option value="week">周计划</option><option value="diagnosis">阶段分析</option></select></label><div class="ai-scope"><label class="form-line"><span>规划日期／周起始日</span><input type="date" id="ai-target"></label><label class="form-line"><span>当天可用分钟（仅日计划）</span><input type="number" id="ai-available" min="0" max="600" inputmode="numeric" placeholder="留空使用学习档案"></label></div><label class="ai-check"><input type="checkbox" id="ai-review">同时分享错题、题号与复盘（可选）</label><p class="setting-note">切换范围会开启新的讨论。关闭不会取消已经发出的请求。</p></details><div class="ai-empty" id="ai-empty"><span class="ai-empty-symbol">'+icon('M4 5h16v12H9l-5 4V5m4 5h8m-8 4h5')+'</span><h3>从你现在最在意的事聊起</h3><p>可以讨论安排，也可以先理清问题。<br>有记录就参考，没把握的地方会说明。</p><div class="ai-starters">'+['最近的安排是不是太满了？','帮我看看哪些地方值得多练一点。'].map(text=>'<button type="button" data-ai-action="suggest" data-ai-text="'+esc(text)+'">'+esc(text)+' <span aria-hidden="true">↗</span></button>').join('')+'</div></div><div id="ai-messages" class="ai-messages" aria-live="polite"></div><div id="ai-preview"></div></div><form id="ai-chat-form" class="ai-composer"><p id="ai-state" class="ai-chat-state" role="status">正在检查连接，不会调用模型…</p><label for="ai-prompt" class="ai-input-label">你想怎样安排或分析</label><textarea id="ai-prompt" maxlength="2000" rows="2" placeholder="说说你的想法…"></textarea><label class="ai-check"><input type="checkbox" id="ai-consent"><span>同意本次向 DeepSeek 分享所选资料，并按用量计费。错题与笔记默认不分享。</span></label><div class="ai-composer-actions"><details class="ai-cost"><summary>费用与数据说明</summary><div class="ai-cost-body"><p id="ai-budget" class="setting-note"></p><p class="setting-note">只携带选定科目与范围及最近几轮讨论。密钥留在服务器，别把密钥写进对话。</p></div></details><button type="button" id="ai-query" class="cta ghost" data-ai-action="query" hidden>查询结果</button><button type="submit" id="ai-send" class="cta">发送</button></div></form></div>';
 box.classList.remove('hidden');document.body.classList.add('modal-open');$('ai-subject').value=SUBJECTS[initialSubject]?initialSubject:'english';boundDates($('ai-subject').value);
 activeSubject=$('ai-subject').value;$('ai-review').checked=false;$('ai-consent').checked=false;$('ai-prompt').value=inputDrafts.get(activeSubject)||'';$('ai-mode').value='discussion';$('ai-target').value=defaultTarget(activeSubject);$('ai-available').value='';
 const previous=restored();if(previous){requestId=previous.id;$('ai-subject').value=previous.subject;boundDates(previous.subject);$('ai-start').value=previous.start;$('ai-end').value=previous.end;uncertain=true;}
 activeSubject=$('ai-subject').value;$('ai-prompt').value=inputDrafts.get(activeSubject)||'';scopeLabel();renderMessages();controls();
 try{
  const status=await cloud.assistantRequest('status');if(ticket!==epoch)return;ready=!!status.ready;
  if(opened)$('ai-budget').textContent=ready?'思考模式 · '+root.BanyaAIBilling.format(status)+'（账单以服务商为准）':'服务器尚未启用。安全配置密钥与费用上限后才能发送；现在不会产生 API 费用。';
  say(ready?(previous?'有上次请求可查询，先查看结果，避免重复调用。':'说说你的想法。本次先讨论，不直接改计划。'):'付费调用尚未启用。');
 }catch(error){if(ticket===epoch)say(error.message||'暂时无法检查学习助手。');}
 finally{if(ticket===epoch)busy=false;controls();}
}
async function send(){
 if(busy||pendingOperation||uncertain||!ready)return;
 if(!$('ai-consent').checked){say('请先确认本次数据发送与计费授权。');return;}
 if(navigator.onLine===false){say('现在离线，文字留在输入框；联网后再主动发送。');return;}
 const text=$('ai-prompt').value.trim();if(!text){say('先写下你的想法。');return;}
 const ticket=epoch,selected=scope(),review=$('ai-review').checked,mode=$('ai-mode').value||'discussion',target=$('ai-target').value,available=$('ai-available').value;let submitted=false;
 const range=(Date.parse(selected.end)-Date.parse(selected.start))/86400000;
 if(!Number.isFinite(range)||range<0||range>30){say('请选开始、结束日期，范围最多31天；建议先讨论一周。');return;}
 busy=true;pendingOperation=true;controls();say('先核对手机和云端记录…');
 try{
  const baseline=await root.BanyaCloudSync.prepareAssistant(selected.subject);
  if(!opened||ticket!==epoch)return;
  requestId='ai-'+crypto.randomUUID();remember(selected);draft=null;preview({status:'discussion'});
  const conversation=[...messages.map(m=>({role:m.role,content:m.content.slice(0,1800)})),{role:'user',content:text}].slice(-6);
  messages.push({role:'user',content:text});renderMessages();say('正在结合记录思考，可能需要一些时间。请不要重复发送…');
  submitted=true;
  const result=await root.BanyaCloudSync.assistantRequest('chat','POST',{requestId,...selected,expectedRevision:baseline.revision,messages:conversation,shareReview:review,consent:true,...(mode!=='discussion'?{planningMode:mode,targetDate:target,...(mode==='day'&&available!==''?{availableMinutes:Number(available)}:{})}:{})});
  if(ticket===epoch){if(opened)$('ai-prompt').value='';inputDrafts.delete(selected.subject);showResult(result);}
 }catch(error){
  if(ticket!==epoch)return;
  const rejected=['ai_consent_required','ai_monthly_limit_reached','ai_context_too_large_narrow_dates','ai_remove_credentials_from_message','ai_request_in_progress','ai_invalid_conversation','ai_date_range_at_most_31_days','ai_date_outside_template','revision_conflict','ai_not_configured_or_not_approved','context_required_data_exceeds_budget','profile_schema_incompatible','capability_unavailable','planning_budget_unknown','invalid_planning_request'].includes(error.code);
  if(submitted&&!rejected){uncertain=true;say('请求结果未确认，先查询本次结果，避免重复付费。');}
  else {if(submitted){requestId='';forget();}say(friendly(error));}
 }finally{pendingOperation=false;if(ticket===epoch)busy=false;controls();}
}
async function query(){if(busy||pendingOperation||!requestId)return;const ticket=epoch,id=requestId;busy=true;pendingOperation=true;controls();try{const receipt=await root.BanyaCloudSync.assistantRequest('requests/'+id);if(ticket===epoch)showResult(receipt);}catch(error){if(ticket===epoch)say(error.message||'暂时查不到结果，请稍后再查。');}finally{pendingOperation=false;if(ticket===epoch)busy=false;controls();}}

async function commit(){
 if(busy||pendingOperation||uncertain||draft?.status!=='prepared'||draft.previewOnly)return;
 const ticket=epoch,proposal=draft,selected=scope();busy=true;pendingOperation=true;controls();say('先保护手机上的最新记录…');
 try{
  const baseline=await root.BanyaCloudSync.prepareAssistant(selected.subject);
  if(ticket!==epoch)return;
  if(baseline.revision!==proposal.baseRevision){draft=null;preview({status:'conflict'});say('手机有新记录，旧建议没有执行。请重新讨论。');return;}
  const receipt=await root.BanyaCloudSync.assistantRequest('proposals/'+proposal.requestId+'/commit','POST',{expectedRevision:proposal.baseRevision,confirmation:'sync'});
  if(ticket===epoch)showResult(receipt);
  if(receipt.status==='applied'){
   const received=await root.BanyaCloudSync.syncAll(true);
   if(ticket===epoch)say(received?'云端已保存，并完成本机同步核对。':'云端已保存，本机收取尚未完成；记录仍保留，请稍后同步。');
  }
 }catch(error){if(ticket===epoch){uncertain=true;say('执行结果需要查询确认；没有自动重试写入。');}}
 finally{pendingOperation=false;if(ticket===epoch)busy=false;controls();}
}
function reset(keepReview=false){const share=keepReview&&opened&&$('ai-review').checked;messages=[];draft=null;requestId='';uncertain=false;forget();if(opened){$('ai-consent').checked=false;$('ai-review').checked=!!share;renderMessages();preview({status:'discussion'});say('新对话已开始，尚未发送任何内容。');controls();}}
document.addEventListener('input',e=>{if(opened&&e.target.id==='ai-prompt')stashDraft();});
document.addEventListener('focusin',e=>{if(opened&&e.target.id==='ai-prompt')$('ai-budget')?.closest?.('.ai-cost')?.removeAttribute('open');});
document.addEventListener('submit',e=>{if(e.target.id==='ai-chat-form'){e.preventDefault();void send();}});
document.addEventListener('change',e=>{if(opened&&!busy&&!pendingOperation&&['ai-subject','ai-start','ai-end','ai-mode','ai-target','ai-available','ai-review'].includes(e.target.id)){if(e.target.id==='ai-subject'){stashDraft();activeSubject=e.target.value;boundDates(activeSubject);$('ai-target').value=defaultTarget(activeSubject);$('ai-available').value='';$('ai-prompt').value=inputDrafts.get(activeSubject)||'';}reset(e.target.id==='ai-review');scopeLabel();}});
document.addEventListener('click',async e=>{
 const button=e.target.closest('[data-ai-action]');if(!button){if(opened&&e.target.id==='modal')close();return;}
 const action=button.dataset.aiAction;
 if(action==='refresh-home'){homeCache.delete(button.dataset.aiSubject);await refreshHome(button.dataset.aiSubject);return;}
 if(action==='open'){if(!opened)await open(button.dataset.aiSubject);return;}
 if(action==='plan'){await root.BanyaStudyAssistant.openPlanning(button.dataset.aiSubject,button.dataset.aiMode,defaultTarget(button.dataset.aiSubject));return;}
 if(action==='close'){close();return;}
 if(busy||pendingOperation)return;
 if(action==='suggest'&&opened){$('ai-prompt').value=button.dataset.aiText||'';$('ai-prompt').focus?.();return;}
 if(action==='mode'&&opened){if($('ai-mode').value!==button.dataset.aiMode){if(messages.length&&typeof root.confirm==='function'&&!root.confirm('切换方式会开始新的讨论，未发送的文字会保留。继续吗？'))return;$('ai-mode').value=button.dataset.aiMode;reset();scopeLabel();if($('ai-options'))$('ai-options').open=button.dataset.aiMode==='day';}return;}
 if(action==='query')await query();
 if(action==='commit')await commit();
 if(action==='reset'){if((messages.length||uncertain)&&typeof root.confirm==='function'&&!root.confirm('开始新对话？当前讨论会清空，已提交的请求不会被取消。'))return;reset();}
 if(action==='receive'){busy=true;controls();try{const ok=await root.BanyaCloudSync.syncAll(true);say(ok?'已完成本机同步核对。':'本机同步未完成，请到设置查看提示。');}finally{busy=false;controls();}}
});
document.addEventListener('keydown',e=>{if(opened&&e.key==='Escape')close();});
document.addEventListener('banya-modal-dismiss',()=>{if(opened)close();});
root.BanyaStudyAssistant={panel,refreshHome,openPlanning:async(subject,mode,target,available)=>{await open(subject);if(opened&&!requestId){$('ai-mode').value=mode;$('ai-target').value=target;$('ai-available').value=available??'';scopeLabel();if($('ai-options'))$('ai-options').open=mode==='day';say('规划只生成建议和预览，不执行修改。请主动填写问题并确认数据授权。');}}};
})(window);

/* M7.1 owner-only memory editor. No provider calls, no checkin/plan writes. */
(function(root){'use strict';
const $=id=>document.getElementById(id),labels={goal:'目标',history:'历史基础',material:'资料',budget:'时间预算',preference:'偏好',constraint:'硬性要求',progress:'进度说明'};
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let active=false,epoch=0,busy=false,profile=null,editing=null,pending=null,subject='english';
const call=(path,method='GET',body)=>root.BanyaCloudSync.assistantRequest('profiles/'+subject+path,method,body);
function message(text){if(active)$('memory-state').textContent=text;}
function lock(value){busy=value;if(!active)return;for(const id of ['memory-subject','memory-save','memory-new','memory-history','memory-category','memory-scope','memory-rule','memory-sensitive','memory-text','memory-certainty','memory-temporal','memory-observed','memory-until','memory-minutes','memory-min','memory-max','memory-year','memory-material','memory-count','memory-total'])if($(id))$(id).disabled=value;}
function card(e,readonly=false){const today=new Date().toISOString().slice(0,10),expired=e.validUntil&&e.validUntil<today;return '<article class="ai-proposal"><h3>'+escape(labels[e.category])+' · '+(!e.active?'已停用':expired?'已过期，待确认':'生效')+'</h3><p>'+escape(e.value.text)+'</p>'+Object.entries(e.value).filter(([key,value])=>key!=='text'&&value!==null).map(([key,value])=>'<p class="setting-note">'+escape(({scope:'适用范围',rule:'规则',minutes:'每日分钟',targetMin:'目标下限',targetMax:'目标上限',examYear:'考试年份',materialState:'资料拥有情况',count:'已知数量',total:'对应总量'})[key]||key)+'：'+escape(({owned:'已拥有',not_owned:'未拥有',unknown:'未知',non_vocabulary:'英语非单词',total:'本学科总时间',vocabulary:'单词',course:'课程',daily_limit:'每日时间上限',course_limit:'课程时间上限',daily_practice:'每天尽量有一组练习',no_carry_all:'不把未完成任务整批堆到次日'})[value]||value)+'</p>').join('')+'<p class="setting-note">'+(e.temporal==='historical'?'历史基础，不是打卡':'当前说明')+' · '+({confirmed:'已确认',reported:'用户陈述',estimate:'主观估计',unknown:'未知／待确认'}[e.certainty])+(e.observedOn?' · 资料日期 '+escape(e.observedOn):'')+(e.validUntil?' · 有效至 '+escape(e.validUntil):'')+'</p><details class="memory-source"><summary>来源与确认信息</summary><p class="setting-note">来源：'+escape(e.source.reference)+' · '+escape(e.source.kind)+'<br>确认于 '+escape(e.confirmedAt)+' · 版本 '+Number(e.entryRevision)+'</p></details>'+(readonly?'':'<button type="button" class="cta ghost small" data-memory-action="edit" data-memory-key="'+escape(e.key)+'">修改</button><button type="button" class="cta ghost small" data-memory-action="toggle" data-memory-key="'+escape(e.key)+'">'+(e.active?'停用':'重新启用')+'</button>')+'</article>';}
function list(){if(active)$('memory-list').innerHTML=profile.entries.length?profile.entries.map(e=>card(e)).join(''):'<p class="setting-note">还没有学习档案。可以先记一条要求；历史基础不会转为完成记录。</p>';}
function editor(e=null){
 editing=e;if(!active)return;pending=null;$('memory-editor').hidden=false;
 $('memory-sensitive').checked=e?.sensitivity==='review';$('memory-category').value=e?.category||'preference';$('memory-scope').value=e?.value.scope||'';$('memory-rule').value=e?.value.rule||'';$('memory-text').value=e?.value.text||'';
 $('memory-certainty').value=e?.certainty||'confirmed';$('memory-temporal').value=e?.temporal||'current';
 $('memory-observed').value=e?.observedOn||'';$('memory-until').value=e?.validUntil||'';
 for(const [id,key] of [['minutes','minutes'],['min','targetMin'],['max','targetMax'],['year','examYear'],['material','materialState'],['count','count'],['total','total']])$('memory-'+id).value=e?.value[key]??'';
 message(e?'修改后保留旧版本，不会改学习记录。':'记下已经确认的要求，或明确标为估计、未知。');
}
function close(){epoch++;active=false;profile=null;editing=null;pending=null;$('modal').innerHTML='';$('modal').classList.add('hidden');document.body.classList.remove('modal-open');}
async function open(initial){
 if(!root.BanyaCloudSync?.isConnected()){root.alert('请先连接云同步，再管理服务器上的私人档案。');return;}
 subject=initial==='politics'?'politics':'english';profile=null;editing=null;pending=null;active=true;const ticket=++epoch;
 const modal=$('modal');modal.innerHTML='<div class="modal-card ai-sheet"><div class="modal-head"><h2>学习档案与规则</h2><button type="button" class="close" data-memory-action="close" aria-label="关闭学习档案">×</button></div><p class="setting-note">这里记目标、基础和长期要求，和真实打卡分开保存。修改档案不调用 DeepSeek，也不调整计划。</p><label class="form-line"><span>科目</span><select id="memory-subject"><option value="english">英语二</option><option value="politics">政治</option></select></label><div class="button-row"><button type="button" id="memory-new" class="cta secondary" data-memory-action="new">记一条要求</button><button type="button" id="memory-history" class="cta ghost" data-memory-action="history">查看旧版本</button></div><p id="memory-state" class="setting-note" role="status"></p><div id="memory-list"></div><form id="memory-editor" hidden><h3>这条信息</h3><label class="ai-check"><input type="checkbox" id="memory-sensitive">包含错题或复盘内容（讨论时需额外同意分享）</label><label class="form-line"><span>类型</span><select id="memory-category">'+Object.entries(labels).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></label><label class="form-line"><span>内容</span><textarea id="memory-text" maxlength="1200" rows="3" required></textarea></label><label class="form-line"><span>确定程度</span><select id="memory-certainty"><option value="confirmed">已确认</option><option value="reported">用户陈述</option><option value="estimate">主观估计</option><option value="unknown">未知／待确认</option></select></label><label class="form-line"><span>时间性质</span><select id="memory-temporal"><option value="current">当前说明</option><option value="historical">历史基础，不是打卡</option></select></label><label class="form-line"><span>资料日期（历史基础必填）</span><input type="date" id="memory-observed"></label><label class="form-line"><span>有效至（可留空）</span><input type="date" id="memory-until"></label><details><summary>补充数值与可验证规则（按需填写）</summary><label class="form-line"><span>时间范围</span><select id="memory-scope"><option value="">本学科默认范围</option><option value="non_vocabulary">英语非单词</option><option value="total">政治总时间</option><option value="vocabulary">单词</option><option value="course">课程</option></select></label><label class="form-line"><span>硬性要求类型（需选择硬性要求）</span><select id="memory-rule"><option value="">普通文字说明</option><option value="daily_limit">每日硬性分钟上限</option><option value="course_limit">课程分钟上限</option><option value="daily_practice">每日一组题感练习</option><option value="no_carry_all">不整批堆积到一天</option></select></label>'+[['minutes','每日分钟',1440],['min','目标下限',150],['max','目标上限',150],['year','考试年份',2100],['count','已知数量',100000],['total','对应总量',100000]].map(([id,label,max])=>'<label class="form-line"><span>'+label+'</span><input type="number" min="'+(id==='year'?2020:id==='total'?1:0)+'" max="'+max+'" id="memory-'+id+'"></label>').join('')+'<label class="form-line"><span>资料拥有情况</span><select id="memory-material"><option value="">未填写</option><option value="owned">已拥有</option><option value="not_owned">未拥有</option><option value="unknown">未知</option></select></label></details><button type="submit" id="memory-save" class="cta">保存这条档案</button></form><button type="button" class="cta ghost" data-memory-action="retry" id="memory-retry" hidden>核对并重试上次保存</button><div id="memory-history-list"></div></div>';
 modal.classList.remove('hidden');document.body.classList.add('modal-open');$('memory-subject').value=subject;lock(true);message('正在读取私人档案，不会调用模型…');
 try{const result=await call('');if(ticket!==epoch)return;profile=result;list();message('没有记录的部分保持未知；历史基础不会算作打卡。');}
 catch(error){if(ticket===epoch)message(error.message||'读取失败，未修改任何记录。');}
 finally{if(ticket===epoch)lock(false);}
}
async function persist(e,retry=false){
 if(busy||!profile)return;const ticket=epoch;
 if(!retry){pending={schemaVersion:1,requestId:'memory-'+crypto.randomUUID(),expectedRevision:profile.revision,entries:[e],confirmation:'save_profile'};}
 lock(true);message('正在备份并保存档案…');
 try{await call('','POST',pending);if(ticket!==epoch)return;profile=await call('');if(ticket!==epoch)return;pending=null;editing=null;list();$('memory-editor').hidden=true;$('memory-retry').hidden=true;message('已保存。旧版本保留，学习记录和计划未改动。');if(typeof Event==='function')document.dispatchEvent?.(new Event('banya-ai-status-change'));}
 catch(error){if(ticket!==epoch)return;const conflict=['profile_revision_conflict','profile_request_id_reused'].includes(error.code),invalid=['invalid_request','profile_too_large','profile_entry_limit','duplicate_profile_key','profile_remove_credentials'].includes(error.code);$('memory-retry').hidden=conflict||invalid;message(invalid?'内容未通过校验。请核对数值和日期，且不要填写任何密钥。':conflict?'服务器已有新版本，这次没有覆盖。请关闭重开，核对后再改。':'保存结果未确认。可以重试同一次请求；不要重复新增。');}
 finally{if(ticket===epoch)lock(false);}
}
document.addEventListener('submit',async e=>{
 if(e.target.id!=='memory-editor')return;e.preventDefault();if(!active||busy||!profile)return;
 const text=$('memory-text').value.trim();if(!text){message('先填写这条信息。');return;}
 const value={text};for(const [id,key] of [['minutes','minutes'],['min','targetMin'],['max','targetMax'],['year','examYear'],['count','count'],['total','total']]){const v=$('memory-'+id).value;if(v!=='')value[key]=Number(v);}
 if($('memory-material').value)value.materialState=$('memory-material').value;if($('memory-scope').value)value.scope=$('memory-scope').value;if($('memory-rule').value)value.rule=$('memory-rule').value;
 const item={key:editing?.key||'rule-'+crypto.randomUUID(),category:$('memory-category').value,value,source:{kind:'user_confirmation',reference:'本人在 App 学习档案中填写'},certainty:$('memory-certainty').value,temporal:$('memory-temporal').value,observedOn:$('memory-observed').value||null,validUntil:$('memory-until').value||null,active:editing?.active??true,topics:editing?.topics||['general'],sensitivity:$('memory-sensitive').checked?'review':'standard'};
 if(item.temporal==='historical'&&!item.observedOn){message('历史基础需要一个资料日期，避免被当成当前进度。');return;}
 if(item.category==='constraint'&&(item.certainty!=='confirmed'||item.sensitivity!=='standard')){message('硬性要求需已确认，且不含错题复盘细节；其他信息可记为偏好或进度说明。');return;}
 await persist(item);
});
document.addEventListener('click',async e=>{
 const button=e.target.closest('[data-memory-action]');if(!button){if(active&&e.target.id==='modal')close();return;}
 const action=button.dataset.memoryAction;if(action==='open'){await open(button.dataset.memorySubject);return;}if(action==='close'){close();return;}if(!active||busy||!profile)return;
 if(action==='new'){editor();return;}
 if(action==='edit'){editor(profile.entries.find(v=>v.key===button.dataset.memoryKey));return;}
 if(action==='toggle'){const found=profile.entries.find(v=>v.key===button.dataset.memoryKey);if(!found)return;const {confirmedAt,entryRevision,...item}=found;await persist({...item,active:!item.active,source:{kind:'user_confirmation',reference:'本人在 App 切换规则有效性'}});return;}
 if(action==='retry'&&pending){await persist(null,true);return;}
 if(action==='history'){const ticket=epoch;lock(true);try{const history=await call('/history');if(ticket!==epoch)return;$('memory-history-list').innerHTML='<h3>最近旧版本</h3>'+history.versions.map(v=>'<details><summary>版本 '+Number(v.revision)+' · '+escape(v.updatedAt)+'</summary>'+v.document.entries.map(e=>card(e,true)).join('')+'</details>').join('');message('旧版本只供查看，修改请使用当前档案。');}catch(error){if(ticket===epoch)message(error.message||'旧版本暂时不可用。');}finally{if(ticket===epoch)lock(false);}}
});
document.addEventListener('change',e=>{if(active&&!busy&&e.target.id==='memory-subject')void open(e.target.value);});
document.addEventListener('keydown',e=>{if(active&&e.key==='Escape')close();});
document.addEventListener('banya-modal-dismiss',()=>{if(active)close();});
})(window);

/* M7.3 owner-only controls. No provider credentials or background model calls. */
(function(root){'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const types={english:['阅读','新题型','完形','翻译','写作','复盘','机动','综合','模考'],politics:['课程','刷题','复盘','模拟','背诵']};
let active=false,busy=false,epoch=0,current='english',status=null;
const api=(path,method='GET',body)=>root.BanyaCloudSync.assistantRequest('auto/'+path,method,body);
function say(text){if(active&&$('auto-state'))$('auto-state').textContent=text;}
function grant(){return status?.grants.find(g=>g.subject===current);}
function close(){epoch++;active=false;status=null;$('modal').classList.add('hidden');$('modal').innerHTML='';document.body.classList.remove('modal-open');}
function changeCard(x,reasons){const before=x.before,after=x.after;const text=t=>t?esc(t.date)+' · 预计 '+Number(t.minutes)+' 分钟':'无原任务';const reason=reasons.find(r=>r.taskId===x.taskId)?.reason;return '<div class="auto-diff"><b>'+esc(after?.title||before?.title||'未来任务')+'</b><div><span>调整前</span><p>'+text(before)+'</p></div><div><span>调整后</span><p>'+text(after)+'</p></div>'+(reason?'<p class="auto-reason">'+esc(reason)+'</p>':'')+'</div>'; }
function form(){
 const g=grant(),c=g?.config||{},tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10),end=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
 const checkbox=(id,label,on)=>'<label class="auto-check"><input type="checkbox" id="auto-'+id+'" '+(on?'checked':'')+'>'+label+'</label>';
 $('auto-form').innerHTML='<label class="form-line"><span>科目</span><select id="auto-subject"><option value="english" '+(current==='english'?'selected':'')+'>英语二</option><option value="politics" '+(current==='politics'?'selected':'')+'>政治</option></select></label>'
 +checkbox('enabled','授权管理这个科目',g?.enabled)+'<p class="setting-note">仅调整未来计划；已完成、不做、实际用时、错题和笔记受到保护。</p>'
 +'<div class="writing-time-fields"><label class="form-line"><span>开始日期</span><input type="date" id="auto-start" value="'+esc(c.start||tomorrow)+'"></label><label class="form-line"><span>结束日期（最多30天）</span><input type="date" id="auto-end" value="'+esc(c.end||end)+'"></label></div>'
 +'<label class="form-line"><span>本学科助手月费用上限（'+(status.currency==='CNY'?'人民币':'美元')+'）</span><input id="auto-budget" type="number" min="0" max="100" step="0.01" value="'+((c.monthlyBudgetCents||0)/100)+'"></label><p class="setting-note">默认0，不能调用。还会同时受到服务器总预算限制；计数为保守预留，不是账单。</p>'
 +'<details class="record-extra"><summary>调整范围和次数限制</summary><fieldset><legend>允许调整的任务类型</legend>'+types[current].map((t,i)=>checkbox('type-'+i,esc(t),(c.types||[]).includes(t))).join('')+'</fieldset><fieldset><legend>允许修改的内容</legend>'+[['date','日期'],['title','名称'],['detail','任务说明'],['minutes','预计用时']].map(([k,v])=>checkbox('field-'+k,v,(c.fields||['minutes']).includes(k))).join('')+'</fieldset>'
 +checkbox('add','允许新增任务',c.allowAdd)+checkbox('periodic','允许定期分析（仍受费用和次数限制）',c.periodic)+checkbox('review','允许分析错题题号与笔记',c.shareReview)
 +[['max','每次最多修改几项',c.maxChanges||1,1,3],['daily','每日最多调用',c.dailyCalls||1,1,3],['weekly','每周最多调用',c.weeklyCalls||3,1,10],['monthly','每月最多调用',c.monthlyCalls||10,1,40],['cooldown','两次调用至少间隔（小时）',c.cooldownHours||12,6,168]].map(([id,label,value,min,max])=>'<label class="form-line"><span>'+label+'</span><input id="auto-'+id+'" type="number" min="'+min+'" max="'+max+'" value="'+value+'"></label>').join('')+'</details>'
 +checkbox('consent','我同意在以上范围内分析私人学习资料并自主调整未来计划',false)+'<p class="setting-note">长期档案中的学习时间要求仍由服务器校验。任何冲突都会停止，不会强行覆盖。</p><button class="cta" type="submit">保存本学科授权</button>';
 $('auto-master').textContent=status.control.enabled?'暂停全部自动管理':'开启自动管理总开关';
 $('auto-master').disabled=!status.serverReady&&!status.control.enabled;
 $('auto-ready').textContent=status.serverReady?'服务器已具备调用条件；只有总开关和科目授权都开启才会执行。':'服务器尚未启用，当前不会调用模型。可以先保存关闭状态的权限设置。';
 const labels={applied:'已调整计划',undone:'已撤销',no_change:'维持原计划',stopped:'已停止',pending:'处理中',unknown:'结果待核实'};
 $('auto-runs').innerHTML=status.runs.some(r=>r.subject===current)?status.runs.filter(r=>r.subject===current).map(r=>'<article class="ai-proposal"><h3>'+esc(r.subject==='english'?'英语二':'政治')+' · '+esc(labels[r.status]||'已停止')+'</h3><p>'+esc(r.result?.summary||r.result?.reason||'')+'</p><p class="setting-note">'+esc(new Date(r.createdAt*1000).toLocaleString())+'</p>'+(r.result?.changes||[]).map(x=>changeCard(x,r.result?.reasons||[])).join('')+(r.status==='applied'?'<button type="button" class="cta ghost" data-auto-action="undo" data-run="'+esc(r.id)+'" data-subject="'+r.subject+'">撤销这次调整</button>':'')+'</article>').join(''):'<p class="setting-note">还没有自动修改记录。</p>';
}
async function load(){const ticket=epoch;const result=await api('status');if(!active||ticket!==epoch)return;status=result;form();}
async function open(subject,history=false){if(active||busy)return;current=types[subject]?subject:'english';active=true;epoch++;const box=$('modal');box.innerHTML='<div class="modal-card'+(history?' auto-history-mode':'')+'"><header class="modal-head"><h2>'+(history?'计划调整记录':'AI 自动管理')+'</h2><button type="button" class="close" data-auto-action="close" aria-label="关闭自动管理">×</button></header><p id="auto-ready" class="setting-note">正在查询授权状态…</p><button type="button" id="auto-master" class="cta secondary" data-auto-action="master" disabled>总开关 · 默认关闭</button><p id="auto-state" role="status"></p><form id="auto-form"></form><details class="auto-history" id="auto-history"><summary>修改历史与撤销</summary><div id="auto-runs"></div></details></div>';box.classList.remove('hidden');document.body.classList.add('modal-open');try{await load();if(active&&history){$('auto-form').hidden=true;$('auto-history').open=true;$('modal').querySelector('.modal-card').scrollTop=0;}}catch(error){say(error.message||'授权状态暂时无法读取');}}
async function operation(fn){if(!active||busy||!status)return;const ticket=epoch;busy=true;$('auto-form').querySelectorAll('button,input,select').forEach(x=>x.disabled=true);$('auto-master').disabled=true;say('正在保存，请稍候…');try{const result=await fn();if(!active||ticket!==epoch)return;await load();say(result||'设置已保存。');if(typeof Event==='function')document.dispatchEvent?.(new Event('banya-ai-status-change'));}catch(error){if(active&&ticket===epoch){say((error.message||'操作未完成')+'。请关闭后重新打开核对状态，勿重复提交。');}}finally{busy=false;if(active&&ticket===epoch){$('auto-form').querySelectorAll('button,input,select').forEach(x=>x.disabled=false);$('auto-master').disabled=!status.serverReady&&!status.control.enabled;}}}
document.addEventListener('change',e=>{if(active&&!busy&&e.target.id==='auto-subject'){current=e.target.value;form();}});
document.addEventListener('submit',e=>{if(e.target.id!=='auto-form')return;e.preventDefault();if(!active||busy||!status)return;const on=id=>$('auto-'+id).checked,num=id=>Number($('auto-'+id).value);if(!types[current].some((_,i)=>on('type-'+i))||!['date','title','detail','minutes'].some(k=>on('field-'+k))){say('请在调整范围中至少选择一种任务和一项内容。');return;}if(on('enabled')&&!status.serverReady){say('服务器尚未启用，请先保存关闭状态。');return;}if(on('enabled')&&!on('consent')){say('请确认授权范围后勾选同意。');return;}const body={expectedRevision:grant()?.revision||0,enabled:on('enabled'),start:$('auto-start').value,end:$('auto-end').value,fields:['date','title','detail','minutes'].filter(k=>on('field-'+k)),types:types[current].filter((_,i)=>on('type-'+i)),allowAdd:on('add'),maxChanges:num('max'),dailyCalls:num('daily'),weeklyCalls:num('weekly'),monthlyCalls:num('monthly'),monthlyBudgetCents:Math.round(num('budget')*100),cooldownHours:num('cooldown'),periodic:on('periodic'),shareReview:on('review'),dataConsent:on('consent'),confirmation:'save_auto_permission'};operation(async()=>{await api('grants/'+current,'POST',body);return '本学科授权已保存。';});});
document.addEventListener('click',e=>{const b=e.target.closest('[data-auto-action]');if(!b)return;const a=b.dataset.autoAction;if(a==='open'){open(b.dataset.subject,b.dataset.history==='true');return;}if(a==='close'){close();return;}if(a==='master')operation(async()=>{await api('control','POST',{expectedRevision:status.control.revision,enabled:!status.control.enabled,confirmation:'set_auto_control'});return '总开关已更新。';});if(a==='undo')operation(async()=>{if(!confirm('撤销这次计划调整并暂停本学科自动管理？有新记录时会停止撤销。'))return '已取消撤销。';const state=await root.BanyaCloudSync.prepareAssistant(b.dataset.subject);await api('runs/'+b.dataset.run+'/undo','POST',{expectedRevision:state.revision,confirmation:'undo_plan'});const ok=await root.BanyaCloudSync.syncAll(true);return ok?'已撤销并同步，自动管理已暂停。':'云端已撤销；请到设置完成手机同步。';});});
document.addEventListener('keydown',e=>{if(active&&e.key==='Escape')close();});
document.addEventListener('banya-modal-dismiss',()=>{if(active)close();});
root.BanyaAutoManagement={open};
})(window);

/* Owner activation is separate from installing credentials and from per-subject grants. */
(function(root){'use strict';
let active=false,busy=false,epoch=0,status=null;
const $=id=>document.getElementById(id),api=(path,method='GET',body)=>root.BanyaCloudSync.assistantRequest(path,method,body);
function close(){epoch++;active=false;status=null;$('modal').classList.add('hidden');$('modal').innerHTML='';document.body.classList.remove('modal-open');}
function show(){if(!active)return;$('activation-info').textContent=status.ready?'AI 已启用。只有主动发送消息，或已授权的自动管理满足条件时，才可能产生费用。':status.configuredReady?'服务器配置已准备好，等待你的启用确认。':'服务器未准备好，当前不会调用付费模型。';$('activation-budget').textContent=root.BanyaAIBilling.format(status)+'。达到预算后暂停；超时不自动重试。';const b=$('activation-save');b.textContent=status.activation.enabled?'暂停所有 AI 调用':'确认启用 AI 调用';b.disabled=!status.configuredReady&&!status.activation.enabled;}
async function open(){if(active||busy)return;active=true;const ticket=++epoch;const box=$('modal');box.innerHTML='<div class="modal-card"><header class="modal-head"><h2>AI 启用与费用</h2><button type="button" class="close" data-activation-action="close" aria-label="关闭">×</button></header><p id="activation-info">正在查询配置…</p><p class="setting-note" id="activation-budget"></p><p class="setting-note">密钥只保存在服务器。这里不会显示或接收密钥；查询状态和切换开关不会调用模型。自动调整未来计划还需要单独的科目授权。</p><button type="button" class="cta" id="activation-save" data-activation-action="save" disabled>等待配置</button><p id="activation-state" role="status"></p></div>';box.classList.remove('hidden');document.body.classList.add('modal-open');try{const result=await api('status');if(active&&ticket===epoch){status=result;show();}}catch(error){if(active&&ticket===epoch)$('activation-state').textContent=error.message;}}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-activation-action]');if(!b)return;const action=b.dataset.activationAction;if(action==='open'){open();return;}if(action==='close'){close();return;}if(action!=='save'||!active||busy||!status)return;const enabled=!status.activation.enabled;if(enabled&&!confirm('按显示的费用与次数上限启用 AI？主动聊天和已授权的自动规划会产生 API 费用。'))return;busy=true;b.disabled=true;const ticket=epoch;try{await api('activation','POST',{expectedRevision:status.activation.revision,enabled,currency:status.currency||'USD',confirmation:'set_ai_activation'});const result=await api('status');if(active&&ticket===epoch){status=result;show();$('activation-state').textContent='开关已保存，本次没有调用模型。';if(typeof Event==='function')document.dispatchEvent?.(new Event('banya-ai-status-change'));}}catch(error){if(active&&ticket===epoch)$('activation-state').textContent=(error.message||'未能确认结果')+'。请重新打开核对，勿重复提交。';}finally{busy=false;}});
document.addEventListener('keydown',e=>{if(active&&e.key==='Escape')close();});
document.addEventListener('banya-modal-dismiss',()=>{if(active)close();});
})(window);
