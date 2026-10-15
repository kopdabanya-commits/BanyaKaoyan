/* 研途 · English II / 2026-10-15 — 2026-12-18. Local-first, no backend. */
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
let subject = 'english';
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
 try{const next=JSON.stringify(state);localStorage.setItem(STORAGE_KEY,next);savedState=next;storageMessage='';return true;}catch{if(savedState)state=JSON.parse(savedState);storageMessage='保存失败，操作未生效。请导出备份并检查存储空间。';toast(storageMessage);return false;}
}
function allTasks(s){return Core.tasks(data,state,s);}
// 单词由用户自己安排：仍为总预算预留时间，但不列入每日专项打卡。
function specialTasks(s){return allTasks(s).filter(t=>!t.vocab);}
function fits(day,id,minutes){return allTasks(day).filter(t=>t.id!==id).reduce((n,t)=>n+t.minutes,0)+minutes<=Math.min(135,Math.max(130,state.settings.budget));}
function canPlace(day,id,minutes){if(fits(day,id,minutes))return true;toast('该日训练超过了新计划的时间预算，请缩短或改期其他任务');return false;}
function dateProgress(s){const a=specialTasks(s);return {done:a.filter(x=>state.done[x.id]).length,total:a.length,minutes:a.reduce((n,x)=>n+x.minutes,0),skipped:!!state.skipped[s]}}
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('on');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('on'),2800)}
function nav(next){view=next;document.querySelectorAll('.nav-tab').forEach(el=>{const active=el.dataset.view===view;el.classList.toggle('active',active);if(active)el.setAttribute?.('aria-current','page');else el.removeAttribute?.('aria-current');});render(true);window.scrollTo(0,0)}
function render(enter=false,justDone=''){
 document.getElementById('system-date').textContent=`${niceDate(today)} · ${weekday(today)}`;
 const app=document.getElementById('app');
 const content=view==='settings'?renderSettings():subject==='politics'?renderPolitics():view==='today'?renderToday(justDone):view==='calendar'?renderCalendar():renderStats();
 const subjectBar=view==='settings'?'':renderSubjects();
 app.innerHTML = `<div class="view-content ${enter?'entering':''}">${subjectBar}${content}</div>`;
 if(storageMessage)app.insertAdjacentHTML('afterbegin',`<div class="skip-banner" role="alert">${esc(storageMessage)} <button class="cta small" data-action="export">导出备份</button></div>`);
 if(pendingPlan&&subject==='english')app.insertAdjacentHTML('afterbegin','<div class="tip">有新版复习计划，先查看变化再应用。 <button class="cta small" data-action="review-update">查看更新</button></div>');
}
function renderSubjects(){
 return `<section class="subject-rail" aria-label="复习科目">
 <div class="subject-tabs" role="group" aria-label="选择科目">
 ${Intel.SUBJECTS.map(item=>`<button type="button" data-action="switch-subject" data-subject="${item.id}" class="subject-tab ${subject===item.id?'is-active':''}" aria-pressed="${subject===item.id}"><span class="subject-symbol">${item.id==='english'?'英':'政'}</span><span>${item.label}</span>${item.status!=='active'?'<span class="subject-new">待建档</span>':''}</button>`).join('')}
 </div><span class="subject-context">${subject==='english'?'65天专项计划':'政治计划筹备中'}</span></section>`;
}
function renderPolitics(){
 return `<div class="politics-hero">
 <div class="politics-orbit" aria-hidden="true">政</div>
 <div class="eyebrow">考研政治 · 科目预留</div>
 <h1 class="page-title">政治，也可以在这里有条理地复习。</h1>
 <p class="subtitle">已为政治预留独立科目与数据命名空间。目前没有你的教材、真实进度和可用时间，因此不生成任何虚构任务，也不影响英语二的计划和记录。</p>
 <div class="politics-steps"><div><span>01</span><b>确认当前进度</b><small>课程、资料、题库与做题情况</small></div><div><span>02</span><b>确定可用时间</b><small>结合英语、数学、专业课整体分配</small></div><div><span>03</span><b>再建立政治计划</b><small>分科目保存、按真实反馈调整</small></div></div>
 <button class="cta" data-action="copy-politics">复制政治建档信息清单 <span aria-hidden="true">↗</span></button>
 <p class="setting-note">只准备接入，不自动开启政治打卡；无需安装第二个App。</p></div>
 <button class="cta ghost politics-back" data-action="switch-subject" data-subject="english">← 继续英语二训练</button>`;
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
 const s=selectedDate; const v=dateProgress(s);
 const budget=state.settings.budget;
 const percent=v.total?Math.round(v.done/v.total*100):0;
 let days=[];for(let i=-3;i<=3;i++){const d=plus(s,i);days.push(`<button class="day-chip ${d===s?'selected':''} ${d===today?'today':''}" data-action="day" data-date="${d}" ${!inRange(d)?'disabled':''}><span class="dow">${weekday(d).slice(1)}</span><span class="number">${dateFrom(d).getDate()}</span></button>`)}
 const tasks=specialTasks(s);
 const pending=tasks.filter(t=>!state.done[t.id]);
 const remainingMinutes=pending.reduce((sum,t)=>sum+t.minutes,0);
 const insight=Intel.recommend(data,state,Core,s);
 const week=Intel.week(data,state,Core,today);
 const selectedLabel=s===today?'今天':s<today?'这一天':'计划当天';
 const intro=s===today?'按任务顺序练习，完成后再记录错题。单词另行安排。':s<today?'这里保留的是你的实际打卡记录，未做的题不自动算完成。':'可以提前查看任务，临时有事也能调整日期。';
 return `<div class="eyebrow dashboard-eyebrow"><span class="status-dot"></span>2027 研究生考试 · 英语二</div><h1 class="page-title">${s===today?'今天，把注意力留给重要的题。':s<today?'回看这一日的积累':'提前看看这一天'}</h1><p class="subtitle">${intro}</p>
 <section class="hero premium-hero" aria-label="倒计时与今日进度">
 <div class="aurora aurora-one" aria-hidden="true"></div><div class="aurora aurora-two" aria-hidden="true"></div><div class="hero-glow-grid" aria-hidden="true"></div>
 <div class="hero-top"><div class="hero-copy"><span class="hero-kicker"><span class="glint-dot"></span>2027 考研 · 稳定推进</span><h2>距离初试还有</h2><div class="count">${remainingDays()}<small>天</small></div><p class="hero-motto">今天完成的，才是属于自己的进度。</p></div>
 <div class="hero-ring" role="img" aria-label="${selectedLabel}已完成${percent}%的专项任务" style="--ring-progress:${percent}%"><div class="hero-ring-core"><strong>${percent}<small>%</small></strong><span>专项完成</span></div></div></div>
 <div class="hero-bottom premium-foot"><div><small>当日专项</small><b>${v.minutes}<span>分钟</span></b></div><div><small>尚需预计</small><b>${remainingMinutes}<span>分钟</span></b></div><div><small>英语二目标</small><b>80<span>分</span></b></div></div>
 </section>
 <section class="section-row calendar-heading"><h2>${dateHeading(s)}</h2><span class="sub">${v.done}/${v.total}项已完成</span></section><div class="weekstrip">${days.join('')}</div>
 ${v.skipped?'<div class="skip-banner">这一天已标记为未学习。保留原任务记录，不自动补双倍。</div>':''}
 <section class="focus-panel" aria-label="当日行动建议">
 <div class="focus-top"><span class="micro-label"><span class="micro-icon">✦</span>${esc(insight?.eyebrow||'当前计划')}</span><span class="focus-duration">${insight?.minutes?'约'+insight.minutes+'分钟':'本机建议'}</span></div>
 <h2>${esc(insight?.title||'今天按计划稳步推进')}</h2><p>${esc(insight?.detail||'以实际做题情况为准，不自动改变计划。')}</p>
 <div class="focus-actions">${insight?.taskId?`<button class="cta focus-primary" data-action="detail" data-id="${esc(insight.taskId)}" data-day="${s}">开始这项训练 <span aria-hidden="true">↗</span></button>`:''}<button class="cta focus-secondary" data-action="copy-summary">发给 ChatGPT 调整计划 <span aria-hidden="true">↗</span></button></div></section>
 <div class="progress-block" aria-label="${selectedLabel}专项进度"><div class="progress-top"><span class="progress-title">${v.total&&percent===100?'当日专项已完成':v.skipped?'已标记休息，不会补债':'专项完成进度'}</span><span class="progress-value">${v.done}/${v.total}项 · 剩余约${remainingMinutes}分钟</span></div><div class="track" role="progressbar" aria-label="专项任务完成比例" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></div>${v.total&&percent===100?'<p class="progress-footnote">完成记录已保存在本机，需要时可在任务详情补充复盘。</p>':pending.length?`<p class="progress-footnote">下一步：${esc(pending[0].title)} · 约${pending[0].minutes}分钟</p>`:''}</div>
 ${tasks.map(t=>taskCard(t,s,t.id===pending[0]?.id,t.id===justDone)).join('')||'<div class="empty">这一天没有安排专项练习，可以根据需要添加任务。</div>'}
 ${(byDate.get(s)?.hint)?`<div class="tip">${esc(byDate.get(s).hint)}</div>`:''}
 ${v.minutes>budget?`<div class="tip">当前约 ${v.minutes} 分钟，比默认预算多 ${v.minutes-budget} 分钟；可调整或改期任务。</div>`:''}
 <div class="section-row"><h2>调整这一天</h2><span class="sub">有变动就调整，不累积补课</span></div><div class="button-row"><button class="cta secondary" data-action="add" data-day="${s}">＋ 添加任务</button><button class="cta ghost" data-action="toggle-skip" data-date="${s}">${v.skipped?'恢复训练安排':'标记当天未学习'}</button>${s!==today?'<button class="cta ghost" data-action="jump-today">返回今天</button>':''}</div>
 <section class="week-insight"><div class="section-row"><h2>最近七天</h2><span class="sub">${week.done}/${week.total}项实际打卡</span></div>${renderWeekChart(week,true)}<p class="week-disclaimer">仅统计你勾选的任务；未打卡不代表没有学习，也不推算分数。</p></section><p class="watermark">每日客观题不断档 · 单词另计 · 不内置计时器</p>`;
}
function renderCalendar(){
 let [year,month] = calendarMonth.split('-').map(Number);
 let first=new Date(year,month-1,1,12); let weekdayOffset=(first.getDay()+6)%7;
 let count=new Date(year,month,0).getDate();
 let arr=['一','二','三','四','五','六','日'].map(w=>`<span class="cal-wd">${w}</span>`);
 for(let i=0;i<weekdayOffset;i++)arr.push('<div></div>');
 for(let day=1;day<=count;day++){
  let s=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  let valid=inRange(s),p=valid?dateProgress(s):{done:0,total:0,skipped:false};
  const status=p.skipped?'已标记休息':p.total&&p.total===p.done?'专项已完成':p.done?'已完成'+p.done+'项，共'+p.total+'项':'待练'+p.total+'项';
  arr.push(`<button class="cal-day ${s===selectedDate?'current':''} ${s===today?'reddot':''} ${!valid?'dim':''} ${p.skipped?'skipped':''} ${p.total&&p.total===p.done?'complete':''}" data-action="cal-day" data-date="${s}" aria-label="${month}月${day}日，${valid?status:'计划范围外'}" ${!valid?'disabled':''}>${day}${valid?'<i class="cal-dot"></i>':'<i style="height:5px"></i>'}</button>`)
 }
 let totalDone=data.days.filter(d=>dateProgress(d.date).total===dateProgress(d.date).done).length; const skippedDays=data.days.filter(d=>state.skipped[d.date]).length;
 return `<div class="eyebrow">65天 · 专项复习安排</div><h1 class="page-title">每天学什么，一眼就知道</h1><p class="subtitle">选择日期即可查看训练内容，临时调整不会让第二天自动加倍。</p>
 <div class="month-head"><button class="round-btn" data-action="prev-month" aria-label="上个月">‹</button><h2>${year}年${month}月</h2><button class="round-btn" data-action="next-month" aria-label="下个月">›</button></div>
 <div class="calendar"><div class="cal-grid">${arr.join('')}</div><div class="legend"><span><i></i>待练</span><span class="green"><i></i>已完成</span><span class="amber"><i></i>休息</span></div></div>
 <section class="section-row"><h2>三个复习阶段</h2></section>
 <div class="mini-card"><h3>10.15—11.15 · 写作入门＋客观题扫尾</h3><p>不追赶前两天进度；11月15日前完成2014—2023新题型一刷。</p></div>
 <div class="mini-card"><h3>11.16—12.04 · 完形翻译收官＋首次检测</h3><p>11月20日左右完形一刷完成；12月1日翻译一刷完成。11月21—24日2024卷弹性模考。</p></div>
 <div class="mini-card"><h3>12.05—12.18 · 两次检测＋作文强化</h3><p>12月5—8日2025卷；12月12—15日2026卷；最后3天重点查漏补缺。</p></div>
 <div class="tip">全部完成天数：${totalDone} / ${data.days.length} · 已标记休息 ${skippedDays} 天。错过一天不会自动产生双倍补课。</div>`;
}
function renderStats(){
 let scheduled=0,done=0,minutes=0;
 const counters={};
 for(const day of data.days){for(const t of specialTasks(day.date)){
   scheduled++;counters[t.type]??={total:0,done:0};counters[t.type].total++;
   if(state.done[t.id]){done++;minutes+=t.minutes;counters[t.type].done++}
 }}
 const pct=scheduled?Math.round(done/scheduled*100):0;
 const week=Intel.week(data,state,Core,today);
 const focus=['写作','新题型','翻译','完形','阅读','复盘','综合','模考','机动'];
 let records=[];for(const d of data.days){for(const t of specialTasks(d.date)){if(state.wrong[t.id]!==undefined&&state.wrong[t.id]!=='')records.push({date:d.date,t,wrong:state.wrong[t.id]})}}
 return `<div class="eyebrow">专项复习 · 完成记录</div><h1 class="page-title">练过哪些，记录得清楚</h1><p class="subtitle">只统计已打卡的任务；学习时长是计划估算，不是手机自动计时，也不等于真实得分。</p>
 <div class="stats-two"><div class="statbox"><div class="name">已完成任务</div><div class="val">${done}<span style="font-size:12px;color:#aab1bf"> / ${scheduled}</span></div></div><div class="statbox"><div class="name">已完成任务预计时长</div><div class="val">${(minutes/60).toFixed(1)}<span style="font-size:12px;color:#aab1bf"> 小时</span></div></div></div>
 <div class="progress-block"><div class="progress-top"><span class="progress-title">总体任务完成率</span><span class="progress-value">${pct}%</span></div><div class="track"><span style="width:${pct}%"></span></div></div>
 <section class="section-row"><h2>七日学习足迹</h2><span class="sub">${week.done}/${week.total}项打卡 · 休息${week.skipped}天</span></section>
 <section class="week-insight full">${renderWeekChart(week)}<p class="week-disclaimer">只使用当前手机上的真实打卡，不计算番茄 Todo 时间，也不推算政治成绩。</p></section>
 <section class="section-row"><h2>各题型完成情况</h2></section><div class="setting-section">${focus.filter(x=>counters[x]).map(x=>`<div class="metric"><div><b>${x}</b><br/><small>${counters[x].done}/${counters[x].total} 已完成</small></div><progress value="${counters[x].done}" max="${counters[x].total}"></progress></div>`).join('')}</div>
 <section class="section-row"><h2>建档时的学习基线</h2></section><div class="setting-section"><div class="metric"><b>阅读一刷</b><small>约 37 / 40</small></div><div class="metric"><b>新题型</b><small>6.5 / 10</small></div><div class="metric"><b>完形填空</b><small>6 / 10</small></div><div class="metric"><b>作文起点</b><small>小作文难独立完成，大作文未开始</small></div></div>
 <div class="tip">复习策略：优先让大小作文能独立写，其次改善翻译中文表达与新题型稳定性；37分阅读是旧卷回忆估计，待后期新卷模考再校准。</div><section class="section-row"><h2>最近的作答记录</h2></section>${records.length?records.slice(-10).reverse().map(r=>`<div class="mini-card"><h3>${esc(r.t.title)}</h3><p>${niceDate(r.date)} · 错 ${esc(r.wrong)} 题</p></div>`).join(''):'<div class="empty">暂时还没有作答记录。打开任意专项任务，在“训练记录”中填写错题数即可。</div>'}
 <section class="section-row"><h2>计划移出的保留记录</h2></section>${Object.values(state.archive).filter(t=>t.retired).map(t=>`<div class="mini-card"><h3>${esc(t.title)}</h3><p>${esc(t.date)} · 已移出待办，记录仍保留${state.wrong[t.id]!==undefined?' · 错'+esc(state.wrong[t.id])+'题':''}</p></div>`).join('')||'<p class="setting-note">暂无移出的任务。</p>'}<div class="tip">阅读是现有优势，计划重心是写作；记录真实成绩后，可进一步调整薄弱项。</div>`;
}
function renderSettings(){
 return `<div class="eyebrow">设置与学习记录</div><h1 class="page-title">少设置一点，多练习一点</h1><p class="subtitle">每天阅读、新题型或完形至少练一项。多数日专项85—90分钟，单词另外安排。</p>
 <section class="setting-section"><h2>最常用的三个操作</h2><div class="usage-steps"><p><b>练习：</b>在“今日”选一项训练，先独立作答，再核对原文或范文。</p><p><b>复盘：</b>打开任务详情，记录错题数和一句话错因，可同时打卡。</p><p><b>调整：</b>将做题情况发给ChatGPT，计划更新后再到这里检查新版。</p></div></section>
 <section class="setting-section appearance-section"><div class="setting-row-title"><div><h2>视觉外观</h2><p class="setting-note">两套配色都保留流畅轻动效；系统设置“减少动态效果”时自动精简动画。</p></div><div class="theme-switch" role="group" aria-label="外观配色"><button type="button" data-action="theme" data-theme="light" class="${theme==='light'?'selected':''}" aria-pressed="${theme==='light'}">浅色</button><button type="button" data-action="theme" data-theme="dark" class="${theme==='dark'?'selected':''}" aria-pressed="${theme==='dark'}">深色</button></div></div></section>
 <section class="setting-section"><h2>英语二时间预算</h2><label class="input-line">背单词时间<select id="vocab-minutes"><option value="30" ${state.settings.vocab===30?'selected':''}>30分钟</option><option value="35" ${state.settings.vocab===35?'selected':''}>35分钟（默认）</option><option value="40" ${state.settings.vocab===40?'selected':''}>40分钟</option></select></label><label class="input-line">每日英语总预算<select id="daily-budget"><option value="90" ${state.settings.budget===90?'selected':''} ${(data.meta.revision||0)>=6?'disabled':''}>90分钟（旧版）</option><option value="100" ${state.settings.budget===100?'selected':''} ${(data.meta.revision||0)>=6?'disabled':''}>100分钟（旧版）</option><option value="110" ${state.settings.budget===110?'selected':''} ${(data.meta.revision||0)>=6?'disabled':''}>110分钟（旧版）</option><option value="120" ${state.settings.budget===120?'selected':''} ${(data.meta.revision||0)>=6?'disabled':''}>120分钟（旧版）</option><option value="130" ${state.settings.budget===130?'selected':''}>130分钟（新版建议）</option><option value="135" ${state.settings.budget===135?'selected':''}>135分钟</option></select></label><p class="setting-note">新计划增加20—25分钟旧卷题感训练：阅读1篇、新题型5题或完形20空。多数日专项85—90分钟，单词另计；130分钟总预算包含自行安排的单词时间。</p></section>
 <section class="setting-section"><h2>获取最新计划</h2><p class="setting-note">你把实际做题结果告诉ChatGPT，我更新计划并发布后，再点击下方检查。请先预览差异，再决定是否应用；不会把计划任务自动算成已完成。</p><div class="button-row"><button class="cta secondary" data-action="check-updates">↻ 检查计划更新</button><button class="cta ghost" data-action="copy-summary">▤ 复制学习近况</button></div><p class="setting-note" id="sync-status">当前：${esc(data.meta.planVersion||'初始版')} · ${esc(updateSource)} · ${esc(lastCheck)}</p></section>
 <section class="setting-section"><h2>数据与备份</h2><div class="button-row"><button class="cta secondary" data-action="export">↥ 导出学习记录</button><button class="cta ghost" data-action="import">↧ 导入备份</button><button class="cta ghost" data-action="export-previous">导出恢复前副本</button></div><input id="file-import" type="file" accept="application/json,.json"/><p class="setting-note" style="margin-top:13px">打卡、错题和复盘存在当前手机的浏览器数据中，并未自动上传云端。建议每周导出一次备份；清除浏览器数据或换机前务必备份。</p></section>
 <section class="setting-section"><h2>离线与访问</h2><p class="setting-note" id="offline-status">${navigator.onLine===false?'当前离线，使用本地记录':'当前在线'} · ${esc(offlineStatus)}</p><div class="button-row"><button class="cta ghost" data-action="refresh-app">检查应用更新</button><a class="cta secondary" href="./index.html">重新打开网页</a></div><p class="setting-note">离线副本保存在本机，当前使用免费公开网址，网站任何人都可访问，GitHub代码仓库仍为私人。打卡、错题和笔记仅存本机、不自动上传；借用手机时请保护好锁屏。</p></section><section class="setting-section"><h2>多科目规划</h2><p class="setting-note">英语二日程和记录已在使用中；政治为下一阶段预留了独立入口、计划文件位置和数据命名空间。你提供真实学习状况后再开始制作政治计划，不预设学习成绩。</p><div class="button-row"><button class="cta secondary" data-action="open-politics">查看政治科目准备情况</button><button class="cta ghost" data-action="copy-politics">复制建档清单</button></div></section>
 <section class="setting-section"><h2>计划依据</h2><div class="metric"><b>计划开始</b><small>2026年10月15日</small></div><div class="metric"><b>计划结束</b><small>2026年12月18日</small></div><div class="metric"><b>英语二考试</b><small>2026年12月19日</small></div><div class="metric"><b>模拟安排</b><small>3套 · 弹性4天</small></div></section>
 <section class="setting-section"><h2>安装到手机桌面</h2><p class="setting-note">部署到HTTPS站点后，在 Android Chrome 或 Edge 菜单中选择「安装应用」或「添加到主屏幕」。荣耀手机安装后如果找不到图标，检查浏览器“创建桌面快捷方式”权限。首次联网缓存完成后再尝试离线启动；清理网站数据前先导出备份。</p></section>
 <div class="watermark">M2.6 本地优先 · 联网更新计划 · 暂无跨设备打卡同步和后台提醒</div>`;
}
function findTask(id,day){return allTasks(day).find(t=>t.id===id)}
let modalFocus=null;
function modal(content){modalFocus=document.activeElement;document.body.classList.add('modal-open');const box=document.getElementById('modal');box.classList.remove('hidden');box.innerHTML=`<div class="modal-card">${content}</div>`;box.querySelector('input,button,textarea')?.focus();}
function closeModal(){document.getElementById('modal').classList.add('hidden');document.body.classList.remove('modal-open');modalFocus?.focus();}
function taskModal(id,day){const t=findTask(id,day);if(!t)return;
 const checked=!!state.done[t.id];
 modal(`<div class="modal-head"><div><div class="eyebrow">专项训练 · ${esc(t.type)}</div><h2>训练记录</h2></div><button class="close" data-action="close" aria-label="关闭训练记录">×</button></div>
 <div class="quickflex task-overview"><div><b>${esc(t.title)}</b><br><span>${esc(day)} · 预计${t.minutes}分钟 · ${checked?'已完成':'未完成'}</span></div></div>
 <section class="study-guide" aria-label="训练方法"><span class="guide-label">这项练习怎么做</span><p>${esc(t.detail||'按自己的节奏独立完成，再核对答案并记录收获。')}</p></section>
 <form id="task-form" data-id="${esc(t.id)}" data-day="${esc(day)}">
 <div class="record-heading"><h3>做完后记录</h3><small>不必写很多，留下关键错因即可</small></div>
 <label class="form-line"><span>${['新题型','阅读'].includes(t.type)?'错题数（0—5）':t.type==='完形'?'错题数（0—20）':'错题数（可选）'}</span><input id="task-wrong" inputmode="numeric" type="number" min="0" max="${['新题型','阅读'].includes(t.type)?5:20}" placeholder="${t.type==='新题型'?'5道题中错了几道？':'没错填0；未统计可留空'}" value="${esc(state.wrong[t.id]??'')}"></label>
 <label class="form-line"><span>一句话复盘（可选）</span><textarea id="task-note" maxlength="20000" placeholder="例如：定位词找对了，但没看转折句。">${esc(state.notes[t.id]||'')}</textarea></label>
 <details class="advanced-adjust"><summary>调整任务名称、预计时间或日期</summary><div class="advanced-fields">
 <label class="form-line"><span>任务名称</span><input id="task-title" maxlength="200" required value="${esc(t.title)}" ${t.vocab?'disabled':''}></label>
 <label class="form-line"><span>预计用时（分钟）</span><input id="task-minutes" type="number" min="1" max="90" required value="${t.minutes}" ${t.vocab?'disabled':''}></label>
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
 const lines=['研途英语二 · 学习进度（发给ChatGPT用于改计划）',`生成日期：${today}`,`计划版本：${data.meta.planVersion||'初始版'}`,`每天总预算：${state.settings.budget}分钟；单词：${state.settings.vocab}分钟`,`阅读一刷近年约37/40，二刷到2011 Text 3；新题型约6.5/10；完形约6/10。`,`近14天情况：`];
 for(const d of latest){const arr=specialTasks(d.date);const short=arr.map(t=>`${t.title}${state.done[t.id]?'[完成]':'[未完成]'}${state.wrong[t.id]!==undefined?'(错'+state.wrong[t.id]+')':''}`).join('；');
  lines.push(`${d.date}${state.skipped[d.date]?'[休息]':''}：${short}`);
  for(const t of arr){if(state.notes[t.id])lines.push(`  复盘（${t.title}）：${state.notes[t.id]}`)}
 }
 lines.push('请优先保留已完成记录，按剩余时间重排未完成任务，不自动双倍补课。');return lines.join('\n');
}
const POLITICS_BRIEF='请帮我为2027考研政治建立复习计划，并接入研途PWA的独立政治科目。我的当前政治复习资料或课程：____；目前学到的阶段：____；已经完成的题库、练习和错题情况：____；每天或每周能分给政治的时间：____；我的重要安排与限制：____。请先根据我填的信息核实，再设计计划，不要猜进度，也不要修改英语二的打卡和复习安排。';
async function copyPolitics(){
 try{await navigator.clipboard.writeText(POLITICS_BRIEF);toast('政治建档清单已复制，可发到ChatGPT填写');}
 catch{modal(`<div class="modal-head"><h2>政治建档清单</h2><button class="close" data-action="close" aria-label="关闭">×</button></div><p class="setting-note">长按全选复制后发给ChatGPT，不需要现在立刻填写。</p><textarea class="share-text" readonly>${esc(POLITICS_BRIEF)}</textarea>`);}
}
async function copySummary(){const s=summaryText();try{await navigator.clipboard.writeText(s);toast('近况已复制，粘贴到ChatGPT即可')}catch{modal(`<div class="modal-head"><h2>复制学习近况</h2><button class="close" data-action="close" aria-label="关闭弹窗">×</button></div><p class="setting-note">长按文本全选复制，发给ChatGPT。</p><textarea class="share-text" readonly>${esc(s)}</textarea>`);}}
function nextBuffer(day){
 for(let i=1;i<=14;i++){const d=plus(day,i);if(!inRange(d))break;const hints=(byDate.get(d)?.items||[]);if(hints.some(t=>t.type==='机动'))return d}
 return null;
}
function exportState(previous=false){let record={app:'yantu-english-ii',version:2,exportedAt:new Date().toISOString(),state,plan:data,...(storageBlocked?{unreadableRaw:localStorage.getItem(STORAGE_KEY)}:{})};if(previous){try{const p=JSON.parse(localStorage.getItem(STORAGE_KEY+'_before_restore'));if(!p)throw Error();record={app:'yantu-english-ii',version:2,state:p.state,plan:p.plan,...(p.raw?{unreadableRaw:p.raw}:{})};}catch{toast('没有恢复前副本');return;}}const blob=new Blob([JSON.stringify(record,null,2)],{type:'application/json'});const a=document.createElement('a');const u=URL.createObjectURL(blob);a.href=u;a.download=`研途英语二备份_${today}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),3000);toast('备份已生成，请妥善保存')}
document.addEventListener('click',e=>{
 const tab=e.target.closest('.nav-tab');if(tab){nav(tab.dataset.view);return}
 const btn=e.target.closest('[data-action]');if(!btn){if(e.target.id==='modal')closeModal();return}
 const action=btn.dataset.action;
 if(action==='switch-subject'||action==='open-politics'){subject=action==='open-politics'?'politics':btn.dataset.subject==='politics'?'politics':'english';if(action==='open-politics')view='today';document.querySelectorAll('.nav-tab').forEach(el=>{const active=el.dataset.view===view;el.classList.toggle('active',active);if(active)el.setAttribute?.('aria-current','page');else el.removeAttribute?.('aria-current');});render(true);window.scrollTo(0,0);return;}
 if(action==='copy-politics'){copyPolitics();return;}
 if(action==='theme'){const next=btn.dataset.theme;if(next!=='light'&&next!=='dark')return;theme=next;if(document.documentElement)document.documentElement.dataset.theme=theme;try{localStorage.setItem(THEME_KEY,theme);}catch{toast('外观已切换，但偏好未能保存');}render();return;}
 if(action==='review-update'){reviewUpdate();return}
 if(action==='apply-update'){applyUpdate();return}
 if(action==='refresh-app'){if(!navigator.serviceWorker){toast('当前浏览器不支持离线应用');return;}navigator.serviceWorker.getRegistration().then(r=>r?.update()).then(()=>toast('已检查应用更新；有新版时关闭再打开即可')).catch(()=>toast('暂时无法检查，稍后重试'));return}
 if(action==='toggle'){const t=findTask(btn.dataset.id,btn.dataset.day);if(!t)return;const next=!state.done[t.id];state.archive[t.id]={...t,date:btn.dataset.day};state.done[t.id]=next;if(next)delete state.skipped[btn.dataset.day];if(!save()){render();return;}render(false,next?t.id:'');const p=dateProgress(btn.dataset.day);toast(next?(p.total&&p.done===p.total?'当日专项已完成，打卡已保存在本机':'已完成，打卡已保存在本机'):'已取消完成标记');return}
 if(action==='day'||action==='cal-day'){selectedDate=btn.dataset.date;calendarMonth=selectedDate.substring(0,7);if(action==='cal-day')nav('today');else render(true);return}
 if(action==='jump-today'){selectedDate=inRange(today)?today:data.meta.start;render(true);return}
 if(action==='toggle-skip'){const day=btn.dataset.date;if(!inRange(day))return;if(state.skipped[day])delete state.skipped[day];else state.skipped[day]=true;const ok=save();render();if(!ok)return;toast(state.skipped[day]?'已标记休息，不会自动补课':'已恢复');return}
 if(action==='detail'){taskModal(btn.dataset.id,btn.dataset.day);return}
 if(action==='add'){addModal(btn.dataset.day||selectedDate);return}
 if(action==='close'){closeModal();return}
 if(action==='move-buffer'){const s=nextBuffer(btn.dataset.day);if(!s){toast('没有可用的机动日，请手动选择日期');return}const t=findTask(btn.dataset.id,btn.dataset.day);if(!t||!canPlace(s,t.id,t.minutes))return;state.moved[btn.dataset.id]=s;if(!save()){render();return;}closeModal();render();toast('已改期到 '+niceDate(s));return}
 if(action==='remove'){if(!confirm('删除此自定义任务？笔记与错题会保留在备份中。'))return;delete state.archive[btn.dataset.id];state.added=state.added.filter(t=>t.id!==btn.dataset.id);delete state.moved[btn.dataset.id];delete state.done[btn.dataset.id];if(!save()){render();return;}closeModal();render();toast('已删除');return}
 if(action==='prev-month'||action==='next-month'){const [y,m]=calendarMonth.split('-').map(Number);const d=new Date(y,m-1+(action==='next-month'?1:-1),1,12);const next=localISO(d).substring(0,7);if(next>='2026-10'&&next<='2026-12')calendarMonth=next;render(true);return}
 if(action==='check-updates'){checkUpdates();return}
 if(action==='copy-summary'){copySummary();return}
 if(action==='export'){exportState();return}
 if(action==='export-previous'){exportState(true);return}
 if(action==='import'){document.getElementById('file-import')?.click();return}
});
document.addEventListener('submit',e=>{
 if(e.target.id==='task-form'){
  e.preventDefault();const f=e.target,id=f.dataset.id,day=f.dataset.day;
  const t=findTask(id,day);if(!t)return;
  const title=document.getElementById('task-title').value.trim(),minutes=Number(document.getElementById('task-minutes').value),move=document.getElementById('task-move').value;
  const w=document.getElementById('task-wrong').value;
  if(!title||!Number.isInteger(minutes)||minutes<1||minutes>90||!inRange(move)){toast('请检查任务名称、分钟和日期');return;}
  const wrongMax=['新题型','阅读'].includes(t.type)?5:20;
  if(w!==''&&(!Number.isInteger(Number(w))||Number(w)<0||Number(w)>wrongMax)){toast('请填写0—'+wrongMax+'之间的整数错题数');return;}
  if(!t.vocab&&(minutes!==t.minutes||move!==day)&&!canPlace(move,id,minutes))return;
  if(w==='')delete state.wrong[id];else state.wrong[id]=Number(w);
  state.notes[id]=document.getElementById('task-note').value.trim();
  if(!t.vocab){state.edits[id]={title,minutes};if(move!==day)state.moved[id]=move;}
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
    if(obj.app!=='yantu-english-ii'||![1,2].includes(obj.version))throw Error('不是有效的研途备份');
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
window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY){state=load();closeModal();render();toast('已载入另一个窗口的记录');}if(e.key===THEME_KEY&&['light','dark'].includes(e.newValue)){theme=e.newValue;if(document.documentElement)document.documentElement.dataset.theme=theme;render();}if(e.key===PLAN_KEY){try{const p=JSON.parse(e.newValue);if(Core.validPlan(p)){data=p;byDate=new Map(data.days.map(d=>[d.date,d]));closeModal();render();}}catch{}}});
document.addEventListener('keydown',e=>{const box=document.getElementById('modal');if(box.classList.contains('hidden'))return;if(e.key==='Escape'){closeModal();return;}if(e.key==='Tab'){const a=[...box.querySelectorAll('button,input,select,textarea,a[href],summary')].filter(x=>!x.disabled);const first=a[0],last=a.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
checkUpdates(true);
if('serviceWorker'  in navigator && (location.protocol==='https:'||location.hostname==='localhost')){
 window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(async r=>{const observe=w=>{w?.addEventListener('statechange',()=>{if(w.state==='redundant'){offlineStatus='离线缓存安装失败，请联网后重试';if(view==='settings')render();}if(w.state==='installed'){offlineStatus='离线资源已缓存';if(view==='settings')render();toast(r.active?'应用新版已下载，关闭后重新打开生效':'离线资源已就绪');}})};observe(r.installing);r.addEventListener('updatefound',()=>observe(r.installing));if(r.waiting){offlineStatus='新版已下载，关闭所有页面后重开生效';}if(navigator.serviceWorker.controller){offlineStatus='离线资源已缓存';if(view==='settings')render();}}).catch(()=>{offlineStatus='离线缓存未完成，请联网打开网页后再试';if(view==='settings')render();}));
}
})();

