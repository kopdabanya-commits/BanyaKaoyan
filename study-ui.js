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
 +'<span class="student-task-meta">'+esc(item.type)+' <span aria-hidden="true">·</span> '+duration+('<span class="student-task-status">'+(done?'已完成':notDone?'不做':'待完成')+'</span>')+wrongLabel+(hasNote?'<span class="student-task-record">有记录</span>':'')+'</span></button>'
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
 const categoriesHtml=categories.length?'<section class="student-stat-section"><h2>'+(subject==='politics'?'训练内容':'题型训练')+'</h2><div class="student-stat-types">'+categories.map(c=>'<div class="student-stat-type"><span>'+esc(c.label)+'</span><strong>'+c.done+' / '+c.total+'</strong></div>').join('')+'</div></section>':'';

 return header('学习进度')+summary+bars+categoriesHtml;
}
function trainingRecords(categories,{subject='english'}={}){
 const items=categories.flatMap(c=>c.items),completed=items.filter(t=>t.done).length,timed=items.filter(t=>t.total!==undefined),minutes=timed.reduce((sum,t)=>sum+t.total,0);
 const summary='<div class="student-stat-grid training-overview"><div><span>累计打卡</span><strong>'+completed+'<small> 项</small></strong></div><div><span>已记录总用时</span><strong>'+(timed.length?minutes:'—')+'<small>'+(timed.length?' 分钟':' 尚未填写')+'</small></strong></div></div>';
 const hints='<p class="training-source-note">来自这台设备已保存的学习记录，联网同步后也会更新。未打卡不等于没学；没有填写的用时和错题不会估算。</p>';
 const cards=categories.map(c=>{
  const active=c.items.filter(t=>!t.done&&!t.notDone).length,times=c.items.filter(t=>t.total!==undefined),total=times.reduce((sum,t)=>sum+t.total,0);
  const work=c.items.filter(t=>t.work!==undefined),review=c.items.filter(t=>t.review!==undefined);
  const timeLabel=times.length?'已记总用时 '+total+' 分钟':[work.length?(c.label==='作文'?'动笔 ':'答题 ')+work.reduce((sum,t)=>sum+t.work,0)+' 分钟':'',review.length?'批改复盘 '+review.reduce((sum,t)=>sum+t.review,0)+' 分钟':''].filter(Boolean).join(' · ')||'用时尚未填写';
  const status=c.items.length?(active?'有记录未打卡 '+active+' 项':'已保存 '+c.items.length+' 项记录')+(c.notDone?' · 不做 '+c.notDone+' 项':''):'还没有保存记录';
  const rows=c.items.map(t=>{
   const status=t.done?'已完成':t.notDone?'不做':'有记录未打卡';
   const facts=[t.total!==undefined?'总用时 '+t.total+' 分钟':'总用时未填写',t.work!==undefined?(c.label==='作文'?'动笔 ':'答题 ')+t.work+' 分钟':'',t.review!==undefined?'批改复盘 '+t.review+' 分钟':'',Number.isInteger(t.wrong)?'错 '+t.wrong+' 题':''].filter(Boolean).join(' · ');
   const tag=t.viewable?'button':'div',attrs=t.viewable?' type="button" data-action="'+(subject==='politics'?'p-detail':'detail')+'" data-id="'+esc(t.id)+'" data-day="'+esc(t.date)+'"':'';
   return '<'+tag+attrs+' class="training-record"><span class="training-record-top"><small>'+(t.date?'任务日期 '+esc(shortDay(t.date)):'日期未记录')+'</small><b class="training-status '+(t.done?'is-done':t.notDone?'is-skipped':'is-recorded')+'">'+status+'</b></span><span class="training-record-title">'+esc(t.title)+'</span><span class="training-record-facts">'+esc(facts)+'</span>'+(!t.viewable?'<small class="training-history-note">历史记录 · 仅查看</small>':'')+'</'+tag+'>';
  }).join('');
  return '<details class="training-card" data-training-category="'+esc(c.label)+'"><summary><span class="training-card-heading">'+esc(c.label)+'<i aria-hidden="true">⌄</i></span><span class="training-card-count"><strong>'+c.done+'</strong> 项已打卡</span><span class="training-card-status">'+esc(status)+'</span><span class="training-card-time">'+esc(timeLabel)+'</span></summary><div class="training-card-records">'+(rows||'<p class="training-empty">保存一次练习记录后，就能在这里看到。</p>')+'</div></details>';
 }).join('');
 return header('我的学习记录','做过的、记下来的，都在这里。')+summary+hints+(items.length?'':'<div class="training-empty-banner">这里还没有已保存的记录。如果记录在云端，请先到设置点击“立即同步”。</div>')+'<div class="training-cards">'+cards+'</div><p class="training-source-note">点开卡片看明细。日期沿用任务安排，不推断实际完成日期；未来未记录的计划不计入统计。</p>';
}
root.BanyaStudyUI={esc,dayAdd,shortDay,header,strip,dayHeading,task,stats,trainingRecords};
})(typeof window==='object'?window:globalThis);
