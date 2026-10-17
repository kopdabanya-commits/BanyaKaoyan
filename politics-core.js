/* Political plan validation and independent local records; never touches English keys. */
(function(root){'use strict';
const key='yantu_politics_2026_v1';
const cleanDate=s=>typeof s==='string'&&/^2026-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const safe=k=>typeof k==='string'&&k.length>0&&k.length<180&&!['__proto__','constructor','prototype'].includes(k);
const types=['课程','刷题','复盘','模拟','背诵'];
function validPlan(p){if(!obj(p)||!obj(p.meta)||p.meta.start!=='2026-10-16'||p.meta.end!=='2026-12-18'||p.meta.exam!=='2026-12-19'||!Array.isArray(p.days)||p.days.length!==64)return false;
const ids=new Set(),dates=new Set();
for(let i=0;i<64;i++){const d=p.days[i],date=new Date(Date.UTC(2026,9,16+i)).toISOString().slice(0,10);if(!obj(d)||d.date!==date||dates.has(date)||!Array.isArray(d.items)||!d.items.length)return false;dates.add(date);let total=0;
for(const t of d.items){if(!obj(t)||!safe(t.id)||ids.has(t.id)||typeof t.title!=='string'||!t.title.trim()||!types.includes(t.type)||!Number.isInteger(t.minutes)||t.minutes<5||t.minutes>90||typeof t.detail!=='string')return false;total+=t.minutes;ids.add(t.id)}if(total<40||total>135)return false}
return true}
const defaults=()=>({done:{},notes:{},wrong:{},questionIds:{},actualMinutes:{},questions:{marx:{done:93,total:396,updated:'2026-10-15'}},skipped:{},settings:{},edits:{},removed:{},added:[],version:1});
function normalize(s){if(!obj(s))throw Error('政治记录格式错误');const n=defaults();for(const field of ['done','notes','wrong','questionIds','actualMinutes','skipped']){if(s[field]===undefined)continue;if(!obj(s[field]))throw Error('字段格式错误');n[field]={};for(const [k,v] of Object.entries(s[field])){if(!safe(k))throw Error('无效记录键');if(field==='notes'&&(typeof v!=='string'||v.length>3000))throw Error('笔记格式错误');if(field==='wrong'&&(!Number.isInteger(v)||v<0||v>100))throw Error('错题格式错误');if(field==='questionIds'&&(typeof v!=='string'||v.length>500))throw Error('题号记录错误');if(field==='actualMinutes'&&(!Number.isInteger(v)||v<1||v>600))throw Error('实际用时错误');if(['done','skipped'].includes(field)&&typeof v!=='boolean')throw Error('打卡格式错误');n[field][k]=v}}
if(s.questions!==undefined){if(!obj(s.questions))throw Error('题库进度错误');n.questions={};for(const [k,q] of Object.entries(s.questions)){if(!safe(k)||!obj(q)||!Number.isInteger(q.total)||q.total<1||q.total>10000||!Number.isInteger(q.done)||q.done<0||q.done>q.total||typeof q.updated!=='string'||q.updated.length>40)throw Error('题库进度错误');n.questions[k]={done:q.done,total:q.total,updated:q.updated}}}
if(s.edits!==undefined){if(!obj(s.edits))throw Error('计划修改格式错误');for(const [id,edit] of Object.entries(s.edits)){if(!safe(id)||!obj(edit)||!Object.keys(edit).length||Object.keys(edit).some(k=>!['title','minutes'].includes(k))||edit.title!==undefined&&(typeof edit.title!=='string'||!edit.title.trim()||edit.title.length>200)||edit.minutes!==undefined&&(!Number.isInteger(edit.minutes)||edit.minutes<1||edit.minutes>90))throw Error('计划修改无效');n.edits[id]={...edit}}}
if(s.removed!==undefined){if(!obj(s.removed))throw Error('计划隐藏格式错误');for(const [id,removed] of Object.entries(s.removed)){if(!safe(id)||removed!==true)throw Error('计划隐藏无效');n.removed[id]=true}}
if(s.added!==undefined){if(!Array.isArray(s.added)||s.added.length>500)throw Error('自定义任务无效');const ids=new Set();for(const task of s.added){if(!obj(task)||!safe(task.id)||!task.id.startsWith('p-custom-')||ids.has(task.id)||!cleanDate(task.date)||task.date<'2026-10-16'||task.date>'2026-12-18'||typeof task.title!=='string'||!task.title.trim()||task.title.length>200||!types.includes(task.type)||!Number.isInteger(task.minutes)||task.minutes<1||task.minutes>90||typeof task.detail!=='string'||task.detail.length>3000)throw Error('自定义任务无效');ids.add(task.id);n.added.push({...task})}}
return n}
function tasks(plan,state,date){const day=plan.days.find(d=>d.date===date);if(!day)return null;const items=[...day.items,...(state.added||[]).filter(t=>t.date===date)].filter(t=>!state.removed?.[t.id]).map(t=>({...t,...state.edits?.[t.id]}));return {...day,items}}
const api={key,validPlan,defaults,normalize,cleanDate,tasks};
if(typeof module==='object'&&module.exports)module.exports=api;else root.PoliticsCore=api;
})(typeof window==='object'?window:globalThis);
