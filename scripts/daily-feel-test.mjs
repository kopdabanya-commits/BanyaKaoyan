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
 assert.equal(plan.meta.revision,6);assert.equal(plan.days.length,65);assert.equal(added.length,42);
 for(const d of plan.days){assert(target(d),d.date);const mins=d.items.reduce((sum,t)=>sum+t.minutes,0);assert(mins>=60&&mins<=90,d.date);}
 for(const yr of [2024,2025,2026])for(const d of plan.days.filter(x=>x.items.some(t=>t.title.includes(yr+'年模考')))){
  assert.equal(d.items.filter(t=>t.id.startsWith('daily-feel-')).length,d.items.some(t=>t.type==='综合'&&/阅读Text\s*4/.test(t.title))?0:d.items.some(t=>['阅读','完形','新题型'].includes(t.type))?0:1);
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
 assert.equal(plan.days.flatMap(d=>d.items).length,141);
});
