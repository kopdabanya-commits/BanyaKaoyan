import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash, webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),englishCore=require('../planner-core.js'),politicsCore=require('../politics-core.js');
const code=fs.readFileSync(new URL('../cloud-sync.js',import.meta.url),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
const configKey='banya_cloud_sync_config_v1';
const key='yantu_english_2026_m1';
const meta='banya_cloud_sync_meta_v1_english';
const state=(done=false)=>({done:{task:done},notes:{task:'private study note'}});
const pack=(subject,record)=>({schema:'banya.sync.v1',subject,record});
function harness(initial={},remote={subject:'english',revision:0,state:null},{liveEvents=false}={}){
 const hooks={},events=[];let digestCount=0;
 const store=new Map(Object.entries(initial)),calls=[],listeners={},reloads=[],notifications=[],elements={};
 let cloud=remote;
 const localStorage={
  getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)),
  removeItem:k=>store.delete(k)
 };
 const el=id=>elements[id]??=( {value:'',innerHTML:'',hidden:true,classList:{add(){},remove(){}},select(){},set textContent(value){notifications.push(value)}} );
 const win={PlannerCore:{validPlan:englishCore.validPlan,normalizeState(s){englishCore.normalizeState(s);return s;}},
  PoliticsCore:{normalize(s){politicsCore.normalize(s);return s;}},
  addEventListener(){},dispatchEvent:e=>events.push(e),confirm:()=>true,location:{reload:()=>reloads.push('reloaded')}};
 const context={window:win,localStorage,document:{
  addEventListener:(event,fn)=>{const previous=listeners[event];listeners[event]=previous?async e=>{await previous(e);await fn(e)}:fn;},getElementById:el,body:{classList:{add(){},remove(){}}}
 },navigator:{onLine:true,clipboard:{writeText:async()=>{}}},AbortController,setTimeout:()=>0,clearTimeout(){},crypto:{subtle:{digest:async(...args)=>{await hooks.onDigest?.(++digestCount);return webcrypto.subtle.digest(...args)}}},StorageEvent:liveEvents?class{constructor(type,options){this.type=type;Object.assign(this,options)}}:undefined,TextEncoder,URL,Blob,setInterval(){},
  fetch:async(url,init)=>{
   calls.push({url,init});
   if(init.method==='GET')await hooks.onGet?.();
   if(url.includes('/v1/agent/'))return {ok:true,json:async()=>url.endsWith('/grants')&&init.method==='POST'?{accessKey:'synthetic-one-time-key',grantId:'synthetic-grant'}:{grants:[]}};
   if(init.method==='PUT'){const body=JSON.parse(init.body);if(body.expectedRevision!==cloud.revision)
    return {ok:false,status:409};
    cloud={subject:body.state.subject,revision:cloud.revision+1,state:body.state};
   }
   return {ok:true,json:async()=>cloud};
  }};
 vm.runInNewContext(code,context);
 return {hooks,events,win,store,calls,reloads,listeners,notifications,network:context.navigator,el,cloud:()=>cloud};
}
const connected={endpoint:'https://124.70.128.201',token:'1234567890abcdef1234567890abcdef1234567890'};
test('no endpoint sends nothing; connected empty cloud safely starts the first backup',async()=>{
 const a=harness({[key]:JSON.stringify(state(true))});
 await a.win.BanyaCloudSync.syncAll();assert.equal(a.calls.length,0);
 assert(a.win.BanyaCloudSync.panel().includes('验证并启用'));
 const b=harness({[configKey]:JSON.stringify(connected),[key]:JSON.stringify(state(true))});
 await b.win.BanyaCloudSync.syncAll();
 assert.equal(b.cloud().revision,1);
 assert.equal(b.store.get(key+'_before_initial_sync'),JSON.stringify(state(true)));
 assert.equal(JSON.parse(b.store.get(meta)).revision,1);
 assert.equal(b.calls.filter(c=>c.init.method==='PUT').length,1);
});
test('automatic first sync stops when the cloud already has a record',async()=>{
 const raw=JSON.stringify(state(true));
 const h=harness({[configKey]:JSON.stringify(connected),[key]:raw},
  {subject:'english',revision:2,state:pack('english',state(false))});
 assert.equal(await h.win.BanyaCloudSync.syncAll(true),false);
 assert.equal(h.store.get(key),raw);
 assert.equal(h.calls.filter(c=>c.init.method==='PUT').length,0);
 assert(h.notifications.some(message=>message.includes('云端已有记录')));
});
test('first politics record enrolls only politics and never changes English storage',async()=>{
 const politics='yantu_politics_2026_v1',raw=JSON.stringify({done:{'pol-1':true},notes:{}});
 const h=harness({[configKey]:JSON.stringify(connected),[politics]:raw},
  {subject:'politics',revision:0,state:null});
 assert.equal(await h.win.BanyaCloudSync.syncAll(),true);
 assert.equal(h.cloud().state.subject,'politics');
 assert.equal(h.store.get(politics),raw);
 assert.equal(h.store.has(key),false);
 assert.equal(h.store.get(politics+'_before_initial_sync'),raw);
});
test('opted-in English sends only English snapshot with CAS, never touches politics',async()=>{
 const old=JSON.stringify(state(false)),newer=JSON.stringify(state(true));
 const a=harness({[configKey]:JSON.stringify(connected),[key]:newer,
   [meta]:JSON.stringify({revision:1,hash:hash(old)})},
  {subject:'english',revision:1,state:pack('english',JSON.parse(old))});
 await a.win.BanyaCloudSync.syncAll();
 assert.equal(a.calls.filter(x=>x.init.method==='PUT').length,1);
 const body=JSON.parse(a.calls.find(x=>x.init.method==='PUT').init.body);
 assert.equal(body.expectedRevision,1);
 assert.equal(body.state.subject,'english');
 assert.deepEqual(JSON.parse(JSON.stringify(body.state.record)),state(true));
 assert.equal(JSON.parse(a.store.get(meta)).revision,2);
 assert.equal(a.store.has('yantu_politics_2026_v1'),false);
});
test('actual writing time remains in the independent English cloud snapshot',async()=>{
 const record={...state(true),actualWritingMinutes:{'2026-10-16-1':14},actualMinutes:{'2026-10-16-1':14},actualReviewMinutes:{'2026-10-16-1':0}};
 const raw=JSON.stringify(record),h=harness({[configKey]:JSON.stringify(connected),[key]:raw},
  {subject:'english',revision:0,state:null});
 assert.equal(await h.win.BanyaCloudSync.syncAll(),true);
 assert.deepEqual(JSON.parse(JSON.stringify(h.cloud().state.record)),record);
 assert.deepEqual(englishCore.normalizeState(JSON.parse(h.store.get(key))).actualWritingMinutes,record.actualWritingMinutes);
 assert.equal(h.store.has('yantu_politics_2026_v1'),false);
 assert.equal(englishCore.normalizeState(h.cloud().state.record).actualReviewMinutes['2026-10-16-1'],0);
});
test('not-done task status is validated and retained in the independent cloud snapshot',async()=>{
 const record={done:{},notDone:{'2026-10-15-1':true},notes:{}};
 const raw=JSON.stringify(record),h=harness({[configKey]:JSON.stringify(connected),[key]:raw},
  {subject:'english',revision:0,state:null});
 assert.equal(await h.win.BanyaCloudSync.syncAll(),true);
 assert.equal(h.cloud().state.subject,'english');
 assert.deepEqual(JSON.parse(JSON.stringify(h.cloud().state.record)),record);
 assert.deepEqual(englishCore.normalizeState(JSON.parse(h.store.get(key))).notDone,record.notDone);
});
test('simultaneous changes stop upload and preserve the current local record',async()=>{
 const old=JSON.stringify(state(false)),changed=JSON.stringify(state(true));
 const a=harness({[configKey]:JSON.stringify(connected),[key]:changed,
  [meta]:JSON.stringify({revision:1,hash:hash(old)})},
  {subject:'english',revision:2,state:pack('english',state(false))});
 await a.win.BanyaCloudSync.syncAll();
 assert.equal(a.store.get(key),changed);
 assert.equal(a.calls.filter(x=>x.init.method==='PUT').length,0);
 assert.equal(a.reloads.length,0);
});
test('remote-only update creates local recovery copy before applying and reloading',async()=>{
 const old=JSON.stringify(state(false)),latest=state(true);
 const a=harness({[configKey]:JSON.stringify(connected),[key]:old,
  [meta]:JSON.stringify({revision:1,hash:hash(old)})},
  {subject:'english',revision:2,state:pack('english',latest)});
 await a.win.BanyaCloudSync.syncAll();
 assert.equal(a.store.get(key+'_before_cloud_restore'),old);
 assert.deepEqual(JSON.parse(a.store.get(key)),latest);
 assert.equal(a.reloads.length,1);
});
test('reject mislabeled cloud record without overwriting local data',async()=>{
 const old=JSON.stringify(state(false));
 const a=harness({[configKey]:JSON.stringify(connected),[key]:old,
  [meta]:JSON.stringify({revision:1,hash:hash(old)})},
  {subject:'english',revision:2,state:pack('politics',state(true))});
 await a.win.BanyaCloudSync.syncAll();
 assert.equal(a.store.get(key),old);assert.equal(a.reloads.length,0);
});

test('offline changes remain local until connectivity returns, then CAS uploads',async()=>{
 const original=JSON.stringify(state(false)),modified=JSON.stringify({...state(true),actualMinutes:{task:30},actualWritingMinutes:{task:20},actualReviewMinutes:{task:10}});
 const a=harness({[configKey]:JSON.stringify(connected),[key]:modified,
  [meta]:JSON.stringify({revision:1,hash:hash(original)})},
  {subject:'english',revision:1,state:pack('english',JSON.parse(original))});
 a.network.onLine=false;
 await a.win.BanyaCloudSync.syncAll();
 assert.equal(a.calls.length,0,'offline mode must never call server or block local state');
 assert.equal(a.store.get(key),modified);
 a.network.onLine=true;
 await a.win.BanyaCloudSync.syncAll();
 assert.equal(a.cloud().revision,2);
 assert.equal(a.cloud().state.record.actualReviewMinutes.task,10);
 assert.equal(a.store.get(key),modified);
});
test('politics remote-only update does not change English storage or English baseline',async()=>{
 const politicsKey='yantu_politics_2026_v1',politicsMeta='banya_cloud_sync_meta_v1_politics';
 const old=JSON.stringify({done:{},notes:{},questions:{marx:{done:93,total:396,updated:'2026-10-15'}}});
 const latest={done:{'politics-task':true},notes:{},questions:{marx:{done:93,total:396,updated:'2026-10-15'}}};
 const english=JSON.stringify(state(true));
 const a=harness({[configKey]:JSON.stringify(connected),[key]:english,
   [politicsKey]:old,[politicsMeta]:JSON.stringify({revision:1,hash:hash(old)})},
   {subject:'politics',revision:2,state:pack('politics',latest)});
 await a.win.BanyaCloudSync.syncAll();
 assert.equal(a.store.get(key),english,'English local state must never be changed by a politics update');
 assert.equal(a.store.get(politicsKey+'_before_cloud_restore'),old);
 assert.deepEqual(JSON.parse(a.store.get(politicsKey)),latest);
 assert.equal(a.store.get(politicsMeta)!==undefined,true);
});

test('M3.1 quick actions distinguish plan refresh and cloud records',async()=>{
 const offline=harness({[key]:JSON.stringify(state(true))});
 assert(offline.win.BanyaCloudSync.quickPanel().includes('刷新计划'));
 assert(offline.win.BanyaCloudSync.quickPanel().includes('同步记录'));
 assert.equal(await offline.win.BanyaCloudSync.syncAll(true),false);
 assert.equal(offline.calls.length,0);
 assert(offline.win.BanyaCloudSync.quickPanel().includes('尚未连接云端'));
 const notEnrolled=harness({[configKey]:JSON.stringify(connected),[key]:JSON.stringify(state(true))});
 assert.equal(await notEnrolled.win.BanyaCloudSync.syncAll(true),true);
 assert.equal(notEnrolled.cloud().revision,1);
 assert(notEnrolled.win.BanyaCloudSync.quickPanel().includes('同步完成'));
});
test('M3.1 manual refresh verifies the enrolled snapshot and shows an accurate success timestamp',async()=>{
 const raw=JSON.stringify(state(true)),record=JSON.parse(raw);
 const h=harness({[configKey]:JSON.stringify(connected),[key]:raw,
  [meta]:JSON.stringify({revision:1,hash:hash(raw)})},
  {subject:'english',revision:1,state:pack('english',record)});
 assert.equal(await h.win.BanyaCloudSync.syncAll(true),true);
 assert.equal(h.calls.length,1,'read only when no local change');
 assert.equal(h.calls[0].init.method,'GET');
 assert.equal(h.calls.filter(c=>c.init.method==='PUT').length,0);
 assert(h.store.has('banya_cloud_sync_last_ok_v1'));
 assert(h.win.BanyaCloudSync.quickPanel().includes('同步完成'));
});
test('one-file local restore validates before writing, clears only restored sync baselines',async()=>{
 const old=JSON.stringify(state(false)),latest=JSON.stringify(state(true));
 const politics='yantu_politics_2026_v1',pmeta='banya_cloud_sync_meta_v1_politics';
 const h=harness({[key]:old,[meta]:'{"revision":1,"hash":"old"}',[pmeta]:'{"revision":2,"hash":"other"}'});
 const file=values=>({size:500,text:async()=>JSON.stringify({app:'banya-kaoyan-local',version:1,values})});
 await h.listeners.change({target:{id:'banya-local-backup-file',files:[file({[key]:latest})],value:'backup.json'}});
 assert.equal(h.store.get(key),latest,h.notifications.join('; '));
 assert.equal(h.store.has(meta),false);
 assert.equal(h.store.has(pmeta),true,'untouched subject keeps its baseline');
 assert.equal(h.reloads.length,1);
 await h.listeners.change({target:{id:'banya-local-backup-file',files:[file({[key]:'{"done":null}'})],value:'bad.json'}});
 assert.equal(h.store.get(key),latest,'invalid backup must not overwrite data');
 assert.equal(h.reloads.length,1);
});
test('local restore retains a validated cloud baseline without storing the sync token in the file',async()=>{
 const raw=JSON.stringify(state(true)),baseline=JSON.stringify({revision:4,hash:hash(raw)});
 const h=harness({[key]:JSON.stringify(state(false)),[meta]:JSON.stringify({revision:1,hash:hash(JSON.stringify(state(false)))})});
 const file={size:500,text:async()=>JSON.stringify({app:'banya-kaoyan-local',version:1,
  values:{[key]:raw,[meta]:baseline}})};
 await h.listeners.change({target:{id:'banya-local-backup-file',files:[file],value:'backup.json'}});
 assert.equal(h.store.get(key),raw);
 assert.equal(h.store.get(meta),baseline);
 assert.equal(h.reloads.length,1);
 assert.equal(h.store.has(configKey),false);
 const invalid={size:500,text:async()=>JSON.stringify({app:'banya-kaoyan-local',version:1,
  values:{[key]:raw,[meta]:JSON.stringify({revision:4,hash:'bad'})}})};
 await h.listeners.change({target:{id:'banya-local-backup-file',files:[invalid],value:'bad.json'}});
 assert.equal(h.store.get(meta),baseline,'invalid baseline must not replace the valid one');
});

test('phone safely upgrades template metadata without changing the learning record',async()=>{
 const raw=JSON.stringify(state(true)),h=harness({[configKey]:JSON.stringify(connected),[key]:raw,[meta]:JSON.stringify({revision:1,hash:hash(raw)})},
  {subject:'english',revision:1,state:pack('english',JSON.parse(raw))});
 h.win.STUDY_PLAN={meta:{planVersion:'synthetic-template'}};
 assert.equal(await h.win.BanyaCloudSync.syncAll(),true);
 assert.equal(h.cloud().revision,2);assert.equal(h.cloud().state.templateVersion,'synthetic-template');
 assert.deepEqual(JSON.parse(JSON.stringify(h.cloud().state.record)),JSON.parse(raw));
 assert(h.calls.every(call=>call.url.endsWith('?plan_protocol=1')));
 assert(h.calls.every(call=>!('X-Banya-Plan-Protocol'in call.init.headers)),'staged frontend release must preserve legacy CORS compatibility');
});
test('private plan delivery backs up clean local state and stops for simultaneous offline edits',async()=>{
 const previous=JSON.stringify(state(false)),modified={...state(false),edits:{task:{detail:'Synthetic private guidance'}},moved:{task:'2026-10-21'}};
 const remote={subject:'english',revision:2,state:{...pack('english',modified),templateVersion:'synthetic-template',requiredCapabilities:['private-plan-v1']}};
 const h=harness({[configKey]:JSON.stringify(connected),[key]:previous,[meta]:JSON.stringify({revision:1,hash:hash(previous)})},remote);
 h.win.STUDY_PLAN={meta:{planVersion:'synthetic-template'}};
 assert.equal(await h.win.BanyaCloudSync.syncAll(),true);
 assert.equal(h.store.get(key+'_before_cloud_restore'),previous);
 assert.equal(JSON.parse(h.store.get(key)).edits.task.detail,'Synthetic private guidance');assert.equal(h.reloads.length,1);
 const changed=JSON.stringify({...state(false),notes:{task:'offline local note'}}),conflict=harness({[configKey]:JSON.stringify(connected),[key]:changed,[meta]:JSON.stringify({revision:1,hash:hash(previous)})},remote);
 conflict.win.STUDY_PLAN=h.win.STUDY_PLAN;
 assert.equal(await conflict.win.BanyaCloudSync.syncAll(),false);assert.equal(conflict.store.get(key),changed);
 assert.equal(conflict.calls.filter(call=>call.init.method==='PUT').length,0);assert.equal(conflict.reloads.length,0);
});
test('unsupported private plan capabilities or templates cannot overwrite phone records',async()=>{
 const raw=JSON.stringify(state(false));
 for(const [capability,version]of [['future-protocol','synthetic-template'],['private-plan-v1','different-template']]){
  const h=harness({[configKey]:JSON.stringify(connected),[key]:raw,[meta]:JSON.stringify({revision:1,hash:hash(raw)})},
   {subject:'english',revision:2,state:{...pack('english',state(true)),requiredCapabilities:[capability],templateVersion:version}});
  h.win.STUDY_PLAN={meta:{planVersion:'synthetic-template'}};
  assert.equal(await h.win.BanyaCloudSync.syncAll(),false);assert.equal(h.store.get(key),raw);assert.equal(h.reloads.length,0);
 }
});
test('owner creates a separate private GPT key only in transient UI, never backups or local storage',async()=>{
 const raw=JSON.stringify(state(false)),h=harness({[configKey]:JSON.stringify(connected),[key]:raw,[meta]:JSON.stringify({revision:1,hash:hash(raw)})},
  {subject:'english',revision:1,state:pack('english',state(false))});
 const button={dataset:{banyaAction:'agent-open'}};
 await h.listeners.click({target:{closest:()=>button}});
 assert(h.el('modal').innerHTML.includes('私人 GPT 授权'));
 for(const [id,value]of Object.entries({'agent-subject':'english','agent-permission':'write','agent-start':'2026-10-20','agent-end':'2026-10-21','agent-days':'7'}))h.el(id).value=value;
 await h.listeners.submit({target:{id:'banya-agent-grant',querySelector:()=>({disabled:false})},preventDefault(){}});
 assert.equal(h.el('agent-key').value,'synthetic-one-time-key');assert.equal(h.el('agent-key-box').hidden,false);
 assert(!Array.from(h.store.values()).some(raw=>raw.includes('synthetic-one-time-key')));
 assert(!h.el('modal').innerHTML.includes('synthetic-one-time-key'));
 const created=h.calls.find(call=>call.url.endsWith('/v1/agent/grants')&&call.init.method==='POST');
 assert.deepEqual(JSON.parse(created.init.body).permissions,['plan:read','plan:write']);
 assert.equal(created.init.headers.Authorization,'Bearer '+connected.token);
 await h.listeners.click({target:{closest:()=>({dataset:{banyaAction:'agent-close'}})}});
 assert.equal(h.el('agent-key').value,'');
});

test('AI bridge checks a clean phone/cloud baseline and never returns authentication material',async()=>{
 const raw=JSON.stringify(state(false)),remote={subject:'english',revision:1,state:{...pack('english',JSON.parse(raw)),templateVersion:'synthetic-template'}};
 const h=harness({[configKey]:JSON.stringify(connected),[key]:raw,[meta]:JSON.stringify({revision:1,hash:hash(raw)})},remote);
 h.win.STUDY_PLAN={meta:{planVersion:'synthetic-template'}};
 const baseline=await h.win.BanyaCloudSync.prepareAssistant('english');assert.equal(baseline.revision,1);assert.equal(baseline.templateVersion,'synthetic-template');
 assert(!JSON.stringify(baseline).includes(connected.token));
 await h.win.BanyaCloudSync.assistantRequest('status');const call=h.calls.at(-1);
 assert.equal(call.url,connected.endpoint+'/v1/ai/status');assert.equal(call.init.headers.Authorization,'Bearer '+connected.token);
 assert.equal(call.init.redirect,'error');assert.equal(call.init.credentials,'omit');
 assert.throws(()=>h.win.BanyaCloudSync.assistantRequest('../snapshot/english'));
});

test('M7.4 snapshot transport rejects redirects and omits unrelated browser credentials',async()=>{
 const raw=JSON.stringify(state(true)),h=harness({[configKey]:JSON.stringify(connected),[key]:raw});
 await h.win.BanyaCloudSync.syncAll();assert(h.calls.length>0);
 for(const call of h.calls){assert.equal(call.init.redirect,'error');assert.equal(call.init.credentials,'omit');}
});
test('M7.4 new phone record during GET prevents uploading stale state',async()=>{
 const raw=JSON.stringify(state(false)),next=JSON.stringify(state(true));
 const h=harness({[configKey]:JSON.stringify(connected),[key]:next,[meta]:JSON.stringify({revision:1,hash:hash(raw)})},{subject:'english',revision:1,state:pack('english',JSON.parse(raw))});
 h.hooks.onGet=async()=>h.store.set(key,JSON.stringify({...state(true),notes:{task:'synthetic newest note'}}));
 assert.equal(await h.win.BanyaCloudSync.syncAll(),false);
 assert.equal(h.calls.filter(c=>c.init.method==='PUT').length,0);assert(h.store.get(key).includes('synthetic newest note'));
});
test('M7.4 local change during cloud hashing is retained, not overwritten',async()=>{
 const raw=JSON.stringify(state(false)),latest=JSON.stringify({...state(true),notes:{task:'synthetic concurrent tap'}});
 const h=harness({[configKey]:JSON.stringify(connected),[key]:raw,[meta]:JSON.stringify({revision:1,hash:hash(raw)})},{subject:'english',revision:2,state:pack('english',state(true))});
 h.hooks.onDigest=async n=>{if(n===2)h.store.set(key,latest)};
 assert.equal(await h.win.BanyaCloudSync.syncAll(),false);assert.equal(h.store.get(key),latest);assert.equal(h.reloads.length,0);
});
test('M7.4 received plan updates notify the live task state before reloading',async()=>{
 const raw=JSON.stringify(state(false)),h=harness({[configKey]:JSON.stringify(connected),[key]:raw,[meta]:JSON.stringify({revision:1,hash:hash(raw)})},{subject:'english',revision:2,state:pack('english',state(true))},{liveEvents:true});
 assert.equal(await h.win.BanyaCloudSync.syncAll(),true);assert.equal(h.events.length,1);
 assert.equal(h.events[0].key,key);assert.equal(h.events[0].newValue,h.store.get(key));assert.equal(h.reloads.length,0);
});
