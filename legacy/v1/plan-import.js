/* Chat-confirmed plan changes: local-only, preview-first, no AI/API credentials. */
(function(root){
'use strict';
const FORMAT='banya-plan-changes-v1';
const KEYS={english:'yantu_english_2026_m1',politics:'yantu_politics_2026_v1'};
const TYPES={english:['写作','新题型','翻译','完形','阅读','复盘','机动','综合','模考','单词'],politics:['课程','刷题','复盘','模拟','背诵']};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const validId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{8,50}$/.test(x);
const text=x=>String(x==null?'':x);
const escape=x=>text(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function parse(input){
 if(typeof input!=='string'||input.length>40000)throw Error('变更内容过长或格式无效');
 let data;try{data=JSON.parse(input.trim())}catch{throw Error('请粘贴完整的 JSON 计划变更包');}
 if(!object(data)||data.format!==FORMAT||!['english','politics'].includes(data.subject)||!validId(data.batchId)||
    !Array.isArray(data.changes)||data.changes.length<1||data.changes.length>40||
    Object.keys(data).some(k=>!['format','subject','batchId','planVersion','changes'].includes(k)))throw Error('计划变更包格式无效');
 if(data.planVersion!==undefined&&(typeof data.planVersion!=='string'||!data.planVersion||data.planVersion.length>100))throw Error('计划版本无效');
 for(const c of data.changes){
  if(!object(c)||!['update','add','notDo'].includes(c.op)||Object.keys(c).some(k=>!['op','taskId','fromDate','matchTitle','toDate','date','title','detail','minutes','type'].includes(k)))throw Error('存在不支持的任务操作');
  if(c.op==='add'){
   if(!['title','date','minutes','type'].every(k=>k in c)||'taskId'in c||'fromDate'in c||'matchTitle'in c||'toDate'in c)throw Error('新增任务缺少必要字段');
   if(!TYPES[data.subject].includes(c.type))throw Error('新增任务类型无效');
  }else{
   if(!c.taskId&&!(c.fromDate&&c.matchTitle))throw Error('修改任务必须指定任务ID或原日期与完整原标题');
   if('type'in c||'date'in c||(c.op==='notDo'&&['toDate','title','detail','minutes'].some(k=>k in c)))throw Error('操作字段不正确');
  }
  for(const k of ['taskId','matchTitle','title','detail']){
   if(k in c&&(typeof c[k]!=='string'||(k!=='detail'&&!c[k].trim())||c[k].length>(k==='detail'?3000:200)))throw Error('任务文字格式无效');
  }
  if('minutes'in c&&(!Number.isInteger(c.minutes)||c.minutes<1||c.minutes>90))throw Error('预计时长必须为1～90分钟');
  for(const k of ['fromDate','toDate','date'])if(k in c&&(typeof c[k]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(c[k])))throw Error('日期格式必须为 YYYY-MM-DD');
 }
 return data;
}
function preview(packet,plan,rawState,core){
 const data=typeof packet==='string'?parse(packet):parse(JSON.stringify(packet));
 if(!core||!core.validPlan(plan))throw Error('当前计划模板无法校验，已停止导入');
 if(data.planVersion&&data.planVersion!==plan.meta.planVersion)throw Error('计划版本已更新，请重新生成对应版本的变更包');
 const english=data.subject==='english',state=english?core.normalizeState(rawState):core.normalize(rawState);
 const before=structuredClone(state),lines=[],skipped=[],changedDates=new Set(),used=new Set();
 const inRange=date=>english?core.inRange(date):core.cleanDate(date)&&date>=plan.meta.start&&date<=plan.meta.end;
 const dayTasks=date=>{
  if(!inRange(date))throw Error('日期超出当前计划范围：'+date);
  const value=core.tasks(plan,state,date);
  if(!value)throw Error('无法读取当前日期任务');
  return english?value:value.items;
 };
 for(let i=0;i<data.changes.length;i++){
  const c=data.changes[i];
  if(c.op==='add'){
   if(!inRange(c.date))throw Error('新增任务超出计划范围');
   const id=(english?'custom-':'p-custom-')+'chat-'+data.batchId+'-'+i;
   if([...plan.days.flatMap(d=>d.items),...state.added].some(t=>t.id===id))throw Error('这份变更包中的新增任务已经存在，请勿重复应用');
   const added={id,date:c.date,title:c.title,minutes:c.minutes,type:c.type,detail:c.detail||'按今日计划完成并记录实际用时。'};
   if(english)added.custom=true;
   state.added.push(added);
   changedDates.add(c.date);lines.push('新增 '+c.date+' '+c.title+'（'+c.minutes+'分钟）');
   continue;
  }
  if(c.fromDate!==undefined&&!inRange(c.fromDate))throw Error('原任务日期超出范围');
  if(c.toDate!==undefined&&!inRange(c.toDate))throw Error('目标日期超出范围');
  if(c.taskId!==undefined&&(typeof c.taskId!=='string'||c.taskId.length>160||['__proto__','constructor','prototype'].includes(c.taskId)))throw Error('任务ID无效');
  const candidates=c.fromDate?dayTasks(c.fromDate):plan.days.flatMap(d=>dayTasks(d.date));
  const matches=candidates.filter(t=>(!c.taskId||t.id===c.taskId)&&(!c.matchTitle||t.title===c.matchTitle)&&!t.vocab);
  if(matches.length!==1)throw Error('任务匹配不唯一或不存在，请核对原日期、完整原标题或任务ID');
  const t=matches[0],id=t.id;
  if(used.has(id))throw Error('同一任务不能在变更包内重复修改');
  used.add(id);
  // Protected history stays untouched. The user sees every omission before approving a partial import.
  if(state.done[id]||state.notDone[id]){
   skipped.push('未应用 '+t.date+' '+t.title+'：原任务'+(state.done[id]?'已完成':'已选不做')+
    (c.op==='update'?'；变更包中的新安排尚未补入':'；原状态保留'));
   continue;
  }
  if([state.notes[id],state.questionIds[id],state.actualMinutes[id],state.actualWritingMinutes[id],state.actualReviewMinutes[id],state.wrong[id]].some(x=>x!==undefined&&x!=='')){
   skipped.push('未应用 '+t.date+' '+t.title+'：已有学习记录，原记录保留'+(c.op==='update'?'；新安排尚未补入':''));
   continue;
  }
  changedDates.add(t.date);
  if(c.op==='notDo'){
   state.notDone[id]=true;
   lines.push('不做 '+t.date+' '+t.title+'（不计入完成）');
   continue;
  }
  if(!['title','detail','minutes','toDate'].some(k=>k in c))throw Error('修改任务没有提供新内容');
  if(c.toDate)changedDates.add(c.toDate);
  if(c.toDate&&c.toDate!==t.date)state.moved[id]=c.toDate;
  const edit={...(state.edits[id]||{})};
  for(const k of ['title','detail','minutes'])if(k in c)edit[k]=c[k];
  if('minutes'in c){delete edit.writingMinutes;delete edit.reviewMinutes;}
  if(Object.keys(edit).length)state.edits[id]=edit;
  lines.push('调整 '+t.date+' '+t.title+' → '+(c.toDate||t.date)+' '+(c.title||t.title)+'（'+(c.minutes||t.minutes)+'分钟）');
 }
 const next=english?core.normalizeState(state):core.normalize(state);
 for(const date of changedDates){
  const items=english?core.tasks(plan,next,date).filter(t=>!t.vocab):core.tasks(plan,next,date).items;
  const base=english?next.settings.vocab:0;
  const newTotal=base+items.reduce((n,t)=>n+t.minutes,0);
  if(newTotal>135)throw Error(date+' 安排超出每天135分钟上限（含英语背单词），请减少任务或改期');
 }
 // Only the relevant subject's plan overlay and explicit "notDo" marks change.
 for(const field of Object.keys(before)){
  if(['added','moved','edits','notDone'].includes(field))continue;
  if(JSON.stringify(before[field])!==JSON.stringify(next[field]))throw Error('已停止：检测到学习记录可能变化');
 }
 return {subject:data.subject,state:next,lines,skipped,batchId:data.batchId,changedDates:[...changedDates].sort()};
}
function panel(){
 return '<section class="setting-section" aria-label="从聊天导入私人计划">'+
 '<h2>从聊天导入计划</h2><p class="setting-note">把确认后的计划变更包粘贴到下方，先预览再应用。只改本机选定科目的任务，不修改已完成、错题或实际用时；应用后可用原有云同步。</p>'+
 '<label class="form-line"><span>计划变更包（JSON）</span><textarea id="banya-plan-import-text" rows="5" maxlength="40000" placeholder="在 ChatGPT 复制完整变更包后粘贴"></textarea></label>'+
 '<div class="button-row"><button type="button" class="cta secondary small" data-plan-import="preview">检查并预览</button><button type="button" class="cta small" data-plan-import="apply" id="banya-plan-import-apply" disabled>确认应用到本机</button></div>'+
 '<div id="banya-plan-import-result" class="setting-note" role="status" aria-live="polite"></div>'+
 '</section>';
}
let pending=null;
function localPlan(subject){
 if(subject==='politics')return root.POLITICS_PLAN;
 let p=root.STUDY_PLAN;
 try{const v=JSON.parse(localStorage.getItem('yantu_english_plan_v2'));if(root.PlannerCore.validPlan(v))p=v;}catch{}
 return p;
}
function currentCore(subject){return subject==='english'?root.PlannerCore:root.PoliticsCore;}
function renderResult(message,lines){
 const box=document.getElementById('banya-plan-import-result');
 if(!box)return;
 box.textContent=message;
 if(lines&&lines.length){
  const ul=document.createElement('ul');
  for(const line of lines){const li=document.createElement('li');li.textContent=line;ul.appendChild(li);}
  box.appendChild(ul);
 }
}
function reset(){pending=null;const b=document.getElementById('banya-plan-import-apply');if(b){b.disabled=true;b.textContent='确认应用到本机';}}
function initBrowser(){
 document.addEventListener('input',e=>{if(e.target?.id==='banya-plan-import-text')reset();});
 document.addEventListener('click',e=>{
  const button=e.target?.closest?.('[data-plan-import]');if(!button)return;
  const action=button.dataset.planImport;
  if(action==='preview'){
   reset();
   try{
    const input=document.getElementById('banya-plan-import-text')?.value||'';
    const pkg=parse(input),key=KEYS[pkg.subject],raw=localStorage.getItem(key);
    if(raw===null)throw Error('该科目还没有本机学习记录，请先打开科目并保存一条记录');
    const template=localPlan(pkg.subject),templateRaw=JSON.stringify(template);
    const result=preview(pkg,template,JSON.parse(raw),currentCore(pkg.subject));
    const summary='检查结果：'+(pkg.subject==='english'?'英语二':'政治')+'，可应用'+result.lines.length+'项，受保护而跳过'+result.skipped.length+'项。';
    const detail=result.skipped.length?' 跳过的任务不会被修改，也不会自动补上新的阅读安排；请核对后再决定是否只应用其余任务。':' 请核对改动再确认。';
    renderResult(summary+detail,[...result.lines,...result.skipped]);
    if(result.lines.length){
     pending={input,key,raw,templateRaw,result};
     const apply=document.getElementById('banya-plan-import-apply');if(apply){apply.disabled=false;apply.textContent=result.skipped.length?'仅应用其余'+result.lines.length+'项':'确认应用到本机';}
    }
   }catch(error){renderResult(error.message||'预览失败');}
  }
  if(action==='apply'){
   if(!pending)return;
   button.disabled=true;
   try{
    const now=localStorage.getItem(pending.key);
    if(now!==pending.raw)throw Error('预览后本机记录已改变，请重新预览，避免覆盖新的打卡');
    const pkg=parse(pending.input);
    const template=localPlan(pkg.subject);
    if(JSON.stringify(template)!==pending.templateRaw)throw Error('计划模板已经更新，请重新预览');
    const checked=preview(pkg,template,JSON.parse(now),currentCore(pkg.subject));
    const beforeKey=pending.key+'_before_chat_plan_import_'+Date.now();
    localStorage.setItem(beforeKey,now);
    localStorage.setItem(pending.key,JSON.stringify(checked.state));
    reset();
    root.alert('已应用到本机并留存修改前备份。返回设置点击“立即同步”后核对云端状态。');
    root.location.reload();
   }catch(error){reset();renderResult(error.message||'应用失败，本机原记录仍保留');}
  }
 });
}
const api={parse,preview,panel};
if(typeof module==='object'&&module.exports)module.exports=api;
else{root.BanyaPlanImport=api;if(typeof document==='object')initBrowser();}
})(typeof window==='object'?window:globalThis);
