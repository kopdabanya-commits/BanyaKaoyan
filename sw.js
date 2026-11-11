const CACHE='banya-archive-cache-v3';
const CORE=['./','./index.html','./manifest.webmanifest','./assets/icon.svg'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('banya-archive-cache-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(res=>{
      if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy)).catch(()=>{});}
      return res;
    }).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(fetch(request).catch(()=>caches.match(request)));
});
