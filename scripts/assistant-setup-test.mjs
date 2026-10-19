import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../study-assistant.js',import.meta.url),'utf8');
function setup({known=true,profileFailure=false,enabled=false}={}){
 const handlers={},elements={},calls=[],prepares=[];let id=0,hold=null;
 const el=id=>elements[id]??={id,value:'',checked:false,disabled:false,hidden:false,innerHTML:'',textContent:'',dataset:{},querySelectorAll:()=>[],insertAdjacentHTML(_,html){this.innerHTML+=html;},classList:{add(){},remove(){}}};
 const budget={key:'synthetic-budget',category:'budget',active:true,temporal:'current',certainty:'confirmed',entryRevision:1,value:{minutes:53}};
 const profile={subject:'english',entries:known?[budget]:[]};
 const config={start:'2026-10-20',end:'2026-10-26',fields:['date','minutes'],types:['阅读'],monthlyBudgetCents:200,dailyCalls:1,weeklyCalls:3,monthlyCalls:10,cooldownHours:12,maxChanges:1,allowAdd:false,periodic:false,shareReview:false,dataConsent:true};
 const status={serverReady:true,currency:'CNY',control:{revision:0,enabled},grants:enabled?[{subject:'english',revision:1,enabled:true,config}]:[],runs:[]};
 const cloud={isConnected:()=>true,prepareAssistant:async s=>{prepares.push(s);if(hold)await hold;return {revision:1};},assistantRequest:async(path,method='GET',body)=>{
  calls.push({path,method,body});if(path==='status')return {ready:true,currency:'CNY',monthlyBudget:19};if(path.startsWith('profiles/')){if(profileFailure)throw Error('Synthetic profile fetch failure');return structuredClone(profile);}
  if(path==='auto/status')return structuredClone(status);
  if(path==='auto/control'){status.control={revision:1,enabled:body.enabled};return status.control;}
  if(path.startsWith('auto/grants/')){status.grants=[{subject:'english',revision:2,enabled:body.enabled,config:body}];return {revision:2};}
  throw Error('Unexpected route '+path);
 }};
 const root={BanyaCloudSync:cloud,alert(){}};
 vm.runInNewContext(code,{window:root,document:{getElementById:el,body:{classList:{add(){},remove(){}}},addEventListener:(t,fn)=>(handlers[t]??=[]).push(fn)},navigator:{onLine:true},sessionStorage:{getItem:()=>null},crypto:{randomUUID:()=>`synthetic-${++id}`},Date,console});
 const settle=async()=>{for(let i=0;i<8;i++)await new Promise(setImmediate);};
 const fire=async(t,target)=>{for(const fn of handlers[t]||[])await fn({target,preventDefault(){}});await settle();};
 const click=action=>fire('click',{closest:s=>s==='[data-auto-action]'?{dataset:{autoAction:action,subject:'english'}}:null});
 const fill=()=>{for(const [id,value] of Object.entries({start:'2026-10-20',end:'2026-10-26',max:1,daily:1,weekly:3,monthly:10,cooldown:12,budget:2}))el('auto-'+id).value=String(value);el('auto-type-0').checked=true;el('auto-field-date').checked=true;el('auto-field-minutes').checked=true;el('auto-consent').checked=true;};
 return {el,calls,prepares,cloud,status,click,fill,settle,submit:()=>fire('submit',{id:'auto-form'}),hold:()=>new Promise(r=>{hold=new Promise(resolve=>r(resolve));})};
}

test('opening automatic setup is read-only, displays shared CNY budget and blocks missing study time',async()=>{
 const h=setup({known:false});await h.click('open');assert(h.el('auto-save').disabled);assert(h.el('auto-ready').textContent.includes('每天可用时间'));assert(h.el('auto-form').innerHTML.includes('¥19'));assert(h.el('auto-form').innerHTML.includes('先填时间'));
 h.fill();await h.submit();assert.equal(h.calls.filter(c=>c.method==='POST').length,0);assert.equal(h.prepares.length,0);
});

test('one explicit confirmation saves scope then enables master, without a model call or plan commit',async()=>{
 const h=setup();await h.click('open');h.fill();h.el('auto-consent').checked=false;await h.submit();assert.equal(h.calls.filter(c=>c.method==='POST').length,0);
 h.el('auto-consent').checked=true;await h.submit();const writes=h.calls.filter(c=>c.method==='POST');assert.deepEqual(writes.map(c=>c.path),['auto/grants/english','auto/control']);
 assert.equal(writes[0].body.enabled,true);assert.equal(writes[0].body.maxChanges,1);assert.equal(writes[1].body.expectedRevision,0);assert.equal(h.prepares.length,1);assert(h.el('auto-state').textContent.includes('已开启'));assert(h.calls.every(c=>!c.path.includes('chat')&&!c.path.includes('commit')&&!c.path.includes('enqueue')));
});

test('closing while phone preflight is pending cancels unsent authorization',async()=>{
 const h=setup();await h.click('open');h.fill();const finish=await h.hold();await h.submit();await h.click('close');finish();await h.settle();assert.equal(h.calls.filter(c=>c.method==='POST').length,0);
});

test('profile lookup failure cannot prevent pausing an already authorized subject',async()=>{
 const h=setup({profileFailure:true,enabled:true});await h.click('open');assert(h.el('auto-save').disabled);await h.click('pause');const writes=h.calls.filter(c=>c.method==='POST');assert.equal(writes.length,1);assert.equal(writes[0].path,'auto/grants/english');assert.equal(writes[0].body.enabled,false);assert(h.status.control.enabled,'other subject control is preserved');
});
