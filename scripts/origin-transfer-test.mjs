import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const English=require('../planner-core.js'),Politics=require('../politics-core.js');
const code=fs.readFileSync(new URL('../origin-transfer.js',import.meta.url),'utf8');
const SOURCE='https://english-ii-plan.kopdabanya.workers.dev',DEST='https://124.70.128.201';
function setup(sourceRecord={},targetRecord={}){
 const handlers=[{},{}],maps=[new Map(Object.entries(sourceRecord)),new Map(Object.entries(targetRecord))],opens=[];
 const make=(i,origin)=>{
  const doc={getElementById:()=>({textContent:''}),addEventListener:(name,fn)=>handlers[i][name]=fn};
  const root={PlannerCore:English,PoliticsCore:Politics,location:{origin,hash:i?'#banya-copy='+('ab'.repeat(16)):'',pathname:'/',search:'',reload(){this.reloaded=true}},history:{replaceState(){}},crypto:{getRandomValues:a=>a.fill(0xab)},addEventListener:(name,fn)=>handlers[i][name]=fn};
  const store={getItem:key=>maps[i].get(key)??null,setItem:(key,value)=>maps[i].set(key,value),removeItem:key=>maps[i].delete(key)};
  vm.runInNewContext(code,{window:root,document:doc,localStorage:store,URLSearchParams,Uint8Array,JSON,Array,String});
  return root;
 };
 const source=make(0,SOURCE),dest=make(1,DEST);
 const deliver=(from,to,index,data,target)=>{if(target!==to.location.origin)throw Error('wrong postMessage target');handlers[index].message({origin:from.location.origin,source:from,data});};
 dest.postMessage=(data,target)=>deliver(source,dest,1,data,target);
 source.postMessage=(data,target)=>deliver(dest,source,0,data,target);
 source.open=url=>{opens.push(url);return dest};dest.opener=source;
 const click=()=>handlers[0].click({target:{closest:()=>({})}});
 const ready=()=>handlers[1].load();
 return {source,dest,maps,opens,click,ready,handlers};
}
test('one-click copy transfers both private records and sync config only between exact HTTPS origins',()=>{
 const english=JSON.stringify(English.normalizeState({done:{a:true},questionIds:{a:'3、8'}}));
 const politics=JSON.stringify(Politics.normalize({done:{b:true},actualMinutes:{b:42}}));
 const config=JSON.stringify({endpoint:DEST,token:'test-only-token-'.repeat(3)});
 const h=setup({yantu_english_2026_m1:english,yantu_politics_2026_v1:politics,banya_cloud_sync_config_v1:config});
 h.click();assert.equal(h.opens.length,1);assert(h.opens[0].startsWith(DEST+'/#banya-copy='));h.ready();
 assert.equal(h.maps[1].get('yantu_english_2026_m1'),english);
 assert.equal(h.maps[1].get('yantu_politics_2026_v1'),politics);
 assert.equal(h.maps[1].get('banya_cloud_sync_config_v1'),config);
 assert.equal(h.maps[0].get('yantu_english_2026_m1'),english,'source remains intact');
 assert.equal(h.dest.location.reloaded,true);
});
test('existing destination record is never overwritten by automatic copy',()=>{
 const original=JSON.stringify(English.defaults()),existing=JSON.stringify(English.normalizeState({done:{mine:true}}));
 const h=setup({yantu_english_2026_m1:original},{yantu_english_2026_m1:existing});
 h.click();h.ready();assert.equal(h.maps[1].get('yantu_english_2026_m1'),existing);assert.equal(h.maps[0].get('yantu_english_2026_m1'),original);
});
test('wrong sender origin or invalid local record cannot initiate transfer',()=>{
 const h=setup({yantu_english_2026_m1:JSON.stringify(English.defaults())});
 h.click();h.handlers[0].message({origin:'https://untrusted.example',source:h.dest,data:{type:'banya-origin-copy-v1',action:'ready',nonce:'ab'.repeat(16)}});
 assert.equal(h.maps[1].size,0);
 const bad=setup({yantu_english_2026_m1:'{broken'});bad.click();assert.equal(bad.opens.length,0);
});
