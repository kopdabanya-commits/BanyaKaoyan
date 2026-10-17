import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const script=readFileSync(new URL('../refresh.js',import.meta.url),'utf8');
async function run({fail=false}={}){
 const deleted=[],unregistered=[],redirected=[];
 const status={textContent:''};
 const context={
  URL,
  document:{getElementById:()=>status},
  navigator:{serviceWorker:{getRegistrations:async()=>[{scope:'https://124.70.128.201/',unregister:async()=>{unregistered.push('app');return true;}}]}},
  location:{origin:'https://124.70.128.201',replace:url=>redirected.push(url)},
  caches:{keys:async()=>['yantu-english-ii-old','unrelated-cache'],delete:async name=>{deleted.push(name);return !fail;}},
  window:{},setTimeout
 };
 context.window.caches=context.caches;
 vm.runInNewContext(script,context);
 await new Promise(resolve=>setTimeout(resolve,10));
 return {deleted,unregistered,redirected,status:status.textContent};
}
test('recovery removes only app caches, unregisters service worker and reloads',async()=>{
 const result=await run();
 assert.deepEqual(result.deleted,['yantu-english-ii-old']);
 assert.deepEqual(result.unregistered,['app']);
 assert.deepEqual(result.redirected,['./index.html?reauth=1']);
});
test('failed cache deletion keeps user on recovery page',async()=>{
 const result=await run({fail:true});
 assert.deepEqual(result.redirected,[]);
 assert.match(result.status,/学习记录仍在本机/);
});
test('recovery code leaves study data storage untouched',()=>{
 assert.doesNotMatch(script,/localStorage|indexedDB|sessionStorage|\.clear\(/);
});
