import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../learning-diagnostics.js',import.meta.url),'utf8');
function harness({offline=false,failSync=false}={}){
 const handlers={},elements={},calls=[],discussions=[];const el=id=>elements[id]??={id,value:'',disabled:false,innerHTML:'',textContent:'',classList:{add(){},remove(){}}};
 const report=subject=>({subject,sources:{profileRevision:1,snapshotRevision:2},windows:{7:{recordedTasks:2,completed:1},14:{recordedTasks:3,completed:2,distribution:{'Synthetic kind':{completed:2,actualMinutes:null,wrongCount:null}}}},future7Days:[{date:'2026-10-20',plannedMinutes:22,vocabularyMinutes:35,budgetMinutes:null}],issues:[{issueCode:'training_evidence_missing',recommendedAction:'Synthetic <script> suggestion',dateRange:{start:'2026-10-01',end:'2026-10-14'},sampleSize:0,confidence:'limited',evidence:{reason:'Synthetic unknown'},sourceRefs:['synthetic-source']}]});
 const root={BanyaStudyAssistant:{openPlanning:async(...args)=>discussions.push(args)},BanyaCloudSync:{isConnected:()=>true,prepareAssistant:async s=>{calls.push({path:'phone',subject:s});if(failSync)throw Error('Synthetic conflict');return {revision:2};},assistantRequest:async(path,method,body)=>{calls.push({path,method,body});return report(body.subject);}},alert(){}};
 vm.runInNewContext(source,{window:root,document:{getElementById:el,body:{classList:{add(){},remove(){}}},addEventListener:(n,f)=>(handlers[n]??=[]).push(f)},navigator:{onLine:!offline},Date,console});
 const fire=async(type,target,extra={})=>{for(const fn of handlers[type]||[])await fn({target,...extra});for(let n=0;n<5;n++)await new Promise(setImmediate);};
 const click=(action,subject='english')=>fire('click',{closest:()=>({dataset:{diagnosisAction:action,diagnosisSubject:subject}})});
 return {el,calls,discussions,click,change:()=>fire('change',el('diagnosis-subject')),escape:()=>fire('keydown',{}, {key:'Escape'})};
}
test('opening diagnosis reads only deterministic analysis and escapes unknown external text',async()=>{
 const h=harness();await h.click('open');assert.deepEqual(h.calls.map(c=>c.path),['phone','analysis']);
 assert(!h.el('diagnosis-output').innerHTML.includes('<script>'));assert(h.el('diagnosis-output').innerHTML.includes('未填写'));assert(h.el('diagnosis-output').innerHTML.includes('没打卡不等于没学习'));
 assert(h.calls.every(c=>c.path!=='chat'));
});
test('switching subject rebuilds an independent report without carrying prior data',async()=>{
 const h=harness();await h.click('open');h.el('diagnosis-subject').value='politics';await h.change();
 assert.equal(h.calls.filter(c=>c.path==='analysis').at(-1).body.subject,'politics');assert(!h.el('diagnosis-output').innerHTML.includes('另有单词'));
});
test('offline does not request data or a model, sync failure labels cloud-only evidence',async()=>{
 const h=harness({offline:true});await h.click('open');assert.equal(h.calls.length,0);assert(h.el('diagnosis-state').textContent.includes('离线'));
 const other=harness({failSync:true});await other.click('open');assert(other.el('diagnosis-state').textContent.includes('手机未同步'));assert(!('expectedRevision' in other.calls.at(-1).body));
});
test('entering planning only opens its form, never sends a paid request',async()=>{
 const h=harness();await h.click('open');h.el('diagnosis-mode').value='week';await h.click('discuss');
 assert.equal(h.discussions.length,1);assert.equal(h.discussions[0][1],'week');assert(h.calls.every(c=>c.path!=='chat'));
 await h.click('open','politics');await h.escape();await h.click('open');assert.equal(h.calls.filter(c=>c.path==='analysis').length,3);
});
