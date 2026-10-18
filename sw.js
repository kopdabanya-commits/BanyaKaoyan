/* 板牙考研：英语+政治单一PWA。旧缓存前缀保留以清理旧版，Access响应不得缓存。 */
const CACHE='yantu-english-ii-m7-1-learning-memory-draft-20261018';
const ASSETS=['./','./index.html','./styles.css','./planner-core.js','./app.js','./plan-data.js','./study-intelligence.js','./study-ui.js','./politics-core.js','./politics-plan-data.js','./politics-ui.js','./plan-import.js','./cloud-sync.js','./study-assistant.js','./origin-transfer.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
function acceptable(response,url){
 if(!response.ok||response.redirected||response.type==='opaque'||response.type==='opaqueredirect')return false;
 if(response.url&&new URL(response.url).origin!==self.location.origin)return false;
 const type=response.headers.get('content-type')||'';
 if(url.endsWith('.js'))return /javascript/.test(type);
 if(url.endsWith('.css'))return type.includes('text/css');
 if(url.endsWith('.png'))return type.includes('image/png');
 if(url.endsWith('.webmanifest'))return /json|manifest/.test(type);
 return type.includes('text/html');
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 try{
  const entries=await Promise.all(ASSETS.map(async path=>{
   const url=new URL(path,self.registration.scope).href;
   const response=await fetch(url,{cache:'reload',redirect:'error'});
   if(!acceptable(response,url))throw Error('Uncacheable resource');
   if(path==='./'||path==='./index.html'){
    const html=await response.clone().text();if(!html.includes('id="app"')||!html.includes('./planner-core.js'))throw Error('Not the application shell');
   }
   return [url,response];
  }));
  await Promise.all(entries.map(([url,response])=>cache.put(url,response)));
 }catch(err){await caches.delete(CACHE);throw err;}
 // Do not skipWaiting: existing tabs keep one consistent application bundle.
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('yantu-english-ii-')&&key!==CACHE)await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin)return;
 if(url.searchParams.has('reauth')||url.pathname.startsWith('/cdn-cgi/')||url.pathname.endsWith('/plan.json')||url.pathname.endsWith('/politics-plan.json'))return;
 const key=new URL(url.pathname,self.location.origin).href;
 const allowed=new Set(ASSETS.map(p=>new URL(p,self.registration.scope).href));
 if(!allowed.has(key))return;
 event.respondWith((async()=>{
  const cached=await (await caches.open(CACHE)).match(key);
  if(cached)return cached;
  try{return await fetch(req,{cache:'no-store'});}catch{return new Response('离线资源未就绪，请联网验证访问后刷新。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}
 })());
});
