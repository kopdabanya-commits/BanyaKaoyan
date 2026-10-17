/* 板牙考研 · 政治科目：独立本机数据、手动苍盾记录，不读取外部小程序。 */
(function(root){'use strict';
const Core=root.PoliticsCore,plan=root.POLITICS_PLAN,ready=!!(Core&&Core.validPlan(plan));
let blocked=false,lastSaved='',state=null,selected='2026-10-16',openId='',rerender=()=>{},pMonth='2026-10';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function restore(){try{const raw=localStorage.getItem(Core.key);state=raw?Core.normalize(JSON.parse(raw)):Core.defaults();lastSaved=JSON.stringify(state);blocked=false;}catch{blocked=true;state=Core.defaults();}}
if(ready)restore();
function save(){if(blocked)return false;try{const raw=JSON.stringify(state);localStorage.setItem(Core.key,raw);lastSaved=raw;if(typeof root.dispatchEvent==='function'&&typeof Event==='function')root.dispatchEvent(new Event('banya-local-change'));return true}catch{state=JSON.parse(lastSaved);return false}}
function dateAdd(s,n){const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function getDay(s){return Core.tasks(plan,state,s)}
function totals(d){return {done:d.items.filter(t=>state.done[t.id]).length,total:d.items.length,minutes:d.items.reduce((n,t)=>n+t.minutes,0)}}
function todayInPlan(){const n=new Date(),d=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');return getDay(d)?d:plan.meta.start}
function setDate(date){if(!getDay(date))return false;selected=date;pMonth=date.slice(0,7);openId='';root.__politicsSelectionInitialized=true;return true}
function shiftMonth(n){const a=pMonth.split('-').map(Number),d=new Date(Date.UTC(a[0],a[1]-1+n,1));const next=d.toISOString().slice(0,7);if(next<plan.meta.start.slice(0,7)||next>plan.meta.end.slice(0,7))return;pMonth=next;rerender()}
function monthlyCalendar(today){
 const [y,m]=pMonth.split('-').map(Number),offset=(new Date(y,m-1,1).getDay()+6)%7,count=new Date(y,m,0).getDate();
 const days=['一','二','三','四','五','六','日'].map(w=>'<span class="cal-wd">'+w+'</span>');
 for(let i=0;i<offset;i++)days.push('<span></span>');
 for(let i=1;i<=count;i++){
  const key=pMonth+'-'+String(i).padStart(2,'0'),d=getDay(key),p=d?totals(d):null;
  const classes=['cal-day',key===selected?'current':'',key===today?'reddot':'',!d?'dim':'',p&&p.total&&p.done===p.total?'complete':''].filter(Boolean).join(' ');
  days.push('<button class="'+classes+'" data-action="p-day" data-day="'+key+'" '+(!d?'disabled':'')+' aria-label="'+m+'月'+i+'日'+(p?'，完成'+p.done+'/'+p.total+'项':'，计划范围外')+'">'+i+(d?'<i class="cal-dot"></i>':'')+'</button>');
 }
 const date=selected.startsWith(pMonth)?selected:plan.days.find(d=>d.date.startsWith(pMonth))?.date||selected,day=getDay(date),progress=day?totals(day):{done:0,total:0};
 return '<div class="month-head"><button class="round-btn" data-action="p-cal-prev" aria-label="上个月" '+(pMonth===plan.meta.start.slice(0,7)?'disabled':'')+'>‹</button><h2>'+y+'年'+m+'月</h2><button class="round-btn" data-action="p-cal-next" aria-label="下个月" '+(pMonth===plan.meta.end.slice(0,7)?'disabled':'')+'>›</button></div><div class="calendar"><div class="cal-grid">'+days.join('')+'</div><div class="legend"><span><i></i>待练</span><span class="green"><i></i>已完成</span></div></div><section class="calendar-details" aria-label="所选日期的任务"><div class="calendar-details-head"><h2>'+Number(date.slice(5,7))+'月'+Number(date.slice(8))+'日</h2><span>已完成 '+progress.done+'/'+progress.total+'</span></div>'+(day?day.items.map(t=>'<button type="button" class="calendar-task-row" data-action="p-day" data-day="'+esc(date)+'"><span>'+esc(t.title)+'</span><small>'+(state.done[t.id]?'✓ 已完成':'待完成')+'</small></button>').join(''):'<p class="calendar-rest">这天没有安排，按自己的节奏来。</p>')+'</section>';
}

function content(view,today){
 const UI=root.BanyaStudyUI;
 if(!ready)return '<section class="student-page"><h1>政治计划暂不可用</h1><p>请联网检查应用更新。</p></section>';
 if(selected==='2026-10-16'&&today>='2026-10-16'&&today<='2026-12-18'&&!root.__politicsSelectionInitialized){
  selected=today;pMonth=today.slice(0,7);root.__politicsSelectionInitialized=true;
 }
 const warning=blocked?'<div class="skip-banner" role="alert">政治记录读取失败，已停止写入，避免覆盖原数据。</div>':'';
 const sub='<span class="student-subject-label">政治复习</span>';
 if(view==='calendar'){
  return '<div class="student-page student-politics">'+sub+UI.header('日历','选择日期查看安排')+warning+monthlyCalendar(today)+'</div>';
 }
 if(view==='stats'){
  const dates=plan.days.filter(d=>d.date<=today).map(d=>getDay(d.date)),recent=dates.map(d=>({date:d.date,...totals(d)}));
  const groups=new Map();
  for(const day of dates)for(const task of day.items){
   if(!groups.has(task.type))groups.set(task.type,{label:task.type,done:0,total:0});
   const row=groups.get(task.type);row.total++;if(state.done[task.id])row.done++;
  }
  const q=state.questions.marx||{done:0,total:396};
  const questionCard='<section class="student-stat-section"><h2>肖1000题 · 马原</h2><p>手动登记：'+q.done+'/'+q.total+' 题</p>'
  +'<form id="p-progress-form" class="p-progress-form"><label>已做<input type="number" id="p-questions" min="0" max="10000" value="'+q.done+'" required></label><label>总题数<input type="number" id="p-total" min="1" max="10000" value="'+q.total+'" required></label><button class="cta small" type="submit">保存</button></form>'
  +'<p class="student-quiet">仅为马原题库进度，不代表政治总成绩。</p></section>';
  return '<div class="student-page student-politics">'+sub+warning+UI.stats({days:recent,categories:[...groups.values()],today,subject:'politics'})+questionCard+'</div>';
 }
 if(view==='settings'){
  const theme=document.documentElement?.dataset?.theme||'light';
  return '<div class="student-page student-politics">'+sub+UI.header('设置')+warning
   +'<section class="setting-section"><h2>学习偏好</h2><div class="setting-row-title"><span>外观</span><div class="theme-switch" role="group" aria-label="外观配色"><button type="button" data-action="theme" data-theme="light" class="'+(theme==='light'?'selected':'')+'" aria-pressed="'+(theme==='light')+'">浅色</button><button type="button" data-action="theme" data-theme="dark" class="'+(theme==='dark'?'selected':'')+'" aria-pressed="'+(theme==='dark')+'">深色</button></div></div></section>'
   +'<section class="setting-section"><h2>给对话看的近况</h2><button class="cta secondary" data-action="p-copy-summary">复制近14天记录</button><p class="setting-note">只会复制这台设备已保存的记录。粘贴给你信任的对话后，才会离开本机。</p></section>'
   +'<section class="setting-section"><h2>备份与恢复</h2><div class="button-row"><button class="cta secondary" data-action="p-export">导出政治备份</button><button class="cta ghost" data-action="p-import">导入备份</button></div><input type="file" id="p-import-file" accept=".json,application/json" hidden></section>'
   +'<section class="setting-section"><h2>应用更新</h2><button class="cta secondary" data-action="refresh-app">检查应用更新</button></section></div>';
 }
 const day=getDay(selected)||getDay(plan.days[0].date),p=totals(day),pending=day.items.filter(t=>!state.done[t.id]);
 const heading=UI.dayHeading({date:day.date,today,start:plan.meta.start,end:plan.meta.end,done:p.done,total:p.total,remaining:pending.reduce((n,t)=>n+t.minutes,0),subtitle:day.stage+' · '+day.topic,prev:'p-day',next:'p-day',jump:'p-today',attribute:'day'});
 const cards=day.items.map(t=>UI.task({item:t,day:day.date,done:!!state.done[t.id],wrong:state.wrong[t.id],hasNote:!!state.notes[t.id],subject:'politics',next:t.id===pending[0]?.id})).join('');
 return '<div class="student-page student-politics" data-day-swipe="true">'+sub+warning+heading
 +'<div class="student-section-heading"><h2>今日任务</h2><span>共 '+day.items.length+' 项</span><button type="button" class="cta secondary small" data-action="p-add-task">+ 加一项</button></div>'
 +'<div class="student-task-list">'+cards+'</div></div>';
}

function render(view,today,escape,refresh){rerender=refresh;return content(view,today)}
function showPoliticsTask(id){
 const t=getDay(selected)?.items.find(item=>item.id===id);
 if(!t)return;
 const box=document.getElementById('modal');
 if(!box||!box.classList){openId=id;rerender();return}
 box.innerHTML='<div class="modal-card"><div class="modal-head"><div><span class="eyebrow">专项训练 · '+esc(t.type)+'</span><h2>训练记录</h2></div><button class="close" type="button" data-action="p-note-close" aria-label="关闭训练记录">×</button></div>'
 +'<div class="quickflex task-overview"><div><b>'+esc(t.title)+'</b><br><span>预计'+t.minutes+'分钟 · '+(state.done[id]?'已完成':'未完成')+'</span></div></div>'
 +'<section class="study-guide"><span class="guide-label">这项练习怎么做</span><p>'+esc(t.detail)+'</p></section>'
 +'<form id="p-task-form" data-id="'+esc(id)+'"><label class="form-line"><span>错题数（可选）</span><input id="p-wrong" type="number" inputmode="numeric" min="0" max="100" value="'+(state.wrong[id]??'')+'"></label>'
 +'<label class="form-line"><span>错的是哪几题（可选）</span><input id="p-question-ids" maxlength="500" placeholder="例如 马原第3、8题" value="'+esc(state.questionIds[id]||'')+'"></label>'
 +'<label class="form-line"><span>实际用了多久（可选）</span><input id="p-actual-minutes" type="number" inputmode="numeric" min="1" max="600" placeholder="分钟" value="'+esc(state.actualMinutes[id]??'')+'"></label>'
 +'<label class="form-line"><span>简短记录（可选）</span><textarea id="p-note" rows="2" maxlength="3000">'+esc(state.notes[id]||'')+'</textarea></label>'
 +'<div class="button-row record-actions"><button class="cta" type="submit">保存记录</button><button class="cta ghost" type="button" data-action="p-note-close">取消</button></div></form>'
 +'<div class="button-row"><button type="button" class="cta ghost small" data-action="p-edit-task" data-id="'+esc(id)+'">修改计划项</button><button type="button" class="cta ghost small" data-action="p-remove-task" data-id="'+esc(id)+'">从计划移除</button></div></div>';
 box.classList.remove('hidden');
 document.body?.classList?.add?.('modal-open');
 box.querySelector?.('input,button,textarea')?.focus?.();
}
function showPlanForm(id=''){
 const task=id?getDay(selected)?.items.find(t=>t.id===id):null;
 if(id&&!task)return;
 const box=document.getElementById('modal');if(!box)return;
 box.innerHTML='<div class="modal-card"><div class="modal-head"><h2>'+(task?'修改政治计划':'添加政治任务')+'</h2><button type="button" class="close" data-action="p-note-close" aria-label="关闭">×</button></div>'+
 '<form id="p-plan-form" data-id="'+esc(id)+'"><label class="form-line"><span>任务名称</span><input id="p-plan-title" maxlength="200" required value="'+esc(task?.title||'')+'"></label>'+
 '<label class="form-line"><span>预计分钟</span><input id="p-plan-minutes" type="number" min="1" max="90" required value="'+esc(task?.minutes||30)+'"></label>'+
 '<p class="setting-note">仅修改你的私人计划，原有打卡和笔记会保留。</p><div class="button-row"><button type="submit" class="cta">保存计划</button><button type="button" class="cta ghost" data-action="p-note-close">取消</button></div></form></div>';
 box.classList.remove('hidden');document.body?.classList?.add?.('modal-open');box.querySelector?.('input,button,textarea')?.focus?.();
}
function closePoliticsTask(){
 const box=document.getElementById('modal');
 box?.classList?.add?.('hidden');
 document.body?.classList?.remove?.('modal-open');
 openId='';rerender();
}
function download(){const data=JSON.stringify({app:'yantu-politics',version:1,exportedAt:new Date().toISOString(),state},null,2);const blob=new Blob([data],{type:'application/json'}),href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download='板牙考研_政治备份_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(href),3000)}
function summaryText(){const now=new Date(),iso=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0'),today=iso>plan.meta.end?plan.meta.end:iso,start=dateAdd(today,-13),lines=['板牙考研 · 政治学习记录（仅复制给你信任的对话）','生成日期：'+iso,'近14天情况：'];for(const base of plan.days.filter(x=>x.date>=start&&x.date<=today)){const d=getDay(base.date);lines.push(d.date+'：'+d.items.map(t=>t.title+(state.done[t.id]?'[完成]':'[未完成]')+(state.wrong[t.id]!==undefined?'(错'+state.wrong[t.id]+')':'')).join('；'));for(const t of d.items){if(state.questionIds[t.id])lines.push('  错题题号（'+t.title+'）：'+state.questionIds[t.id]);if(state.actualMinutes[t.id])lines.push('  实际用时（'+t.title+'）：'+state.actualMinutes[t.id]+'分钟');if(state.notes[t.id])lines.push('  复盘（'+t.title+'）：'+state.notes[t.id])}}return lines.join('\n')}
async function copySummary(){const value=summaryText();try{await navigator.clipboard.writeText(value);alert('政治近况已复制，可以粘贴到对话里。')}catch{const box=document.getElementById('modal');box.innerHTML='<div class="modal-card"><div class="modal-head"><h2>政治近况</h2><button type="button" class="close" data-action="p-note-close" aria-label="关闭">×</button></div><textarea class="share-text" readonly>'+esc(value)+'</textarea></div>';box.classList.remove('hidden')}}
function report(success){if(!success)alert('保存失败，旧数据没有被覆盖。建议检查浏览器存储空间。');rerender()}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b||!String(b.dataset.action).startsWith('p-')||!ready)return;e.stopImmediatePropagation?.();e.preventDefault?.();const act=b.dataset.action,id=b.dataset.id;
 if(act==='p-today'){root.BANYA_SELECT_DAY?.(todayInPlan());return}
 if(act==='p-day'){if(!getDay(b.dataset.day))return;if(root.BANYA_VIEW?.()==='calendar'&&!document.body?.classList?.contains?.('day-detail-open')){root.BANYA_OPEN_DAY?.(b.dataset.day);}else{root.BANYA_SELECT_DAY?.(b.dataset.day);}return}
 if(act==='p-cal-prev'||act==='p-cal-next'){shiftMonth(act==='p-cal-prev'?-1:1);return}
 if(act==='p-prev'||act==='p-next'){const n=dateAdd(selected,act==='p-prev'?-1:1);if(getDay(n))root.BANYA_SELECT_DAY?.(n);return}
 if(act==='p-toggle'){const task=getDay(selected)?.items.find(x=>x.id===id);if(task&&!blocked){state.done[id]=!state.done[id];report(save())}return}
 if(act==='p-detail'){showPoliticsTask(id);return}
 if(act==='p-add-task'){showPlanForm();return}
 if(act==='p-edit-task'){showPlanForm(id);return}
 if(act==='p-remove-task'){if(blocked||!getDay(selected)?.items.some(t=>t.id===id))return;if(!confirm('从计划移除这项任务？原有打卡和笔记仍会保留在备份中。'))return;state.removed[id]=true;if(save())closePoliticsTask();else report(false);return}
 if(act==='p-note-close'){closePoliticsTask();return}
 if(act==='p-export'){download();return}
 if(act==='p-copy-summary'){void copySummary();return}
 if(act==='p-import'){document.getElementById('p-import-file')?.click();return}
},true);
document.addEventListener('submit',e=>{if(!ready||!['p-progress-form','p-task-form','p-plan-form'].includes(e.target.id))return;e.preventDefault();e.stopImmediatePropagation?.();if(blocked)return;
 if(e.target.id==='p-plan-form'){
  const title=document.getElementById('p-plan-title').value.trim(),minutes=Number(document.getElementById('p-plan-minutes').value),id=e.target.dataset.id;
  if(!title||title.length>200||!Number.isInteger(minutes)||minutes<1||minutes>90){alert('请填写任务名称和 1—90 分钟的预计时间。');return}
  if(id){if(!getDay(selected)?.items.some(t=>t.id===id))return;state.edits[id]={title,minutes}}
  else state.added.push({id:'p-custom-'+Date.now()+'-'+Math.random().toString(16).slice(2,10),date:selected,title,minutes,type:'复盘',detail:'按自己的节奏完成。'});
  if(save())closePoliticsTask();else report(false);return;
 }
 if(e.target.id==='p-progress-form'){const a=Number(document.getElementById('p-questions').value),b=Number(document.getElementById('p-total').value);if(!Number.isInteger(a)||!Number.isInteger(b)||b<1||b>10000||a<0||a>b){alert('请输入正确的题库总数和已做题数。');return}state.questions.marx={done:a,total:b,updated:new Date().toISOString().slice(0,10)};report(save());return}
 const id=e.target.dataset.id,w=document.getElementById('p-wrong').value.trim(),note=document.getElementById('p-note').value.trim(),ids=document.getElementById('p-question-ids')?.value.trim()||'',time=document.getElementById('p-actual-minutes')?.value.trim()||'';if(w!==''&&(!Number.isInteger(Number(w))||Number(w)<0||Number(w)>100)){alert('错题数只能填写0—100。');return}if(ids.length>500||time!==''&&(!Number.isInteger(Number(time))||Number(time)<1||Number(time)>600)){alert('请检查题号和实际用时（1—600分钟）。');return}if(w==='')delete state.wrong[id];else state.wrong[id]=Number(w);if(ids)state.questionIds[id]=ids;else delete state.questionIds[id];if(time)state.actualMinutes[id]=Number(time);else delete state.actualMinutes[id];state.notes[id]=note;const ok=save();if(ok)closePoliticsTask();report(ok);
},true);
document.addEventListener('change',async e=>{if(!ready||e.target.id!=='p-import-file')return;e.stopImmediatePropagation?.();const file=e.target.files?.[0];if(!file)return;try{if(file.size>2000000)throw Error('备份文件过大');const obj=JSON.parse(await file.text());if(obj.app!=='yantu-politics'||obj.version!==1)throw Error('不是有效的政治备份');const next=Core.normalize(obj.state);if(!confirm('恢复政治记录会替换原政治打卡，但不会影响英语二。恢复前将保留回退副本，继续吗？'))return;localStorage.setItem(Core.key+'_before_restore',JSON.stringify(state));const before=state;state=next;if(!save()){state=before;throw Error('本机写入失败')}rerender()}catch(err){alert('导入失败：'+err.message)}},true);
root.addEventListener?.('storage',e=>{if(ready&&e.key===Core.key){restore();rerender()}});
root.PoliticsUI={render,setDate,getDate:()=>selected};
})(typeof window==='object'?window:globalThis);
