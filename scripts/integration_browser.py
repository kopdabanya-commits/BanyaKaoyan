"""Actual PWA cloud-sync transport against local TestClient; all HTTPS is intercepted.
No BanyaCloudSync methods are replaced, no real host or model is contacted.
Service Worker caching is covered separately by visual_acceptance.py.
"""
import hashlib,json,mimetypes,os
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from visual_acceptance import fixture,templates,ROOT,TODAY
from test_agent_api import OWNER,OWNER_AUTH,PROTO
from autonomous import RECORD_FIELDS

ORIGIN='https://124.70.128.201'
KEYS={'english':'yantu_english_2026_m1','politics':'yantu_politics_2026_v1'}

def run(executable=None):
    with sync_playwright() as p:
        browser=p.chromium.launch(**({'executable_path':executable} if executable else {}),headless=True,args=['--no-sandbox'])
        for subject in ('english','politics'):
            with fixture() as (client,app,raw,calls,_):
                context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='block',reduced_motion='reduce')
                forwarded=[];errors=[]
                def intercept(route):
                    request=route.request;url=urlsplit(request.url)
                    assert url.scheme=='https' and url.netloc=='124.70.128.201','Unexpected egress refused'
                    if url.path.startswith('/v1/') or url.path=='/health':
                        forwarded.append((request.method,url.path))
                        r=client.request(request.method,url.path+('?' +url.query if url.query else ''),headers={k:v for k,v in request.headers.items() if k.lower() in ('authorization','content-type','x-banya-plan-protocol')},content=request.post_data)
                        route.fulfill(status=r.status_code,body=r.content,content_type='application/json');return
                    path='index.html' if url.path=='/' else url.path.lstrip('/')
                    if path in ('plan-data.js','politics-plan-data.js','plan.json','politics-plan.json'):
                        s='politics' if path.startswith('politics') else 'english';body=json.dumps(templates(s),ensure_ascii=False)
                        if path.endswith('.js'):body='window.'+('POLITICS_PLAN' if s=='politics' else 'STUDY_PLAN')+'='+body+';'
                        route.fulfill(body=body,content_type='application/javascript' if path.endswith('.js') else 'application/json');return
                    from ecs_package import ASSETS
                    if path in ASSETS:route.fulfill(body=(ROOT/path).read_bytes(),content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
                    else:route.fulfill(status=404,body='')
                context.route('**/*',intercept)
                page=context.new_page();page.set_default_timeout(12000);page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
                seed={'banya_cloud_sync_config_v1':json.dumps({'endpoint':ORIGIN,'token':OWNER})}
                for s,key in KEYS.items():
                    text=json.dumps(raw[s],ensure_ascii=False,separators=(',',':'));seed[key]=text
                    seed['banya_cloud_sync_meta_v1_'+s]=json.dumps({'revision':1,'hash':hashlib.sha256(text.encode()).hexdigest()})
                page.add_init_script("(seed=>{if(!sessionStorage.getItem('synthetic-transport')){for(const [k,v] of Object.entries(seed))localStorage.setItem(k,v);sessionStorage.setItem('synthetic-transport','1');}})("+json.dumps(seed)+');')
                def snapshot():return client.get('/v1/snapshot/'+subject,headers=PROTO).json()
                page.goto(ORIGIN+'/');page.wait_for_selector('.student-task')
                page.locator('[data-action="switch-subject"][data-subject="'+subject+'"]').click();page.locator('[data-view="assistant"]').click()
                page.wait_for_function("document.getElementById('ai-home-status').textContent.includes('未启用')");assert not calls
                page.locator('[data-activation-action="open"]').click();page.wait_for_selector('#activation-save:not([disabled])');page.locator('#activation-save').click();page.wait_for_function("document.getElementById('activation-state').textContent.includes('开关已保存')");page.keyboard.press('Escape');page.wait_for_timeout(100)
                assert not calls
                page.locator('[data-auto-action="open"]').first.click();page.wait_for_selector('#auto-save')
                page.locator('#auto-form details summary').click();page.locator('#auto-budget').fill('1');page.locator('#auto-consent').check();page.locator('#auto-save').click();page.wait_for_function("document.getElementById('auto-state').textContent.includes('已开启。新的学习记录')")
                assert client.get('/v1/ai/auto/status',headers=OWNER_AUTH).json()['control']['enabled'];page.keyboard.press('Escape');page.wait_for_timeout(100)
                page.locator('[data-view="today"]').click()
                def note(text):
                    page.locator('.student-task-body').first.click()
                    page.locator('summary').filter(has_text='一句话复盘（可选）').first.click()
                    page.locator('#task-note' if subject=='english' else '#p-note').fill(text)
                    page.locator('.record-save-only').click()
                with page.expect_response(lambda r:r.url.startswith(ORIGIN+'/v1/snapshot/'+subject) and r.request.method=='PUT' and r.status==200):note('示例：同步触发前的新笔记')
                page.wait_for_function('!BanyaCloudSync.isSyncing()')
                before=snapshot()['state'];assert before['record']['notes'][subject+'-'+TODAY.isoformat()+'-main']=='示例：同步触发前的新笔记','Synthetic note must upload before planning'
                assert app.state.autonomy.process_one()=='applied';assert len(calls)==1
                after=snapshot()['state']
                for field in RECORD_FIELDS:assert after['record'].get(field,{})==before['record'].get(field,{})
                # The actual cloud-sync module receives the changed overlay with CAS metadata.
                page.wait_for_function('!BanyaCloudSync.isSyncing()')
                assert page.evaluate('BanyaCloudSync.syncAll(true)')
                page.wait_for_selector('.student-task')
                tomorrow=(TODAY+timedelta(days=1)).isoformat();task=subject+'-'+tomorrow+'-main'
                assert page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))',KEYS[subject])['edits'][task]['minutes']==19
                page.locator('[data-view="assistant"]').click();page.locator('[data-auto-action="open"][data-history="true"]').click();page.wait_for_selector('[data-auto-action="undo"]')
                page.wait_for_function('!BanyaCloudSync.isSyncing()')
                with page.expect_response(lambda r:'/v1/ai/auto/runs/' in r.url and r.url.endswith('/undo') and r.status==200):page.locator('[data-auto-action="undo"]').click()
                undo_revision=snapshot()['revision']
                page.wait_for_function('(x)=>JSON.parse(localStorage.getItem(x.key)).revision===x.revision',arg={'key':'banya_cloud_sync_meta_v1_'+subject,'revision':undo_revision})
                page.wait_for_selector('[data-ai-home-subject]');page.wait_for_selector('#modal.hidden',state='attached')
                local=page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))',KEYS[subject]);assert task not in local['edits']
                assert local['notes']==before['record']['notes'];assert not client.get('/v1/ai/auto/status',headers=OWNER_AUTH).json()['grants'][0]['enabled']
                # Offline edit vs another device: neither copy may be silently overwritten.
                page.locator('[data-view="today"]').click();context.set_offline(True);note('示例：离线后尚未同步的新笔记')
                cloud=snapshot();cloud['state']['record']['notes']['synthetic-other-device']='示例：另一设备的新笔记'
                assert client.put('/v1/snapshot/'+subject,headers=OWNER_AUTH,json={'expectedRevision':cloud['revision'],'state':cloud['state']}).status_code==200
                context.set_offline(False);page.wait_for_timeout(500)
                assert not page.evaluate('BanyaCloudSync.syncAll(true)')
                local=page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))',KEYS[subject])
                assert '离线后' in local['notes'][subject+'-'+TODAY.isoformat()+'-main']
                assert snapshot()['state']['record']['notes']['synthetic-other-device']=='示例：另一设备的新笔记'
                assert len(calls)==1 and not errors,errors
                assert any(m=='PUT' and path=='/v1/snapshot/'+subject for m,path in forwarded)
                context.close();print('PASS actual cloud-sync transport '+subject+': sync trigger, fake apply, receive, undo receive, offline conflict; paid calls=0',flush=True)
        browser.close()

if __name__=='__main__':run(os.environ.get('BANYA_CHROMIUM'))
