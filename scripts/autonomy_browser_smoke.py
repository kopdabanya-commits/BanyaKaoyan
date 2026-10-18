"""Optional browser + real local backend smoke; synthetic fixtures, injected provider only.
Run with Python containing pytest/httpx/fastapi/playwright. Static app at :8765.
No production URLs, credentials, database or provider calls are used.
"""
import sys,tempfile,json,os
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server/banya-sync'))
from test_autonomous import auto,enqueue
from playwright.sync_api import sync_playwright

with tempfile.TemporaryDirectory() as directory:
 fixture=auto.__wrapped__(Path(directory));client,service,db,calls,response,_=next(fixture)
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
   page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   def request(source,path,method,body):
    from test_agent_api import OWNER_AUTH
    r=client.request(method,'/v1/ai/'+path,headers=OWNER_AUTH,**({'json':body} if body is not None else {}))
    return {'ok':r.status_code<300,'body':r.json()}
   page.expose_binding('syntheticApi',request)
   page.goto(os.environ.get('BANYA_SMOKE_URL','http://127.0.0.1:8765/'))
   page.evaluate('''() => {BanyaCloudSync.assistantRequest=async(path,method='GET',body)=>{const r=await syntheticApi(path,method,body??null);if(!r.ok)throw Error('模拟接口安全拒绝');return r.body;};BanyaCloudSync.prepareAssistant=async(subject)=>({revision:(await syntheticApi('read?subject='+subject,'GET',null)).body.revision});BanyaCloudSync.syncAll=async()=>true;}''')
   for subject in ('english','politics'):
    page.locator('[data-action="switch-subject"][data-subject="'+subject+'"]').click()
    page.locator('[data-view="assistant"]').click();page.locator('[data-auto-action="open"]').click();page.wait_for_selector('#auto-enabled')
    assert not page.locator('#auto-enabled').is_checked()
    page.locator('#auto-enabled').check();page.locator('#auto-budget').fill('1')
    page.locator('#auto-form details summary').click();page.locator('#auto-type-0').check();page.locator('#auto-consent').check()
    page.locator('#auto-form button[type="submit"]').click();page.wait_for_function("document.getElementById('auto-state').textContent==='本科学习授权已保存。'")
    if subject=='english':
     page.locator('#auto-master').click();page.wait_for_function("document.getElementById('auto-state').textContent==='总开关已更新。'")
    assert enqueue(client,subject).status_code==200
    assert service.process_one()=='applied'
    page.locator('[data-auto-action="close"]').click();page.wait_for_timeout(100)
    page.locator('[data-auto-action="open"]').click();page.wait_for_selector('[data-auto-action="undo"]')
    page.screenshot(path='/tmp/banya-auto-'+subject+'.png',full_page=True)
    # The phone preflight reads the actual local backend snapshot revision.
    from test_agent_api import OWNER_AUTH,PROTO
    rev=client.get('/v1/snapshot/'+subject,headers=PROTO).json()['revision']
    page.evaluate('(revision)=>BanyaCloudSync.prepareAssistant=async()=>({revision})',rev)
    page.locator('[data-auto-action="undo"]').first.click();page.wait_for_function("document.getElementById('auto-state').textContent==='已撤销并同步，自动管理已暂停。'")
    assert not page.locator('#auto-enabled').is_checked()
    page.locator('[data-auto-action="close"]').click();page.wait_for_timeout(100)
   assert len(calls)==2
   assert not errors,errors
   browser.close()
  print('PASS: English/politics grants, fake model apply, receipt and safe undo via browser + local backend; 2 injected calls, 0 paid calls')
 finally:
  try:next(fixture)
  except StopIteration:pass
