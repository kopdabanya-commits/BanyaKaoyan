import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const importer=require('../plan-import.js');
const englishCore=require('../planner-core.js'),politicsCore=require('../politics-core.js');
const en=JSON.parse(fs.readFileSync(new URL('../plan.json',import.meta.url),'utf8'));
const pol=JSON.parse(fs.readFileSync(new URL('../politics-plan.json',import.meta.url),'utf8'));
const pack=(subject,changes)=>({format:'banya-plan-changes-v1',subject,batchId:'synthetic_batch_0001',changes});
const first=(p,date)=>p.days.find(d=>d.date===date).items[0];
const snapshot=x=>JSON.stringify(x);
test('strict JSON package: no code, no unexpected keys, capped operations',()=>{
 assert.throws(()=>importer.parse('hello'),/JSON/);
 assert.throws(()=>importer.parse(JSON.stringify({...pack('english',[])})),/格式/);
 assert.throws(()=>importer.parse(JSON.stringify({...pack('english',[{op:'add',date:'2026-10-20',title:'模拟任务',type:'阅读',minutes:20,script:'x'}])})),/不支持/);
 assert.throws(()=>importer.parse(JSON.stringify(pack('english',[{op:'add',date:'2026-10-20',title:'模拟任务',type:'错误类型',minutes:20}]))),/类型/);
});
test('English imported edit and move preserve untouched learning records',()=>{
 const t=first(en,'2026-10-20'),source=englishCore.defaults();
 source.notes['earlier-task']='Synthetic preserved note';source.actualMinutes['earlier-task']=44;
 source.actualReviewMinutes['earlier-task']=12;source.done['earlier-task']=true;
 source.notDone['another-task']=true;
 const prior=snapshot(source);
 const op=pack('english',[{op:'update',fromDate:'2026-10-20',matchTitle:t.title,toDate:'2026-12-18',title:'模拟调整练习',minutes:20,detail:'测试说明'}]);
 const out=importer.preview(op,en,source,englishCore);
 assert.equal(out.subject,'english');assert.equal(out.lines.length,1);
 assert.equal(out.state.moved[t.id],'2026-12-18');
 assert.equal(out.state.edits[t.id].title,'模拟调整练习');
 for(const key of ['done','notDone','notes','wrong','questionIds','actualMinutes','actualWritingMinutes','actualReviewMinutes','archive','settings'])
  assert.equal(snapshot(out.state[key]),snapshot(source[key]));
 assert.equal(snapshot(source),prior,'input state must not mutate');
});
test('Completed, not-done and historically recorded tasks fail closed',()=>{
 const t=first(en,'2026-10-20');
 const request=pack('english',[{op:'update',taskId:t.id,fromDate:'2026-10-20',title:'改名'}]);
 for(const field of ['done','notDone','notes','actualMinutes','actualReviewMinutes']){
  const state=englishCore.defaults();state[field][t.id]=field==='notes'?'saved':field==='actualMinutes'?22:field==='actualReviewMinutes'?8:true;
  assert.throws(()=>importer.preview(request,en,state,englishCore),/不能|历史/);
 }
});
test('notDo is an explicit status, never completion',()=>{
 const t=first(en,'2026-10-20');
 const out=importer.preview(pack('english',[{op:'notDo',fromDate:'2026-10-20',matchTitle:t.title}]),en,englishCore.defaults(),englishCore);
 assert.equal(out.state.notDone[t.id],true);
 assert.equal(out.state.done[t.id],undefined);
});
test('Idempotent custom addition: duplicate package is stopped, note data untouched',()=>{
 const change=pack('english',[{op:'add',date:'2026-10-22',title:'模拟阅读练习',minutes:10,type:'阅读',detail:'按时做题并复盘'}]);
 const base=englishCore.defaults();base.questionIds['old-task']='12,13';
 const one=importer.preview(change,en,base,englishCore);
 assert.equal(one.state.added.length,1);
 assert.equal(one.state.questionIds['old-task'],'12,13');
 assert.throws(()=>importer.preview(change,en,one.state,englishCore),/已经存在/);
});
test('Politics keeps completely separate format, can edit and add',()=>{
 const t=first(pol,'2026-10-20'),state=politicsCore.defaults();
 state.notes['other-id']='saved';state.actualMinutes['other-id']=45;
 const changes=pack('politics',[{op:'update',fromDate:'2026-10-20',matchTitle:t.title,title:'模拟政治复习'},{op:'add',date:'2026-10-21',title:'模拟背诵',minutes:10,type:'背诵'}]);
 const out=importer.preview(changes,pol,state,politicsCore);
 assert.equal(out.state.edits[t.id].title,'模拟政治复习');
 assert.equal(out.state.added.length,1);
 assert(out.state.added[0].id.startsWith('p-custom-chat-'));
 assert.equal(out.state.actualMinutes['other-id'],45);
 assert.equal(out.state.notes['other-id'],'saved');
});
test('Wrong template, wrong date and budget overflow never produce a result',()=>{
 const t=first(en,'2026-10-20');
 const bad=pack('english',[{op:'update',taskId:t.id,fromDate:'2026-10-20',toDate:'2026-10-19',minutes:90}]);
 assert.throws(()=>importer.preview(bad,en,englishCore.defaults(),englishCore),/135/);
 assert.throws(()=>importer.preview(pack('english',[{op:'add',date:'2027-01-01',title:'过期任务',type:'阅读',minutes:20}]),en,englishCore.defaults(),englishCore),/范围/);
 assert.throws(()=>importer.preview({...pack('english',[{op:'notDo',taskId:t.id}]),planVersion:'wrong'},en,englishCore.defaults(),englishCore),/版本/);
});
