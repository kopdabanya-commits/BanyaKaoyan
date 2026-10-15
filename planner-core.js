/* Shared validation and non-destructive plan migration. No network or storage. */
(function(root){
'use strict';
const types=['写作','新题型','翻译','完形','阅读','复盘','机动','综合','模考','单词'];
const defaults=()=>({done:{},skipped:{},moved:{},added:[],notes:{},wrong:{},edits:{},archive:{},settings:{vocab:35,budget:100}});
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const safeKey=k=>typeof k==='string'&&k.length>0&&k.length<=160&&!['__proto__','constructor','prototype'].includes(k);
const date=s=>typeof s==='string'&&/^2026-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const inRange=s=>date(s)&&s>='2026-10-15'&&s<='2026-12-18';
function task(t,custom=false){return object(t)&&safeKey(t.id)&&typeof t.title==='string'&&t.title.trim().length>0&&t.title.length<=200&&Number.isInteger(t.minutes)&&t.minutes>=1&&t.minutes<=90&&types.includes(t.type)&&(t.detail===undefined||typeof t.detail==='string')&&(!custom||(t.id.startsWith('custom-')&&t.custom===true&&inRange(t.date)));}
function validPlan(p){
 if(!object(p)||!object(p.meta)||p.meta.start!=='2026-10-15'||p.meta.end!=='2026-12-18'||p.meta.exam!=='2026-12-19'||typeof p.meta.planVersion!=='string'||!p.meta.planVersion||!Array.isArray(p.days)||p.days.length!==65)return false;
 if(p.meta.revision!==undefined&&(!Number.isInteger(p.meta.revision)||p.meta.revision<1))return false;
 const ids=new Set(),dates=new Set();
 for(const d of p.days){if(!object(d)||!inRange(d.date)||dates.has(d.date)||!Array.isArray(d.items))return false;dates.add(d.date);let m=40;
  for(const t of d.items){if(!task(t)||t.id.endsWith('-vocab')||t.id.startsWith('custom-')||ids.has(t.id))return false;ids.add(t.id);m+=t.minutes;}if(m>120)return false;
 }return true;
}
function normalizeState(s){
 if(!object(s))throw Error('记录格式无效');const n=defaults();
 for(const k of ['done','skipped','moved','notes','wrong','edits','archive']){
  if(s[k]===undefined)continue;if(!object(s[k]))throw Error(k+'格式无效');
  for(const [id,v] of Object.entries(s[k])){
   if(!safeKey(id))throw Error('记录ID无效');
   if(k==='done'&&typeof v!=='boolean')throw Error('完成记录无效');
   if(k==='skipped'&&(!inRange(id)||typeof v!=='boolean'))throw Error('休息记录无效');
   if(k==='moved'&&!inRange(v))throw Error('改期日期无效');
   if(k==='notes'&&(typeof v!=='string'||v.length>20000))throw Error('笔记无效');
   if(k==='wrong'&&v!==''&&(!Number.isInteger(v)||v<0||v>20))throw Error('错题记录无效');
   if(k==='edits'&&(!object(v)||typeof v.title!=='string'||!v.title.trim()||v.title.length>200||!Number.isInteger(v.minutes)||v.minutes<1||v.minutes>90))throw Error('任务修改无效');
   if(k==='archive'&&(!task(v)||v.id!==id||!inRange(v.date)))throw Error('历史任务无效');
   n[k][id]=structuredClone(v);
  }
 }
 if(s.settings!==undefined){if(!object(s.settings))throw Error('设置无效');Object.assign(n.settings,s.settings);}
 if(![30,35,40].includes(n.settings.vocab)||![90,100,110,120].includes(n.settings.budget))throw Error('时间设置超出范围');
 if(s.added!==undefined){if(!Array.isArray(s.added)||s.added.length>5000)throw Error('自定义任务无效');const ids=new Set();for(const t of s.added){if(!task(t,true)||ids.has(t.id))throw Error('自定义任务无效或重复');ids.add(t.id);}n.added=structuredClone(s.added);}
 return n;
}
function tasks(p,s,day){
 const result=new Map();for(const d of p.days)for(const t of d.items)result.set(t.id,{...t,date:d.date});
 for(const t of s.added)result.set(t.id,t);
 for(const [id,t] of Object.entries(s.archive))result.set(id,t);
 const vocab={id:day+'-vocab',date:day,title:`背单词 ${s.settings.vocab} 分钟`,minutes:s.settings.vocab,type:'单词',detail:'按当前使用的单词软件复习。',vocab:true};
 if(!result.has(vocab.id))result.set(vocab.id,vocab);
 return [...result.values()].filter(t=>!t.retired&&(s.moved[t.id]||t.date)===day).map(t=>({...t,...s.edits[t.id]})).sort((a,b)=>Number(!!b.vocab)-Number(!!a.vocab));
}
function migrate(old,fresh,s,today){
 const n=normalizeState(s);const next=new Map(fresh.days.flatMap(d=>d.items.map(t=>[t.id,t])));
 for(const d of old.days)for(const t of tasks(old,s,d.date)){
  if(t.vocab||t.custom)continue;
  if(s.done[t.id]||s.notes[t.id]||s.wrong[t.id]!==undefined||d.date<today||!next.has(t.id))n.archive[t.id]={...t,date:d.date,...(!next.has(t.id)&&d.date>=today&&!s.done[t.id]?{retired:true}:{})};
 }
 return n;
}
function diff(a,b){const m=p=>new Map(p.days.flatMap(d=>d.items.map(t=>[t.id,{...t,date:d.date}])));const x=m(a),y=m(b);let added=0,changed=0,removed=0;for(const [id,t]of y){if(!x.has(id))added++;else if(JSON.stringify(x.get(id))!==JSON.stringify(t))changed++;}for(const id of x.keys())if(!y.has(id))removed++;return {added,changed,removed};}
const api={defaults,validPlan,normalizeState,tasks,migrate,diff,inRange};
if(typeof module==='object'&&module.exports)module.exports=api;else root.PlannerCore=api;
})(typeof window==='object'?window:globalThis);
