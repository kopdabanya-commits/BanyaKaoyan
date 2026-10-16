import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),core=require('../planner-core.js');
const plan=JSON.parse(fs.readFileSync(new URL('../plan.json',import.meta.url),'utf8'));
const added=plan.days.flatMap(d=>d.items.filter(t=>t.id.startsWith('daily-feel-')));
const original=structuredClone(plan);original.days.forEach(d=>d.items=d.items.filter(t=>!t.id.startsWith('daily-feel-')));original.meta.revision=5;original.meta.planVersion='2026.10.15-m2.3';
const target=d=>d.items.some(t=>['阅读','新题型','完形'].includes(t.type)||(t.type==='综合'&&/阅读Text\s*4.*新题型.*完形/.test(t.title)));
test('M2.6: each of 65 days includes one real objective task; 2024-26 mock parts count but are not re-used',()=>{
 assert.equal(plan.meta.revision,8);assert.equal(plan.days.length,65);assert.equal(added.length,42);
 for(const d of plan.days){assert(target(d),d.date);const mins=d.items.reduce((sum,t)=>sum+t.minutes,0);assert(mins>=60&&mins<=90,d.date);}
 for(const yr of [2024,2025,2026])for(const d of plan.days.filter(x=>x.items.some(t=>t.title.includes(yr+'年模考')))){
  assert.equal(d.items.filter(t=>t.id.startsWith('daily-feel-')).length,target(original.days.find(x=>x.date===d.date))?0:1);
 }
 assert(added.every(t=>!/(2024|2025|2026)年/.test(t.title)));
});
test('M2.6: old task identifiers, date, minutes and 10-15 assignments remain identical',()=>{
 assert.equal(original.days.length,plan.days.length);
 for(let i=0;i<65;i++){
  const d=plan.days[i],old=original.days[i];assert.equal(d.date,old.date);
  for(let j=0;j<old.items.length;j++)assert.deepEqual(d.items[j],old.items[j]);
 }
 assert.equal(plan.days[0].items.reduce((n,t)=>n+t.minutes,0),65);
 assert.equal(plan.days[0].items.length,3);
 assert(added.every(t=>t.type==='阅读'&&/Text [1-4]/.test(t.title)||t.type==='新题型'&&t.title.includes('5题')||t.type==='完形'&&t.title.includes('20空')));
});
test('M2.6: old local notes, completion and personalized schedule can migrate without being erased',()=>{
 const s=core.defaults();s.settings.budget=100;
 const past=original.days[0].items[0];s.done[past.id]=true;s.notes[past.id]='作文复盘';s.wrong[past.id]=1;
 s.moved[original.days[9].items[0].id]='2026-10-30';
 const next=core.migrate(original,plan,s,'2026-10-15');
 assert.equal(next.done[past.id],true);assert.equal(next.notes[past.id],'作文复盘');assert.equal(next.wrong[past.id],1);
 assert.equal(next.moved[original.days[9].items[0].id],'2026-10-30');
 assert.equal(next.settings.budget,100,'core migrate must not silently change user settings');
 assert(core.tasks(plan,next,'2026-10-16').some(t=>t.id==='daily-feel-2026-10-16'));
 assert(core.validPlan(plan));
 for(const vocab of [30,35,40])for(const d of plan.days){const t=core.defaults();t.settings.vocab=vocab;const total=core.tasks(plan,t,d.date).reduce((n,x)=>n+x.minutes,0);assert(total<=135,d.date);}
});
test('M2.6: practice-only additions never claim actual scores, learning completion or automatic timing',()=>{
 assert(added.every(t=>t.detail.includes('限时')||t.detail.includes('15—18分钟')));
 assert(added.every(t=>t.detail.length>=50));
 assert(added.every(t=>t.id.startsWith('daily-feel-2026-')));
 assert.equal(new Set(added.map(t=>t.id)).size,42);
 assert.equal(plan.days.flatMap(d=>d.items).length,143);
});

// M2.7独立复测：保留10月15日旧任务历史、10月16日重新上手、不强行补债。
test('M2.7: missed Oct 15 remains historical and Oct 16 writing + new type + reading start is safe',()=>{
 const d15=plan.days.find(d=>d.date==='2026-10-15');
 const d16=plan.days.find(d=>d.date==='2026-10-16');
 const d17=plan.days.find(d=>d.date==='2026-10-17');
 assert(plan.meta.missedStart.includes('2026-10-15'));
 assert.equal(d15.items.length,3,'保留旧计划历史以兼容本机历史记录');
 assert.equal(d16.items.reduce((n,t)=>n+t.minutes,0),85);
 assert.equal(d16.items.filter(t=>t.id.startsWith('restart-2026-10-16-')).length,2);
 assert(d16.items.some(t=>t.title.includes('2010年小作文')));
 assert(d16.items.some(t=>t.title.includes('2014年英语二新题型')));
 assert(d16.items.some(t=>t.type==='阅读'));
 assert.equal(d17.items.reduce((n,t)=>n+t.minutes,0),65);
 assert(d17.items.some(t=>t.id==='2026-10-16-1'&&t.minutes===15));
 const previous=structuredClone(plan);previous.meta.revision=6;previous.meta.planVersion='2026.10.15-m2.6';
 const p16=previous.days.find(d=>d.date==='2026-10-16');const p17=previous.days.find(d=>d.date==='2026-10-17');
 p16.items=p16.items.filter(t=>!t.id.startsWith('restart-2026-10-16-'));
 const intro=p17.items.find(t=>t.id==='2026-10-16-1');intro.minutes=60;intro.title='大作文入门：图表三段式';
 intro.detail='以2010题为例，先掌握描述趋势/比较数据/总结的结构，写出首段。';
 p16.items.unshift(p17.items.splice(p17.items.indexOf(intro),1)[0]);
 const review=p17.items.find(t=>t.id==='2026-10-17-newtype-review');review.minutes=35;
 const state=core.defaults();state.notes['2026-10-15-1']='历史个人笔记';state.wrong['2026-10-17-1']=2;
 const updated=core.migrate(previous,plan,state,'2026-10-16');
 assert.equal(updated.notes['2026-10-15-1'],'历史个人笔记');
 assert.equal(updated.wrong['2026-10-17-1'],2);
 assert(core.tasks(plan,updated,'2026-10-16').some(t=>t.id==='restart-2026-10-16-writing'));
 assert(core.tasks(plan,updated,'2026-10-16').some(t=>t.id==='restart-2026-10-16-newtype'));
 assert(!core.tasks(plan,updated,'2026-10-16').some(t=>t.id==='2026-10-16-1'));
 assert(core.tasks(plan,updated,'2026-10-17').some(t=>t.id==='2026-10-16-1'));
 assert(!updated.done['2026-10-15-1'],'不能假装未做的昨天已经完成');
});

test('M2.7.1: Oct 18 substitutes invitation letter instead of 2011 prompt, and leaves objective training',()=>{
 const d=plan.days.find(x=>x.date==='2026-10-18');
 const essay=d.items.find(t=>t.id==='2026-10-18-1');
 assert(essay.title.includes('邀请信'));
 assert(!essay.title.includes('2011年小作文'));
 assert.equal(essay.minutes,55);
 assert(d.items.some(t=>t.type==='新题型'&&t.minutes===25));
 assert.equal(d.items.reduce((n,t)=>n+t.minutes,0),85);
 assert.equal(plan.days.flatMap(x=>x.items).length,143);
});
