/* 板牙考研 · 政治科目：独立本机数据、手动苍盾记录，不读取外部小程序。 */
(function(root){'use strict';
const Core=root.PoliticsCore,plan=root.POLITICS_PLAN,ready=!!(Core&&Core.validPlan(plan));
let blocked=false,lastSaved='',state=null,selected='2026-10-16',openId='',rerender=()=>{},pMonth='2026-10';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function restore(){try{const raw=localStorage.getItem(Core.key);state=raw?Core.normalize(JSON.parse(raw)):Core.defaults();lastSaved=JSON.stringify(state);blocked=false;}catch{blocked=true;state=Core.defaults();}}
if(ready)restore();
function save(){if(blocked)return false;try{const raw=JSON.stringify(state);localStorage.setItem(Core.key,raw);lastSaved=raw;return true}catch{state=JSON.parse(lastSaved);return false}}
function dateAdd(s,n){const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function getDay(s){return plan.days.find(d=>d.date===s)}
function totals(d){return {done:d.items.filter(t=>state.done[t.id]).length,total:d.items.length,minutes:d.items.reduce((n,t)=>n+t.minutes,0)}}
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
 return '<div class="month-head"><button class="round-btn" data-action="p-cal-prev" aria-label="上个月" '+(pMonth===plan.meta.start.slice(0,7)?'disabled':'')+'>‹</button><h2>'+y+'年'+m+'月</h2><button class="round-btn" data-action="p-cal-next" aria-label="下个月" '+(pMonth===plan.meta.end.slice(0,7)?'disabled':'')+'>›</button></div><div class="calendar"><div class="cal-grid">'+days.join('')+'</div><div class="legend"><span><i></i>待练</span><span class="green"><i></i>已完成</span></div></div>';
}

function content(view,today){if(!ready)return '<section class="p-board"><h2>政治计划资源未就绪</h2><p>原有英语二数据未受影响，请联网后点击检查应用更新。</p></section>';
 if(selected==='2026-10-16'&&today>='2026-10-16'&&today<='2026-12-18'&&!root.__politicsSelectionInitialized){selected=today;pMonth=today.slice(0,7);root.__politicsSelectionInitialized=true}
 const header='<header class="p-head compact-p-head"><div><div class="eyebrow">2027 考研 · 政治</div><h1>政治复习</h1><p>按当天计划推进 · 60～65 分目标</p></div></header>';
 const warning=blocked?'<div class="skip-banner" role="alert">政治记录读取失败，已停止写入，防止覆盖原数据。</div>':'';
 const disclaimer='<p class="p-hint">打卡只代表你主动确认完成，计划日期不会自动转成学习成绩。苍盾题库无法直接同步，请手动更新。</p>';
 if(view==='calendar'){return header+warning+'<h1 class="page-title">学习日历</h1><p class="subtitle">点选日期查看完整安排，返回后仍在日历。</p>'+monthlyCalendar(today)+'<div class="p-calendar-summary">每天的计划按原日期保留，未完成任务不会自动推到第二天。</div>';}
 if(view==='stats'){const all=plan.days.map(d=>totals(d)),done=all.reduce((n,x)=>n+x.done,0),total=all.reduce((n,x)=>n+x.total,0),stages=[...new Set(plan.days.map(d=>d.stage))];return header+warning+'<section class="p-board"><h2>政治实际打卡统计</h2><div class="p-big">'+done+'<small> / '+total+'项完成</small></div>'+stages.map(name=>{const days=plan.days.filter(d=>d.stage===name),a=days.reduce((n,d)=>n+totals(d).done,0),b=days.reduce((n,d)=>n+totals(d).total,0);return '<div class="p-stage"><div><b>'+esc(name)+'</b><span>'+a+'/'+b+'</span></div><div class="p-track"><i style="width:'+Math.round(a/b*100)+'%"></i></div></div>'}).join('')+disclaimer+'</section>';}
 if(view==='settings'){return header+warning+'<section class="p-board"><h2>政治备份与恢复</h2><p class="p-hint">政治和英语二各有独立的本地记录键。恢复政治备份不会覆盖英语数据；恢复前会留一份回退副本。</p><div class="p-buttons"><button class="cta" data-action="p-export">导出政治备份</button><button class="cta secondary" data-action="p-import">导入政治备份</button></div><input type="file" id="p-import-file" accept=".json,application/json" hidden>'+disclaimer+'<button class="cta ghost" data-action="switch-subject" data-subject="english">返回英语二</button></section>';}
 const day=getDay(selected)||plan.days[0],t=totals(day),pct=Math.round(t.done/t.total*100),q=state.questions.marx||{done:0,total:396};
 const cards=day.items.map(item=>'<article class="p-task'+(state.done[item.id]?' completed':'')+'"><div class="p-task-meta"><span class="p-label">'+esc(item.type)+'</span><span>'+item.minutes+'分钟</span></div><h3>'+esc(item.title)+'</h3><p>'+esc(item.detail)+'</p>'+(state.wrong[item.id]!==undefined?'<small class="p-wrong">已记录错题 '+state.wrong[item.id]+' 道</small>':'')+(state.notes[item.id]?'<p class="p-saved-note">'+esc(state.notes[item.id])+'</p>':'')+'<div class="p-buttons"><button class="cta small'+(state.done[item.id]?' secondary':'')+'" data-action="p-toggle" data-id="'+item.id+'">'+(state.done[item.id]?'撤销打卡':'完成打卡')+'</button><button class="cta ghost small" data-action="p-detail" data-id="'+item.id+'">错题 / 笔记</button></div>'+(openId===item.id?'<form class="p-note-form" id="p-task-form" data-id="'+item.id+'"><label>本次错题数<input id="p-wrong" type="number" min="0" max="100" value="'+(state.wrong[item.id]??'')+'" placeholder="可留空"></label><label>一句话复盘<textarea id="p-note" rows="3" maxlength="3000" placeholder="例如：多选题漏掉了限制条件">'+esc(state.notes[item.id]||'')+'</textarea></label><div class="p-buttons"><button class="cta small" type="submit">保存复盘</button><button class="cta secondary small" data-action="p-note-close">收起</button></div></form>':'')+'</article>').join('');
 return header+warning+'<section class="p-board"><div class="p-day-top"><div><span class="eyebrow">当前计划</span><h2>'+day.date.slice(5)+' · '+esc(day.stage)+'</h2><p>'+t.minutes+'分钟建议训练量 · '+esc(day.topic)+'</p></div><strong>'+t.done+'/'+t.total+'</strong></div><div class="p-track"><i style="width:'+pct+'%"></i></div><div class="p-buttons p-nav"><button class="cta ghost small" data-action="p-prev" '+(day.date===plan.meta.start?'disabled':'')+'>← 前一天</button><button class="cta ghost small" data-action="p-day" data-day="'+(today>='2026-10-16'&&today<='2026-12-18'?today:plan.meta.start)+'">今天</button><button class="cta ghost small" data-action="p-next" '+(day.date===plan.meta.end?'disabled':'')+'>后一天 →</button></div><p class="p-hint">'+esc(day.hint)+'</p></section><div class="p-section-heading"><h2>今日政治任务</h2><span>'+t.minutes+'分钟</span></div>'+cards+'<section class="p-board"><div class="section-row"><h2>苍盾 · 肖1000题</h2><span class="sub">手动登记</span></div><p class="p-hint">截图中马原进度为93/396题。以后请根据苍盾中的实际数据更新，不会自动读取小程序账号。</p><form id="p-progress-form" class="p-progress-form"><label>已做<input type="number" id="p-questions" min="0" max="10000" value="'+q.done+'" required></label><label>总题数<input type="number" id="p-total" min="1" max="10000" value="'+q.total+'" required></label><button class="cta small" type="submit">保存</button></form><p class="p-hint">已登记马原 '+q.done+'/'+q.total+'题（'+Math.round(q.done/q.total*100)+'%），不是整门政治总体完成率。</p></section><section class="p-board"><h2>计划使用说明</h2>'+disclaimer+'<button class="cta secondary" data-action="p-export">导出政治记录</button></section>';
}
function render(view,today,escape,refresh){rerender=refresh;return content(view,today)}
function download(){const data=JSON.stringify({app:'yantu-politics',version:1,exportedAt:new Date().toISOString(),state},null,2);const blob=new Blob([data],{type:'application/json'}),href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download='板牙考研_政治备份_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(href),3000)}
function report(success){if(!success)alert('保存失败，旧数据没有被覆盖。建议检查浏览器存储空间。');rerender()}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b||!String(b.dataset.action).startsWith('p-')||!ready)return;e.stopImmediatePropagation?.();e.preventDefault?.();const act=b.dataset.action,id=b.dataset.id;
 if(act==='p-day'){if(!getDay(b.dataset.day))return;if(root.BANYA_VIEW?.()==='calendar'&&!document.body.classList.contains('day-detail-open')){root.BANYA_OPEN_DAY?.(b.dataset.day);}else{root.BANYA_SELECT_DAY?.(b.dataset.day);}return}
 if(act==='p-cal-prev'||act==='p-cal-next'){shiftMonth(act==='p-cal-prev'?-1:1);return}
 if(act==='p-prev'||act==='p-next'){const n=dateAdd(selected,act==='p-prev'?-1:1);if(getDay(n))root.BANYA_SELECT_DAY?.(n);return}
 if(act==='p-toggle'){const task=plan.days.flatMap(d=>d.items).find(x=>x.id===id);if(task&&!blocked){state.done[id]=!state.done[id];report(save())}return}
 if(act==='p-detail'){openId=openId===id?'':id;rerender();return}
 if(act==='p-note-close'){openId='';rerender();return}
 if(act==='p-export'){download();return}
 if(act==='p-import'){document.getElementById('p-import-file')?.click();return}
},true);
document.addEventListener('submit',e=>{if(!ready||!['p-progress-form','p-task-form'].includes(e.target.id))return;e.preventDefault();e.stopImmediatePropagation?.();if(blocked)return;
 if(e.target.id==='p-progress-form'){const a=Number(document.getElementById('p-questions').value),b=Number(document.getElementById('p-total').value);if(!Number.isInteger(a)||!Number.isInteger(b)||b<1||b>10000||a<0||a>b){alert('请输入正确的题库总数和已做题数。');return}state.questions.marx={done:a,total:b,updated:new Date().toISOString().slice(0,10)};report(save());return}
 const id=e.target.dataset.id,w=document.getElementById('p-wrong').value.trim(),note=document.getElementById('p-note').value.trim();if(w!==''&&(!Number.isInteger(Number(w))||Number(w)<0||Number(w)>100)){alert('错题数只能填写0—100。');return}if(w==='')delete state.wrong[id];else state.wrong[id]=Number(w);state.notes[id]=note;openId='';report(save());
},true);
document.addEventListener('change',async e=>{if(!ready||e.target.id!=='p-import-file')return;e.stopImmediatePropagation?.();const file=e.target.files?.[0];if(!file)return;try{if(file.size>2000000)throw Error('备份文件过大');const obj=JSON.parse(await file.text());if(obj.app!=='yantu-politics'||obj.version!==1)throw Error('不是有效的政治备份');const next=Core.normalize(obj.state);if(!confirm('恢复政治记录会替换原政治打卡，但不会影响英语二。恢复前将保留回退副本，继续吗？'))return;localStorage.setItem(Core.key+'_before_restore',JSON.stringify(state));const before=state;state=next;if(!save()){state=before;throw Error('本机写入失败')}rerender()}catch(err){alert('导入失败：'+err.message)}},true);
root.addEventListener?.('storage',e=>{if(ready&&e.key===Core.key){restore();rerender()}});
root.PoliticsUI={render,setDate,getDate:()=>selected};
})(typeof window==='object'?window:globalThis);
