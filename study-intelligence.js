/* 研途 · 可解释的本地学习建议与未来科目注册。无网络、无个人数据上传。 */
(function(root){
'use strict';
const SUBJECTS=Object.freeze([
 Object.freeze({id:'english',label:'英语二',short:'ENGLISH II',status:'active',planFile:'plan.json',storageKey:'yantu_english_2026_m1'}),
 Object.freeze({id:'politics',label:'政治',short:'POLITICS',status:'active',planFile:'politics-plan.json',storageKey:'yantu_politics_2026_v1'})
]);
const WEIGHTS=Object.freeze({'写作':6,'翻译':5,'新题型':5,'完形':3,'复盘':3,'阅读':2,'模考':6,'综合':4,'机动':1});
const validDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s);
const asDate=s=>new Date(s+'T12:00:00Z');
function before(s,n){const d=asDate(s);d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10)}
function tasks(plan,state,core,date){return core.tasks(plan,state,date).filter(t=>!t.vocab&&!t.retired)}
function recommend(plan,state,core,date){
 if(!validDay(date))return null;
 const today=tasks(plan,state,core,date),remaining=today.filter(t=>!state.done[t.id]);
 if(state.skipped[date])return {kind:'rest',eyebrow:'状态已记录',title:'这一天已标记为未学习',detail:'不用把任务翻倍塞到明天。你可以根据实际情况恢复或调整安排。'};
 if(!today.length)return {kind:'empty',eyebrow:'当前安排',title:'这一天暂无专项任务',detail:'可以保留休息，也可以按需添加一项。'};
 if(!remaining.length)return {kind:'complete',eyebrow:'当日完成',title:'计划中的专项都已打卡',detail:'完成状态已保存在本机。想进一步提高，可以回看今天的错题与复盘。'};
 const sorted=remaining.map((task,index)=>{
  const w=state.wrong[task.id],mistakes=Number.isInteger(w)?Math.min(w,5):0;
  return {task,score:(WEIGHTS[task.type]||2)*10+mistakes-index*.01};
 }).sort((a,b)=>b.score-a.score);
 const t=sorted[0].task;
 const wrong=state.wrong[t.id];
 return {kind:'next',taskId:t.id,eyebrow:'本机规则建议 · 仅作参考',title:t.title,
  detail:Number.isInteger(wrong)&&wrong>0?'这项已记录'+wrong+'道错题；可先梳理错因再继续。':'依据你的现有专项任务和题型优先级推荐，完成后再记录错题。',
  minutes:t.minutes,type:t.type};
}
function week(plan,state,core,today){
 if(!validDay(today))return {days:[],done:0,total:0,skipped:0};
 const days=[];let done=0,total=0,skipped=0;
 for(let i=6;i>=0;i--){
  const date=before(today,i);
  const exists=plan.days.some(d=>d.date===date);
  const daily=exists?tasks(plan,state,core,date):[];
  const finished=daily.filter(t=>state.done[t.id]).length;
  const isSkipped=!!state.skipped[date];
  if(isSkipped)skipped++;done+=finished;total+=daily.length;
  days.push({date,day:asDate(date).getUTCDay(),done:finished,total:daily.length,skipped:isSkipped,
   fraction:daily.length?finished/daily.length:0,planned:exists});
 }
 return {days,done,total,skipped};
}
const api=Object.freeze({SUBJECTS,recommend,week,before});
if(typeof module==='object'&&module.exports)module.exports=api;
else root.StudyIntel=api;
})(typeof window==='object'?window:globalThis);
