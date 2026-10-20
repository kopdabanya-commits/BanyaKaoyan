"""M7.4 synthetic browser matrix. Serves local assets; only injected AI is callable.
Produces reviewable PNG + HTML artifacts. No credentials/private server access.
"""
from __future__ import annotations
import argparse,hashlib,json,os,subprocess,sys,tempfile,threading
from contextlib import contextmanager
from datetime import date,datetime,timedelta,timezone
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'server/banya-sync'))
from fastapi.testclient import TestClient
from playwright.sync_api import sync_playwright
from app import create_app
from deepseek_ai import AIConfig
from test_agent_api import OWNER,OWNER_AUTH,PROTO
from test_learning_memory import entry,save
from test_learning_planner import suggestion

START=date(2026,10,15);END=date(2026,12,18);TODAY=date.today()
# Existing app contract is explicitly a 2026 study app.
assert START<=TODAY<=END,'Visual fixture requires a date inside the existing app calendar'

def templates(subject):
    start=START if subject=='english' else START+timedelta(days=1)
    days=[]
    for n in range((END-start).days+1):
        day=(start+timedelta(days=n)).isoformat();prefix=subject+'-'+day
        if subject=='english':
            kind=['写作','完形','翻译','新题型'][n%4]
            items=[{'id':prefix+'-main','title':'阅读练习 · 示例材料','type':'阅读','minutes':18,'questionCount':5,'detail':'独立完成一组练习，再核对答案。此为合成测试材料。'},
                   {'id':prefix+'-extra','title':{'写作':'写作练习 · 示例题目','完形':'完形练习 · 示例材料','翻译':'翻译练习 · 示例段落','新题型':'新题型练习 · 示例材料'}[kind],'type':kind,'minutes':20,'detail':'按自己的节奏完成，留下一条简短记录即可。'}]
        else:
            items=[{'id':prefix+'-main','title':'理论理解 · 示例课程','type':'课程','minutes':18,'detail':'带着问题看一节课程，再用自己的话解释。'},
                   {'id':prefix+'-extra','title':'选择题练习 · 示例题组','type':'刷题','minutes':25,'questionCount':10,'detail':'完成一组练习，核对不确定的选项。'},
                   {'id':prefix+'-review','title':'错题订正 · 示例材料','type':'复盘','minutes':12,'detail':'理解错因，不必写很长的笔记。'}]
        days.append({'date':day,'stage':'基础训练','topic':'理解与练习','items':items})
    return {'meta':{'start':start.isoformat(),'end':END.isoformat(),'exam':'2026-12-19','planVersion':'synthetic-ui-v1','revision':1},'days':days}

def records(subject,template):
    r={k:{} for k in ('done','notDone','notes','wrong','questionIds','actualMinutes','actualWritingMinutes','actualReviewMinutes','moved','edits','archive','skipped','removed')}
    r.update(added=[],settings={'vocab':35,'budget':130} if subject=='english' else {},questions={},version=1)
    for day in template['days']:
        age=(TODAY-date.fromisoformat(day['date'])).days
        if 0<=age<=6:
            item=day['items'][0]['id'];r['done'][item]=True;r['wrong'][item]=1
            r['actualMinutes'][item]=32;r['actualWritingMinutes'][item]=22;r['actualReviewMinutes'][item]=10
            r['notes'][item]='示例记录：留意关键词。';r['questionIds'][item]='2'
            if age==0:r['notDone'][day['items'][1]['id']]=True
    return r

@contextmanager
def fixture():
    with tempfile.TemporaryDirectory(prefix='banya-visual-') as directory:
        folder=Path(directory);plans={s:templates(s) for s in ('english','politics')};raw={s:records(s,plans[s]) for s in plans};calls=[]
        for s,name in [('english','plan.json'),('politics','politics-plan.json')]: (folder/name).write_text(json.dumps(plans[s]))
        def provider(config,payload):
            calls.append(payload);context=json.loads(payload['messages'][1]['content']);subject=context['subject']
            task=subject+'-'+(TODAY+timedelta(days=1)).isoformat()+'-main'
            patch=[{'operation':'update','taskId':task,'minutes':19}]
            if 'detection' in context:
                result=suggestion(context,patch);result.update(summary='保留大部分安排，只微调一项未来练习。',recommendations=['先用真实记录校准用时，再逐步调整。'],uncertainties=['任务日期不代表实际学习日期。'])
                result['findings'][0]['text']='示例记录中的实际用时高于预计，值得核对。'
                for reason in result['reasons']:reason['reason']='根据已记录用时做小幅调整，保留其余任务。'
            else:result={'reply':'可以先保留主要训练，只小幅调整未来一项。以下是示例建议，尚未执行。','changes':patch}
            return {'id':'synthetic-visual-request','usage':{'total_tokens':90},'choices':[{'finish_reason':'stop','message':{'content':json.dumps(result),'reasoning_content':'SYNTHETIC_NOT_FOR_STORAGE'}}]}
        app=create_app(db_path=folder/'sync.sqlite3',token_sha256=hashlib.sha256(OWNER.encode()).hexdigest(),template_dir=folder,
          ai_config=AIConfig(enabled=True,api_key='synthetic-provider-'+'x'*32,monthly_budget_nano=19_000_000_000,monthly_calls=None,currency='CNY',input_nano_per_token=2000,output_nano_per_token=8000,owner_approval_required=True,approval_stamp='synthetic-visual'),ai_provider=provider,auto_enabled=True,auto_worker=False)
        with TestClient(app) as client:
            for subject in plans:
                assert client.put('/v1/snapshot/'+subject,headers=OWNER_AUTH,json={'expectedRevision':0,'state':{'schema':'banya.sync.v1','subject':subject,'templateVersion':'synthetic-ui-v1','record':raw[subject]}}).status_code==200
                assert save(client,[entry('budget','budget',text='示例：每日时间根据实际情况调整',value={'text':'示例可用时间','minutes':87 if subject=='english' else 67}),entry('brief','preference',text='示例偏好：简短复盘，不堆积任务'),entry('course','constraint',value={'text':'示例课程限制','rule':'course_limit','minutes':26})],subject=subject).status_code==200
            class Handler(SimpleHTTPRequestHandler):
                def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
                def log_message(self,*_):pass
                def handle(self):
                    try:super().handle()
                    except (BrokenPipeError,ConnectionResetError):pass
                def do_GET(self):
                    path=urlsplit(self.path).path
                    sub='english' if path in ('/plan-data.js','/plan.json') else 'politics' if path in ('/politics-plan-data.js','/politics-plan.json') else None
                    if sub:
                        body=json.dumps(plans[sub],ensure_ascii=False)
                        if path.endswith('.js'):body='window.'+('STUDY_PLAN' if sub=='english' else 'POLITICS_PLAN')+'='+body+';'
                        self.send_response(200);self.send_header('Content-Type','application/javascript' if path.endswith('.js') else 'application/json');self.end_headers();self.wfile.write(body.encode());return
                    super().do_GET()
            server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
            try:yield client,app,raw,calls,'http://localhost:'+str(server.server_port)+'/'
            finally:server.shutdown();server.server_close()

def run(output,executable):
    output.mkdir(parents=True,exist_ok=True);shots=[];cases=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(**({'executable_path':executable} if executable else {}),headless=True,args=['--no-sandbox'])
        for width,height in [(360,800),(390,844),(412,915)]:
            for subject in ('english','politics'):
                print(f'Checking {width}x{height} {subject}',flush=True)
                with fixture() as (client,app,raw,calls,base):
                    context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,is_mobile=True,has_touch=True,reduced_motion='reduce')
                    page=context.new_page();page.set_default_timeout(10000);errors=[];page.on('pageerror',lambda error:errors.append(str(error)));page.on('dialog',lambda d:d.accept())
                    def api(source,path,method,body):
                        r=client.request(method,'/v1/ai/'+path,headers=OWNER_AUTH,**({'json':body} if body is not None else {}))
                        return {'ok':r.status_code<300,'body':r.json()}
                    def revision(source,s):return client.get('/v1/snapshot/'+s,headers=PROTO).json()['revision']
                    page.expose_binding('syntheticApi',api);page.expose_binding('syntheticRevision',revision)
                    page.add_init_script("""(raw=>{if(!sessionStorage.getItem('synthetic-seeded')){for(const [s,k] of [['english','yantu_english_2026_m1'],['politics','yantu_politics_2026_v1']])localStorage.setItem(k,JSON.stringify(raw[s]));sessionStorage.setItem('synthetic-seeded','1');}})("""+json.dumps(raw)+');')
                    page.goto(base);page.wait_for_selector('.student-task');
                    def bridge():
                        page.evaluate("""()=>{BanyaCloudSync.isConnected=()=>true;BanyaCloudSync.assistantRequest=async(path,method='GET',body)=>{const r=await syntheticApi(path,method,body??null);if(!r.ok){const e=Error('合成环境安全拒绝');e.code=r.body.detail?.code;throw e;}return r.body;};BanyaCloudSync.prepareAssistant=async s=>({revision:await syntheticRevision(s)});BanyaCloudSync.syncAll=async()=>true;}""")
                    bridge();page.locator('[data-action="switch-subject"][data-subject="'+subject+'"]').click()
                    def shot(name):
                        page.wait_for_timeout(100)
                        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,subject,name,'page overflow')
                        assert page.locator('#modal').evaluate("x=>x.classList.contains('hidden')||x.querySelector('.modal-card').scrollWidth<=x.querySelector('.modal-card').clientWidth+1"),(width,subject,name,'sheet overflow')
                        path=f'{width}-{subject}-{name}.png';page.screenshot(path=str(output/path),full_page=False);shots.append((width,height,subject,name,path))
                    def tab(view):page.locator('.nav-tab[data-view="'+view+'"]').click()
                    def dismiss():
                        if page.locator('#modal:not(.hidden)').count():page.keyboard.press('Escape');page.wait_for_timeout(100)
                    shot('today');n=page.evaluate('history.length');tab('today');tab('today');assert page.evaluate('history.length')==n
                    tab('calendar');next_month='next-month' if subject=='english' else 'p-cal-next';page.locator('[data-action="'+next_month+'"]').click();month=page.locator('.month-head h2').inner_text()
                    tab('stats');page.go_back();page.wait_for_selector('.month-head h2');assert page.locator('.month-head h2').inner_text()==month
                    page.reload();page.wait_for_selector('.month-head h2');bridge();assert page.locator('.month-head h2').inner_text()==month
                    shot('calendar')
                    day=page.locator('[data-action="cal-day"]:not([disabled]),[data-action="p-day"]:not([disabled])').first;day.click();page.wait_for_selector('.day-detail-head');shot('date-detail')
                    page.locator('.student-task-body').first.click();shot('task-detail');page.go_back();page.wait_for_selector('#modal.hidden',state='attached')
                    page.go_back();page.wait_for_selector('.calendar');assert page.locator('.month-head h2').inner_text()==month
                    # Actual record editor retains totals and split times without changing plan.
                    tab('today');page.locator('.student-task-body').first.click();assert page.locator('#task-actual-minutes' if subject=='english' else '#p-actual-minutes').input_value()=='32';dismiss()
                    tab('stats');shot('stats');tab('assistant');page.wait_for_function("document.getElementById('ai-home-status').textContent.includes('未启用')");assert not calls;shot('assistant')
                    nav_top=page.locator('.bottom-nav,nav').last.bounding_box()['y']
                    assert page.locator('.assistant-shortcuts').bounding_box()['y']+page.locator('.assistant-shortcuts').bounding_box()['height']<=nav_top
                    # Owner activation itself does not invoke the fake or real model.
                    assert client.post('/v1/ai/activation',headers=OWNER_AUTH,json={'expectedRevision':0,'enabled':True,'currency':'CNY','confirmation':'set_ai_activation'}).status_code==200
                    page.locator('[data-ai-action="plan"][data-ai-mode="week"]').click();page.wait_for_selector('#ai-send:not([disabled])');shot('ai-conversation')
                    page.locator('#ai-prompt').fill('请结合示例记录，局部调整下周安排。');page.locator('#ai-consent').check();page.locator('#ai-send').click();page.wait_for_selector('.ai-change');assert len(calls)==1;assert not page.locator('#ai-commit').count();shot('planning-preview');dismiss()
                    # Start with unknown time in a real isolated profile; never infer a private budget.
                    prof=client.get('/v1/ai/profiles/'+subject,headers=OWNER_AUTH).json()
                    old=next(e for e in prof['entries'] if e['category']=='budget');deactivated={k:v for k,v in old.items() if k not in ('confirmedAt','entryRevision')};deactivated['active']=False
                    assert client.post('/v1/ai/profiles/'+subject,headers=OWNER_AUTH,json={'schemaVersion':1,'requestId':'synthetic-deactivate-budget','expectedRevision':prof['revision'],'entries':[deactivated],'confirmation':'save_profile'}).status_code==200
                    snapshots_before={s:client.get('/v1/snapshot/'+s,headers=PROTO).json() for s in ('english','politics')}
                    page.locator('[data-auto-action="open"]').first.click();page.wait_for_selector('#auto-save');assert page.locator('#auto-save').is_disabled();shot('setup-missing-time')
                    assert not client.get('/v1/ai/auto/status',headers=OWNER_AUTH).json()['control']['enabled']
                    page.locator('[data-auto-action="time"]').click();page.wait_for_selector('#memory-daily');assert page.locator('#memory-daily').input_value()==''
                    page.locator('#memory-daily').fill('88' if subject=='english' else '68');assert page.locator('#memory-next').is_disabled();page.locator('#memory-time-save').click();page.wait_for_function("document.getElementById('memory-state').textContent.includes('已保存')");assert len(calls)==1
                    assert snapshots_before=={s:client.get('/v1/snapshot/'+s,headers=PROTO).json() for s in ('english','politics')}
                    shot('setup-time-saved');page.locator('#memory-next').click();page.wait_for_selector('#auto-save');assert not page.locator('#auto-consent').is_checked();shot('auto-permission')
                    page.locator('#modal').dispatch_event('click');page.wait_for_timeout(100);page.locator('[data-auto-action="open"]').first.click();page.wait_for_selector('#auto-save')
                    page.locator('#auto-form details summary').click();page.locator('#auto-budget').fill('1');page.locator('#auto-consent').check();page.locator('#auto-max').fill('2');assert not page.locator('#auto-consent').is_checked();assert page.locator('#auto-save').is_disabled();assert '最多 2 项' in page.locator('#auto-scope').inner_text();page.locator('#auto-consent').check();page.locator('#auto-save').click();page.wait_for_function("document.getElementById('auto-state').textContent.includes('已开启。新的学习记录')")
                    assert client.get('/v1/ai/auto/status',headers=OWNER_AUTH).json()['control']['enabled'];assert len(calls)==1
                    page.locator('[data-auto-action="check"]').click();page.wait_for_function("document.getElementById('auto-state').textContent.includes('已提交检查')")
                    assert app.state.autonomy.process_one()=='applied';assert len(calls)==2;dismiss()
                    page.locator('[data-auto-action="open"][data-history="true"]').click();page.wait_for_selector('[data-auto-action="undo"]');assert '调整前' in page.locator('#auto-runs').inner_text() and '调整后' in page.locator('#auto-runs').inner_text();shot('auto-history')
                    page.locator('[data-auto-action="undo"]').first.click();page.wait_for_function("document.getElementById('auto-state').textContent==='已撤销并同步，自动管理已暂停。'");assert not next(g for g in client.get('/v1/ai/auto/status',headers=OWNER_AUTH).json()['grants'] if g['subject']==subject)['enabled'];dismiss()
                    page.locator('[data-memory-action="open"]').click();page.wait_for_selector('#memory-daily');shot('learning-profile');assert page.locator('#memory-time-save').is_visible();assert page.locator('.setup-sheet').evaluate("e=>getComputedStyle(e).overflowY==='auto'");page.locator('#memory-more summary').first.click();page.locator('#memory-new').click();page.locator('#memory-save').scroll_into_view_if_needed();assert page.locator('#memory-save').is_visible();shot('profile-optional');assert page.locator('.setup-sheet').evaluate('e=>e.scrollTop>0');dismiss();page.locator('[data-diagnosis-action="open"]').click();page.wait_for_selector('#diagnosis-output');shot('free-diagnosis');page.locator('#diagnosis-discuss').locator('..').evaluate('e=>e.open=true');page.locator('#diagnosis-discuss').scroll_into_view_if_needed();assert page.locator('#diagnosis-discuss').is_visible();dismiss()
                    # Assistant UX: input-only shortcuts, isolated in-memory drafts and compact-height layout.
                    tab('assistant');page.locator('[data-ai-action="open"]').click();page.wait_for_selector('#ai-send:not([disabled])')
                    assert not page.locator('#ai-query').is_visible()
                    page.locator('[data-ai-action="suggest"]').first.click();draft=page.locator('#ai-prompt').input_value();assert draft
                    assert len(calls)==2;page.go_back();page.wait_for_selector('#modal.hidden',state='attached');assert page.locator('.nav-tab[aria-current="page"]').get_attribute('data-view')=='assistant';page.locator('[data-ai-action="open"]').click();page.wait_for_selector('#ai-send:not([disabled])')
                    assert page.locator('#ai-prompt').input_value()==draft and not page.locator('#ai-consent').is_checked()
                    other='politics' if subject=='english' else 'english';page.locator('#ai-options summary').click();page.locator('#ai-subject').select_option(other);assert page.locator('#ai-prompt').input_value()==''
                    page.locator('#ai-prompt').fill('另一科的合成草稿');page.locator('#ai-subject').select_option(subject);assert page.locator('#ai-prompt').input_value()==draft
                    page.locator('[data-ai-action="mode"][data-ai-mode="day"]').click();assert page.locator('#ai-options').evaluate('e=>e.open')
                    assert '日计划' in page.locator('#ai-scope-label').inner_text();page.locator('#ai-available').fill('42')
                    page.locator('[data-ai-action="mode"][data-ai-mode="discussion"]').click()
                    page.set_viewport_size({'width':width,'height':480});page.locator('#ai-prompt').focus()
                    send_box=page.locator('#ai-send').bounding_box();assert send_box['y']>=0 and send_box['y']+send_box['height']<=480
                    page.set_viewport_size({'width':width,'height':height})
                    # Display-only CNY fixture; failures/receipt lookup never reach a paid provider.
                    page.evaluate("""()=>{const previous=BanyaCloudSync.assistantRequest;BanyaCloudSync.assistantRequest=async(path,method='GET',body)=>{if(path==='status')return {...await previous(path,method,body),currency:'CNY',monthlyBudget:50,monthlyCallLimit:null,estimatedReserved:0.1};if(path==='chat')return {status:'unknown',requestId:body.requestId,changes:[]};if(path.startsWith('requests/'))return {requestId:path.slice(9),status:'discussion',previewOnly:true,reply:'合成结果已核对，没有修改计划。',changes:[]};return previous(path,method,body);};}""")
                    dismiss();page.locator('[data-ai-action="open"]').click();page.wait_for_selector('#ai-send:not([disabled])');page.locator('[data-ai-action="fees"]').click()
                    assert '¥50' in page.locator('#ai-budget').inner_text() and '不设月调用次数上限' in page.locator('#ai-budget').inner_text();shot('assistant-fees');assert page.locator('.ai-cost-body').bounding_box()['y']+page.locator('.ai-cost-body').bounding_box()['height']<=page.locator('.ai-composer').bounding_box()['y']+1;page.locator('#ai-prompt').focus();assert not page.locator('.ai-cost').evaluate('e=>e.open')
                    page.locator('#ai-consent').check();page.locator('#ai-send').click();page.wait_for_selector('#ai-query:not([hidden])');assert page.locator('#ai-send').is_disabled();shot('assistant-unconfirmed')
                    page.locator('#ai-query').click();page.wait_for_selector('#ai-send:not([disabled])');assert not page.locator('#ai-query').is_visible();assert len(calls)==2
                    # A completed failure is not an indefinitely pending receipt and is not model dialogue.
                    page.evaluate("""()=>{const previous=BanyaCloudSync.assistantRequest;BanyaCloudSync.assistantRequest=(path,method,body)=>path==='chat'?Promise.resolve({requestId:body.requestId,status:'unknown',terminal:true,errorCode:'provider_timeout',reply:'合成的旧失败说明'}):previous(path,method,body);}""")
                    page.locator('#ai-prompt').fill('合成：失败后保留原问题');page.locator('#ai-consent').check();page.locator('#ai-send').click();page.wait_for_selector('.ai-recovery');assert not page.locator('#ai-send').is_disabled();assert not page.locator('#ai-consent').is_checked();assert not page.locator('#ai-query').is_visible();assert page.locator('#ai-prompt').input_value()=='合成：失败后保留原问题';assert '合成的旧失败说明' not in page.locator('#ai-messages').inner_text();shot('assistant-terminal-failure');assert len(calls)==2
                    page.emulate_media(reduced_motion='reduce');assert page.locator('.ai-workspace').evaluate('e=>getComputedStyle(e).scrollBehavior')=='auto';page.emulate_media(reduced_motion='no-preference');dismiss()
                    tab('settings');shot('settings')
                    # Offline cache is checked with actual Service Worker, not intercepted app assets.
                    page.evaluate('Promise.race([navigator.serviceWorker.ready,new Promise((_,r)=>setTimeout(()=>r(Error("SW timeout")),8000))])');page.reload();page.wait_for_selector('.setting-section');context.set_offline(True);page.reload();page.wait_for_selector('.setting-section');context.set_offline(False)
                    assert not errors,errors
                    cases.append(f'{width}x{height} {subject}: navigation, modal reopen, planning preview, guided time/one-confirmation auto/check/undo, scrollable profile/diagnosis, drafts/modes/CNY/480px/unknown-recovery/reduced-motion, offline PASS; injected calls=2, real paid calls=0')
                    context.close()
        browser.close()
    revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    scenario_count=len(cases)
    cases.insert(0,'Source revision: '+revision+'; all data synthetic; no paid requests')
    rows=''.join(f'<section><h2>{w}×{h} · {s} · {name}</h2><a href="{path}"><img loading="lazy" src="{path}" width="{w}" alt="{s} {name}"></a></section>' for w,h,s,name,path in shots)
    report='<!doctype html><meta charset="utf-8"><title>板牙考研 M7.4 合成视觉验收</title><style>body{font:14px system-ui;background:#f4f5f7;color:#263348;margin:24px}main{display:flex;flex-wrap:wrap;gap:24px}section{max-width:420px}h2{font-size:15px}img{max-width:100%;border:1px solid #ddd}</style><h1>M7.4 合成数据截图</h1><p>浏览器模拟；不是 Android 真机或生产验收。所有记录和模型响应均为合成，不包含用户资料或密钥。</p><p>'+str(len(shots))+' screenshots; '+str(scenario_count)+' scenarios passed; zero paid API calls.</p><main>'+rows+'</main>'
    (output/'index.html').write_text(report);(output/'report.txt').write_text('\n'.join(cases)+'\n')
    print(f'PASS {len(shots)} screenshots, {scenario_count} dual-subject/viewport scenarios, zero paid API calls')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=Path('/tmp/banya-m74-visual'));parser.add_argument('--chromium',default=os.environ.get('BANYA_CHROMIUM'));args=parser.parse_args();run(args.output,args.chromium)
