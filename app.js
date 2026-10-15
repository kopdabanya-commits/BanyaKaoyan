/* 研途 · English II / 2026-10-15 — 2026-12-18. Local-first, no backend. */
(() => {
'use strict';
let data = window.STUDY_PLAN;
let byDate = new Map(data.days.map(day=>[day.date,day]));
let lastCheck = '还未检查';
let updateSource = '本地计划';
const DAYS = ['日','一','二','三','四','五','六'];
const COLORS = {'写作':'purple','新题型':'blue','翻译':'green','完形':'peach','阅读':'blue','复盘':'gray','机动':'green','综合':'peach','模考':'purple','单词':'purple'};
const DEFAULT = { done:{}, skipped:{}, moved:{}, added:[], notes:{}, wrong:{}, settings:{vocab:35,budget:100} };
const STORAGE_KEY = 'yantu_english_2026_m1';
let state = load();
let view = 'today';
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
function load(){try {const v=JSON.parse(localStorage.getItem(STORAGE_KEY));return {...structuredClone(DEFAULT),...(v||{}),settings:{...DEFAULT.settings,...(v?.settings||{})}}}catch{return structuredClone(DEFAULT)}}
function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch{toast('保存失败，请检查浏览器存储权限')}}
function allTasks(s){
 const source = (byDate.get(s)?.items||[]).filter(t=>!state.moved[t.id]||state.moved[t.id]===s);
 const inbound = data.days.flatMap(d=>d.items.filter(t=>state.moved[t.id]===s&&d.date!==s));
 const added = (state.added||[]).filter(t=>(state.moved[t.id]||t.date)===s);
 return [{id:s+'-vocab',title:`背单词 ${state.settings.vocab} 分钟`,minutes:state.settings.vocab,type:'单词',detail:'按自己当前使用的单词软件复习。需要时调整设置中的分钟数。',vocab:true},...source,...inbound,...added];
}
function dateProgress(s){const a=allTasks(s);return {done:a.filter(x=>state.done[x.id]).length,total:a.length,minutes:a.reduce((n,x)=>n+x.minutes,0),skipped:!!state.skipped[s]}}
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('on');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('on'),2800)}
function nav(next){view=next;document.querySelectorAll('.nav-tab').forEach(el=>el.classList.toggle('active',el.dataset.view===view));render();window.scrollTo(0,0)}
function render(){
 document.getElementById('system-date').textContent=`${niceDate(today)} · ${weekday(today)}`;
 const app=document.getElementById('app');
 app.innerHTML = view==='today'?renderToday():view==='calendar'?renderCalendar():view==='stats'?renderStats():renderSettings();
}
function remainingDays(){return Math.max(0, Math.round((dateFrom(data.meta.exam)-dateFrom(today))/(1000*60*60*24)))}
function refreshToday(){const fresh=localISO(new Date());if(fresh!==today){const followingToday=selectedDate===today;today=fresh;if(followingToday&&inRange(today))selectedDate=today;render();}}
function taskCard(t,day){
 const checked=!!state.done[t.id];
 const text = state.notes[t.id]||'';
 const wrong = state.wrong[t.id];
 return `<article class="task-card ${checked?'done':''}">
 <button class="check ${checked?'checked':''}" data-action="toggle" data-id="${esc(t.id)}" aria-label="${checked?'取消完成':'标记完成'}：${esc(t.title)}">${checked?'✓':''}</button>
 <button class="task-main task-open" data-action="detail" data-id="${esc(t.id)}" data-day="${esc(day)}" aria-label="查看任务详情：${esc(t.title)}"><div class="task-title">${esc(t.title)}</div><p class="task-sub">${t.detail?esc(t.detail):'完成后可点击右侧记录错题或心得。'}</p>
 <div class="pills"><span class="pill ${COLORS[t.type]||'gray'}">${esc(t.type)}</span><span class="pill gray">◷ ${t.minutes} 分钟</span>${wrong!==undefined&&wrong!==''?`<span class="pill peach">错 ${esc(wrong)} 题</span>`:''}${text?`<span class="pill green">已记录</span>`:''}</div></button>
 <button class="task-more" data-action="detail" data-id="${esc(t.id)}" data-day="${esc(day)}" aria-label="记录或调整任务">···</button>
 </article>`;
}
function renderToday(){
 const s=selectedDate; const v=dateProgress(s);
 const budget=state.settings.budget;
 const percent=v.total?Math.round(v.done/v.total*100):0;
 let days=[];for(let i=-3;i<=3;i++){const d=plus(s,i);days.push(`<button class="day-chip ${d===s?'selected':''} ${d===today?'today':''}" data-action="day" data-date="${d}" ${!inRange(d)?'disabled':''}><span class="dow">${weekday(d).slice(1)}</span><span class="number">${dateFrom(d).getDate()}</span></button>`)}
 const tasks=allTasks(s);
 return `<div class="eyebrow">2027 考研 · 英语二专项计划</div><h1 class="page-title">一点点，向目标靠近。</h1><p class="subtitle">10月13—14日已留空，从15日重新出发；无需补做双份。</p>
 <section class="hero"><div class="hero-top"><div><h2>距离英语二初试还有</h2><div class="count">${remainingDays()}<small>天</small></div></div><div class="hero-right"><div class="biggoal">80<span style="font-size:13px">分</span></div><div class="goal-label">冲刺目标</div><div class="smallgoal">基础目标 75分</div></div></div><div class="hero-bottom"><span>每日预算 ${budget} 分钟</span><div class="hero-foot">今日任务进度 <div class="hero-bar"><span style="width:${percent}%"></span></div><b>${percent}%</b></div></div></section>
 <section class="section-row"><h2>${dateHeading(s)}</h2><span class="sub">${v.minutes}分钟 · ${v.total}项</span></section><div class="weekstrip">${days.join('')}</div>
 ${v.skipped?'<div class="skip-banner">这一天已标记为休息／未学习，不会累计补课。随时可以恢复。</div>':''}
 <div class="progress-block"><div class="progress-top"><span class="progress-title">${percent===100?'今天完成了，做得不错 ✓':v.skipped?'今天先休息，保留原任务':'今天只做这几项'}</span><span class="progress-value">${v.done} / ${v.total} 已完成</span></div><div class="track"><span style="width:${percent}%"></span></div></div>
 ${tasks.map(t=>taskCard(t,s)).join('')||'<div class="empty">这一天没有任务，给自己留点喘息空间。</div>'}
 ${(byDate.get(s)?.hint)?`<div class="tip">${esc(byDate.get(s).hint)}</div>`:''}
 ${v.minutes>budget?`<div class="tip">当前约 ${v.minutes} 分钟，比默认预算多 ${v.minutes-budget} 分钟；可调整或改期任务。</div>`:''}
 <div class="section-row"><h2>灵活调整</h2><span class="sub">不让计划成为负担</span></div><div class="button-row"><button class="cta secondary" data-action="add" data-day="${s}">＋ 添加任务</button><button class="cta ghost" data-action="toggle-skip" data-date="${s}">${v.skipped?'恢复这一天':'今天没学／休息'}</button><button class="cta ghost" data-action="jump-today">返回今天</button></div>
 <p class="watermark">65天适应性计划 · 本地保存 · 随时可调整</p>`;
}
function renderCalendar(){
 let [year,month] = calendarMonth.split('-').map(Number);
 let first=new Date(year,month-1,1,12); let weekdayOffset=(first.getDay()+6)%7;
 let count=new Date(year,month,0).getDate();
 let arr=['一','二','三','四','五','六','日'].map(w=>`<span class="cal-wd">${w}</span>`);
 for(let i=0;i<weekdayOffset;i++)arr.push('<div></div>');
 for(let day=1;day<=count;day++){
  let s=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  let valid=inRange(s),p=valid?dateProgress(s):{done:0,total:0};
  arr.push(`<button class="cal-day ${s===selectedDate?'current':''} ${s===today?'reddot':''} ${!valid?'dim':''} ${p.total&&p.total===p.done?'complete':''}" data-action="cal-day" data-date="${s}" ${!valid?'disabled':''}>${day}${valid?'<i class="cal-dot"></i>':'<i style="height:5px"></i>'}</button>`)
 }
 let totalDone=data.days.filter(d=>dateProgress(d.date).total===dateProgress(d.date).done).length; const skippedDays=data.days.filter(d=>state.skipped[d.date]).length;
 return `<div class="eyebrow">DAY BY DAY</div><h1 class="page-title">65天复习日历</h1><p class="subtitle">点日期查看具体安排。不同于固定表格，任务可以改期和记录。</p>
 <div class="month-head"><button class="round-btn" data-action="prev-month" aria-label="上个月">‹</button><h2>${year}年${month}月</h2><button class="round-btn" data-action="next-month" aria-label="下个月">›</button></div>
 <div class="calendar"><div class="cal-grid">${arr.join('')}</div><div class="legend"><span><i></i>有安排</span><span class="green"><i></i>当天全部完成</span></div></div>
 <section class="section-row"><h2>三个复习阶段</h2></section>
 <div class="mini-card"><h3>10.15—11.15 · 写作入门＋客观题扫尾</h3><p>不追赶前两天进度；11月15日前完成2014—2023新题型一刷。</p></div>
 <div class="mini-card"><h3>11.16—12.04 · 完形翻译收官＋首次检测</h3><p>11月20日左右完形一刷完成；12月1日翻译一刷完成。11月21—24日2024卷弹性模考。</p></div>
 <div class="mini-card"><h3>12.05—12.18 · 两次检测＋作文强化</h3><p>12月5—8日2025卷；12月12—15日2026卷；最后3天重点查漏补缺。</p></div>
 <div class="tip">全部完成天数：${totalDone} / ${data.days.length} · 已标记休息 ${skippedDays} 天。错过一天不会自动产生双倍补课。</div>`;
}
function renderStats(){
 let scheduled=0,done=0,minutes=0;
 const counters={};
 for(const day of data.days){for(const t of allTasks(day.date)){
   scheduled++;counters[t.type]??={total:0,done:0};counters[t.type].total++;
   if(state.done[t.id]){done++;minutes+=t.minutes;counters[t.type].done++}
 }}
 const pct=scheduled?Math.round(done/scheduled*100):0;
 const focus=['写作','新题型','翻译','完形','阅读','复盘','综合','模考','机动','单词'];
 let records=[];for(const d of data.days){for(const t of allTasks(d.date)){if(state.wrong[t.id]!==undefined&&state.wrong[t.id]!=='')records.push({date:d.date,t,wrong:state.wrong[t.id]})}}
 return `<div class="eyebrow">MY PROGRESS</div><h1 class="page-title">看见每一步积累。</h1><p class="subtitle">仅根据你实际勾选和录入的内容统计；不虚构学习时长或成绩。</p>
 <div class="stats-two"><div class="statbox"><div class="name">已完成任务</div><div class="val">${done}<span style="font-size:12px;color:#aab1bf"> / ${scheduled}</span></div></div><div class="statbox"><div class="name">已完成任务的预计时长</div><div class="val">${(minutes/60).toFixed(1)}<span style="font-size:12px;color:#aab1bf"> 小时</span></div></div></div>
 <div class="progress-block"><div class="progress-top"><span class="progress-title">总体任务完成率</span><span class="progress-value">${pct}%</span></div><div class="track"><span style="width:${pct}%"></span></div></div>
 <section class="section-row"><h2>各题型完成情况</h2></section><div class="setting-section">${focus.filter(x=>counters[x]).map(x=>`<div class="metric"><div><b>${x}</b><br/><small>${counters[x].done}/${counters[x].total} 已完成</small></div><progress value="${counters[x].done}" max="${counters[x].total}"></progress></div>`).join('')}</div>
 <section class="section-row"><h2>你之前的真实基线</h2></section><div class="setting-section"><div class="metric"><b>阅读一刷</b><small>约 37 / 40</small></div><div class="metric"><b>新题型</b><small>6.5 / 10</small></div><div class="metric"><b>完形填空</b><small>6 / 10</small></div><div class="metric"><b>作文状态</b><small>从零启动</small></div></div>
 <section class="section-row"><h2>已记录的错题</h2></section>${records.length?records.slice(-10).reverse().map(r=>`<div class="mini-card"><h3>${esc(r.t.title)}</h3><p>${niceDate(r.date)} · 错 ${esc(r.wrong)} 题</p></div>`).join(''):'<div class="empty">开始练习后，点任务右侧 ··· 填错题数，这里就会生成记录。</div>'}
 <div class="tip">阅读是现有优势，计划重心是写作；记录真实成绩后，可进一步调整薄弱项。</div>`;
}
function renderSettings(){
 return `<div class="eyebrow">MAKE IT YOURS</div><h1 class="page-title">你的计划，你来掌控。</h1><p class="subtitle">不要因为临时安排打乱节奏；把计划调到能完成的程度。</p>
 <section class="setting-section"><h2>日常时间配置</h2><label class="input-line">背单词时间<select id="vocab-minutes"><option value="30" ${state.settings.vocab===30?'selected':''}>30分钟</option><option value="35" ${state.settings.vocab===35?'selected':''}>35分钟（默认）</option><option value="40" ${state.settings.vocab===40?'selected':''}>40分钟</option></select></label><label class="input-line">每日英语总预算<select id="daily-budget"><option value="90" ${state.settings.budget===90?'selected':''}>90分钟</option><option value="100" ${state.settings.budget===100?'selected':''}>100分钟（默认）</option><option value="110" ${state.settings.budget===110?'selected':''}>110分钟</option><option value="120" ${state.settings.budget===120?'selected':''}>120分钟</option></select></label><p class="setting-note">调整后每天的单词任务时长实时变化；其他任务不擅自改动。</p></section>
 <section class="setting-section"><h2>获取最新计划</h2><p class="setting-note">你告诉ChatGPT最新进度后，等我更新GitHub仓库里的 plan.json。手机有网络时点「检查更新」，不会清空已打卡和笔记。</p><div class="button-row"><button class="cta secondary" data-action="check-updates">↻ 检查计划更新</button><button class="cta ghost" data-action="copy-summary">▤ 复制学习近况</button></div><p class="setting-note" id="sync-status">当前：${esc(data.meta.planVersion||'初始版')} · ${esc(updateSource)} · ${esc(lastCheck)}</p></section>
 <section class="setting-section"><h2>数据与备份</h2><div class="button-row"><button class="cta secondary" data-action="export">↥ 导出学习记录</button><button class="cta ghost" data-action="import">↧ 导入备份</button></div><input id="file-import" type="file" accept="application/json,.json"/><p class="setting-note" style="margin-top:13px">当前版本所有记录只存在这台设备的浏览器中，不会自动同步。清除站点数据可能丢失记录，请定期导出备份。</p></section>
 <section class="setting-section"><h2>计划依据</h2><div class="metric"><b>计划开始</b><small>2026年10月15日</small></div><div class="metric"><b>计划结束</b><small>2026年12月18日</small></div><div class="metric"><b>英语二考试</b><small>2026年12月19日</small></div><div class="metric"><b>模拟安排</b><small>3套 · 弹性4天</small></div></section>
 <section class="setting-section"><h2>安装到手机桌面</h2><p class="setting-note">部署到HTTPS站点后，在Android Chrome的菜单中选择「添加到主屏幕」或「安装应用」。本地HTML预览不支持完整的离线安装能力。</p></section>
 <div class="watermark">M2 本地优先 · 联网更新计划 · 暂无跨设备打卡同步和后台提醒</div>`;
}
function findTask(id,day){return allTasks(day).find(t=>t.id===id)}
function modal(content){const box=document.getElementById('modal');box.classList.remove('hidden');box.innerHTML=`<div class="modal-card">${content}</div>`}
function closeModal(){document.getElementById('modal').classList.add('hidden')}
function taskModal(id,day){const t=findTask(id,day);if(!t)return;
 modal(`<div class="modal-head"><h2>任务记录与调整</h2><button class="close" data-action="close">×</button></div><div class="quickflex"><div><b>${esc(t.title)}</b><br><span>${esc(day)} · ${esc(t.type)} · ${t.minutes}分钟</span></div></div>
 <form id="task-form" data-id="${esc(t.id)}" data-day="${esc(day)}">
 <label class="form-line"><span>错题数（没有就留空）</span><input id="task-wrong" type="number" min="0" max="${t.type==='新题型'||t.type==='阅读'?5:20}" placeholder="如 2" value="${esc(state.wrong[t.id]??'')}"></label>
 <label class="form-line"><span>复盘笔记（可选）</span><textarea id="task-note" placeholder="今天最需要记住的是什么？">${esc(state.notes[t.id]||'')}</textarea></label>
 <label class="form-line"><span>调整到其他日期</span><input id="task-move" type="date" min="${data.meta.start}" max="${data.meta.end}" value="${day}" ${t.vocab?'disabled':''}></label>
 <div class="button-row"><button type="submit" class="cta">保存记录</button>${t.vocab?'':`<button type="button" class="cta secondary" data-action="move-buffer" data-id="${esc(t.id)}" data-day="${day}">移到机动日</button>`}</div></form>
 ${t.custom?'<div class="divider"></div><button class="cta danger" data-action="remove" data-id="'+esc(t.id)+'">删除自定义任务</button>':''}`);
}
function addModal(day){modal(`<div class="modal-head"><h2>添加自定义任务</h2><button class="close" data-action="close">×</button></div><form id="add-form"><label class="form-line"><span>任务名称</span><input required maxlength="70" id="add-title" placeholder="例如：重写2017年小作文"></label><label class="form-line"><span>题型</span><select id="add-type">${['写作','新题型','完形','翻译','阅读','复盘','机动'].map(x=>`<option>${x}</option>`).join('')}</select></label><label class="form-line"><span>预估时长（分钟）</span><input type="number" id="add-minutes" min="5" max="90" value="30" required></label><label class="form-line"><span>日期</span><input type="date" id="add-date" min="${data.meta.start}" max="${data.meta.end}" value="${day}" required></label><div class="button-row"><button type="submit" class="cta">添加任务</button></div></form>`)}
function validatePlan(input){
 if(!input || !input.meta || !Array.isArray(input.days) || input.meta.start!==data.meta.start || input.meta.end!==data.meta.end) return false;
 if(input.days.length!==data.days.length) return false;
 const ids=new Set(), dates=new Set();
 for(const day of input.days){
   if(!inRange(day.date) || dates.has(day.date) || !Array.isArray(day.items))return false;
   dates.add(day.date);
   for(const item of day.items){
     if(typeof item.id!=='string'||ids.has(item.id)||typeof item.title!=='string'||!Number.isInteger(item.minutes)||item.minutes<0||item.minutes>120)return false;
     ids.add(item.id);
   }
 }
 return true;
}
async function checkUpdates(silent=false){
 const button=document.querySelector('[data-action="check-updates"]'); if(button)button.disabled=true;
 try{
   const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),6500);
   let response;try{response=await fetch('./plan.json?check='+Date.now(),{cache:'no-store',signal:controller.signal})}finally{clearTimeout(timer)}
   if(!response.ok)throw Error('HTTP '+response.status);
   const fresh=await response.json();if(!validatePlan(fresh))throw Error('计划结构校验不通过');
   const changed=JSON.stringify(data.days)!==JSON.stringify(fresh.days) || data.meta.planVersion!==fresh.meta.planVersion;
   data=fresh;byDate=new Map(data.days.map(day=>[day.date,day]));
   lastCheck=new Date().toLocaleString('zh-CN',{hour:'2-digit',minute:'2-digit'});updateSource='已联机检查';
   render();if(changed)toast('计划已更新；你的打卡和笔记仍保留');else if(!silent)toast('已经是最新计划');
 }catch(err){updateSource='离线/暂不可更新';lastCheck='保留上次计划';render();if(!silent)toast('暂时无法联网，仍可离线打卡');}
 finally{const current=document.querySelector('[data-action="check-updates"]');if(current)current.disabled=false;}
}
function summaryText(){
 const cutoff=today>data.meta.end?data.meta.end:today;
 const latest=data.days.filter(d=>d.date<=cutoff && d.date>=plus(cutoff,-13));
 const lines=['研途英语二 · 学习进度（发给ChatGPT用于改计划）',`生成日期：${today}`,`计划版本：${data.meta.planVersion||'初始版'}`,`每天总预算：${state.settings.budget}分钟；单词：${state.settings.vocab}分钟`,`阅读一刷近年约37/40，二刷到2011 Text 3；新题型约6.5/10；完形约6/10。`,`近14天情况：`];
 for(const d of latest){const arr=allTasks(d.date);const short=arr.filter(t=>!t.vocab).map(t=>`${t.title}${state.done[t.id]?'[完成]':'[未完成]'}${state.wrong[t.id]!==undefined?'(错'+state.wrong[t.id]+')':''}`).join('；');
  lines.push(`${d.date}${state.skipped[d.date]?'[休息]':''}：${short}`);
  for(const t of arr){if(state.notes[t.id])lines.push(`  复盘（${t.title}）：${state.notes[t.id]}`)}
 }
 lines.push('请优先保留已完成记录，按剩余时间重排未完成任务，不自动双倍补课。');return lines.join('\n');
}
async function copySummary(){const s=summaryText();try{await navigator.clipboard.writeText(s);toast('近况已复制，粘贴到ChatGPT即可')}catch{modal(`<div class="modal-head"><h2>复制学习近况</h2><button class="close" data-action="close">×</button></div><p class="setting-note">长按文本全选复制，发给ChatGPT。</p><textarea class="share-text" readonly>${esc(s)}</textarea>`);}}
function nextBuffer(day){
 for(let i=1;i<=14;i++){const d=plus(day,i);if(!inRange(d))break;const hints=(byDate.get(d)?.items||[]);if(hints.some(t=>t.type==='机动'))return d}
 return inRange(plus(day,1))?plus(day,1):null;
}
function exportState(){const record={app:'yantu-english-ii',version:1,exportedAt:new Date().toISOString(),state};const blob=new Blob([JSON.stringify(record,null,2)],{type:'application/json'});const a=document.createElement('a');const u=URL.createObjectURL(blob);a.href=u;a.download=`研途英语二备份_${today}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),3000);toast('备份已生成，请妥善保存')}
document.addEventListener('click',e=>{
 const tab=e.target.closest('.nav-tab');if(tab){nav(tab.dataset.view);return}
 const btn=e.target.closest('[data-action]');if(!btn){if(e.target.id==='modal')closeModal();return}
 const action=btn.dataset.action;
 if(action==='toggle'){state.done[btn.dataset.id]=!state.done[btn.dataset.id];if(state.done[btn.dataset.id])delete state.skipped[btn.dataset.id.slice(0,10)];save();render();return}
 if(action==='day'||action==='cal-day'){selectedDate=btn.dataset.date;calendarMonth=selectedDate.substring(0,7);render();if(action==='cal-day')nav('today');return}
 if(action==='jump-today'){selectedDate=inRange(today)?today:data.meta.start;render();return}
 if(action==='toggle-skip'){const day=btn.dataset.date;if(!inRange(day))return;if(state.skipped[day])delete state.skipped[day];else state.skipped[day]=true;save();render();toast(state.skipped[day]?'已标记休息，不会自动补课':'已恢复');return}
 if(action==='detail'){taskModal(btn.dataset.id,btn.dataset.day);return}
 if(action==='add'){addModal(btn.dataset.day||selectedDate);return}
 if(action==='close'){closeModal();return}
 if(action==='move-buffer'){const s=nextBuffer(btn.dataset.day);if(!s){toast('没有可用的机动日，请手动选择日期');return}state.moved[btn.dataset.id]=s;save();closeModal();render();toast('已改期到 '+niceDate(s));return}
 if(action==='remove'){state.added=state.added.filter(t=>t.id!==btn.dataset.id);delete state.moved[btn.dataset.id];delete state.done[btn.dataset.id];save();closeModal();render();toast('已删除');return}
 if(action==='prev-month'||action==='next-month'){const [y,m]=calendarMonth.split('-').map(Number);const d=new Date(y,m-1+(action==='next-month'?1:-1),1,12);const next=localISO(d).substring(0,7);if(next>='2026-10'&&next<='2026-12')calendarMonth=next;render();return}
 if(action==='check-updates'){checkUpdates();return}
 if(action==='copy-summary'){copySummary();return}
 if(action==='export'){exportState();return}
 if(action==='import'){document.getElementById('file-import')?.click();return}
});
document.addEventListener('submit',e=>{
 if(e.target.id==='task-form'){
  e.preventDefault();const f=e.target,id=f.dataset.id,day=f.dataset.day;
  const w=document.getElementById('task-wrong').value;
  if(w==='')delete state.wrong[id];else{const count=Number(w);if(!Number.isInteger(count)||count<0||count>20){toast('错题数应为0—20之间的整数');return;}state.wrong[id]=count;}
  state.notes[id]=document.getElementById('task-note').value.trim();
  const move=document.getElementById('task-move').value;
  if(!id.endsWith('-vocab')&&inRange(move)) {if(move===day){ /* retain previous placement */ }else state.moved[id]=move}
  save();closeModal();render();toast('记录已保存');return;
 }
 if(e.target.id==='add-form'){
   e.preventDefault();const title=document.getElementById('add-title').value.trim(), date=document.getElementById('add-date').value;
   if(!title||!inRange(date))return;
   state.added.push({id:'custom-'+Date.now()+'-'+Math.random().toString(16).slice(2,7),title,date,type:document.getElementById('add-type').value,minutes:Number(document.getElementById('add-minutes').value),detail:'自定义任务',custom:true});
   save();closeModal();selectedDate=date;nav('today');toast('任务已添加');return;
 }
});
document.addEventListener('change',async e=>{
 if(e.target.id==='vocab-minutes'){state.settings.vocab=Number(e.target.value);save();render();toast('已调整背词时间')}
 if(e.target.id==='daily-budget'){state.settings.budget=Number(e.target.value);save();render();toast('已调整日预算')}
 if(e.target.id==='file-import'){
  const file=e.target.files?.[0];if(!file)return;
  try{const obj=JSON.parse(await file.text());if(file.size>2000000||obj.app!=='yantu-english-ii'||!obj.state||typeof obj.state.done!=='object'||!Array.isArray(obj.state.added))throw Error('备份无效或文件过大');
    if(!window.confirm('导入会覆盖此设备当前记录，是否继续？'))return;
    if(!obj.state.settings || !Array.isArray(obj.state.added) || !['done','skipped','moved','notes','wrong'].every(x=>obj.state[x]===undefined||(obj.state[x]&&typeof obj.state[x]==='object'&&!Array.isArray(obj.state[x]))))throw Error('备份数据格式异常');
    const next={...structuredClone(DEFAULT),...obj.state,settings:{...DEFAULT.settings,...(obj.state.settings||{})}};
    if(![30,35,40].includes(next.settings.vocab)||![90,100,110,120].includes(next.settings.budget))throw Error('备份设置超出范围');
    state=next;save();render();toast('导入完成');
  }catch(err){toast('导入失败：'+err.message)}
 }
});
render();
window.addEventListener('focus',refreshToday);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshToday();checkUpdates(true)}});
setInterval(refreshToday,60000);
checkUpdates(true);
if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost')){
 window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
})();
