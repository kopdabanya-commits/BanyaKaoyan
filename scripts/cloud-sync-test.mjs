import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash, webcrypto} from 'node:crypto';
const code=fs.readFileSync(new URL('../cloud-sync.js',import.meta.url),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
const configKey='banya_cloud_sync_config_v1';
const key='yantu_english_2026_m1';
const meta='banya_cloud_sync_meta_v1_english';
const state=(done=false)=>({done:{task:done},notes:{task:'private study note'}});
const pack=(subject,record)=>({schema:'banya.sync.v1',subject,record});
function harness(initial={},remote={subject:'english',revision:0,state:null}){
 const store=new Map(Object.entries(initial)),calls=[],listeners={},reloads=[],notifications=[];
 let cloud=remote;
 const localStorage={
  getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)),
  removeItem:k=>store.delete(k)
 };
 const win={PlannerCore:{validPlan:()=>true,normalizeState(s){if(!s||!s.done||typeof s.done!=='object')throw Error('invalid');return s;}},
  PoliticsCore:{normalize(s){if(!s||!s.done||typeof s.done!=='object')throw Error('invalid');return s;}},
  addEventListener(){},confirm:()=>true,location:{reload:()=>reloads.push('reloaded')}};
 const context={window:win,localStorage,document:{
  addEventListener:(event,fn)=>listeners[event]=fn,getElementById:()=>({set textContent(value){notifications.push(value)}})
 },navigator:{onLine:true},crypto:webcrypto,TextEncoder,URL,Blob,setInterval(){},
  fetch:async(url,init)=>{
   calls.push({url,init});
   if(init.method==='PUT'){const body=JSON.parse(init.body);if(body.expectedRevision!==cloud.revision)
    return {ok:false,status:409};
    cloud={subject:body.state.subject,revision:cloud.revision+1,state:body.state};
   }
   return {ok:true,json:async()=>cloud};
  }};
 vm.runInNewContext(code,context);
 return {win,store,calls,reloads,listeners,notifications,network:context.navigator,cloud:()=>cloud};
}
const connected={endpoint:'https://124.70.128.201',token:'1234567890abcdef1234567890abcdef1234567890'};
test('no endpoint: no network, no automatic first upload or cloud replacement',async()=>{
 const a=harness({[key]:JSON.stringify(state(true))});
 await a.win.BanyaCloudSync.syncAll();assert.equal(a.calls.length,0);
 assert(a.win.BanyaCloudSync.panel().includes('验证并启用'));
 const b=harness({[configKey]:JSON.stringify(connected),[key]:JSON.stringify(state(true))});
 await b.win.BanyaCloudSync.syncAll();
 assert.equal(b.calls.length,0,'no consent baseline must never contact/mutate cloud');
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
 const original=JSON.stringify(state(false)),modified=JSON.stringify(state(true));
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
 assert.equal(a.store.get(key),modified);
});
test('politics remote-only update does not change English storage or English baseline',async()=>{
 const politicsKey='yantu_politics_2026_v1',politicsMeta='banya_cloud_sync_meta_v1_politics';
 const old=JSON.stringify({done:{},notes:{},questions:{marx:{done:93,total:396}}});
 const latest={done:{'politics-task':true},notes:{},questions:{marx:{done:93,total:396}}};
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

test('M3.1 quick actions distinguish plan refresh and cloud records without implicit first upload',async()=>{
 const offline=harness({[key]:JSON.stringify(state(true))});
 assert(offline.win.BanyaCloudSync.quickPanel().includes('刷新计划'));
 assert(offline.win.BanyaCloudSync.quickPanel().includes('同步记录'));
 assert.equal(await offline.win.BanyaCloudSync.syncAll(true),false);
 assert.equal(offline.calls.length,0);
 assert(offline.win.BanyaCloudSync.quickPanel().includes('尚未连接云端'));
 const notEnrolled=harness({[configKey]:JSON.stringify(connected),[key]:JSON.stringify(state(true))});
 assert.equal(await notEnrolled.win.BanyaCloudSync.syncAll(true),false);
 assert.equal(notEnrolled.calls.length,0);
 assert(notEnrolled.win.BanyaCloudSync.quickPanel().includes('还没有首次上传'));
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
