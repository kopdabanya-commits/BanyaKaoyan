import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../study-assistant.js',import.meta.url),'utf8');
function harness({ready=true,session=new Map(),failChat=false,previewOnly=false}={}){
 const handlers={},elements={},calls=[],prepares=[],network={onLine:true};let revision=1,count=0,syncs=0;
 const el=id=>elements[id]??={id,value:'',checked:false,disabled:false,hidden:false,innerHTML:'',textContent:'',classList:{add(){},remove(){}}};
 const proposal={...(previewOnly?{previewOnly:true,analysis:{findings:[{text:'Synthetic finding'}],recommendations:['Synthetic advice'],uncertainties:['Synthetic unknown'],reasons:[],evidence:[]}}:{}),status:'prepared',requestId:'synthetic-request',baseRevision:1,reply:'Model claims 已同步 <script>alert(1)</script>',changes:[{before:{title:'Synthetic original',date:'2026-10-20',minutes:20,detail:''},after:{title:'Synthetic <img> plan',date:'2026-10-21',minutes:25,detail:'Synthetic change'}}]};
 const cloud={isConnected:()=>true,prepareAssistant:async subject=>{prepares.push(subject);return {revision};},syncAll:async()=>{syncs++;return true;},assistantRequest:async(path,method='GET',body)=>{
  calls.push({path,method,body});
  if(path==='status')return {ready,monthlyCalls:0,monthlyCallLimit:100,monthlyBudgetUsd:1};
  if(path==='chat'){if(failChat)throw Error('Synthetic network failure');return {...proposal,requestId:body.requestId,baseRevision:revision};}
  if(path.startsWith('requests/'))return {...proposal,requestId:path.slice(9)};
  if(path.endsWith('/commit'))return {status:'applied',requestId:path.split('/')[1],revision:2};
 }};
 const root={homeSubject:'english',BanyaCloudSync:cloud,STUDY_PLAN:{meta:{start:'2026-10-15',end:'2026-12-18'}},POLITICS_PLAN:{meta:{start:'2026-10-16',end:'2026-12-18'}},alert(){}};
 vm.runInNewContext(source,{window:root,navigator:network,crypto:{randomUUID:()=>`synthetic-uuid-${++count}`},sessionStorage:{getItem:k=>session.get(k)??null,setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)},document:{querySelector:()=>({dataset:{aiHomeSubject:root.homeSubject}}),querySelectorAll:()=>[],getElementById:el,body:{classList:{add(){},remove(){}}},addEventListener:(type,fn)=>(handlers[type]??=[]).push(fn)},Date,console});
 const settle=async()=>{for(let i=0;i<5;i++)await new Promise(setImmediate);};
 const event=async(type,target,extra={})=>{for(const fn of handlers[type]||[])await fn({target,preventDefault(){},...extra});await settle();};
 const click=(action,subject,extra={})=>event('click',{closest:()=>({dataset:{aiAction:action,aiSubject:subject,...extra}})});
 return {root,el,calls,prepares,session,network,cloud,settle,click,escape:()=>event('keydown',{}, {key:'Escape'}),backdrop:()=>event('click',{id:'modal',closest:()=>null}),change:id=>event('change',el(id)),send:()=>event('submit',{id:'ai-chat-form'}),setRevision:n=>revision=n,syncs:()=>syncs};
}

test('disabled assistant performs only a readiness read and never sends a paid request',async()=>{
 const h=harness({ready:false});await h.click('open');
 assert(h.el('ai-send').disabled);h.el('ai-prompt').value='Synthetic request';h.el('ai-consent').checked=true;await h.send();
 assert.deepEqual(h.calls.map(c=>c.path),['status']);assert.equal(h.prepares.length,0);
 assert(!h.root.BanyaStudyAssistant.panel().includes('type="password"'));
});
test('consent and connectivity gate model calls; advice and hostile text never execute changes',async()=>{
 const h=harness();await h.click('open');h.el('ai-prompt').value='Synthetic private discussion';
 await h.send();assert.equal(h.calls.filter(c=>c.path==='chat').length,0);
 h.el('ai-consent').checked=true;h.network.onLine=false;await h.send();assert.equal(h.prepares.length,0);
 h.network.onLine=true;await h.send();
 const sent=h.calls.find(c=>c.path==='chat');assert(sent.body.consent);assert.equal(sent.body.shareReview,false);
 assert.equal(h.calls.filter(c=>c.path.endsWith('/commit')).length,0);
 assert(h.el('ai-preview').innerHTML.includes('建议改动 · 尚未执行'));
 assert(h.el('ai-preview').innerHTML.includes('&lt;img&gt;'));assert(!h.el('ai-messages').innerHTML.includes('<script>'));
 assert(![...h.session.values()].some(v=>v.includes('Synthetic private discussion')));
});
test('review sharing is explicitly enabled and subject changes clear previous context',async()=>{
 const h=harness();await h.click('open');h.el('ai-review').checked=true;await h.change('ai-review');assert(h.el('ai-review').checked);
 h.el('ai-consent').checked=true;h.el('ai-prompt').value='Synthetic English discussion';await h.send();
 assert(h.calls.find(c=>c.path==='chat').body.shareReview);
 h.el('ai-subject').value='politics';await h.change('ai-subject');assert(!h.el('ai-review').checked);assert(!h.el('ai-consent').checked);
 h.el('ai-consent').checked=true;h.el('ai-prompt').value='Synthetic politics discussion';await h.send();
 const last=h.calls.filter(c=>c.path==='chat').at(-1);assert.equal(last.body.subject,'politics');assert(!JSON.stringify(last.body).includes('Synthetic English discussion'));
});
test('only explicit confirmation commits and it synchronizes phone records first',async()=>{
 const h=harness();await h.click('open');h.el('ai-consent').checked=true;h.el('ai-prompt').value='Synthetic change';await h.send();
 assert.equal(h.calls.filter(c=>c.path.endsWith('/commit')).length,0);await h.click('commit');
 const commit=h.calls.find(c=>c.path.endsWith('/commit'));assert.equal(commit.body.confirmation,'sync');assert.equal(commit.body.expectedRevision,1);
 assert.equal(h.prepares.length,2);assert.equal(h.syncs(),1);
});
test('new phone revision blocks stale proposal without another paid request or write',async()=>{
 const h=harness();await h.click('open');h.el('ai-consent').checked=true;h.el('ai-prompt').value='Synthetic change';await h.send();
 h.setRevision(2);await h.click('commit');assert.equal(h.calls.filter(c=>c.path.endsWith('/commit')).length,0);
 assert.equal(h.calls.filter(c=>c.path==='chat').length,1);assert(h.el('ai-state').textContent.includes('旧建议没有执行'));
});
test('ambiguous request is queried and survives reopening without automatic paid retry',async()=>{
 const h=harness({failChat:true});await h.click('open');h.el('ai-consent').checked=true;h.el('ai-prompt').value='Synthetic question';await h.send();
 assert(h.el('ai-send').disabled);assert(!h.el('ai-query').hidden);await h.send();assert.equal(h.calls.filter(c=>c.path==='chat').length,1);
 const next=harness({session:h.session});await next.click('open');assert(next.el('ai-send').disabled);await next.click('query');
 assert.equal(next.calls.filter(c=>c.path==='chat').length,0);assert(!next.el('ai-send').disabled);assert(next.el('ai-preview').innerHTML.includes('确认同步'));
});


test('backdrop and Escape close the shared sheet without preventing reopening',async()=>{
 const h=harness();await h.click('open');await h.backdrop();await h.click('open');assert(!h.el('ai-send').disabled);
 await h.escape();await h.click('open');assert(!h.el('ai-send').disabled);
 assert.equal(h.calls.filter(c=>c.path==='status').length,3);assert.equal(h.calls.filter(c=>c.path==='chat').length,0);
});
test('closing during phone preparation cancels the unsent paid request even when reopening another subject',async()=>{
 const h=harness();let finish;h.cloud.prepareAssistant=()=>new Promise(resolve=>finish=resolve);
 await h.click('open');h.el('ai-consent').checked=true;h.el('ai-prompt').value='Synthetic English change';await h.send();
 await h.backdrop();await h.click('open','politics');assert(h.el('ai-send').disabled);
 finish({revision:1});await h.settle();
 assert.equal(h.calls.filter(c=>c.path==='chat').length,0);assert.equal(h.el('ai-subject').value,'politics');assert(!h.el('ai-consent').checked);
});


test('M7.2 structured advice renders safely without offering or allowing commit',async()=>{
 const h=harness({previewOnly:true});await h.click('open');h.el('ai-mode').value='day';h.el('ai-target').value='2026-10-20';h.el('ai-available').value='25';h.el('ai-consent').checked=true;h.el('ai-prompt').value='Synthetic daily planning';await h.send();
 const sent=h.calls.find(c=>c.path==='chat');assert.equal(sent.body.planningMode,'day');assert.equal(sent.body.availableMinutes,25);
 assert(!h.el('ai-preview').innerHTML.includes('data-ai-action="commit"'));assert(h.el('ai-preview').innerHTML.includes('Synthetic finding'));assert.equal(h.session.size,0,'finished read-only preview must not block opening another subject');
 await h.click('commit');assert.equal(h.calls.filter(c=>c.path.endsWith('/commit')).length,0);
});


test('native CNY billing shows unlimited calls without a fake dollar total',()=>{
 const root={};vm.runInNewContext(source.split('\n')[1],{window:root});const text=root.BanyaAIBilling.format({currency:'CNY',monthlyBudget:50,estimatedReserved:0.1,monthlyCallLimit:null,monthlyCalls:1002});
 assert(text.includes('¥50'));assert(text.includes('不设月调用次数上限'));assert(!text.includes('$'));assert(!text.includes('/0'));
});


test('assistant drafts survive close within a page and stay isolated by subject without storing consent',async()=>{
 const h=harness();await h.click('open','english');h.el('ai-prompt').value='Synthetic English unsent';h.el('ai-consent').checked=true;h.el('ai-review').checked=true;h.el('ai-available').value='42';
 h.el('ai-subject').value='politics';await h.change('ai-subject');assert.equal(h.el('ai-prompt').value,'');assert.equal(h.el('ai-available').value,'');
 h.el('ai-prompt').value='Synthetic politics unsent';await h.click('close');await h.click('open','english');
 assert.equal(h.el('ai-prompt').value,'Synthetic English unsent');assert(!h.el('ai-consent').checked);assert(!h.el('ai-review').checked);
 await h.click('close');await h.click('open','politics');assert.equal(h.el('ai-prompt').value,'Synthetic politics unsent');
 assert.equal(h.calls.filter(c=>c.path==='chat').length,0);
});

test('successful submission removes the old unsent draft and hides redundant receipt lookup',async()=>{
 const h=harness();await h.click('open');h.el('ai-prompt').value='Synthetic discussion';h.el('ai-consent').checked=true;await h.send();
 assert(h.el('ai-query').hidden);await h.click('close');await h.click('open');assert.equal(h.el('ai-prompt').value,'');
 assert(!h.el('ai-consent').checked);assert.equal(h.calls.filter(c=>c.path==='chat').length,1);
});

test('mode shortcuts and prompt starters only prepare input; they never call the model',async()=>{
 const h=harness();await h.click('open');await h.click('mode',undefined,{aiMode:'day'});
 assert.equal(h.el('ai-mode').value,'day');assert.equal(h.el('ai-options').open,true);assert(h.el('ai-scope-label').textContent.includes('日计划'));
 await h.click('suggest',undefined,{aiText:'Synthetic prompt starter'});assert.equal(h.el('ai-prompt').value,'Synthetic prompt starter');
 assert(h.calls.every(c=>c.path==='status'));assert(!h.el('ai-consent').checked);
});

test('new conversation can be cancelled without dropping a displayed result',async()=>{
 const h=harness();await h.click('open');h.el('ai-prompt').value='Synthetic discussion';h.el('ai-consent').checked=true;await h.send();const before=h.el('ai-messages').innerHTML;
 h.root.confirm=()=>false;await h.click('reset');assert.equal(h.el('ai-messages').innerHTML,before);assert.equal(h.calls.filter(c=>c.path==='chat').length,1);
});

test('budget errors explain the next action and retain the unsent text without suggesting a paid retry',async()=>{
 const h=harness();const old=h.cloud.assistantRequest;h.cloud.assistantRequest=async(path,...args)=>{if(path==='chat'){const error=Error('planning_budget_unknown');error.code='planning_budget_unknown';throw error;}return old(path,...args);};
 await h.click('open');h.el('ai-prompt').value='Synthetic daily planning';h.el('ai-consent').checked=true;await h.send();
 assert(h.el('ai-state').textContent.includes('学习档案'));assert(!h.el('ai-state').textContent.includes('planning_budget_unknown'));
 assert.equal(h.el('ai-prompt').value,'Synthetic daily planning');assert(!h.el('ai-send').disabled);assert(h.el('ai-query').hidden);
});

test('assistant home reads free scoped endpoints and distinguishes zero evidence from completed study',async()=>{
 const h=harness();h.cloud.assistantRequest=async(path,method,body)=>{h.calls.push({path,method,body});return path==='analysis'?{windows:{7:{recordedTasks:0,completed:0}},issues:[]}:path==='auto/status'?{control:{enabled:false},grants:[],runs:[]}:path.startsWith('profiles/')?{entries:[]}:{ready:true};};
 await h.root.BanyaStudyAssistant.refreshHome('english');assert(h.el('ai-home-brief').innerHTML.includes('还没有足够'));
 assert.equal(h.calls.length,4);assert(h.calls.every(c=>c.path!=='chat'));await h.root.BanyaStudyAssistant.refreshHome('english');assert.equal(h.calls.length,4);
 await h.click('refresh-home','english');assert.equal(h.calls.length,8);
 h.network.onLine=false;await h.click('refresh-home','english');assert.equal(h.calls.length,8);assert(h.el('ai-home-status').textContent.includes('离线'));
});


test('a slower home response from the previous subject cannot replace the current subject evidence',async()=>{
 const h=harness();let resolveEnglish;h.cloud.assistantRequest=async(path,method,body)=>path==='analysis'?(body.subject==='english'?await new Promise(r=>resolveEnglish=r):{windows:{7:{recordedTasks:9,completed:3}},issues:[]}):path==='auto/status'?{control:{enabled:false},grants:[],runs:[]}:path.startsWith('profiles/')?{entries:[]}:{ready:true};
 const first=h.root.BanyaStudyAssistant.refreshHome('english');await h.settle();h.root.homeSubject='politics';await h.root.BanyaStudyAssistant.refreshHome('politics');
 resolveEnglish({windows:{7:{recordedTasks:101,completed:100}},issues:[]});await first;
 assert(h.el('ai-home-brief').innerHTML.includes('<b>9</b>'));assert(!h.el('ai-home-brief').innerHTML.includes('101'));
});
