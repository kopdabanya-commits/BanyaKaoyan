/* Private, in-app DeepSeek assistant. Provider credentials never enter the browser. */
(function(root){'use strict';
const PENDING='banya_ai_pending_request_v1',SUBJECTS={english:'英语二',politics:'政治'};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
let epoch=0,pendingOperation=false,opened=false,busy=false,ready=false,uncertain=false,messages=[],draft=null,requestId='';
function panel(subject='english'){return '<section class="setting-section"><h2>学习助手</h2><p class="setting-note">和 DeepSeek 用思考模式讨论安排。先同步真实记录，再看建议；你确认后才修改计划。</p><button type="button" class="cta secondary" data-ai-action="open" data-ai-subject="'+(SUBJECTS[subject]?subject:'english')+'">和 DeepSeek 聊计划</button><button type="button" class="cta ghost" data-memory-action="open" data-memory-subject="'+(SUBJECTS[subject]?subject:'english')+'">学习档案与规则</button><p class="setting-note">需由服务器安全配置密钥与预算。配置完成并启用后才能发送；关闭时不会调用模型。</p></section>';}
function remember(scope){try{sessionStorage.setItem(PENDING,JSON.stringify({id:requestId,...scope}));}catch{}}
function forget(){try{sessionStorage.removeItem(PENDING);}catch{}}
function restored(){try{const r=JSON.parse(sessionStorage.getItem(PENDING));return r&&/^[A-Za-z0-9_-]{8,80}$/.test(r.id)&&SUBJECTS[r.subject]&&/^2026-\d{2}-\d{2}$/.test(r.start)&&/^2026-\d{2}-\d{2}$/.test(r.end)?r:null;}catch{return null;}}
function scope(){return {subject:$('ai-subject').value,start:$('ai-start').value,end:$('ai-end').value};}
function say(message){if(opened&&$('ai-state'))$('ai-state').textContent=message;}
function controls(){if(!opened)return;const locked=busy||pendingOperation;for(const id of ['ai-subject','ai-start','ai-end','ai-review','ai-consent','ai-prompt'])if($(id))$(id).disabled=locked||uncertain||!ready;const send=$('ai-send');if(send)send.disabled=locked||uncertain||!ready;const query=$('ai-query');if(query){query.hidden=!requestId;query.disabled=locked;}const commit=$('ai-commit');if(commit)commit.disabled=locked||uncertain||!ready;}
function renderMessages(){if(opened)$('ai-messages').innerHTML=messages.map(m=>'<div class="ai-message '+m.role+'"><small>'+(m.role==='user'?'你':'DeepSeek · 思考模式')+'</small><p>'+esc(m.content)+'</p></div>').join('');}
function preview(result){
 if(!opened)return;
 const box=$('ai-preview');box.innerHTML='';
 if(result.status==='prepared'){
  box.innerHTML='<section class="ai-proposal"><h3>建议改动 · 尚未执行</h3>'+result.changes.map(c=>'<div class="ai-change"><b>'+esc(c.after.title)+'</b><p>'+(c.before?esc(c.before.date)+' · 预计 '+c.before.minutes+' 分钟 → ':'新增 → ')+esc(c.after.date)+' · 预计 '+c.after.minutes+' 分钟</p>'+(c.before&&c.before.title!==c.after.title?'<p>原标题：'+esc(c.before.title)+'</p>':'')+(c.before?.detail!==c.after.detail?'<p>'+esc(c.after.detail)+'</p>':'')+'</div>').join('')+'<button type="button" id="ai-commit" class="cta" data-ai-action="commit">确认同步这 '+result.changes.length+' 项</button><p class="setting-note">只改所示计划，已有完成、不做和全部学习记录保留。新记录或版本冲突会停止写入。</p></section>';
 }else if(result.status==='applied'){
  box.innerHTML='<section class="ai-proposal"><h3>云端已更新 · 版本 '+Number(result.revision)+'</h3><p>手机是否已收取仍需同步确认。</p><button type="button" class="cta secondary" data-ai-action="receive">接收云端更新</button></section>';
 }
}
function showResult(result){
 draft=result;uncertain=['pending','unknown'].includes(result.status);
 if(result.reply){const prior=messages.find(m=>m.role==='assistant'&&m.requestId===result.requestId);if(prior)prior.content=result.reply;else messages.push({role:'assistant',content:result.reply,requestId:result.requestId});}
 messages=messages.slice(-12);renderMessages();preview(result);
 const labels={prepared:'建议已准备好，核对后再确认同步。',discussion:'这次只讨论，没有修改计划。',rejected:'建议未通过计划保护校验，没有修改；请缩小改动或说明具体任务。',conflict:'记录或模板已变化，没有写入。请重新同步，再生成建议。',expired:'建议已过期，没有写入。请重新讨论。',unknown:'本次结果未能确认，没有自动重试；可能已产生调用费。先查询结果，再决定是否新开对话。',pending:'服务器仍在处理。稍后查询即可，不会再次调用模型。',applied:'服务器已保存。手机接收状态尚待确认。'};
 const reasons={completed_or_not_doing_task_is_protected:'已完成或不做的任务不能改动。',day_budget_exceeded:'某天安排过满，请减少预计时长或调整日期。',destination_date_outside_grant:'改动日期超出了本次选择范围。',source_date_outside_grant:'原任务不在本次选择范围。'};
 say((labels[result.status]||'请查询本次结果。')+(reasons[result.validationCode]||''));controls();
}
function boundDates(subject){
 const meta=(subject==='english'?root.STUDY_PLAN:root.POLITICS_PLAN)?.meta;
 if(!meta)return;
 const d=new Date(),today=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 const shift=n=>{const date=new Date(today+'T12:00:00');date.setDate(date.getDate()+n);return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');};
 for(const id of ['ai-start','ai-end']){$(id).min=meta.start;$(id).max=meta.end;}
 $('ai-start').value=[meta.start,shift(-3),meta.end].sort()[1];$('ai-end').value=[meta.start,shift(10),meta.end].sort()[1];
}
function close(){epoch++;opened=false;messages=[];draft=null;$('modal').classList.add('hidden');$('modal').innerHTML='';document.body.classList.remove('modal-open');}
async function open(initialSubject='english'){
 const cloud=root.BanyaCloudSync;if(!cloud?.isConnected()){root.alert('请先在设置连接云同步，学习助手才有权读取你的记录。');return;}
 const ticket=++epoch;opened=true;busy=true;ready=false;messages=[];draft=null;requestId='';uncertain=false;
 const box=$('modal');box.innerHTML='<div class="modal-card ai-sheet"><div class="modal-head"><h2>学习助手</h2><button type="button" class="close" data-ai-action="close" aria-label="关闭学习助手">×</button></div><p class="setting-note">DeepSeek 思考模式 · 只有主动发送才会调用。每次只读取选定科目与日期范围，密钥留在服务器。</p><div class="ai-scope"><label class="form-line"><span>科目</span><select id="ai-subject"><option value="english">英语二</option><option value="politics">政治</option></select></label><label class="form-line"><span>开始日期</span><input type="date" id="ai-start"></label><label class="form-line"><span>结束日期</span><input type="date" id="ai-end"></label></div><label class="ai-check"><input type="checkbox" id="ai-review">附带错题数、题号与复盘内容（可选）</label><p class="setting-note" id="ai-budget"></p><div id="ai-messages" class="ai-messages" aria-live="polite"></div><div id="ai-preview"></div><form id="ai-chat-form"><label class="form-line"><span>你想怎样调整或分析</span><textarea id="ai-prompt" maxlength="2000" rows="3" placeholder="例如：结合我最近做题的实际用时，看看下周安排是否太满。不要改已完成的任务。"></textarea></label><label class="ai-check"><input type="checkbox" id="ai-consent">同意将所选科目的档案与规则、选定范围的计划、状态、实际用时和对话发送至 DeepSeek，并按用量计费。未勾选的复盘内容不发送。</label><div class="button-row"><button type="submit" id="ai-send" class="cta">发送并思考</button><button type="button" id="ai-query" class="cta ghost" data-ai-action="query" hidden>查询本次结果</button><button type="button" class="cta ghost" data-ai-action="reset">开始新对话</button></div></form><p class="setting-note" id="ai-state" role="status">正在检查连接，不会调用模型…</p><p class="setting-note">只携带最近几轮讨论。切换科目、日期或分享范围会清空当前对话；关闭页面不取消已提交请求，可重新进入后查询。不要粘贴任何密钥。</p></div>';
 box.classList.remove('hidden');document.body.classList.add('modal-open');$('ai-subject').value=SUBJECTS[initialSubject]?initialSubject:'english';boundDates($('ai-subject').value);
 $('ai-review').checked=false;$('ai-consent').checked=false;$('ai-prompt').value='';
 const previous=restored();if(previous){requestId=previous.id;$('ai-subject').value=previous.subject;boundDates(previous.subject);$('ai-start').value=previous.start;$('ai-end').value=previous.end;uncertain=true;}
 controls();
 try{
  const status=await cloud.assistantRequest('status');if(ticket!==epoch)return;ready=!!status.ready;
  if(opened)$('ai-budget').textContent=ready?'思考模式 · 本月调用 '+status.monthlyCalls+'/'+status.monthlyCallLimit+' 次 · 应用预算 $'+status.monthlyBudgetUsd+'（按配置单价保守预留，账单以服务商为准）':'服务器尚未启用。安全配置密钥与费用上限后才能发送；现在不会产生 API 费用。';
  say(ready?(previous?'有上次请求可查询，先查看结果，避免重复调用。':'先选范围，再说你的想法。建议需要单独确认才会保存。'):'付费调用尚未启用。');
 }catch(error){if(ticket===epoch)say(error.message||'暂时无法检查学习助手。');}
 finally{if(ticket===epoch)busy=false;controls();}
}
async function send(){
 if(busy||pendingOperation||uncertain||!ready)return;
 if(!$('ai-consent').checked){say('请先确认本次数据发送与计费授权。');return;}
 if(navigator.onLine===false){say('现在离线，文字留在输入框；联网后再主动发送。');return;}
 const text=$('ai-prompt').value.trim();if(!text){say('先写下你的想法。');return;}
 const ticket=epoch,selected=scope(),review=$('ai-review').checked;let submitted=false;
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
  const result=await root.BanyaCloudSync.assistantRequest('chat','POST',{requestId,...selected,expectedRevision:baseline.revision,messages:conversation,shareReview:review,consent:true});
  if(ticket===epoch){if(opened)$('ai-prompt').value='';showResult(result);}
 }catch(error){
  if(ticket!==epoch)return;
  const rejected=['ai_consent_required','ai_monthly_limit_reached','ai_context_too_large_narrow_dates','ai_remove_credentials_from_message','ai_request_in_progress','ai_invalid_conversation','ai_date_range_at_most_31_days','ai_date_outside_template','revision_conflict','ai_not_configured_or_not_approved','context_required_data_exceeds_budget','profile_schema_incompatible','capability_unavailable'].includes(error.code);
  if(submitted&&!rejected){uncertain=true;say('请求结果未确认，先查询本次结果，避免重复付费。');}
  else {if(submitted){requestId='';forget();}say(error.message||'尚未发送，请先处理同步问题。');}
 }finally{pendingOperation=false;if(ticket===epoch)busy=false;controls();}
}
async function query(){if(busy||pendingOperation||!requestId)return;const ticket=epoch,id=requestId;busy=true;pendingOperation=true;controls();try{const receipt=await root.BanyaCloudSync.assistantRequest('requests/'+id);if(ticket===epoch)showResult(receipt);}catch(error){if(ticket===epoch)say(error.message||'暂时查不到结果，请稍后再查。');}finally{pendingOperation=false;if(ticket===epoch)busy=false;controls();}}

async function commit(){
 if(busy||pendingOperation||uncertain||draft?.status!=='prepared')return;
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
document.addEventListener('submit',e=>{if(e.target.id==='ai-chat-form'){e.preventDefault();void send();}});
document.addEventListener('change',e=>{if(opened&&!busy&&!pendingOperation&&['ai-subject','ai-start','ai-end','ai-review'].includes(e.target.id)){if(e.target.id==='ai-subject')boundDates(e.target.value);reset(e.target.id==='ai-review');}});
document.addEventListener('click',async e=>{
 const button=e.target.closest('[data-ai-action]');if(!button){if(opened&&e.target.id==='modal')close();return;}
 const action=button.dataset.aiAction;
 if(action==='open'){if(!opened)await open(button.dataset.aiSubject);return;}
 if(action==='close'){close();return;}
 if(busy||pendingOperation)return;
 if(action==='query')await query();
 if(action==='commit')await commit();
 if(action==='reset')reset();
 if(action==='receive'){busy=true;controls();try{const ok=await root.BanyaCloudSync.syncAll(true);say(ok?'已完成本机同步核对。':'本机同步未完成，请到设置查看提示。');}finally{busy=false;controls();}}
});
document.addEventListener('keydown',e=>{if(opened&&e.key==='Escape')close();});
root.BanyaStudyAssistant={panel};
})(window);

/* M7.1 owner-only memory editor. No provider calls, no checkin/plan writes. */
(function(root){'use strict';
const $=id=>document.getElementById(id),labels={goal:'目标',history:'历史基础',material:'资料',budget:'时间预算',preference:'偏好',constraint:'硬性要求',progress:'进度说明'};
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let active=false,epoch=0,busy=false,profile=null,editing=null,pending=null,subject='english';
const call=(path,method='GET',body)=>root.BanyaCloudSync.assistantRequest('profiles/'+subject+path,method,body);
function message(text){if(active)$('memory-state').textContent=text;}
function lock(value){busy=value;if(!active)return;for(const id of ['memory-subject','memory-save','memory-new','memory-history','memory-category','memory-sensitive','memory-text','memory-certainty','memory-temporal','memory-observed','memory-until','memory-minutes','memory-min','memory-max','memory-year','memory-material','memory-count','memory-total'])if($(id))$(id).disabled=value;}
function card(e,readonly=false){const today=new Date().toISOString().slice(0,10),expired=e.validUntil&&e.validUntil<today;return '<article class="ai-proposal"><h3>'+escape(labels[e.category])+' · '+(!e.active?'已停用':expired?'已过期，待确认':'生效')+'</h3><p>'+escape(e.value.text)+'</p>'+Object.entries(e.value).filter(([key,value])=>key!=='text'&&value!==null).map(([key,value])=>'<p class="setting-note">'+escape(({minutes:'每日分钟',targetMin:'目标下限',targetMax:'目标上限',examYear:'考试年份',materialState:'资料拥有情况',count:'已知数量',total:'对应总量'})[key]||key)+'：'+escape(({owned:'已拥有',not_owned:'未拥有',unknown:'未知'})[value]||value)+'</p>').join('')+'<p class="setting-note">'+(e.temporal==='historical'?'历史基础，不是打卡':'当前说明')+' · '+({confirmed:'已确认',reported:'用户陈述',estimate:'主观估计',unknown:'未知／待确认'}[e.certainty])+(e.observedOn?' · 资料日期 '+escape(e.observedOn):'')+(e.validUntil?' · 有效至 '+escape(e.validUntil):'')+'</p><p class="setting-note">来源：'+escape(e.source.reference)+' · '+escape(e.source.kind)+'<br>确认于 '+escape(e.confirmedAt)+' · 版本 '+Number(e.entryRevision)+'</p>'+(readonly?'':'<button type="button" class="cta ghost small" data-memory-action="edit" data-memory-key="'+escape(e.key)+'">修改</button><button type="button" class="cta ghost small" data-memory-action="toggle" data-memory-key="'+escape(e.key)+'">'+(e.active?'停用':'重新启用')+'</button>')+'</article>';}
function list(){if(active)$('memory-list').innerHTML=profile.entries.length?profile.entries.map(e=>card(e)).join(''):'<p class="setting-note">还没有学习档案。可以先记一条要求；历史基础不会转为完成记录。</p>';}
function editor(e=null){
 editing=e;if(!active)return;pending=null;$('memory-editor').hidden=false;
 $('memory-sensitive').checked=e?.sensitivity==='review';$('memory-category').value=e?.category||'preference';$('memory-text').value=e?.value.text||'';
 $('memory-certainty').value=e?.certainty||'confirmed';$('memory-temporal').value=e?.temporal||'current';
 $('memory-observed').value=e?.observedOn||'';$('memory-until').value=e?.validUntil||'';
 for(const [id,key] of [['minutes','minutes'],['min','targetMin'],['max','targetMax'],['year','examYear'],['material','materialState'],['count','count'],['total','total']])$('memory-'+id).value=e?.value[key]??'';
 message(e?'修改后保留旧版本，不会改学习记录。':'记下已经确认的要求，或明确标为估计、未知。');
}
function close(){epoch++;active=false;profile=null;editing=null;pending=null;$('modal').innerHTML='';$('modal').classList.add('hidden');document.body.classList.remove('modal-open');}
async function open(initial){
 if(!root.BanyaCloudSync?.isConnected()){root.alert('请先连接云同步，再管理服务器上的私人档案。');return;}
 subject=initial==='politics'?'politics':'english';profile=null;editing=null;pending=null;active=true;const ticket=++epoch;
 const modal=$('modal');modal.innerHTML='<div class="modal-card ai-sheet"><div class="modal-head"><h2>学习档案与规则</h2><button type="button" class="close" data-memory-action="close" aria-label="关闭学习档案">×</button></div><p class="setting-note">这里记目标、基础和长期要求，和真实打卡分开保存。修改档案不调用 DeepSeek，也不调整计划。</p><label class="form-line"><span>科目</span><select id="memory-subject"><option value="english">英语二</option><option value="politics">政治</option></select></label><div class="button-row"><button type="button" id="memory-new" class="cta secondary" data-memory-action="new">记一条要求</button><button type="button" id="memory-history" class="cta ghost" data-memory-action="history">查看旧版本</button></div><p id="memory-state" class="setting-note" role="status"></p><div id="memory-list"></div><form id="memory-editor" hidden><h3>这条信息</h3><label class="ai-check"><input type="checkbox" id="memory-sensitive">包含错题或复盘内容（讨论时需额外同意分享）</label><label class="form-line"><span>类型</span><select id="memory-category">'+Object.entries(labels).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></label><label class="form-line"><span>内容</span><textarea id="memory-text" maxlength="1200" rows="3" required></textarea></label><label class="form-line"><span>确定程度</span><select id="memory-certainty"><option value="confirmed">已确认</option><option value="reported">用户陈述</option><option value="estimate">主观估计</option><option value="unknown">未知／待确认</option></select></label><label class="form-line"><span>时间性质</span><select id="memory-temporal"><option value="current">当前说明</option><option value="historical">历史基础，不是打卡</option></select></label><label class="form-line"><span>资料日期（历史基础必填）</span><input type="date" id="memory-observed"></label><label class="form-line"><span>有效至（可留空）</span><input type="date" id="memory-until"></label><details><summary>补充数值（按需填写）</summary>'+[['minutes','每日分钟',1440],['min','目标下限',150],['max','目标上限',150],['year','考试年份',2100],['count','已知数量',100000],['total','对应总量',100000]].map(([id,label,max])=>'<label class="form-line"><span>'+label+'</span><input type="number" min="'+(id==='year'?2020:id==='total'?1:0)+'" max="'+max+'" id="memory-'+id+'"></label>').join('')+'<label class="form-line"><span>资料拥有情况</span><select id="memory-material"><option value="">未填写</option><option value="owned">已拥有</option><option value="not_owned">未拥有</option><option value="unknown">未知</option></select></label></details><button type="submit" id="memory-save" class="cta">保存这条档案</button></form><button type="button" class="cta ghost" data-memory-action="retry" id="memory-retry" hidden>核对并重试上次保存</button><div id="memory-history-list"></div></div>';
 modal.classList.remove('hidden');document.body.classList.add('modal-open');$('memory-subject').value=subject;lock(true);message('正在读取私人档案，不会调用模型…');
 try{const result=await call('');if(ticket!==epoch)return;profile=result;list();message('档案版本 '+profile.revision+'。没有记录的部分保持未知。');}
 catch(error){if(ticket===epoch)message(error.message||'读取失败，未修改任何记录。');}
 finally{if(ticket===epoch)lock(false);}
}
async function persist(e,retry=false){
 if(busy||!profile)return;const ticket=epoch;
 if(!retry){pending={schemaVersion:1,requestId:'memory-'+crypto.randomUUID(),expectedRevision:profile.revision,entries:[e],confirmation:'save_profile'};}
 lock(true);message('正在备份并保存档案…');
 try{await call('','POST',pending);if(ticket!==epoch)return;profile=await call('');if(ticket!==epoch)return;pending=null;editing=null;list();$('memory-editor').hidden=true;$('memory-retry').hidden=true;message('已保存。旧版本保留，学习记录和计划未改动。');}
 catch(error){if(ticket!==epoch)return;const conflict=['profile_revision_conflict','profile_request_id_reused'].includes(error.code),invalid=['invalid_request','profile_too_large','profile_entry_limit','duplicate_profile_key','profile_remove_credentials'].includes(error.code);$('memory-retry').hidden=conflict||invalid;message(invalid?'内容未通过校验。请核对数值和日期，且不要填写任何密钥。':conflict?'服务器已有新版本，这次没有覆盖。请关闭重开，核对后再改。':'保存结果未确认。可以重试同一次请求；不要重复新增。');}
 finally{if(ticket===epoch)lock(false);}
}
document.addEventListener('submit',async e=>{
 if(e.target.id!=='memory-editor')return;e.preventDefault();if(!active||busy||!profile)return;
 const text=$('memory-text').value.trim();if(!text){message('先填写这条信息。');return;}
 const value={text};for(const [id,key] of [['minutes','minutes'],['min','targetMin'],['max','targetMax'],['year','examYear'],['count','count'],['total','total']]){const v=$('memory-'+id).value;if(v!=='')value[key]=Number(v);}
 if($('memory-material').value)value.materialState=$('memory-material').value;
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
})(window);
