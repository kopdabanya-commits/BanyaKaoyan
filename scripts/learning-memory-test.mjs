import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../study-assistant.js',import.meta.url),'utf8');
function harness(){
 const elements={},handlers={},calls=[];let id=0,fail=null;
 const sample={key:'synthetic-rule',category:'preference',value:{text:'Synthetic <script> text',minutes:25},source:{kind:'private_import',reference:'Synthetic source'},certainty:'estimate',temporal:'historical',observedOn:'2026-09-01',validUntil:null,active:true,confirmedAt:'2026-09-02T00:00:00Z',entryRevision:1};
 let profile={schemaVersion:1,subject:'english',revision:1,entries:[sample],updatedAt:'synthetic'};
 const el=id=>elements[id]??={id,value:'',checked:false,disabled:false,hidden:false,innerHTML:'',textContent:'',classList:{add(){},remove(){}}};
 const root={alert(){},BanyaCloudSync:{isConnected:()=>true,assistantRequest:async(path,method='GET',body)=>{calls.push({path,method,body});if(method==='POST'){if(fail)throw Object.assign(Error('Synthetic failure'),{code:fail});profile={...profile,revision:profile.revision+1,entries:body.entries.map(e=>({...e,confirmedAt:'synthetic',entryRevision:2}))};return {status:'profile_saved'};}if(path.endsWith('/history'))return {versions:[{revision:0,updatedAt:'synthetic',document:{entries:[sample]}}]};return structuredClone(profile);}}};
 vm.runInNewContext(code,{window:root,document:{getElementById:el,body:{classList:{add(){},remove(){}}},addEventListener:(type,fn)=>(handlers[type]??=[]).push(fn)},navigator:{onLine:true},crypto:{randomUUID:()=>`synthetic-${++id}`},sessionStorage:{getItem:()=>null},console,Date});
 const fire=async(type,target,extra={})=>{for(const fn of handlers[type]||[])await fn({target,preventDefault(){},...extra});for(let i=0;i<4;i++)await new Promise(setImmediate);};
 const click=(action,key)=>fire('click',{closest:selector=>selector==='[data-memory-action]'?{dataset:{memoryAction:action,memoryKey:key,memorySubject:'english'}}:null});
 const form=()=>fire('submit',{id:'memory-editor'});
 return {root,el,calls,click,form,timeForm:()=>fire('submit',{id:'memory-time-form'}),input:id=>fire('input',{id}),setFail:value=>fail=value,escape:()=>fire('keydown',{}, {key:'Escape'})};
}

test('memory is accessible without paid readiness and all external text is escaped',async()=>{
 const h=harness();assert(h.root.BanyaStudyAssistant.panel().includes('学习时间与偏好'));await h.click('open');
 assert.deepEqual(h.calls.map(c=>c.path),['profiles/english']);assert(!h.calls.some(c=>c.path==='chat'));
 assert(h.el('memory-list').innerHTML.includes('&lt;script&gt;'));assert(h.el('memory-list').innerHTML.includes('历史基础，不是打卡'));assert(h.el('memory-list').innerHTML.includes('Synthetic source'));
});
test('editing a profile preserves structured values and uses versioned owner confirmation',async()=>{
 const h=harness();await h.click('open');await h.click('edit','synthetic-rule');h.el('memory-text').value='Synthetic updated text';await h.form();
 const write=h.calls.find(c=>c.method==='POST');assert.equal(write.path,'profiles/english');assert.equal(write.body.expectedRevision,1);assert.equal(write.body.confirmation,'save_profile');
 assert.equal(write.body.entries[0].value.minutes,25);assert.equal(write.body.entries[0].source.kind,'user_confirmation');assert(!('confirmedAt' in write.body.entries[0]));
 assert(h.el('memory-state').textContent.includes('学习记录和计划未改动'));
});
test('disable retains the rule and previous source is never silently deleted',async()=>{
 const h=harness();await h.click('open');await h.click('toggle','synthetic-rule');
 const item=h.calls.find(c=>c.method==='POST').body.entries[0];assert.equal(item.active,false);assert.equal(item.key,'synthetic-rule');assert.equal(item.value.minutes,25);
});
test('history is rendered without edit or toggle buttons',async()=>{
 const h=harness();await h.click('open');await h.click('history');
 const html=h.el('memory-history-list').innerHTML;assert(html.includes('版本 0'));assert(!html.includes('data-memory-action="edit"'));assert(!html.includes('data-memory-action="toggle"'));
});
test('conflict never retries or overwrites and ambiguous saves reuse one request ID',async()=>{
 const h=harness();await h.click('open');await h.click('toggle','synthetic-rule');
 await h.click('edit','synthetic-rule');h.el('memory-text').value='Synthetic pending';h.setFail('synthetic-network');await h.form();
 const first=h.calls.filter(c=>c.method==='POST').at(-1);await h.click('retry');const retry=h.calls.filter(c=>c.method==='POST').at(-1);assert.equal(first.body.requestId,retry.body.requestId);
 h.setFail('profile_revision_conflict');await h.click('retry');assert(h.el('memory-retry').hidden);assert(h.el('memory-state').textContent.includes('没有覆盖'));
});
test('historical facts need dates and nonconfirmed hard rules cannot be submitted',async()=>{
 const h=harness();await h.click('open');await h.click('new');h.el('memory-text').value='Synthetic history';h.el('memory-temporal').value='historical';await h.form();
 assert.equal(h.calls.filter(c=>c.method==='POST').length,0);
 h.el('memory-observed').value='2026-09-01';h.el('memory-category').value='constraint';h.el('memory-certainty').value='estimate';await h.form();assert.equal(h.calls.filter(c=>c.method==='POST').length,0);
});
test('closing/reopening memory never requests a model or stores profile data in the browser',async()=>{
 const h=harness();await h.click('open');await h.escape();await h.click('open');assert.equal(h.calls.length,2);assert(h.calls.every(c=>c.path==='profiles/english'));
});

test('daily time is one explicit versioned profile save without plan writes or model calls',async()=>{
 const h=harness();await h.click('open');h.el('memory-daily').value='47';await h.timeForm();
 const write=h.calls.find(c=>c.method==='POST');assert.equal(write.path,'profiles/english');assert.equal(write.body.entries.length,1);
 const e=write.body.entries[0];assert.equal(e.category,'budget');assert.equal(e.value.minutes,47);assert.equal(e.value.scope,'non_vocabulary');assert.equal(e.certainty,'confirmed');assert.equal(e.temporal,'current');assert.equal(write.body.expectedRevision,1);
 assert(!h.el('memory-next').hidden);assert(h.calls.every(c=>c.path.startsWith('profiles/')));
});

test('empty or fractional daily time cannot create a profile or enable automatic management',async()=>{
 const h=harness();await h.click('open');for(const value of ['', '3.5', '-2']){h.el('memory-daily').value=value;await h.timeForm();}
 assert.equal(h.calls.filter(c=>c.method==='POST').length,0);assert(h.el('memory-state').textContent.includes('分钟'));
});

test('quick time selector ignores historical estimates, expired rules and the other subject',()=>{
 const h=harness(),rule=(key,n,revision,extra={})=>({key,category:'budget',value:{minutes:n,scope:'non_vocabulary'},entryRevision:revision,active:true,temporal:'current',certainty:'confirmed',...extra});
 const doc={subject:'english',entries:[rule('old',12,1),rule('recent',48,2),rule('history',123,4,{temporal:'historical'}),rule('estimate',200,7,{certainty:'estimate'}),rule('expired',100,9,{validUntil:'2020-01-01'})]};
 assert.equal(h.root.BanyaStudySetup.policy(doc,'english').minutes,48);assert.equal(h.root.BanyaStudySetup.policy(doc,'politics').minutes,null);
 const entries=h.root.BanyaStudySetup.timeEntries(doc,'english',49,null);assert.equal(entries[0].key,'recent');assert.equal(entries[0].value.minutes,49);assert(!('entryRevision' in entries[0]));assert.equal(doc.entries[1].value.minutes,48);
});

test('politics course limit is structured and checked against total time, never converted into a checkin',()=>{
 const h=harness();const entries=h.root.BanyaStudySetup.timeEntries({subject:'politics',entries:[]},'politics',73,24);
 assert.equal(entries[0].value.scope,'total');assert.equal(entries[1].category,'constraint');assert.equal(entries[1].value.rule,'course_limit');assert.equal(entries[1].value.minutes,24);
 assert.throws(()=>h.root.BanyaStudySetup.timeEntries({},'politics',20,21));
});


test('unsaved daily time cannot be mistaken for the saved planning policy',async()=>{
 const h=harness();await h.click('open');h.el('memory-daily').value='44';await h.input('memory-daily');assert(h.el('memory-next').disabled);assert(h.el('memory-state').textContent.includes('先点'));assert.equal(h.calls.filter(c=>c.method==='POST').length,0);
});
