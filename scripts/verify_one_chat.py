"""One separately authorized paid check, through normal app budget and owner gates.
No activation/grant/plan write route. No retries. No private reply text in logs.
"""
import json,os,uuid
import urllib.request,urllib.error
from datetime import datetime,timezone

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None

def api(path,body=None):
    assert (path in ('status','auto/status') and body is None) or (path in ('snapshot/english','snapshot/politics') and body is None) or (path=='chat' and body is not None)
    namespace='/v1/' if path.startswith('snapshot/') else '/v1/ai/'
    request=urllib.request.Request('https://124.70.128.201'+namespace+path,headers={'Authorization':'Bearer '+os.environ['BANYA_OWNER_TOKEN'],'Content-Type':'application/json','X-Banya-Plan-Protocol':'1'},data=None if body is None else json.dumps(body).encode())
    with urllib.request.build_opener(NoRedirect()).open(request,timeout=115) as response:return json.load(response)

def verify(client=api):
    status=client('status');assert status['ready'] and status['currency']=='CNY' and 0<status['monthlyBudget']<=50
    before={s:client('snapshot/'+s) for s in ('english','politics')};auto=client('auto/status')
    subject=next((s for s in before if before[s]['revision']>0),None);assert subject,'Phone first sync required'
    today=datetime.now(timezone.utc).date().isoformat()
    result=client('chat',{'requestId':'readonly-check-'+uuid.uuid4().hex,'subject':subject,'start':today,'end':today,'expectedRevision':before[subject]['revision'],'shareReview':False,'consent':True,'messages':[{'role':'user','content':'请用一句简短中文回答连接是否正常，不复述私人细节，不提出任务修改，changes 必须为空。'}]})
    report={'status':result['status'],'errorCode':result.get('errorCode'),'terminal':result.get('terminal'),'usage':result.get('usage'),'newPlanWrite':False}
    assert before=={s:client('snapshot/'+s) for s in before},'Concurrent learning update; never restore snapshots'
    current=client('auto/status');assert auto['control']==current['control'] and auto['grants']==current['grants'],'Concurrent authorization change; never restore grants'
    print(json.dumps(report,ensure_ascii=False))
    assert result['status']=='discussion' and not result.get('changes') and result.get('usage',{}).get('total_tokens',0)>0,'Paid check ended without valid reply; no retry'

if __name__=='__main__':
    try:verify()
    except Exception:raise SystemExit('Single chat check stopped; no automatic retry, configuration change or plan commit.') from None
