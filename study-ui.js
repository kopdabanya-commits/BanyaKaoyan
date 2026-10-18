/* 板牙考研 M4：英语二/政治共用的精简视图组件。纯渲染，不读写两科数据。 */
(function(root){'use strict';
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const dayAdd=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const shortDay=s=>Number(s.slice(5,7))+'月'+Number(s.slice(8))+'日';
const days=['日','一','二','三','四','五','六'];
function header(label,hint=''){return '<header class="student-page-head"><h1>'+esc(label)+'</h1>'+(hint?'<p>'+esc(hint)+'</p>':'')+'</header>'}
function strip({selected,today,start,end,action='day',attribute='date'}){
 return '<div class="weekstrip student-weekstrip" aria-label="选择复习日期">'+[-3,-2,-1,0,1,2,3].map(i=>{
 const date=dayAdd(selected,i),valid=date>=start&&date<=end,dow=days[new Date(date+'T12:00:00Z').getUTCDay()];
 return '<button type="button" class="day-chip'+(date===selected?' selected':'')+(date===today?' today':'')+'" data-action="'+action+'" data-'+attribute+'="'+date+'" '+(!valid?'disabled':'')+' aria-pressed="'+(date===selected)+'" aria-label="'+shortDay(date)+'，周'+dow+'"><span class="dow">'+dow+'</span><span class="number">'+Number(date.slice(-2))+'</span></button>';
 }).join('')+'</div>';
}
function dayHeading({date,today,start,end,done,notDone=0,total,remaining,remainingCount=total-done-notDone,countdown,subtitle='',prev='day',next='day',jump='jump-today',attribute='date'}){
 const label=date===today?'今天':date<today?'已选日期':'计划日期';
 const pct=total?Math.round(done*100/total):0;
 const step=(offset,action,text)=>{const target=dayAdd(date,offset);return '<button type="button" data-action="'+action+'" data-'+attribute+'="'+target+'" '+(target<start||target>end?'disabled':'')+'>'+text+'</button>'};
 return '<header class="student-day-heading"><div><span class="student-overline">'+label+'</span><h1>'+shortDay(date)+'</h1>'+(subtitle?'<p>'+esc(subtitle)+'</p>':'')+'</div>'+(countdown!==undefined?'<span class="student-countdown">距初试 '+Number(countdown)+' 天</span>':'')+'</header>'
 +strip({selected:date,today,start,end,action:prev,attribute})
 +'<div class="student-day-controls"><div class="student-control-buttons">'+step(-1,prev,'‹ 前一天')+'<button type="button" data-action="'+jump+'" '+(date===today?'disabled':'')+'>今天</button>'+step(1,next,'后一天 ›')+'</div><span class="student-done-label">已完成 '+done+'/'+total+'</span></div>'
 +'<div class="student-progress"><span class="student-progress-fill" style="width:'+pct+'%"></span></div>'
 +(total&&remainingCount===0?'<p class="student-progress-caption">'+(notDone?'今天的安排已处理完':'当天计划已打卡完成')+'</p>':'<p class="student-progress-caption">剩余 '+Math.max(0,remainingCount)+' 项 · 预计 '+Number(remaining)+' 分钟</p>');
}
function task({item,day,done=false,notDone=false,wrong,hasNote=false,subject='english',next=false}){
 const id=esc(item.id),isPolitics=subject==='politics',toggle=isPolitics?'p-toggle':'toggle',open=isPolitics?'p-detail':'detail';
 const writing=isPolitics?null:root.PlannerCore?.writingParts?.(item);
 const duration=writing?'写'+writing.writing+'分钟 · 批改复盘'+writing.review+'分钟':'预计'+Number(item.minutes)+'分钟';
 const dayAttr=isPolitics?'':' data-day="'+esc(day)+'"';
 const wrongLabel=wrong!==undefined&&wrong!==''?'<span class="student-task-record">错 '+esc(wrong)+' 题</span>':'';
 return '<article class="student-task'+(done?' is-done':'')+(notDone?' is-not-done':'')+(next?' is-next':'')+'">'
 +'<button type="button" class="student-task-check'+(done?' checked':'')+'" data-action="'+toggle+'" data-id="'+id+'"'+dayAttr+' aria-pressed="'+done+'" aria-label="'+(done?'取消完成':'标记完成')+'：'+esc(item.title)+'">'+(done?'✓':'')+'</button>'
 +'<button type="button" class="student-task-body" data-action="'+open+'" data-id="'+id+'"'+dayAttr+' aria-label="查看任务详情：'+esc(item.title)+'">'
 +'<span class="student-task-name">'+esc(item.title)+'</span>'
 +'<span class="student-task-meta">'+esc(item.type)+' <span aria-hidden="true">·</span> '+duration+(notDone?'<span class="student-task-status">不做</span>':'')+wrongLabel+(hasNote?'<span class="student-task-record">有记录</span>':'')+'</span></button>'
 +'<button type="button" class="student-task-more" data-action="'+open+'" data-id="'+id+'"'+dayAttr+' aria-label="展开任务记录">›</button></article>';
}
function stats({days:rows=[],categories=[],wrongCount=0,today,subject='english'}){
 const end=[],start=dayAdd(today,-6);
 for(let i=0;i<7;i++){const d=dayAdd(start,i);const found=rows.find(x=>x.date===d);end.push(found||{date:d,total:0,done:0})}
 const completed=end.reduce((n,d)=>n+d.done,0),planned=end.reduce((n,d)=>n+d.total,0);
 const daysStudied=end.filter(d=>d.done>0).length;
 const summary='<div class="student-stat-grid"><div><span>近7日已打卡</span><strong>'+completed+'<small> 项</small></strong></div><div><span>有打卡的天数</span><strong>'+daysStudied+'<small> / 7</small></strong></div></div>';
 const bars='<section class="student-stat-section"><h2>最近7天</h2><div class="student-stat-bars">'+end.map(d=>{
 const frac=d.total?Math.round(d.done/d.total*100):0,lab=days[new Date(d.date+'T12:00:00Z').getUTCDay()];
 return '<div class="student-stat-day"><div class="student-stat-track"><i style="height:'+frac+'%"></i></div><span>'+lab+'</span><small>'+d.done+'/'+d.total+'</small></div>';
 }).join('')+'</div><p>只统计已打卡的任务；未打卡不等于未学习。</p></section>';
 const categoriesHtml=categories.length?'<section class="student-stat-section"><h2>'+(subject==='politics'?'训练内容':'各项完成情况')+'</h2>'+(subject==='english'?'<p>按当前全部计划统计，含以后安排；不做不计为完成。点开查看每项记录。</p>':'')+'<div class="student-stat-types">'+categories.map(c=>{
  if(subject!=='english'||!Array.isArray(c.items))return '<div class="student-stat-type"><span>'+esc(c.label)+'</span><strong>'+c.done+' / '+c.total+'</strong></div>';
  const pending=c.total-c.done-c.notDone;
  return '<details class="student-training-group" data-training-category="'+esc(c.label)+'"><summary><span>'+esc(c.label)+'</span><strong>已完成 '+c.done+' / '+c.total+'</strong></summary><p class="student-training-status">待完成 '+pending+' 项'+(c.notDone?' · 不做 '+c.notDone+' 项':'')+'</p><progress class="student-training-progress" max="'+(c.total||1)+'" value="'+c.done+'" aria-label="'+esc(c.label)+'完成进度"></progress>'+(c.items.length?c.items.map(t=>'<button type="button" class="student-record-row" data-action="detail" data-id="'+esc(t.id)+'" data-day="'+esc(t.date)+'"><span><small>'+esc(shortDay(t.date))+'</small> '+esc(t.title)+'</span><strong>'+(t.done?'✓ 已完成':t.notDone?'不做':t.date>today?'待完成 · 计划中':'待完成')+' ›</strong></button>').join(''):'<p class="student-training-status">还没有安排这类练习。</p>')+'</details>';
 }).join('')+'</div></section>':'';

 return header('学习进度')+summary+bars+categoriesHtml;
}
root.BanyaStudyUI={esc,dayAdd,shortDay,header,strip,dayHeading,task,stats};
})(typeof window==='object'?window:globalThis);
