/* 板牙考研 · 单一PWA的英语二和政治科目。原数据键保持兼容。 */
(() => {
'use strict';
const Core=window.PlannerCore;
const Intel=window.StudyIntel;
const PLAN_KEY='yantu_english_plan_v2';
let data = window.STUDY_PLAN;
try{const cached=JSON.parse(localStorage.getItem(PLAN_KEY));if(Core.validPlan(cached))data=cached;}catch{}
let pendingPlan=null, checking=false, storageBlocked=false, savedState='', storageMessage='';
let byDate = new Map(data.days.map(day=>[day.date,day]));
let offlineStatus='离线缓存尚未就绪';
let lastCheck = '还未检查';
let updateSource = '本地计划';
const DAYS = ['日','一','二','三','四','五','六'];
const COLORS = {'写作':'purple','新题型':'blue','翻译':'green','完形':'peach','阅读':'blue','复盘':'gray','机动':'green','综合':'peach','模考':'purple','单词':'purple'};
const DEFAULT = Core.defaults();
const STORAGE_KEY = 'yantu_english_2026_m1';
let state = load();
let view = 'today';
let dayDetail=false;
let dayReturnScroll=0;

const SUBJECT_KEY='banya_active_subject_v1';
let subject='english';
try{const saved=localStorage.getItem(SUBJECT_KEY);if(saved==='english'||saved==='politics')subject=saved;}catch{}
const THEME_KEY='yantu_theme_v1';
let theme='light';
try{const raw=localStorage.getItem(THEME_KEY);if(['light','dark'].includes(raw))theme=raw;}catch{}
if(document.documentElement)document.documentElement.dataset.theme=theme;
let today = localISO(new Date());
let selectedDate = (today>=data.meta.start && today<=data.meta.end)?today:data.meta.start;
let calendarMonth = selectedDate.substring(0,7);
const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateFrom = s => new Date(s+'T12:00:00');
function localISO(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function plus(s,n){const d=dateFrom(s);d.setDate(d.getDate()+n);return localISO(d)}
function isValidDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(dateFrom(s).valueOf()) && localISO(dateFrom(s))===s}
function inRange(s){return isValidDate(s)&&s>=data.meta.start&&s<=data.meta.end}
function niceDate(s){const d=dateFrom(s);return `${d.getMonth()+1}月${d.getDate()}日`}
function weekday(s){return `周${DAYS[dateFrom(s).getDay()]}`}
function dateHeading(s){return `${niceDate(s)} · ${weekday(s)}`}
function load(){try{const raw=localStorage.getItem(STORAGE_KEY);const n=raw?Core.normalizeState(JSON.parse(raw)):Core.defaults();savedState=JSON.stringify(n);storageBlocked=false;return n;}catch{storageBlocked=true;storageMessage='本地记录无法读取，已停止写入以保护原数据。请先导出备份。';return Core.defaults();}}
function save(){
 if(storageBlocked){toast('本地记录尚未恢复，已阻止覆盖');return false;}
 try{const next=JSON.stringify(state);localStorage.setItem(STORAGE_KEY,next);savedState=next;storageMessage='';if(typeof window.dispatchEvent==='function'&&typeof Event==='function')window.dispatchEvent(new Event('banya-local-change'));return true;}catch{if(savedState)state=JSON.parse(savedState);storageMessage='保存失败，操作未生效。请导出备份并检查存储空间。';toast(storageMessage);return false;}
}
function allTasks(s){return Core.tasks(data,state,s);}
// 单词由用户自己安排：仍为总预算预留时间，但不列入每日专项打卡。
function specialTasks(s){return allTasks(s).filter(t=>!t.vocab);}
function fits(day,id,minutes){return allTasks(day).filter(t=>t.id!==id).reduce((n,t)=>n+t.minutes,0)+minutes<=Math.min(135,Math.max(130,state.settings.budget));}
function canPlace(day,id,minutes){if(fits(day,id,minutes))return true;toast('该日训练超过了新计划的时间预算，请缩短或改期其他任务');return false;}
function dateProgress(s){const a=specialTasks(s);return {done:a.filter(x=>state.done[x.id]).length,total:a.length,minutes:a.reduce((n,x)=>n+x.minutes,0),skipped:!!state.skipped[s]}}
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('on');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('on'),2800)}
function nav(next){if(dayDetail){dayDetail=false;document.body.classList.remove('day-detail-open');}if(next==='today'&&view!=='today'){const meta=subject==='politics'?window.POLITICS_PLAN?.meta:data.meta;const date=meta&&today>=meta.start&&today<=meta.end?today:meta?.start;if(date){if(subject==='politics')window.PoliticsUI?.setDate?.(date);else selectedDate=date;}}view=next;document.querySelectorAll('.nav-tab').forEach(el=>{const active=el.dataset.view===view;el.classList.toggle('active',active);if(active)el.setAttribute?.('aria-current','page');else el.removeAttribute?.('aria-current');});render(true);window.scrollTo(0,0)}
function render(enter=false,justDone=''){
 document.getElementById('system-date').textContent=`${niceDate(today)} · ${weekday(today)}`;
 const app=document.getElementById('app');
 const content=subject==='politics'?renderPolitics():dayDetail?renderToday(justDone):view==='settings'?renderSettings():view==='today'?renderToday(justDone):view==='calendar'?renderCalendar():renderStats();
 const subjectBar=renderSubjects();
 const cloudPanel=!dayDetail&&view==='settings'&&window.BanyaCloudSync?window.BanyaCloudSync.panel():'';
 const transferPanel=!dayDetail&&view==='settings'&&window.BanyaOriginTransfer?window.BanyaOriginTransfer.panel():'';
  document.body?.classList?.toggle?.('day-detail-open',dayDetail);
  if(document.documentElement?.dataset)document.documentElement.dataset.subject=subject;
 app.innerHTML = `<div class="view-content ${enter?'entering':''}">${dayDetail?'<div class="day-detail-head"><button type="button" class="day-back" data-action="close-day" aria-label="返回日历">‹ <span>返回日历</span></button><span class="day-detail-label">每日学习安排</span></div>':''}${dayDetail?'':subjectBar}${content}${cloudPanel}${transferPanel}</div>`;
 if(storageMessage&&subject==='english')app.insertAdjacentHTML('afterbegin',`<div class="skip-banner" role="alert">${esc(storageMessage)} <button class="cta small" data-action="export">导出备份</button></div>`);
 if(pendingPlan&&subject==='english')app.insertAdjacentHTML('afterbegin','<div class="tip">有新版复习计划，先查看变化再应用。 <button class="cta small" data-action="review-update">查看更新</button></div>');
}
function renderSubjects(){
 return `<section class="subject-rail" aria-label="复习科目">
 <div class="subject-tabs" role="group" aria-label="选择科目">
 ${Intel.SUBJECTS.map(item=>`<button type="button" data-action="switch-subject" data-subject="${item.id}" class="subject-tab ${subject===item.id?'is-active':''}" aria-pressed="${subject===item.id}"><span class="subject-symbol">${item.id==='english'?'英':'政'}</span><span>${item.label}</span>${item.status!=='active'?'<span class="subject-new">待建档</span>':''}</button>`).join('')}
 </div></section>`;
}
function renderPolitics(){ window.POLITICS_NAV=nav; return window.PoliticsUI.render(view,today,esc,()=>render()); }
function openDayDetail(date){
  const valid=subject==='politics'?!!window.PoliticsUI?.setDate?.(date):inRange(date);
  if(!valid)return;
  if(subject==='english')selectedDate=date;
  calendarMonth=date.slice(0,7);
  if(!dayDetail){dayReturnScroll=window.scrollY;history.pushState({banyaDay:true},'',location.pathname+location.search+'#day/'+subject+'/'+date);}
  dayDetail=true;render(true);window.scrollTo(0,0);
}
function closeDayDetail(){if(!dayDetail)return;dayDetail=false;render(true);window.scrollTo(0,dayReturnScroll);}
window.BANYA_OPEN_DAY=openDayDetail;
window.BANYA_SELECT_DAY=selectDay;
window.BANYA_VIEW=()=>view;
window.addEventListener('popstate',()=>{if(dayDetail)closeDayDetail();});
function selectDay(date){
 if(subject==='politics'){if(!window.PoliticsUI?.setDate?.(date))return;}
 else {if(!inRange(date))return;selectedDate=date;}
 if(dayDetail&&history.state?.banyaDay)history.replaceState({...history.state},'',location.pathname+location.search+'#day/'+subject+'/'+date);
 render(true);
}
function renderWeekChart(week,compact=false){
 const labels=['日','一','二','三','四','五','六'];
 return `<div class="weekly-chart ${compact?'compact':''}" aria-label="最近七天专项任务完成情况">
 ${week.days.map(d=>`<div class="week-col" title="${d.date}：${d.done}/${d.total}项${d.skipped?'，已休息':''}">
 <div class="week-bar-track"><span class="week-bar-fill ${d.skipped?'is-rest':''}" style="height:${!d.planned?0:d.skipped?15:Math.round(d.fraction*100)}%"></span></div>
 <small>${labels[d.day]}</small></div>`).join('')}</div>`;
}
function remainingDays(){return Math.max(0, Math.round((dateFrom(data.meta.exam)-dateFrom(today))/(1000*60*60*24)))}
function refreshToday(){const fresh=localISO(new Date());if(fresh!==today){const followingToday=selectedDate===today;today=fresh;if(followingToday&&inRange(today))selectedDate=today;render();}}
function taskCard(t,day,featured=false,justDone=false){
 const checked=!!state.done[t.id];
 const text = state.notes[t.id]||'';
 const wrong = state.wrong[t.id];
 return `<article class="task-card ${checked?'done':''} ${featured?'featured':''} ${justDone?'just-done':''}">
 <button class="check ${checked?'checked':''}" data-action="toggle" data-id="${esc(t.id)}" data-day="${esc(day)}" aria-pressed="${checked}" aria-label="${checked?'取消完成':'标记完成'}：${esc(t.title)}">${checked?'✓':''}</button>
 <button class="task-main task-open" data-action="detail" data-id="${esc(t.id)}" data-day="${esc(day)}" aria-label="查看训练方法并记录：${esc(t.title)}">${featured?'<span class="task-label">建议先做</span>':''}<div class="task-title">${esc(t.title)}</div><p class="task-sub">${t.detail?esc(t.detail):'完成后可点击右侧记录错题或心得。'}</p>
 <div class="pills"><span class="pill ${COLORS[t.type]||'gray'}">${esc(t.type)}</span><span class="pill gray">◷ ${t.minutes} 分钟</span>${wrong!==undefined&&wrong!==''?`<span class="pill peach">错 ${esc(wrong)} 题</span>`:''}${text?`<span class="pill green">已记录</span>`:''}</div></button>
 <button class="task-more" data-action="detail" data-id="${esc(t.id)}" data-day="${esc(day)}" aria-label="记录、复盘或调整：${esc(t.title)}">···</button>
 </article>`;
}
function renderToday(justDone=''){
 const UI=window.BanyaStudyUI,date=selectedDate,progress=dateProgress(date),tasks=specialTasks(date);
 const pending=tasks.filter(t=>!state.done[t.id]),remaining=pending.reduce((sum,t)=>sum+t.minutes,0);
 const head=UI.dayHeading({date,today,start:data.meta.start,end:data.meta.end,done:progress.done,total:progress.total,remaining,countdown:remainingDays(),prev:'day',next:'day',jump:'jump-today'});
 const list=tasks.map(t=>UI.task({item:t,day:date,done:!!state.done[t.id],wrong:state.wrong[t.id],hasNote:!!state.notes[t.id],next:t.id===pending[0]?.id})).join('');
 return '<div class="student-page student-english" data-day-swipe="true">'+head
 +'<div class="student-section-heading"><h2>今日任务</h2><span>共 '+tasks.length+' 项</span></div>'
 +'<div class="student-task-list">'+(list||'<div class="empty">这一天没有计划任务</div>')+'</div>'
 +(progress.skipped?'<p class="student-quiet">这一天标记为休息，任务仍保留。</p>':'')
 +'<div class="student-day-tools"><button class="student-action-link" data-action="add" data-day="'+date+'">＋ 添加任务</button>'
 +'<button class="student-action-link" data-action="toggle-skip" data-date="'+date+'">'+(progress.skipped?'取消休息标记':'标记休息')+'</button></div></div>';
}
function renderCalendar(){
 const UI=window.BanyaStudyUI,[year,month]=calendarMonth.split('-').map(Number);
 const first=new Date(year,month-1,1,12),offset=(first.getDay()+6)%7,count=new Date(year,month,0).getDate();
 const arr=['一','二','三','四','五','六','日'].map(w=>'<span class="cal-wd">'+w+'</span>');
 for(let i=0;i<offset;i++)arr.push('<span></span>');
 for(let d=1;d<=count;d++){
  const date=calendarMonth+'-'+String(d).padStart(2,'0'),valid=inRange(date),p=valid?dateProgress(date):{done:0,total:0,skipped:false};
  const classes=['cal-day',date===selectedDate?'current':'',date===today?'reddot':'',!valid?'dim':'',p.skipped?'skipped':'',p.total&&p.done===p.total?'complete':''].filter(Boolean).join(' ');
  arr.push('<button type="button" class="'+classes+'" data-action="cal-day" data-date="'+date+'" '+(!valid?'disabled':'')+' aria-label="'+UI.shortDay(date)+'，完成'+p.done+'/'+p.total+'项">'+d+(valid?'<i class="cal-dot"></i>':'')+'</button>');
 }
 const previous=calendarMonth<=data.meta.start.slice(0,7),following=calendarMonth>=data.meta.end.slice(0,7);
 const detailDate=selectedDate.startsWith(calendarMonth)?selectedDate:data.days.find(d=>d.date.startsWith(calendarMonth))?.date||selectedDate;
 return '<div class="student-page student-english">'+UI.header('日历','选择日期查看安排')
 +'<div class="month-head"><button type="button" class="round-btn" data-action="prev-month" '+(previous?'disabled':'')+' aria-label="上个月">‹</button><h2>'+year+'年'+month+'月</h2><button type="button" class="round-btn" data-action="next-month" '+(following?'disabled':'')+' aria-label="下个月">›</button></div>'
 +'<div class="calendar"><div class="cal-grid">'+arr.join('')+'</div><div class="legend"><span><i></i>待完成</span><span class="green"><i></i>已打卡</span><span class="amber"><i></i>休息</span></div></div>'+calendarDetails(detailDate)+'</div>';
}
function calendarDetails(date){const tasks=specialTasks(date),p=dateProgress(date);return '<section class="calendar-details" aria-label="所选日期的任务"><div class="calendar-details-head"><h2>'+esc(dateHeading(date))+'</h2><span>已完成 '+p.done+'/'+p.total+'</span></div>'+(p.skipped?'<p class="calendar-rest">这天想休息一下，任务还在。</p>':'')+(tasks.length?tasks.map(t=>'<button type="button" class="calendar-task-row" data-action="open-day" data-date="'+esc(date)+'"><span>'+esc(t.title)+'</span><small>'+(state.done[t.id]?'✓ 已完成':'待完成')+'</small></button>').join(''):'<p class="calendar-rest">这天没有安排，按自己的节奏来。</p>')+'</section>'}
function renderStats(){
 const UI=window.BanyaStudyUI;
 const days=data.days.filter(d=>d.date<=today).map(d=>({date:d.date,...dateProgress(d.date)}));
 const groups=new Map(),recorded=[];
 for(const d of data.days.filter(d=>d.date<=today)){
  for(const t of specialTasks(d.date)){
   if(!groups.has(t.type))groups.set(t.type,{label:t.type,done:0,total:0});
   const g=groups.get(t.type);g.total++;if(state.done[t.id])g.done++;
   if(state.wrong[t.id]!==undefined&&state.wrong[t.id]!=='')recorded.push({date:d.date,task:t,wrong:state.wrong[t.id]});
  }
 }
 const recordedHtml=recorded.length?'<section class="student-stat-section"><h2>最近的错题记录</h2>'+recorded.slice(-5).reverse().map(r=>'<button class="student-record-row" data-action="detail" data-id="'+esc(r.task.id)+'" data-day="'+esc(r.date)+'"><span>'+esc(r.task.title)+'</span><strong>错 '+esc(r.wrong)+' 题 ›</strong></button>').join('')+'</section>':'';
 return '<div class="student-page student-english">'+UI.stats({days,categories:[...groups.values()],wrongCount:recorded.length,today,subject:'english'})+recordedHtml+'</div>';
}
function renderSettings(){
 const UI=window.BanyaStudyUI;
 return '<div class="student-page student-english">'+UI.header('设置')
 +'<section class="setting-section"><h2>计划与同步</h2><div class="button-row"><button class="cta secondary" data-action="check-updates">检查英语计划更新</button><button class="cta ghost" data-action="copy-summary">复制学习近况</button></div>'
 +'<p class="setting-note" id="sync-status">计划 '+esc(data.meta.planVersion||'初始版')+' · '+esc(updateSource)+' · '+esc(lastCheck)+'</p></section>'
 +'<section class="setting-section"><h2>学习偏好</h2><div class="setting-row-title"><span>外观</span><div class="theme-switch" role="group" aria-label="外观配色"><button type="button" data-action="theme" data-theme="light" class="'+(theme==='light'?'selected':'')+'" aria-pressed="'+(theme==='light')+'">浅色</button><button type="button" data-action="theme" data-theme="dark" class="'+(theme==='dark'?'selected':'')+'" aria-pressed="'+(theme==='dark')+'">深色</button></div></div>'
 +'</section>'
 +'<section class="setting-section"><h2>备份与恢复</h2><div class="button-row"><button class="cta secondary" data-action="export">导出英语备份</button><button class="cta ghost" data-action="import">导入备份</button></div><details><summary>恢复前的备份</summary><button class="cta ghost" data-action="export-previous">导出恢复前副本</button></details><input id="file-import" type="file" accept="application/json,.json" hidden></section>'
 +'<section class="setting-section"><h2>应用更新</h2><div class="button-row"><button class="cta secondary" data-action="refresh-app">检查应用更新</button><a class="cta ghost" href="./update.html?reauth=1">更新没反应？点这里修复</a></div><p class="setting-note" id="offline-status">'+esc(offlineStatus)+'</p></section></div>';
}

function findTask(id,day){return allTasks(day).find(t=>t.id===id)}
let modalFocus=null;
function modal(content){modalFocus=document.activeElement;document.body.classList.add('modal-open');const box=document.getElementById('modal');box.classList.remove('hidden');box.innerHTML=`<div class="modal-card">${content}</div>`;box.querySelector('input,button,textarea')?.focus();}
function closeModal(){document.getElementById('modal').classList.add('hidden');document.body.classList.remove('modal-open');modalFocus?.focus();}
function taskModal(id,day){const t=findTask(id,day);if(!t)return;
 const checked=!!state.done[t.id];
 const writing=Core.writingParts(t);
 modal(`<div class="modal-head"><div><div class="eyebrow">专项训练 · ${esc(t.type)}</div><h2>训练记录</h2></div><button class="close" data-action="close" aria-label="关闭训练记录">×</button></div>
 <div class="quickflex task-overview"><div><b>${esc(t.title)}</b><br><span>${esc(day)} · ${writing?`动笔写${writing.writing}分钟、批改复盘${writing.review}分钟`:`预计${t.minutes}分钟`} · ${checked?'已完成':'未完成'}</span></div></div>
 <section class="study-guide" aria-label="训练方法"><span class="guide-label">这项练习怎么做</span><p>${esc(t.detail||'按自己的节奏独立完成，再核对答案并记录收获。')}</p></section>
 <form id="task-form" data-id="${esc(t.id)}" data-day="${esc(day)}">
 ${writing?`<section class="writing-time-editor" aria-label="作文计划用时"><h3>计划用时</h3><p class="setting-note">填总时间和写作时间，批改复盘会自动算好；也可以直接改批改复盘时间。</p><div class="writing-time-fields"><label class="form-line"><span>总时间（分钟）</span><input id="task-minutes" inputmode="numeric" type="number" min="2" max="90" required value="${t.minutes}"></label><label class="form-line"><span>动笔写（分钟）</span><input id="task-write-minutes" inputmode="numeric" type="number" min="1" max="89" required value="${writing.writing}"></label><label class="form-line"><span>批改复盘（分钟）</span><input id="task-review-minutes" inputmode="numeric" type="number" min="1" max="89" required value="${writing.review}"></label></div><p class="setting-note" id="writing-time-hint" role="status">${t.minutes} 分钟 = 写 ${writing.writing} 分钟 + 批改复盘 ${writing.review} 分钟；仍然只打卡一次。</p></section>`:''}
 <div class="record-heading"><h3>做完后记录</h3><small>不必写很多，留下关键错因即可</small></div>
 <label class="form-line"><span>${['新题型','阅读'].includes(t.type)?'错题数（0—5）':t.type==='完形'?'错题数（0—20）':'错题数（可选）'}</span><input id="task-wrong" inputmode="numeric" type="number" min="0" max="${['新题型','阅读'].includes(t.type)?5:20}" placeholder="${t.type==='新题型'?'5道题中错了几道？':'没错填0；未统计可留空'}" value="${esc(state.wrong[t.id]??'')}"></label>
 <label class="form-line"><span>错的是哪几题（可选）</span><input id="task-question-ids" maxlength="500" placeholder="例如 3、8、12；不填也可以" value="${esc(state.questionIds[t.id]||'')}"></label>
 <label class="form-line"><span>实际用了多久（可选）</span><input id="task-actual-minutes" inputmode="numeric" type="number" min="1" max="600" placeholder="分钟" value="${esc(state.actualMinutes[t.id]??'')}"></label>
 <label class="form-line"><span>一句话复盘（可选）</span><textarea id="task-note" maxlength="20000" placeholder="例如：定位词找对了，但没看转折句。">${esc(state.notes[t.id]||'')}</textarea></label>
 <details class="advanced-adjust"><summary>${writing?'调整任务名称或日期':'调整任务名称、预计时间或日期'}</summary><div class="advanced-fields">
 <label class="form-line"><span>任务名称</span><input id="task-title" maxlength="200" required value="${esc(t.title)}" ${t.vocab?'disabled':''}></label>
 ${writing?'':`<label class="form-line"><span>预计用时（分钟）</span><input id="task-minutes" type="number" min="1" max="90" required value="${t.minutes}" ${t.vocab?'disabled':''}></label>`}
 <label class="form-line"><span>调整到其他日期</span><input id="task-move" type="date" min="${data.meta.start}" max="${data.meta.end}" value="${day}" ${t.vocab?'disabled':''}></label>
 </div></details>
 <div class="button-row record-actions"><button type="submit" class="cta secondary">仅保存记录</button><button type="submit" class="cta" data-complete="true">${checked?'保存并保持完成':'保存并打卡完成'}</button></div></form>
 ${t.custom?'<div class="divider"></div><button class="cta danger" data-action="remove" data-id="'+esc(t.id)+'">删除自定义任务</button>':''}`);
}
function addModal(day){modal(`<div class="modal-head"><h2>添加自定义任务</h2><button class="close" data-action="close" aria-label="关闭弹窗">×</button></div><form id="add-form"><label class="form-line"><span>任务名称</span><input required maxlength="70" id="add-title" placeholder="例如：重写2017年小作文"></label><label class="form-line"><span>题型</span><select id="add-type">${['写作','新题型','完形','翻译','阅读','复盘','机动'].map(x=>`<option>${x}</option>`).join('')}</select></label><label class="form-line"><span>预估时长（分钟）</span><input type="number" id="add-minutes" min="5" max="90" value="30" required></label><label class="form-line"><span>日期</span><input type="date" id="add-date" min="${data.meta.start}" max="${data.meta.end}" value="${day}" required></label><div class="button-row"><button type="submit" class="cta">添加任务</button></div></form>`)}
function validatePlan(input){return Core.validPlan(input);}
function reviewUpdate(){if(!pendingPlan)return;const d=Core.diff(data,pendingPlan);const old=new Map(data.days.flatMap(day=>day.items.map(t=>[t.id,{...t,date:day.date}])));const changedCards=pendingPlan.days.flatMap(day=>day.items.filter(t=>!old.has(t.id)||JSON.stringify({...t,date:day.date})!==JSON.stringify(old.get(t.id))).map(t=>`<div class="mini-card"><h3>${esc(t.title)}</h3><p>${old.has(t.id)?esc(old.get(t.id).date)+' · '+old.get(t.id).minutes+'分钟 → ':'新增：'}${esc(day.date)} · ${t.minutes}分钟</p></div>`));const changes=changedCards.slice(0,6).join('')+(changedCards.length>6?`<details class="update-details"><summary>展开其余 ${changedCards.length-6} 项变更</summary>${changedCards.slice(6).join('')}</details>`:'');modal(`<div class="modal-head"><h2>新版计划预览</h2><button class="close" data-action="close" aria-label="关闭弹窗">×</button></div><p>${esc(data.meta.planVersion)} → ${esc(pendingPlan.meta.planVersion)}</p><p>新增 ${d.added} 项，调整 ${d.changed} 项，移出 ${d.removed} 项。</p><p class="setting-note">${esc(pendingPlan.meta.changeSummary||'调整剩余安排。')} 历史任务、完成状态、错题、笔记及个人改期会保留；移出的未完成未来任务放入保留记录，不会自动堆到明天。应用本次每日题感计划时，旧版不足130分钟的总预算将调为130分钟（含单词）；其他个人记录保留，超预算调整仍会被阻止。</p>${changes}<button class="cta" data-action="apply-update">保留记录并应用</button>`);}
function applyUpdate(){
 if(!pendingPlan)return;const old=state;
 try{
  const next=Core.migrate(data,pendingPlan,state,today);
  // 用户要求加题感练习，应用计划更新时才同步上调旧总预算，其余完成/笔记记录不改。
  if((pendingPlan.meta.revision||0)>=6&&next.settings.budget<130)next.settings.budget=130;
  const overflow=pendingPlan.days.find(d=>d.date>=today&&Core.tasks(pendingPlan,next,d.date).filter(t=>!next.done[t.id]).reduce((n,t)=>n+t.minutes,0)>Math.min(135,next.settings.budget));
  if(overflow){toast(niceDate(overflow.date)+'剩余任务超预算，请先缩短或改期个人任务后更新');return;}
  localStorage.setItem(PLAN_KEY+'_previous',JSON.stringify(data));
  state=next;if(!save())throw Error('学习记录保存失败');
  localStorage.setItem(PLAN_KEY,JSON.stringify(pendingPlan));
  data=pendingPlan;pendingPlan=null;byDate=new Map(data.days.map(d=>[d.date,d]));updateSource='已保存新版至本机';closeModal();render();toast('新版已应用，历史记录保留');
 }catch{state=old;save();toast('更新未完成，继续使用原计划');}
}
async function checkUpdates(silent=false){
 if(checking)return;checking=true;const button=document.querySelector('[data-action="check-updates"]');if(button)button.disabled=true;
 try{
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),6500);let response;
  try{response=await fetch('./plan.json?check='+Date.now(),{cache:'no-store',redirect:'error',signal:controller.signal})}finally{clearTimeout(timer)}
  if(!response.ok||response.redirected||!response.headers.get('content-type')?.includes('json'))throw Error('服务器暂时不可用或网络异常');
  const fresh=await response.json();if(!validatePlan(fresh))throw Error('计划结构校验不通过');
  if((fresh.meta.revision||0)<(data.meta.revision||0))throw Error('服务器计划较旧，已阻止回退');
  const changed=JSON.stringify(data)!==JSON.stringify(fresh);
  if(changed&&fresh.meta.planVersion===data.meta.planVersion)throw Error('计划内容变化但版本未变');
  lastCheck=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});updateSource='已联机检查';
  pendingPlan=changed?fresh:null;if(view==='settings'||changed)render();
  if(changed&&!silent)reviewUpdate();else if(!silent)toast('已经是最新计划');
 }catch(err){updateSource='更新未完成';lastCheck='保留本地计划';if(view==='settings')render();if(!silent)toast(err.message==='服务器计划较旧，已阻止回退'?err.message:'计划检查未成功，原记录不受影响；请联网后重试');}
 finally{checking=false;const button=document.querySelector('[data-action="check-updates"]');if(button)button.disabled=false;}
}
function summaryText(){
 const cutoff=today>data.meta.end?data.meta.end:today;
 const latest=data.days.filter(d=>d.date<=cutoff && d.date>=plus(cutoff,-13));
 const lines=['板牙考研 · 英语二学习记录（仅复制给你信任的对话）',`生成日期：${today}`,`计划版本：${data.meta.planVersion||'初始版'}`,`近14天情况：`];
 for(const d of latest){const arr=specialTasks(d.date);const short=arr.map(t=>`${t.title}${state.done[t.id]?'[完成]':'[未完成]'}${state.wrong[t.id]!==undefined?'(错'+state.wrong[t.id]+')':''}`).join('；');
  lines.push(`${d.date}${state.skipped[d.date]?'[休息]':''}：${short}`);
  for(const t of arr){if(state.questionIds[t.id])lines.push(`  错题题号（${t.title}）：${state.questionIds[t.id]}`);if(state.actualMinutes[t.id])lines.push(`  实际用时（${t.title}）：${state.actualMinutes[t.id]}分钟`);if(state.notes[t.id])lines.push(`  复盘（${t.title}）：${state.notes[t.id]}`)}
 }
 lines.push('请优先保留已完成记录，按剩余时间重排未完成任务，不自动双倍补课。');return lines.join('\n');
}
const POLITICS_BRIEF='板牙考研已在同一个PWA内接入政治与英语二。请根据我的最新政治学习反馈调整政治科目计划，不修改英语二：徐涛27强化课当前学到____；苍盾考研肖1000题马原已做____/____题，其他章节完成____；错题薄弱点____；每天政治可用时间____；是否已取得肖八/肖四____。请优先读取同一个GitHub仓库最新politics-plan.json与工作流文档，核对真实进度，不要编造学习记录，也不要建立第二个App。';
async function copyPolitics(){
 try{await navigator.clipboard.writeText(POLITICS_BRIEF);toast('政治建档清单已复制，可发到ChatGPT填写');}
 catch{modal(`<div class="modal-head"><h2>政治建档清单</h2><button class="close" data-action="close" aria-label="关闭">×</button></div><p class="setting-note">长按全选复制后发给ChatGPT，不需要现在立刻填写。</p><textarea class="share-text" readonly>${esc(POLITICS_BRIEF)}</textarea>`);}
}
async function copySummary(){const s=summaryText();try{await navigator.clipboard.writeText(s);toast('近况已复制，粘贴到ChatGPT即可')}catch{modal(`<div class="modal-head"><h2>复制学习近况</h2><button class="close" data-action="close" aria-label="关闭弹窗">×</button></div><p class="setting-note">长按文本全选复制，发给ChatGPT。</p><textarea class="share-text" readonly>${esc(s)}</textarea>`);}}
function nextBuffer(day){
 for(let i=1;i<=14;i++){const d=plus(day,i);if(!inRange(d))break;const hints=(byDate.get(d)?.items||[]);if(hints.some(t=>t.type==='机动'))return d}
 return null;
}
function exportState(previous=false){let record={app:'yantu-english-ii',version:2,exportedAt:new Date().toISOString(),state,plan:data,...(storageBlocked?{unreadableRaw:localStorage.getItem(STORAGE_KEY)}:{})};if(previous){try{const p=JSON.parse(localStorage.getItem(STORAGE_KEY+'_before_restore'));if(!p)throw Error();record={app:'yantu-english-ii',version:2,state:p.state,plan:p.plan,...(p.raw?{unreadableRaw:p.raw}:{})};}catch{toast('没有恢复前副本');return;}}const blob=new Blob([JSON.stringify(record,null,2)],{type:'application/json'});const a=document.createElement('a');const u=URL.createObjectURL(blob);a.href=u;a.download=`板牙考研_英语二备份_${today}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),3000);toast('备份已生成，请妥善保存')}
// Horizontal gestures change the study date without changing the bottom tab.
let swipeStart=null;
document.addEventListener('touchstart',e=>{
  if(!(dayDetail||view==='today')||!e.target.closest('[data-day-swipe]')||e.target.closest('button,input,textarea,select,a'))return;
  if(e.touches.length!==1)return;
  const p=e.touches[0];swipeStart={x:p.clientX,y:p.clientY,t:Date.now()};
},{passive:true});
document.addEventListener('touchend',e=>{
  if(!swipeStart)return;
  const first=swipeStart;swipeStart=null;
  if(e.changedTouches.length!==1||Date.now()-first.t>800)return;
  const p=e.changedTouches[0],dx=p.clientX-first.x,dy=p.clientY-first.y;
  if(Math.abs(dx)<85||Math.abs(dx)<Math.abs(dy)*1.5||Math.abs(dy)>70)return;
  const from=subject==='politics'?window.PoliticsUI?.getDate?.():selectedDate;
  if(!from)return;
  const target=plus(from,dx<0?1:-1);
  selectDay(target);
},{passive:true});
document.addEventListener('click',e=>{
 const tab=e.target.closest('.nav-tab');if(tab){nav(tab.dataset.view);return}
 const btn=e.target.closest('[data-action]');if(!btn){if(e.target.id==='modal')closeModal();return}
 const action=btn.dataset.action;
 if(action==='switch-subject'||action==='open-politics'){subject=action==='open-politics'?'politics':btn.dataset.subject==='politics'?'politics':'english';try{localStorage.setItem(SUBJECT_KEY,subject);}catch{}if(action==='open-politics')view='today';document.querySelectorAll('.nav-tab').forEach(el=>{const active=el.dataset.view===view;el.classList.toggle('active',active);if(active)el.setAttribute?.('aria-current','page');else el.removeAttribute?.('aria-current');});render(true);window.scrollTo(0,0);return;}
 if(action==='copy-politics'){copyPolitics();return;}
 if(action==='theme'){const next=btn.dataset.theme;if(next!=='light'&&next!=='dark')return;theme=next;if(document.documentElement)document.documentElement.dataset.theme=theme;try{localStorage.setItem(THEME_KEY,theme);}catch{toast('外观已切换，但偏好未能保存');}render();return;}
 if(action==='review-update'){reviewUpdate();return}
 if(action==='apply-update'){applyUpdate();return}
 if(action==='refresh-app'){
  toast('正在检查应用更新……');
  if(!navigator.serviceWorker?.getRegistration){toast('浏览器无法检查更新，请点“更新没反应？点这里修复”');return;}
  Promise.race([
   navigator.serviceWorker.getRegistration().then(r=>r?r.update():null),
   new Promise((_,reject)=>setTimeout(()=>reject(Error('timeout')),8000))
  ]).then(r=>toast(r?'已检查更新；有新版时关闭所有应用窗口再打开':'离线缓存未就绪，请点修复入口'))
   .catch(()=>toast('检查超时，请点“更新没反应？点这里修复”'));
  return;
 }
 if(action==='toggle'){const t=findTask(btn.dataset.id,btn.dataset.day);if(!t)return;const next=!state.done[t.id];state.archive[t.id]={...t,date:btn.dataset.day};state.done[t.id]=next;if(next)delete state.skipped[btn.dataset.day];if(!save()){render();return;}render(false,next?t.id:'');const p=dateProgress(btn.dataset.day);toast(next?(p.total&&p.done===p.total?'当日专项已完成，打卡已保存在本机':'已完成，打卡已保存在本机'):'已取消完成标记');return}
 if(action==='close-day'){if(history.state?.banyaDay)history.back();else closeDayDetail();return}
  if(action==='day'||action==='cal-day'||action==='open-day'){if(action!=='day')openDayDetail(btn.dataset.date);else selectDay(btn.dataset.date);return}
 if(action==='jump-today'){selectDay(inRange(today)?today:data.meta.start);return}
 if(action==='toggle-skip'){const day=btn.dataset.date;if(!inRange(day))return;if(state.skipped[day])delete state.skipped[day];else state.skipped[day]=true;const ok=save();render();if(!ok)return;toast(state.skipped[day]?'已标记休息，不会自动补课':'已恢复');return}
 if(action==='detail'){taskModal(btn.dataset.id,btn.dataset.day);return}
 if(action==='add'){addModal(btn.dataset.day||selectedDate);return}
 if(action==='close'){closeModal();return}
 if(action==='move-buffer'){const s=nextBuffer(btn.dataset.day);if(!s){toast('没有可用的机动日，请手动选择日期');return}const t=findTask(btn.dataset.id,btn.dataset.day);if(!t||!canPlace(s,t.id,t.minutes))return;state.moved[btn.dataset.id]=s;if(!save()){render();return;}closeModal();render();toast('已改期到 '+niceDate(s));return}
 if(action==='remove'){if(!confirm('删除此自定义任务？笔记与错题会保留在备份中。'))return;delete state.archive[btn.dataset.id];state.added=state.added.filter(t=>t.id!==btn.dataset.id);delete state.moved[btn.dataset.id];delete state.done[btn.dataset.id];if(!save()){render();return;}closeModal();render();toast('已删除');return}
 if(action==='prev-month'||action==='next-month'){const [y,m]=calendarMonth.split('-').map(Number);const d=new Date(y,m-1+(action==='next-month'?1:-1),1,12);const next=localISO(d).substring(0,7);if(next>='2026-10'&&next<='2026-12')calendarMonth=next;render(true);return}
 if(action==='check-updates'){
   if(subject==='politics'){
    if(!navigator.serviceWorker?.getRegistration){toast('当前浏览器暂不支持应用版本检查');return;}
    navigator.serviceWorker.getRegistration().then(r=>r?.update()).then(()=>toast('已检查政治计划版本；有新版时关闭所有应用窗口再打开即可')).catch(()=>toast('政治计划检查失败；继续使用本机已缓存安排'));
   }else checkUpdates();
   return;
  }
 if(action==='copy-summary'){copySummary();return}
 if(action==='export'){exportState();return}
 if(action==='export-previous'){exportState(true);return}
 if(action==='import'){document.getElementById('file-import')?.click();return}
});
document.addEventListener('input',e=>{
 if(!['task-minutes','task-write-minutes','task-review-minutes'].includes(e.target.id))return;
 const totalEl=document.getElementById('task-minutes'),writeEl=document.getElementById('task-write-minutes'),reviewEl=document.getElementById('task-review-minutes');
 if(!writeEl||!reviewEl)return;
 const valid=value=>value!==''&&Number.isInteger(Number(value))&&Number(value)>0;
 if(e.target.id==='task-review-minutes'){
  const write=Number(writeEl.value),review=Number(reviewEl.value);
  totalEl.value=valid(writeEl.value)&&valid(reviewEl.value)&&write+review<=90?String(write+review):'';
 }else{
  const total=Number(totalEl.value),write=Number(writeEl.value);
  reviewEl.value=valid(totalEl.value)&&valid(writeEl.value)&&total>write&&total<=90?String(total-write):'';
 }
 const total=Number(totalEl.value),write=Number(writeEl.value),review=Number(reviewEl.value);
 document.getElementById('writing-time-hint').textContent=valid(totalEl.value)&&valid(writeEl.value)&&valid(reviewEl.value)&&total===write+review&&total<=90
  ?`${total} 分钟 = 写 ${write} 分钟 + 批改复盘 ${review} 分钟；仍然只打卡一次。`
  :'时间还没对上：总时间需等于写作与批改复盘之和，最多 90 分钟。';
});
document.addEventListener('submit',e=>{
 if(e.target.id==='task-form'){
  e.preventDefault();const f=e.target,id=f.dataset.id,day=f.dataset.day;
  const t=findTask(id,day);if(!t)return;
  const title=document.getElementById('task-title').value.trim(),parts=Core.writingParts(t),writeText=parts?document.getElementById('task-write-minutes').value:'',reviewText=parts?document.getElementById('task-review-minutes').value:'',totalText=document.getElementById('task-minutes').value,write=Number(writeText),review=Number(reviewText),minutes=Number(totalText),move=document.getElementById('task-move').value;
  const w=document.getElementById('task-wrong').value;
  if(!title||totalText===''||!Number.isInteger(minutes)||minutes<1||minutes>90||parts&&(writeText===''||reviewText===''||!Number.isInteger(write)||write<1||!Number.isInteger(review)||review<1||minutes!==write+review)||!inRange(move)){toast('请检查任务名称、分钟和日期；作文总时间要等于两段之和');return;}
  const wrongMax=['新题型','阅读'].includes(t.type)?5:20;
  if(w!==''&&(!Number.isInteger(Number(w))||Number(w)<0||Number(w)>wrongMax)){toast('请填写0—'+wrongMax+'之间的整数错题数');return;}
  const questionIds=document.getElementById('task-question-ids')?.value.trim()||'',actualText=document.getElementById('task-actual-minutes')?.value.trim()||'';
  if(questionIds.length>500||actualText!==''&&(!Number.isInteger(Number(actualText))||Number(actualText)<1||Number(actualText)>600)){toast('请检查题号和实际用时（1—600分钟）');return;}
  if(!t.vocab&&(minutes!==t.minutes||move!==day)&&!canPlace(move,id,minutes))return;
  if(w==='')delete state.wrong[id];else state.wrong[id]=Number(w);
  if(questionIds)state.questionIds[id]=questionIds;else delete state.questionIds[id];
  if(actualText)state.actualMinutes[id]=Number(actualText);else delete state.actualMinutes[id];
  state.notes[id]=document.getElementById('task-note').value.trim();
  if(!t.vocab){const baseline=data.days.flatMap(d=>d.items).find(x=>x.id===id)||state.added.find(x=>x.id===id)||state.archive[id]||t;const edits={};if(title!==baseline.title)edits.title=title;if(minutes!==baseline.minutes)edits.minutes=minutes;if(parts){const original=Core.writingParts({...baseline,minutes});if(!original||write!==original.writing||review!==original.review){edits.minutes=minutes;edits.writingMinutes=write;edits.reviewMinutes=review;}}if(Object.keys(edits).length)state.edits[id]=edits;else delete state.edits[id];if(move!==day)state.moved[id]=move;}
  const markComplete=e.submitter?.dataset?.complete==='true';
  if(markComplete){state.archive[id]={...t,date:move};state.done[id]=true;delete state.skipped[move];}
  if(!save()){render();return;}
  closeModal();render(false,markComplete?id:'');toast(markComplete?'训练已打卡，错题与笔记同时保存':'复盘记录已保存');return;
 }
 if(e.target.id==='add-form'){
   e.preventDefault();const title=document.getElementById('add-title').value.trim(), date=document.getElementById('add-date').value;
   if(!title||!inRange(date))return;
   const minutes=Number(document.getElementById('add-minutes').value);if(!Number.isInteger(minutes)||minutes<5||minutes>90||!canPlace(date,'',minutes))return;
   state.added.push({id:'custom-'+Date.now()+'-'+Math.random().toString(16).slice(2,7),title,date,type:document.getElementById('add-type').value,minutes:Number(document.getElementById('add-minutes').value),detail:'自定义任务',custom:true});
   if(!save()){render();return;}closeModal();selectedDate=date;nav('today');toast('任务已添加');return;
 }
});
document.addEventListener('change',async e=>{
 if(e.target.id==='vocab-minutes'){state.settings.vocab=Number(e.target.value);const ok=save();render();if(ok)toast('已调整背词时间')}
 if(e.target.id==='daily-budget'){const value=Number(e.target.value);if((data.meta.revision||0)>=6&&value<130){toast('每日题感版总预算至少130分钟');render();return;}state.settings.budget=value;const ok=save();render();if(ok)toast('已调整日预算')}
 if(e.target.id==='file-import'){
  const file=e.target.files?.[0];if(!file)return;
  try{if(file.size>2000000)throw Error('文件过大');const obj=JSON.parse(await file.text());
    if(obj.app!=='yantu-english-ii'||![1,2].includes(obj.version))throw Error('不是有效的英语二学习记录备份');
    const next=Core.normalizeState(obj.state);if(obj.plan&&!Core.validPlan(obj.plan))throw Error('备份计划无效');
    if(!window.confirm('恢复此备份将替换当前记录。恢复前会在本机保留一份回退副本，是否继续？'))return;
    const previous={state,plan:data,raw:localStorage.getItem(STORAGE_KEY)};
    localStorage.setItem(STORAGE_KEY+'_before_restore',JSON.stringify(previous));
    if(obj.plan)localStorage.setItem(PLAN_KEY,JSON.stringify(obj.plan));
    const old=state,blocked=storageBlocked;state=next;storageBlocked=false;
    if(!save()){state=old;storageBlocked=blocked;localStorage.setItem(PLAN_KEY,JSON.stringify(previous.plan));throw Error('保存失败，原记录仍保留');}
    if(obj.plan){data=obj.plan;byDate=new Map(data.days.map(d=>[d.date,d]));}pendingPlan=null;render();toast('恢复完成，旧记录已有本机回退副本');
  }catch(err){toast('导入失败：'+err.message)}
 }
});
render();
window.addEventListener('focus',refreshToday);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshToday();checkUpdates(true)}});
setInterval(refreshToday,60000);
window.addEventListener('online',()=>{render();checkUpdates(true)});
window.addEventListener('offline',()=>{render();toast('已离线，打卡仍保存在本机')});
window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY){state=load();closeModal();render();toast('已载入另一个窗口的记录');}if(e.key===SUBJECT_KEY&&['english','politics'].includes(e.newValue)){subject=e.newValue;render();}if(e.key===THEME_KEY&&['light','dark'].includes(e.newValue)){theme=e.newValue;if(document.documentElement)document.documentElement.dataset.theme=theme;render();}if(e.key===PLAN_KEY){try{const p=JSON.parse(e.newValue);if(Core.validPlan(p)){data=p;byDate=new Map(data.days.map(d=>[d.date,d]));closeModal();render();}}catch{}}});
document.addEventListener('keydown',e=>{const box=document.getElementById('modal');if(box.classList.contains('hidden'))return;if(e.key==='Escape'){closeModal();return;}if(e.key==='Tab'){const a=[...box.querySelectorAll('button,input,select,textarea,a[href],summary')].filter(x=>!x.disabled);const first=a[0],last=a.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
checkUpdates(true);
if('serviceWorker'  in navigator && (location.protocol==='https:'||location.hostname==='localhost')){
 window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(async r=>{const observe=w=>{w?.addEventListener('statechange',()=>{if(w.state==='redundant'){offlineStatus='离线缓存安装失败，请联网后重试';if(view==='settings')render();}if(w.state==='installed'){offlineStatus='离线资源已缓存';if(view==='settings')render();toast(r.active?'应用新版已下载，关闭后重新打开生效':'离线资源已就绪');}})};observe(r.installing);r.addEventListener('updatefound',()=>observe(r.installing));if(r.waiting){offlineStatus='新版已下载，关闭所有页面后重开生效';}if(navigator.serviceWorker.controller){offlineStatus='离线资源已缓存';if(view==='settings')render();}}).catch(()=>{offlineStatus='离线缓存未完成，请联网打开网页后再试';if(view==='settings')render();}));
}
})();

