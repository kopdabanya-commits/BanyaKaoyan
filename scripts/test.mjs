import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),core=require('../planner-core.js'),intel=require('../study-intelligence.js');
const plan=JSON.parse(fs.readFileSync(new URL('../plan.json',import.meta.url)));
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const sharedView=fs.readFileSync(new URL('../study-ui.js',import.meta.url),'utf8');
const oldPlan=structuredClone(plan);oldPlan.meta.planVersion='previous';oldPlan.meta.revision=2;
const key='yantu_english_2026_m1',pk='yantu_english_plan_v2';
const clone=x=>JSON.parse(JSON.stringify(x));
function harness({storage=new Map(),online=true,fresh=plan,fail=false}={}){
 const handlers={},winHandlers={},elements={},intervals=[],blobs=[];let now='2026-10-15T04:00:00Z',quota=false,fetchFail=fail,currentFresh=fresh;
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return new Date(now).valueOf();}}
 function el(id){return elements[id]??=( {id,value:'',disabled:false,dataset:{},textContent:'',_html:'',classList:{add(){},remove(){},contains(){return false;}},set innerHTML(s){this._html=s;},get innerHTML(){return this._html;},insertAdjacentHTML(_,s){this._html=s+this._html;},querySelector(){return el('focus');},querySelectorAll(){return []},focus(){},click(){},closest(){return null;}} );}
 const doc={hidden:false,activeElement:el('active'),body:{classList:{add(){},remove(){}}},getElementById:el,querySelector:()=>el('update-button'),querySelectorAll:()=>[],addEventListener:(k,f)=>(handlers[k]??=[]).push(f),createElement:()=>el('download')};
 const ls={getItem:k=>storage.get(k)??null,setItem:(k,v)=>{if(quota){quota=false;throw Error('quota');}storage.set(k,v)}};
 const context={window:null,PlannerCore:core,StudyIntel:intel,PoliticsUI:{render:(view)=>'<section class="politics-fixture">政治学习计划 '+view+'</section>'},STUDY_PLAN:clone(oldPlan),document:doc,navigator:{onLine:online,clipboard:{writeText:async t=>{context.copied=t}}},localStorage:ls,Date:Clock,structuredClone,console,AbortController,Blob,URL:class extends URL{static createObjectURL(b){blobs.push(b);return 'blob:test'}static revokeObjectURL(){}},location:{protocol:'https:',hostname:'test.invalid'},setTimeout:()=>0,clearTimeout(){},setInterval:f=>{intervals.push(f)},fetch:async()=>{if(fetchFail)throw Error('offline');return {ok:true,redirected:false,headers:new Headers({'content-type':'application/json'}),json:async()=>clone(currentFresh)}},confirm:()=>true,addEventListener:(k,f)=>(winHandlers[k]??=[]).push(f),scrollTo(){}};
 context.window=context;
 vm.createContext(context);vm.runInContext(sharedView,context);vm.runInContext(source.replace(/\n\}\)\(\);\s*$/,'\nglobalThis.api={get data(){return data},get state(){return state},get pending(){return pendingPlan},get selected(){return selectedDate},get today(){return today},allTasks,dateProgress,checkUpdates,applyUpdate,reviewUpdate,render,nav,exportState,summaryText,refreshToday};\n})();'),context);
 const api=context.api;
 async function event(type,target,extra={}){for(const f of handlers[type]||[])await f({target,preventDefault(){},...extra});}
 async function click(action,opts={}){const b={dataset:{action,...opts}};await event('click',{closest:q=>q==='.nav-tab'?null:b});}
 const input=(id,value)=>{el(id).value=String(value)};
 return {api,context,storage,el,input,event,click,winHandlers,blobs,async settle(){await new Promise(setImmediate)},setFresh:p=>currentFresh=p,setFail:v=>fetchFail=v,setNow:v=>now=v,quota:()=>quota=true};
}

test('65 continuous days, unique IDs, exact fallback and 90–135 minute schedules for all vocab settings',()=>{
 assert(core.validPlan(plan));let count=0;for(let day of plan.days){for(const vocab of [30,35,40]){const s=core.defaults();s.settings.vocab=vocab;const minutes=core.tasks(plan,s,day.date).reduce((n,t)=>n+t.minutes,0);assert(minutes>=(['2026-10-16','2026-12-18'].includes(day.date)?70:90)&&minutes<=135,day.date);}count+=day.items.length;}
 const ctx={window:{}};vm.runInNewContext(fs.readFileSync(new URL('../plan-data.js',import.meta.url),'utf8'),ctx);assert.deepEqual(clone(ctx.window.STUDY_PLAN),plan);assert.equal(count,191);
});
test('plan rejects duplicate IDs, duplicate dates, impossible dates, over-budget days and prototype keys',()=>{
 for(const edit of [p=>p.days[1].date=p.days[0].date,p=>p.days[1].items[0].id=p.days[0].items[0].id,p=>p.days[0].date='2026-02-31',p=>p.days[0].items[0].minutes=90,p=>p.days[0].items[0].id='__proto__']){const p=clone(plan);edit(p);assert.equal(core.validPlan(p),false);}
});
test('legacy state migrates; malformed backup, duplicate customs and unsafe keys are rejected',()=>{
 assert.equal(core.normalizeState({done:{a:true},added:[]}).settings.vocab,35);
 for(const p of [{done:null},{notes:{a:3}},{wrong:{a:-1}},{moved:{a:'2026-11-31'}},{added:[{id:'bad'}]},JSON.parse('{"done":{"__proto__":true}}')])assert.throws(()=>core.normalizeState(p));
 const t={id:'custom-1',custom:true,date:'2026-10-15',title:'test',minutes:5,type:'写作'};assert.throws(()=>core.normalizeState({added:[t,t]}));
});
test('full writing tasks show separate writing and review time without changing total or task ID',async()=>{
 const day='2026-10-18',id='2026-10-18-1',task=plan.days.find(d=>d.date===day).items.find(t=>t.id===id);
 assert.deepEqual(core.writingParts(task),{writing:20,review:5});
 const todayOutline=plan.days.find(d=>d.date==='2026-10-17').items.find(t=>t.id==='2026-10-16-1');
 assert.deepEqual(core.writingParts(todayOutline),{writing:10,review:5});
 assert.deepEqual(core.writingParts(plan.days.find(d=>d.date==='2026-10-16').items.find(t=>t.id==='restart-2026-10-16-writing')),{writing:15,review:5});
 assert.deepEqual(core.writingParts(plan.days.find(d=>d.date==='2026-12-18').items.find(t=>t.id==='2026-12-18-1')),{writing:10,review:5});
 assert.deepEqual(core.writingParts(plan.days.find(d=>d.date==='2026-12-11').items.find(t=>t.type==='写作')),{writing:20,review:10});
 assert.deepEqual(core.writingParts({...task,minutes:20,writingMinutes:10,reviewMinutes:10}),{writing:10,review:10});
 assert.equal(core.writingParts(plan.days[0].items[0]),null,'historical task must not be rewritten');
 assert.equal(core.writingParts(plan.days.find(d=>d.date==='2026-10-18').items.find(t=>t.title.includes('功能句'))),null,'short recall task stays undivided');
 const h=harness();await h.settle();
 const todayCard=h.context.BanyaStudyUI.task({item:todayOutline,day:'2026-10-17'});
 assert(todayCard.includes('写10分钟 · 批改复盘5分钟'));
 await h.click('detail',{id:todayOutline.id,day:'2026-10-17'});
 assert(h.el('modal').innerHTML.includes('总时间（分钟）'));
 assert(h.el('modal').innerHTML.includes('批改复盘（分钟）'));
 const card=h.context.BanyaStudyUI.task({item:task,day});
 assert(card.includes('写20分钟 · 批改复盘5分钟'));
 await h.click('detail',{id,day});
 assert(h.el('modal').innerHTML.includes('总时间（分钟）'));
 assert(h.el('modal').innerHTML.includes('动笔写（分钟）'));
 assert(h.el('modal').innerHTML.includes('批改复盘（分钟）'));
 h.input('task-minutes',25);h.input('task-write-minutes',20);h.input('task-review-minutes',5);
 h.input('task-minutes',35);await h.event('input',h.el('task-minutes'));
 assert.equal(h.el('task-review-minutes').value,'15');
 h.input('task-write-minutes',25);await h.event('input',h.el('task-write-minutes'));
 assert.equal(h.el('task-review-minutes').value,'10');
 h.input('task-review-minutes',8);await h.event('input',h.el('task-review-minutes'));
 assert.equal(h.el('task-minutes').value,'33');
 h.input('task-minutes',25);await h.event('input',h.el('task-minutes'));
 assert.equal(h.el('task-review-minutes').value,'');
 const before=JSON.stringify(h.api.state);
 await h.event('submit',{id:'task-form',dataset:{id,day}});
 assert.equal(JSON.stringify(h.api.state),before,'incomplete split cannot change records');
 for(const [field,value] of Object.entries({'task-title':task.title,'task-write-minutes':18,'task-review-minutes':7,'task-move':day,'task-wrong':'','task-note':'按原计划练习'}))h.input(field,value);
 await h.event('submit',{id:'task-form',dataset:{id,day}});
 const saved=h.api.state;
 assert.equal(saved.edits[id].minutes,25);
 assert.equal(saved.edits[id].writingMinutes,18);
 assert.equal(saved.edits[id].reviewMinutes,7);
 assert.equal(saved.notes[id],'按原计划练习');
 assert.equal(h.api.allTasks(day).find(t=>t.id===id).minutes,25);
 assert.deepEqual(core.writingParts(h.api.allTasks(day).find(t=>t.id===id)),{writing:18,review:7});
 assert.equal(core.normalizeState(saved).edits[id].reviewMinutes,7);
 assert.throws(()=>core.normalizeState({edits:{[id]:{minutes:25,writingMinutes:20,reviewMinutes:10}}}));
});
test('specific wrong questions and actual minutes survive English normalization and backup',async()=>{
 const id='2026-10-15-1',h=harness();await h.settle();
 for(const [field,value]of Object.entries({'task-title':'edited','task-minutes':30,'task-move':'2026-10-15','task-wrong':2,'task-question-ids':'3、8','task-actual-minutes':42,'task-note':'留意转折'}))h.input(field,value);
 await h.event('submit',{id:'task-form',dataset:{id,day:'2026-10-15'}});
 assert.equal(h.api.state.questionIds[id],'3、8');assert.equal(h.api.state.actualMinutes[id],42);
 assert.match(h.api.summaryText(),/错题题号/);assert(!h.api.summaryText().includes('37\/40'));
 h.api.exportState();const backup=JSON.parse(await h.blobs[0].text());assert.equal(core.normalizeState(backup.state).actualMinutes[id],42);
 assert.throws(()=>core.normalizeState({actualMinutes:{[id]:601}}));
});
test('migration preserves completed, removed, historical, noted and rescheduled tasks without duplication',()=>{
 const s=core.defaults(),id=plan.days[0].items[0].id;s.done[id]=true;s.notes[id]='笔记';s.wrong[id]=2;s.moved[id]='2026-10-18';
 const fresh=clone(plan);fresh.days[0].items[0].title='changed';fresh.days[1].items=[];
 const n=core.migrate(plan,fresh,s,'2026-10-17');assert.equal(n.notes[id],'笔记');assert.equal(n.wrong[id],2);
 assert.equal(core.tasks(fresh,n,'2026-10-18').filter(t=>t.id===id).length,1);assert.equal(core.tasks(fresh,n,'2026-10-18').find(t=>t.id===id).title,'changed');
 assert(core.tasks(fresh,n,'2026-10-16').some(t=>t.id===plan.days[1].items[0].id));
});
test('first open, check/uncheck, reopen and refresh preserve local records',async()=>{
 const h=harness();await h.settle();await h.click('toggle',{id:'2026-10-15-1',day:'2026-10-15'});assert.equal(h.api.state.done['2026-10-15-1'],true);
 const reopened=harness({storage:h.storage});assert.equal(reopened.api.state.done['2026-10-15-1'],true);await reopened.click('toggle',{id:'2026-10-15-1',day:'2026-10-15'});assert.equal(reopened.api.state.done['2026-10-15-1'],false);
});
test('wrong answers and notes save, clear, and remain separate across tasks',async()=>{
 const h=harness();await h.settle();for(const [id,w,note,day,minutes]of [['2026-10-15-1',2,'甲','2026-10-15',30],['2026-10-16-1',3,'乙','2026-10-17',15]]){
  for(const [field,value]of Object.entries({'task-title':'edited','task-minutes':minutes,'task-move':day,'task-wrong':w,'task-note':note}))h.input(field,value);
  if(id==='2026-10-16-1'){h.input('task-write-minutes',10);h.input('task-review-minutes',5);}
  await h.event('submit',{id:'task-form',dataset:{id,day}});
 }assert.equal(h.api.state.wrong['2026-10-15-1'],2);assert.equal(h.api.state.notes['2026-10-16-1'],'乙');
 h.input('task-wrong','');await h.event('submit',{id:'task-form',dataset:{id:'2026-10-16-1',day:'2026-10-17'}});assert.equal(h.api.state.wrong['2026-10-16-1'],undefined);assert.equal(h.api.state.wrong['2026-10-15-1'],2);
});
test('edit task, move with reduced duration, reject over-budget add/move and keep one stable ID',async()=>{
 const h=harness();await h.settle();for(const [id,v]of Object.entries({'task-title':'我的写作','task-minutes':5,'task-move':'2026-10-16','task-wrong':'','task-note':'note'}))h.input(id,v);
 await h.event('submit',{id:'task-form',dataset:{id:'2026-10-15-1',day:'2026-10-15'}});
 assert(!h.api.allTasks('2026-10-15').some(t=>t.id==='2026-10-15-1'));assert.equal(h.api.allTasks('2026-10-16').find(t=>t.id==='2026-10-15-1').title,'我的写作');
 const before=h.api.state.added.length;for(const [id,v]of Object.entries({'add-title':'too much','add-date':'2026-10-16','add-type':'写作','add-minutes':90}))h.input(id,v);
 await h.event('submit',{id:'add-form'});assert.equal(h.api.state.added.length,before);
 h.input('add-date','2026-10-15');h.input('add-minutes',5);await h.event('submit',{id:'add-form'});assert.equal(h.api.state.added.length,before+1);
});
test('rest day does not spill into tomorrow; check moved task clears target rest marker',async()=>{
 const h=harness();await h.settle();const count=h.api.allTasks('2026-10-16').length;await h.click('toggle-skip',{date:'2026-10-15'});assert.equal(h.api.state.skipped['2026-10-15'],true);assert.equal(h.api.allTasks('2026-10-16').length,count);
 await h.click('toggle-skip',{date:'2026-10-15'});assert.equal(h.api.state.skipped['2026-10-15'],undefined);
});
test('across days, midnight follows today only when viewing today; cancelled tasks survive',async()=>{
 const h=harness();await h.settle();h.setNow('2026-10-16T04:00:00Z');h.api.refreshToday();assert.equal(h.api.today,'2026-10-16');assert.equal(h.api.selected,'2026-10-16');
 await h.click('day',{date:'2026-10-18'});h.setNow('2026-10-17T04:00:00Z');h.api.refreshToday();assert.equal(h.api.selected,'2026-10-18');
});
test('new plan needs explicit approval, persists after restart, keeps records and rejects stale/same-version conflicts',async()=>{
 const h=harness();await h.settle();assert(h.api.pending);assert.equal(h.api.data.meta.planVersion,'previous');await h.click('toggle',{id:'2026-10-15-1',day:'2026-10-15'});h.api.applyUpdate();assert.equal(h.api.data.meta.planVersion,plan.meta.planVersion);assert.equal(h.api.state.done['2026-10-15-1'],true);
 const again=harness({storage:h.storage,fail:true});await again.settle();assert.equal(again.api.data.meta.planVersion,plan.meta.planVersion);
 h.setFresh(oldPlan);await h.api.checkUpdates();assert.equal(h.api.data.meta.planVersion,plan.meta.planVersion);assert.equal(h.api.pending,null);
 const conflict=clone(plan);conflict.days[0].items[0].title='unversioned';h.setFresh(conflict);await h.api.checkUpdates();assert.equal(h.api.pending,null);
});
test('offline/failure/reconnect keep plan and notes; plan fetch bypasses login/cache redirects',async()=>{
 const h=harness({fail:true,online:false});await h.settle();assert.equal(h.api.data.meta.planVersion,'previous');await h.click('toggle',{id:'2026-10-15-1',day:'2026-10-15'});h.setFail(false);await h.api.checkUpdates();assert(h.api.pending);assert.equal(h.api.state.done['2026-10-15-1'],true);
 let seen;h.context.fetch=async(_,opts)=>{seen=opts;return {ok:true,redirected:true,headers:new Headers({'content-type':'text/html'})}};await h.api.checkUpdates();assert.equal(seen.redirect,'error');assert.equal(h.api.data.meta.planVersion,'previous');
});
test('export/restore round trip includes plan, notes and wrong counts, and preserves a recovery copy',async()=>{
 const h=harness();await h.settle();await h.click('toggle',{id:'2026-10-15-1',day:'2026-10-15'});h.api.exportState();const backup=JSON.parse(await h.blobs[0].text());assert.equal(backup.version,2);assert(backup.plan);
 const fresh=harness();await fresh.settle();await fresh.event('change',{id:'file-import',files:[{size:100,text:async()=>JSON.stringify(backup)}]});assert.equal(fresh.api.state.done['2026-10-15-1'],true);assert(fresh.storage.has(key+'_before_restore'));
 fresh.api.exportState(true);const previous=JSON.parse(await fresh.blobs[0].text());assert.equal(previous.state.done['2026-10-15-1'],undefined);
 const invalid=clone(backup);invalid.state.added=[{id:'bad'}];const before=fresh.storage.get(key);await fresh.event('change',{id:'file-import',files:[{size:100,text:async()=>JSON.stringify(invalid)}]});assert.equal(fresh.storage.get(key),before);
});
test('corrupt local data is not overwritten and is included verbatim in recovery export',async()=>{
 const storage=new Map([[key,'broken-json']]);const h=harness({storage});await h.settle();await h.click('toggle',{id:'2026-10-15-1',day:'2026-10-15'});assert.equal(storage.get(key),'broken-json');h.api.exportState();assert.equal(JSON.parse(await h.blobs[0].text()).unreadableRaw,'broken-json');
});
test('quota failure rolls back mutations, and another window updates state',async()=>{
 const h=harness();await h.settle();h.quota();await h.click('toggle',{id:'2026-10-15-1',day:'2026-10-15'});assert.equal(h.api.state.done['2026-10-15-1'],undefined);
 const n=core.defaults();n.done['2026-10-16-1']=true;h.storage.set(key,JSON.stringify(n));for(const f of h.winHandlers.storage)f({key});assert.equal(h.api.state.done['2026-10-16-1'],true);
});

test('removed future unfinished task is retained outside active schedule, not stacked with replacement',()=>{
 const fresh=clone(plan),s=core.defaults(),removed=fresh.days[1].items.shift();fresh.days[1].items.push({...removed,id:'replacement-id',title:'replacement'});
 const n=core.migrate(plan,fresh,s,'2026-10-15');assert.equal(n.archive[removed.id].retired,true);assert(!core.tasks(fresh,n,'2026-10-16').some(t=>t.id===removed.id));assert(core.tasks(fresh,n,'2026-10-16').some(t=>t.id==='replacement-id'));
});
test('plan update blocks a future over-budget personalized schedule and leaves current plan intact',async()=>{
 const s=core.defaults();s.added.push({id:'custom-heavy',title:'already scheduled',minutes:90,type:'写作',date:'2026-10-16',custom:true});const h=harness({storage:new Map([[key,JSON.stringify(s)]])});await h.settle();h.api.applyUpdate();assert.equal(h.api.data.meta.planVersion,'previous');assert(h.api.pending);
});
test('moving a task then checking it clears rest only on the destination day',async()=>{
 const s=core.defaults();s.moved['2026-10-15-1']='2026-10-16';s.skipped['2026-10-16']=true;s.skipped['2026-10-15']=true;const h=harness({storage:new Map([[key,JSON.stringify(s)]])});await h.settle();await h.click('toggle',{id:'2026-10-15-1',day:'2026-10-16'});assert.equal(h.api.state.skipped['2026-10-16'],undefined);assert.equal(h.api.state.skipped['2026-10-15'],true);
});
test('settings changes do not rewrite the duration of previously completed vocabulary tasks',async()=>{
 const h=harness();await h.settle();await h.click('toggle',{id:'2026-10-15-vocab',day:'2026-10-15'});await h.event('change',{id:'vocab-minutes',value:'40'});assert.equal(h.api.allTasks('2026-10-15')[0].minutes,35);assert.equal(h.api.allTasks('2026-10-16')[0].minutes,40);
});

// 2026-10-15 用户指定：单词不列今日打卡，专项65分钟包含作文及2014新题型。
test('Oct 15 visible plan contains 65 minutes writing and new type, and hides separate vocabulary tasks',async()=>{
 const day=plan.days.find(d=>d.date==='2026-10-15');
 assert.equal(day.items.reduce((n,t)=>n+t.minutes,0),65);
 assert(day.items.some(t=>t.title.includes('小作文')));
 assert(day.items.some(t=>t.title.includes('2014年新题型')));
 const h=harness({fail:true});await h.settle();
 const v=h.api.dateProgress('2026-10-15');
 assert.equal(v.total,3);assert.equal(v.minutes,65);
 assert(!h.el('app').innerHTML.includes('class="task-title">背单词'));
 assert(h.el('app').innerHTML.includes('2014年新题型'));
 for(const item of day.items)await h.click('toggle',{id:item.id,day:day.date});
 assert.equal(h.api.dateProgress('2026-10-15').done,3);
 assert(h.el('app').innerHTML.includes('当天计划已打卡完成'));
 const restarted=harness({storage:h.storage,fail:true});await restarted.settle();
 assert.equal(restarted.api.dateProgress('2026-10-15').done,3);
 const summary=h.api.summaryText();assert(summary.includes('2014年新题型'));
 assert(!summary.includes('背单词 35 分钟[未完成]'));
});

test('M2.4 student interface gives focused guidance, accessible nav, and truthful progress language',async()=>{
 const h=harness({fail:true});await h.settle();
 const home=h.el('app').innerHTML;
 assert(home.includes('今日任务'));
 assert(home.includes('student-task-list'));
 assert(!home.includes('premium-hero'));
 assert(!home.includes('focus-panel'));
 assert(!home.includes('本机规则建议'));
 assert(home.includes('预计'));
 assert(!home.includes('class="task-title">背单词'));
 await h.click('detail',{id:'2026-10-15-1',day:'2026-10-15'});
 const sheet=h.el('modal').innerHTML;
 assert(sheet.includes('这项练习怎么做'));
 assert(sheet.includes('一句话复盘'));
 assert(sheet.includes('advanced-adjust'));
 assert(sheet.includes('保存并打卡完成'));
 h.api.nav('calendar');assert(h.el('app').innerHTML.includes('选择日期查看安排'));
 h.api.nav('stats');assert(h.el('app').innerHTML.includes('近7日已打卡'));assert(h.el('app').innerHTML.includes('只统计已打卡'));
 h.api.nav('settings');assert(h.el('app').innerHTML.includes('备份与恢复'));
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 assert.equal((html.match(/class="nav-icon" viewBox/g)||[]).length,4);
 assert(css.includes('prefers-reduced-motion:reduce'));
 assert(css.includes('.modal:not(.hidden) .modal-card'));
});
test('M2.4 recording can save and complete together, persists across reloads, and enforces question bounds',async()=>{
 const h=harness({fail:true});await h.settle();
 const task=h.api.allTasks('2026-10-15').find(t=>t.type==='新题型');
 assert(task);
 for(const [id,value] of Object.entries({'task-title':task.title,'task-minutes':task.minutes,'task-move':'2026-10-15','task-wrong':'6','task-note':'初稿'}))h.input(id,value);
 await h.event('submit',{id:'task-form',dataset:{id:task.id,day:'2026-10-15'}},{submitter:{dataset:{complete:'true'}}});
 assert.equal(h.api.state.done[task.id],undefined);
 assert.equal(h.api.state.wrong[task.id],undefined);
 h.input('task-wrong','2');h.input('task-note','定位词看到了，但没核对段落主旨');
 await h.event('submit',{id:'task-form',dataset:{id:task.id,day:'2026-10-15'}},{submitter:{dataset:{complete:'true'}}});
 assert.equal(h.api.state.done[task.id],true);
 assert.equal(h.api.state.wrong[task.id],2);
 assert.equal(h.api.state.notes[task.id],'定位词看到了，但没核对段落主旨');
 const again=harness({storage:h.storage,fail:true});await again.settle();
 assert.equal(again.api.state.done[task.id],true);
 assert.equal(again.api.state.wrong[task.id],2);
 assert(again.el('app').innerHTML.includes('已完成 1/3'));
});

test('M2.7 English analytics survive switching to the independent political route',async()=>{
 const h=harness({fail:true});await h.settle();
 assert(h.el('app').innerHTML.includes('student-task-list'));
 assert(!h.el('app').innerHTML.includes('premium-hero'));
 assert(h.el('app').innerHTML.includes('已完成'));
 assert(h.el('app').innerHTML.includes('今日任务'));
 assert(h.el('app').innerHTML.includes('政治'));
 await h.click('switch-subject',{subject:'politics'});
 const political=h.el('app').innerHTML;
 assert(political.includes('政治学习计划'));
 assert(political.includes('politics-fixture'));
 assert(!political.includes('2014年新题型'));
 h.api.nav('calendar');assert(h.el('app').innerHTML.includes('政治学习计划'));
 await h.click('switch-subject',{subject:'english'});
 assert(h.el('app').innerHTML.includes('cal-grid'),'switching subjects preserves the selected page');
 const active=h.api.state.done['2026-10-15-1'];
 assert.equal(active,undefined);
});
test('M2.5 appearance controls never overwrite learning records',async()=>{
 const h=harness({fail:true});await h.settle();
 await h.click('toggle',{id:'2026-10-15-1',day:'2026-10-15'});
 h.api.nav('settings');
 assert(h.el('app').innerHTML.includes('外观'));
 await h.click('theme',{theme:'dark'});
 assert.equal(h.storage.get('yantu_theme_v1'),'dark');
 assert.equal(h.api.state.done['2026-10-15-1'],true);
 const second=harness({storage:h.storage,fail:true});await second.settle();
 assert.equal(second.api.state.done['2026-10-15-1'],true);
 assert(second.el('app').innerHTML.includes('student-task-list'));
});

test('M2.8 one app subject switch is persistent and cannot modify the other subject record',async()=>{
 const h=harness({fail:true});await h.settle();
 assert(h.el('app').innerHTML.includes('英语二'));
 await h.click('toggle',{id:'2026-10-15-1',day:'2026-10-15'});
 assert.equal(h.api.state.done['2026-10-15-1'],true);
 const before=h.storage.get(key);
 await h.click('switch-subject',{subject:'politics'});
 assert.equal(h.storage.get('banya_active_subject_v1'),'politics');
 assert(h.el('app').innerHTML.includes('politics-fixture'));
 assert.equal(h.storage.get(key),before);
 const reopened=harness({storage:h.storage,fail:true});await reopened.settle();
 assert(reopened.el('app').innerHTML.includes('politics-fixture'));
 assert.equal(reopened.api.state.done['2026-10-15-1'],true);
 reopened.api.nav('settings');
 assert(reopened.el('app').innerHTML.includes('politics-fixture'));
 await reopened.click('switch-subject',{subject:'english'});
 assert.equal(reopened.storage.get('banya_active_subject_v1'),'english');
 assert.equal(reopened.api.state.done['2026-10-15-1'],true);
});

test('M3 mobile calendar opens an in-app day page, changes date, and restores calendar on Back',async()=>{
 const h=harness();await h.settle();
 h.context.location.pathname='/index.html';h.context.location.search='';
 const history={state:null,pushState(next){this.state=next},replaceState(next){this.state=next},back(){this.state=null;for(const fn of h.winHandlers.popstate||[])fn()}};
 h.context.history=history;
 h.api.nav('calendar');
 assert(h.el('app').innerHTML.includes('cal-grid'));
 await h.click('cal-day',{date:'2026-10-17'});
 assert(history.state?.banyaDay);
 assert(h.el('app').innerHTML.includes('返回日历'));
 assert(h.el('app').innerHTML.includes('10月17日'));
 await h.click('day',{date:'2026-10-18'});
 assert.equal(h.api.selected,'2026-10-18');
 assert(h.el('app').innerHTML.includes('10月18日'));
 await h.click('close-day');
 assert.equal(history.state,null);
 assert(h.el('app').innerHTML.includes('cal-grid'));
 assert(!h.el('app').innerHTML.includes('day-detail-head'));
});


test('M4: saving a note cannot freeze old task title or estimated minutes across plan revisions',async()=>{
 const h=harness();await h.settle();h.api.applyUpdate();
 const day='2026-10-16',task=plan.days.find(d=>d.date===day).items[0];
 for(const [id,value] of Object.entries({'task-title':task.title,'task-minutes':task.minutes,'task-move':day,'task-wrong':'','task-note':'保留真实学习记录'}))h.input(id,value);
 h.input('task-write-minutes',15);h.input('task-review-minutes',5);
 await h.event('submit',{id:'task-form',dataset:{id:task.id,day}});
 assert.equal(h.api.state.edits[task.id],undefined,'no accidental local task override from merely recording');
 assert.equal(h.api.state.notes[task.id],'保留真实学习记录');
 const revised=clone(plan),changed=revised.days.find(d=>d.date===day).items[0];
 changed.title='用户指定的新写作项目';changed.minutes=21;
 const updated=core.migrate(plan,revised,h.api.state,day);
 const shown=core.tasks(revised,updated,day).find(t=>t.id===task.id);
 assert.equal(shown.title,changed.title);assert.equal(shown.minutes,21);
 assert.equal(updated.notes[task.id],'保留真实学习记录');
 const personalized=core.normalizeState({edits:{[task.id]:{minutes:18}}});
 const custom=core.tasks(revised,personalized,day).find(t=>t.id===task.id);
 assert.equal(custom.title,changed.title,'an intentional minutes-only edit does not freeze the title');
 assert.equal(custom.minutes,18);
});
