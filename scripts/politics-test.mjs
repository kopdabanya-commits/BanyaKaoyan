import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const Core=require('../politics-core.js');
const politics=JSON.parse(fs.readFileSync(new URL('../politics-plan.json',import.meta.url)));
const serialized=fs.readFileSync(new URL('../politics-plan-data.js',import.meta.url),'utf8');
const uiCode=fs.readFileSync(new URL('../politics-ui.js',import.meta.url),'utf8');
const sharedCode=fs.readFileSync(new URL('../study-ui.js',import.meta.url),'utf8');
const deep=x=>JSON.parse(JSON.stringify(x));
function harness(initial={}){
 const handlers={},storage=new Map(Object.entries(initial)),elements={};
 const doc={addEventListener:(event,fn)=>(handlers[event]??=[]).push(fn),getElementById:id=>elements[id]||(elements[id]={value:'',innerHTML:'',classList:{_set:new Set(),add(x){this._set.add(x)},remove(x){this._set.delete(x)},contains(x){return this._set.has(x)}},querySelector:()=>null}),body:{classList:{add(){},remove(){}}},createElement:()=>({click(){}})};
 const win={PoliticsCore:Core,POLITICS_PLAN:politics,addEventListener(){},POLITICS_NAV(v){lastNav=v}};let lastNav='';
 const ctx={window:win,document:doc,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},Date,Blob,URL:{createObjectURL:()=>'',revokeObjectURL(){}},setTimeout(){},console,confirm:()=>true,alert:()=>{}};
 vm.createContext(ctx);vm.runInContext(sharedCode,ctx);vm.runInContext(uiCode,ctx);
 const render=(view='today',day='2026-10-16')=>win.PoliticsUI.render(view,day,x=>x,()=>{});
 const click=(action,opts={})=>{const b={dataset:{action,...opts}};for(const f of handlers.click||[])f({target:{closest:()=>b},preventDefault(){},stopImmediatePropagation(){}})};
 const submit=(id,opts={},submitter=null)=>{for(const f of handlers.submit||[])f({target:{id,dataset:opts},submitter,preventDefault(){},stopImmediatePropagation(){}})};
 return {render,click,submit,storage,elements,win,get lastNav(){return lastNav}};
}
test('2027 politics 64 valid calendar days and unique task ids',()=>{
 assert(Core.validPlan(politics));assert.equal(politics.days.length,64);assert.equal(politics.days[0].date,'2026-10-16');assert.equal(politics.days.at(-1).date,'2026-12-18');
 assert.equal(new Set(politics.days.flatMap(d=>d.items.map(x=>x.id))).size,192);
 assert(politics.days.some(d=>d.items.some(t=>t.title.includes('肖八'))));
 assert(politics.days.some(d=>d.items.some(t=>t.title.includes('肖四'))));
});
test('politics fallback plan data exactly matches JSON',()=>{
 const ctx={window:{}};vm.runInNewContext(serialized,ctx);assert.deepEqual(deep(ctx.window.POLITICS_PLAN),politics);
});
test('initial Marx questions reflect screenshot but never imply tasks completed',()=>{
 const state=Core.defaults();assert.equal(state.questions.marx.done,93);assert.equal(state.questions.marx.total,396);assert.deepEqual(state.done,{});
 const h=harness();const html=h.render();assert(html.includes('今日任务'));assert(h.render('stats').includes('93/396'));assert(!h.storage.has(Core.key));
});
test('subject renders today, calendar, stats and settings independently',()=>{
 const h=harness();for(const view of ['today','calendar','stats','settings'])assert(h.render(view).includes('政治复习'));assert(h.render('calendar').includes('cal-grid'));assert(h.render('settings').includes('p-import-file'));
});
test('politics completion writes only politics state, never English',()=>{
 const h=harness();h.render();h.click('p-toggle',{id:politics.days[0].items[0].id});const state=JSON.parse(h.storage.get(Core.key));assert.equal(state.done[politics.days[0].items[0].id],true);assert(!h.storage.has('yantu_english_2026_m1'));
 h.click('p-toggle',{id:politics.days[0].items[0].id});assert.equal(JSON.parse(h.storage.get(Core.key)).done[politics.days[0].items[0].id],false);
});
test('manual Cangdun updates enforce 0 <= completed <= total and preserve notes',()=>{
 const h=harness();h.render();h.elements['p-questions']={value:'100'};h.elements['p-total']={value:'396'};h.submit('p-progress-form');
 assert.equal(JSON.parse(h.storage.get(Core.key)).questions.marx.done,100);
 const id=politics.days[0].items[0].id;
 h.elements['p-wrong']={value:'3'};h.elements['p-note']={value:'多选题错因：概念不清'};h.submit('p-task-form',{id});
 const state=JSON.parse(h.storage.get(Core.key));assert.equal(state.wrong[id],3);assert.equal(state.notes[id],'多选题错因：概念不清');
 assert.throws(()=>Core.normalize({questions:{marx:{done:400,total:396,updated:'2026-10-15'}}}));
});
test('politics keeps specific question IDs and elapsed minutes within its own snapshot',()=>{
 const h=harness(),id=politics.days[0].items[0].id;h.render();
 h.elements['p-wrong']={value:'2'};h.elements['p-note']={value:'概念混淆'};h.elements['p-question-ids']={value:'马原第3、8题'};h.elements['p-actual-minutes']={value:'41'};
 h.submit('p-task-form',{id});const saved=JSON.parse(h.storage.get(Core.key));
 assert.equal(Core.normalize(saved).questionIds[id],'马原第3、8题');assert.equal(saved.actualMinutes[id],41);
 assert(!h.storage.has('yantu_english_2026_m1'));assert.throws(()=>Core.normalize({actualMinutes:{[id]:601}}));
});
test('corrupt or malicious politics backup structure is rejected',()=>{
 assert.throws(()=>Core.normalize({done:null}));
 assert.throws(()=>Core.normalize({done:{task:true},notDone:{task:true}}));
 assert.throws(()=>Core.normalize(JSON.parse('{"notes":{"__proto__":"x"}}')));
 assert.throws(()=>Core.normalize({wrong:{id:-1}}));
});
test('politics task can be marked not done, restored, or completed in its own snapshot',()=>{
 const h=harness(),id=politics.days[0].items[0].id;h.render();h.click('p-detail',{id});
 assert(h.elements.modal.innerHTML.includes('data-not-done="true"'));
 h.elements['p-note']={value:'改天再做'};h.submit('p-task-form',{id},{dataset:{notDone:'true'}});
 let saved=JSON.parse(h.storage.get(Core.key));assert.equal(saved.notDone[id],true);assert.equal(saved.done[id],undefined);assert(h.render().includes('student-task is-not-done'));assert(h.render().includes('不做'));
 h.click('p-detail',{id});h.submit('p-task-form',{id},{dataset:{notDone:'false'}});
 saved=JSON.parse(h.storage.get(Core.key));assert.equal(saved.notDone[id],undefined);assert.equal(saved.done[id],undefined);
 h.click('p-detail',{id});h.submit('p-task-form',{id},{dataset:{complete:'true'}});
 saved=JSON.parse(h.storage.get(Core.key));assert.equal(saved.done[id],true);assert.equal(saved.notDone[id],undefined);
 assert(!h.storage.has('yantu_english_2026_m1'));
});
test('private politics plan edits preserve task IDs, records and subject separation',()=>{
 const h=harness(),id=politics.days[0].items[0].id;
 h.render();h.click('p-toggle',{id});
 h.elements['p-plan-title']={value:'个人调整后的复盘'};h.elements['p-plan-minutes']={value:'25'};
 h.submit('p-plan-form',{id});
 let saved=JSON.parse(h.storage.get(Core.key));
 assert.equal(saved.edits[id].title,'个人调整后的复盘');
 assert.equal(saved.done[id],true);
 assert(h.render().includes('个人调整后的复盘'));
 h.elements['p-plan-title']={value:'新增错题回顾'};h.elements['p-plan-minutes']={value:'15'};
 h.submit('p-plan-form',{id:''});
 saved=JSON.parse(h.storage.get(Core.key));
 assert.equal(saved.added.length,1);
 assert(h.render().includes('新增错题回顾'));
 h.click('p-remove-task',{id});
 saved=JSON.parse(h.storage.get(Core.key));
 assert.equal(saved.removed[id],true);
 assert.equal(saved.done[id],true,'removing a plan item retains its old completion');
 assert(!h.render().includes('个人调整后的复盘'));
 assert(!h.storage.has('yantu_english_2026_m1'));
 assert.equal(Core.normalize(saved).added.length,1,'edits survive snapshot validation');
});
test('politics rejects malformed private plan overrides before restore or sync',()=>{
 assert.throws(()=>Core.normalize({edits:{task:{title:''}}}));
 assert.throws(()=>Core.normalize({removed:{task:false}}));
 assert.throws(()=>Core.normalize({added:[{id:'bad',date:'2026-10-16',title:'bad',type:'复盘',minutes:5,detail:''}]}));
});

// Politics v2: assert the actual user-approved time budget and stable local records.
test('v2 integrated plan has 60-minute budget, <=30-minute classes and stable 192 original IDs',()=>{
 assert.equal(politics.meta.revision,2);
 assert.equal(politics.meta.planVersion,'politics.2026-10-16-v2');
 assert.equal(politics.days.length,64);
 for(const [i,day] of politics.days.entries()){
  assert.deepEqual(day.items.map(t=>t.id),[1,2,3].map(n=>'pol-'+day.date+'-'+n));
  const total=day.items.reduce((n,t)=>n+t.minutes,0);
  assert.equal(total,i===63?40:60,'daily budget on '+day.date);
  for(const t of day.items)if(t.type==='课程')assert(t.minutes<=30,'watch actual minutes <=30');
  assert(day.hint.includes('60')||day.date==='2026-12-18');
 }
 assert(politics.days[0].items[0].title.includes('徐涛'));
 assert(politics.days[0].items[2].title.includes('腿姐'));
 assert(politics.days.some(d=>d.topic.includes('真题')));
 assert(politics.days.some(d=>d.items.some(t=>t.detail.includes('帕拉迪宇'))));
 assert(politics.days.some(d=>d.items.some(t=>t.detail.includes('未到手'))));
 assert(!politics.days.some(d=>d.items.some(t=>t.minutes>60)));
});
test('legacy political completed tasks, wrong counts and notes survive plan upgrade',()=>{
 const id='pol-2026-10-16-2';
 const legacy={done:{[id]:true},wrong:{[id]:3},notes:{[id]:'历史多选错因'},questions:{marx:{done:93,total:396,updated:'2026-10-15'}}};
 const state=Core.normalize(legacy);
 assert.equal(state.done[id],true);
 assert.equal(state.wrong[id],3);
 assert.equal(state.notes[id],'历史多选错因');
 assert.equal(state.questions.marx.done,93);
 assert(politics.days[0].items.some(t=>t.id===id),'legacy task ID is retained in v2');
 const h=harness();h.render();h.click('p-toggle',{id});
 assert.equal(JSON.parse(h.storage.get(Core.key)).done[id],true);
 assert(!h.storage.has('yantu_english_2026_m1'));
});

test('M3 politics monthly calendar opens day via shared app route and changes months',()=>{
 const h=harness();
 h.win.BANYA_VIEW=()=> 'calendar';
 let opened='';
 h.win.BANYA_OPEN_DAY=date=>{opened=date};
 let html=h.render('calendar','2026-10-16');
 assert(html.includes('2026年10月'));
 assert(html.includes('cal-grid'));
 h.click('p-day',{day:'2026-10-17'});
 assert.equal(opened,'2026-10-17');
 assert.equal(h.lastNav,'');
 h.click('p-cal-next');
 html=h.render('calendar','2026-10-16');
 assert(html.includes('2026年11月'));
 assert(h.win.PoliticsUI.setDate('2026-11-03'));
 assert.equal(h.win.PoliticsUI.getDate(),'2026-11-03');
 html=h.render('today','2026-10-16');
 assert(html.includes('student-weekstrip'));
});

test('M4.1 politics task details open the same sheet as English without displacing daily tasks',()=>{
 const h=harness(),id=politics.days[0].items[0].id;
 const list=h.render();assert(list.includes('student-task-list'));assert(!list.includes('student-task-detail'));
 h.click('p-detail',{id});const modal=h.elements['modal'];
 assert(modal&&!modal.classList.contains('hidden'));
 assert(modal.innerHTML.includes('class="modal-card"'));
 assert(modal.innerHTML.includes('训练记录'));
 assert(modal.innerHTML.includes('p-task-form'));
 assert(modal.innerHTML.includes('这项练习怎么做'));
 h.elements['p-wrong']={value:'2'};h.elements['p-note']={value:'多选题漏了限制词'};
 h.submit('p-task-form',{id});
 assert(modal.classList.contains('hidden'));
 const saved=JSON.parse(h.storage.get(Core.key));
 assert.equal(saved.wrong[id],2);assert.equal(saved.notes[id],'多选题漏了限制词');
 assert(!h.storage.has('yantu_english_2026_m1'));
});


test('private political date/content overlays and old learning records survive phone edits',()=>{
 const task=politics.days[0].items[0],id=task.id,record=Core.defaults();
 record.moved[id]='2026-10-17';record.edits[id]={detail:'Synthetic private guidance'};
 record.notes[id]='Existing private note';record.actualWritingMinutes[id]=20;record.actualReviewMinutes[id]=0;
 const normalized=Core.normalize(record);
 assert(!Core.tasks(politics,normalized,'2026-10-16').items.some(t=>t.id===id));
 assert.equal(Core.tasks(politics,normalized,'2026-10-17').items.filter(t=>t.id===id).length,1);
 const h=harness({[Core.key]:JSON.stringify(record)});h.win.PoliticsUI.setDate('2026-10-17');h.render();h.click('p-detail',{id});
 assert(h.elements.modal.innerHTML.includes('Synthetic private guidance'));
 h.click('p-edit-task',{id});h.elements['p-plan-title']={value:task.title};h.elements['p-plan-minutes']={value:String(task.minutes)};
 h.submit('p-plan-form',{id});const saved=JSON.parse(h.storage.get(Core.key));
 assert.equal(saved.edits[id].detail,'Synthetic private guidance');assert.equal(saved.moved[id],'2026-10-17');
 assert.equal(saved.notes[id],'Existing private note');assert.equal(saved.actualWritingMinutes[id],20);assert.equal(saved.actualReviewMinutes[id],0);
 assert(!h.storage.has('yantu_english_2026_m1'));
 assert.throws(()=>Core.normalize({moved:{[id]:'2026-02-31'}}));
});
