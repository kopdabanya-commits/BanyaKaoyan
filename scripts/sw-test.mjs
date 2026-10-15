import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const origin='https://app.example',scope=origin+'/';
function setup({bad=null,offline=false,redirect=false}={}){
 const handlers={},stores=new Map([['yantu-english-ii-old',new Map([['old','safe']])]]),calls=[];let claimed=false;
 const caches={open:async name=>{if(!stores.has(name))stores.set(name,new Map());const m=stores.get(name);return {put:async(k,r)=>m.set(k,r),match:async k=>m.get(k)}},keys:async()=>[...stores.keys()],delete:async k=>stores.delete(k)};
 const context={self:{location:{origin},registration:{scope},clients:{claim:async()=>{claimed=true}},addEventListener:(n,f)=>handlers[n]=f},caches,URL,Response,fetch:async(url,opts)=>{
  calls.push([url,opts]);if(offline)throw Error('offline');if(redirect)throw Error('redirect denied');
  const path=new URL(url).pathname,type=path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.png')?'image/png':path.endsWith('.webmanifest')?'application/manifest+json':'text/html';
  return new Response(path===bad?'login':path==='/'||path==='/index.html'?'<main id="app"></main><script src="./planner-core.js"></script>':'asset',{headers:{'content-type':path===bad?'text/html':type}});
 }};
 vm.createContext(context);vm.runInContext(code,context);
 async function lifecycle(k){let result;handlers[k]({waitUntil:p=>result=p});return result;}
 async function get(path,method='GET'){let result;handlers.fetch({request:{url:origin+path,method},respondWith:p=>result=p});return result;}
 return {stores,calls,lifecycle,get,claimed:()=>claimed};
}
test('atomic install validates ten resources, activation removes only old app caches',async()=>{
 const h=setup();h.stores.set('other-app',new Map());await h.lifecycle('install');const name=[...h.stores.keys()].find(k=>k.startsWith('yantu-english-ii-')&&k!=='yantu-english-ii-old');assert.equal(h.stores.get(name).size,10);assert(h.stores.has('yantu-english-ii-old'));await h.lifecycle('activate');assert(!h.stores.has('yantu-english-ii-old'));assert(h.stores.has('other-app'));assert(h.claimed());
 for(const [,opts] of h.calls)assert.equal(opts.redirect,'error');
});
test('HTML login returned as JavaScript aborts install, partial new cache removed, active cache preserved',async()=>{
 const h=setup({bad:'/app.js'});await assert.rejects(h.lifecycle('install'));assert.equal(h.stores.size,1);assert(h.stores.has('yantu-english-ii-old'));
});
test('login redirects and offline install cannot replace the working cache',async()=>{
 for(const opts of [{redirect:true},{offline:true},{bad:'/'}]){const h=setup(opts);await assert.rejects(h.lifecycle('install'));assert(h.stores.has('yantu-english-ii-old'));assert.equal(h.stores.size,1);}
});
test('cached shell works offline; updates, reauth, Access endpoints and docs bypass SW cache',async()=>{
 const h=setup();await h.lifecycle('install');await h.lifecycle('activate');const before=h.calls.length;const response=await h.get('/');assert.equal(response.status,200);assert.equal(h.calls.length,before);
 for(const path of ['/plan.json?check=1','/?reauth=1','/cdn-cgi/access/login','/README.md','/unknown.js'])assert.equal(await h.get(path),undefined);
 assert.equal(await h.get('/','POST'),undefined);
});
test('uncached offline asset returns useful 503 and is not cached',async()=>{
 const h=setup({offline:true});assert.equal((await h.get('/app.js')).status,503);
});
