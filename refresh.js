(async function(){
 const status=document.getElementById('status');
 const timeout=(promise)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(Error('更新超时')),8000))]);
 try{
  if('serviceWorker' in navigator){
   const registrations=await timeout(navigator.serviceWorker.getRegistrations());
   for(const registration of registrations){
    if(new URL(registration.scope).origin===location.origin&&!await timeout(registration.unregister()))
     throw Error('离线应用未能重置');
   }
  }
  if('caches' in window){
   const names=await timeout(caches.keys());
   for(const name of names){
    if(name.startsWith('yantu-english-ii-')&&!await timeout(caches.delete(name)))
     throw Error('旧网页文件未能清理');
   }
  }
  status.textContent='网页文件已更新，正在返回学习页面……';
  location.replace('./index.html?reauth=1');
 }catch(error){
  status.textContent='暂时无法更新网页文件。请保持联网后重新打开此页；你的学习记录仍在本机。';
 }
})();
