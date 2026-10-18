"""Synthetic automation only, fake thinking, no paid or production requests."""
import copy,hashlib,json,sqlite3
from datetime import date,timedelta
import pytest
from fastapi.testclient import TestClient
from app import create_app,open_db
from deepseek_ai import AIConfig,ProviderFailure
from autonomous import initialize_auto
from test_agent_api import OWNER,OWNER_AUTH,PROTO,document
from test_learning_memory import entry,save,snapshot_rows
from test_learning_planner import synthetic_template,suggestion,TARGET,TODAY

@pytest.fixture
def auto(tmp_path):
    for subject,name in [('english','plan.json'),('politics','politics-plan.json')]:
        (tmp_path/name).write_text(json.dumps(synthetic_template(subject)))
    calls=[];response={'value':None,'during':None}
    def provider(config,payload):
        calls.append(payload)
        if response['during']:response['during']()
        if response['value']=='timeout':raise ProviderFailure()
        context=json.loads(payload['messages'][1]['content']);subject=context['subject']
        patch=[{'operation':'update','taskId':'synthetic-14-'+('reading' if subject=='english' else 'course'),'minutes':22 if subject=='english' else 26}]
        result=response['value'] if isinstance(response['value'],dict) else suggestion(context,patch)
        return {'id':'synthetic-provider-id','usage':{'total_tokens':90},'choices':[{'finish_reason':'stop','message':{'content':json.dumps(result),'reasoning_content':'DO NOT STORE synthetic thinking'}}]}
    db=tmp_path/'db';config=AIConfig(enabled=True,api_key='synthetic-provider-'+'x'*32,monthly_budget_nano=2_000_000_000,monthly_calls=40)
    app=create_app(db_path=db,token_sha256=hashlib.sha256(OWNER.encode()).hexdigest(),template_dir=tmp_path,ai_config=config,ai_provider=provider,auto_enabled=True,auto_worker=False)
    with TestClient(app) as c:
        for subject in ('english','politics'):
            doc=document(subject);doc['templateVersion']='synthetic-analysis-v1';doc['record']['actualMinutes']['synthetic-13-'+('reading' if subject=='english' else 'course')]=70
            c.put('/v1/snapshot/'+subject,headers=OWNER_AUTH,json={'expectedRevision':0,'state':doc})
            assert save(c,[entry('budget','budget',value={'text':'Synthetic available time','minutes':38 if subject=='english' else 62}),entry('course','constraint',value={'text':'Synthetic course bound','rule':'course_limit','minutes':27})],subject=subject).status_code==200
        yield c,app.state.autonomy,db,calls,response,tmp_path


def grant(c,subject='english',**extra):
    body={'expectedRevision':0,'enabled':True,'start':TARGET,'end':(TODAY+timedelta(days=7)).isoformat(),'types':['阅读'] if subject=='english' else ['课程'],
          'monthlyBudgetCents':100,'dataConsent':True,'confirmation':'save_auto_permission',**extra}
    return c.post('/v1/ai/auto/grants/'+subject,headers=OWNER_AUTH,json=body)

def enable(c):
    return c.post('/v1/ai/auto/control',headers=OWNER_AUTH,json={'expectedRevision':0,'enabled':True,'confirmation':'set_auto_control'})

def enqueue(c,subject='english',revision=1):
    return c.post('/v1/ai/auto/enqueue',headers=OWNER_AUTH,json={'subject':subject,'expectedRevision':revision})

def latest(c):return c.get('/v1/ai/auto/status',headers=OWNER_AUTH).json()['runs'][0]


def test_default_off_and_authentication(auto):
    c,svc,db,calls,_,_=auto
    assert c.get('/v1/ai/auto/status').status_code==401
    for route in ('control','grants/english','enqueue','runs/invalid/undo'):
        assert c.post('/v1/ai/auto/'+route,json={}).status_code==401
    assert not c.get('/v1/ai/auto/status',headers=OWNER_AUTH).json()['control']['enabled']
    enqueue(c);assert svc.process_one() is None and not calls
    assert grant(c,enabled=True,dataConsent=False).status_code==422
    assert grant(c,start=TODAY.isoformat()).status_code==422


@pytest.mark.parametrize('subject',['english','politics'])
def test_complete_auto_backup_delivery_and_safe_undo(auto,subject):
    c,svc,db,calls,_,_=auto;before=snapshot_rows(db)
    assert grant(c,subject).status_code==200;enable(c);enqueue(c,subject)
    assert svc.process_one()=='applied' and len(calls)==1
    run=latest(c);assert run['status']=='applied'
    with sqlite3.connect(db) as con:
        row=con.execute('SELECT * FROM snapshots WHERE subject=?',(subject,)).fetchone();old=next(r for r in before[0] if r[0]==subject)
        fresh=json.loads(row[2]);original=json.loads(old[2])
        for field in ('done','notDone','wrong','notes','actualMinutes','actualWritingMinutes','actualReviewMinutes','questionIds'):assert fresh['record'][field]==original['record'][field]
        assert con.execute('SELECT count(*) FROM agent_backups').fetchone()[0]==1
        assert 'DO NOT STORE' not in con.execute('SELECT result_json FROM auto_runs').fetchone()[0]
    undo=c.post('/v1/ai/auto/runs/'+run['id']+'/undo',headers=OWNER_AUTH,json={'expectedRevision':2,'confirmation':'undo_plan'})
    assert undo.status_code==200 and undo.json()['revision']==3
    assert c.post('/v1/ai/auto/runs/'+run['id']+'/undo',headers=OWNER_AUTH,json={'expectedRevision':2,'confirmation':'undo_plan'}).json()=={'status':'undone','revision':3}
    with sqlite3.connect(db) as con:assert json.loads(con.execute('SELECT state_json FROM snapshots WHERE subject=?',(subject,)).fetchone()[0])==original
    assert not c.get('/v1/ai/auto/status',headers=OWNER_AUTH).json()['grants'][0]['enabled']


def test_undo_refuses_new_phone_record_and_offline_cas_is_preserved(auto):
    c,svc,db,_,_,_=auto;grant(c);enable(c);enqueue(c);assert svc.process_one()=='applied';run=latest(c)
    old=c.get('/v1/snapshot/english',headers=PROTO).json()['state']
    assert c.put('/v1/snapshot/english',headers=PROTO,json={'expectedRevision':1,'state':old}).status_code==409
    old['record']['notes']['synthetic-14-reading']='Synthetic newly saved note'
    assert c.put('/v1/snapshot/english',headers=PROTO,json={'expectedRevision':2,'state':old}).status_code==200
    assert c.post('/v1/ai/auto/runs/'+run['id']+'/undo',headers=OWNER_AUTH,json={'expectedRevision':3,'confirmation':'undo_plan'}).status_code==409
    assert c.get('/v1/snapshot/english',headers=PROTO).json()['state']['record']['notes']['synthetic-14-reading']=='Synthetic newly saved note'


def test_dedup_cooldown_and_no_loop_from_plan_overlay(auto):
    c,svc,db,calls,_,_=auto;grant(c);enable(c);enqueue(c);enqueue(c);assert svc.process_one()=='applied'
    fresh=c.get('/v1/snapshot/english',headers=PROTO).json()['state']
    assert c.put('/v1/snapshot/english',headers=PROTO,json={'expectedRevision':2,'state':fresh}).status_code==200
    with sqlite3.connect(db) as con:assert con.execute("SELECT count(*) FROM auto_events WHERE status='queued'").fetchone()[0]==0
    enqueue(c,revision=3);assert svc.process_one()=='cooldown' and len(calls)==1


@pytest.mark.parametrize('kind',['grant','profile','snapshot','template'])
def test_changes_during_model_stop_execution(auto,kind):
    c,svc,db,calls,response,root=auto;grant(c);enable(c);enqueue(c);before=snapshot_rows(db)
    def change():
        if kind=='grant':grant(c,expectedRevision=1,enabled=False)
        elif kind=='profile':save(c,[entry('new-rule')],1,'synthetic-new-rule')
        elif kind=='template':(root/'plan.json').write_text((root/'plan.json').read_text()+' ')
        else:
            doc=c.get('/v1/snapshot/english',headers=PROTO).json()['state'];doc['record']['notes']['new']='Synthetic concurrent phone note'
            c.put('/v1/snapshot/english',headers=PROTO,json={'expectedRevision':1,'state':doc})
    response['during']=change;assert svc.process_one()!='applied'
    with sqlite3.connect(db) as con:assert con.execute('SELECT count(*) FROM agent_backups').fetchone()[0]==0
    if kind!='snapshot':assert snapshot_rows(db)[0]==before[0]


def test_budget_timeout_recovery_and_no_duplicate_charge(auto):
    c,svc,db,calls,response,_=auto;grant(c,monthlyBudgetCents=1);enable(c);enqueue(c)
    assert svc.process_one()=='budget_exhausted' and not calls
    grant(c,expectedRevision=1,monthlyBudgetCents=100);response['value']='timeout'
    assert svc.process_one()=='automatic_result_unknown';assert len(calls)==1
    assert svc.process_one() is None
    with sqlite3.connect(db) as con:
        assert con.execute('SELECT sum(cost_nano) FROM ai_requests').fetchone()[0]>0
        con.execute("UPDATE auto_runs SET status='pending'")
    svc.recover();svc.recover();assert latest(c)['status']=='unknown' and not c.get('/v1/ai/auto/status',headers=OWNER_AUTH).json()['grants'][0]['enabled']
    assert len(calls)==1


def test_database_backup_failure_rolls_back_and_pauses(auto):
    c,svc,db,_,_,_=auto;grant(c);enable(c);enqueue(c);before=snapshot_rows(db)
    with sqlite3.connect(db) as con:con.execute("CREATE TRIGGER synthetic_backup_fail BEFORE INSERT ON agent_backups BEGIN SELECT RAISE(ABORT,'synthetic'); END")
    assert svc.process_one()=='automatic_result_unknown' and snapshot_rows(db)==before
    assert not c.get('/v1/ai/auto/status',headers=OWNER_AUTH).json()['grants'][0]['enabled']


def test_forbidden_fields_completed_and_types_are_protected(auto):
    c,svc,db,_,response,_=auto;grant(c,fields=['title']);enable(c);enqueue(c);before=snapshot_rows(db)
    assert svc.process_one()=='automatic_field_forbidden' and snapshot_rows(db)==before


def test_sync_enqueues_only_learning_changes_and_server_flag_is_off_by_default(auto):
    c,svc,db,calls,_,_=auto;grant(c);enable(c)
    doc=c.get('/v1/snapshot/english',headers=PROTO).json()['state'];doc['record']['notes']['synthetic-13-reading']='Synthetic new review'
    assert c.put('/v1/snapshot/english',headers=PROTO,json={'expectedRevision':1,'state':doc}).status_code==200
    with sqlite3.connect(db) as con:assert con.execute("SELECT count(*) FROM auto_events WHERE status='queued'").fetchone()[0]==1
    svc.enabled=False;assert svc.process_one() is None and not calls


def test_permission_expiry_global_disable_and_monthly_limit_stop_without_call(auto):
    c,svc,db,calls,_,_=auto;grant(c,monthlyCalls=1);enable(c);enqueue(c);assert svc.process_one()=='applied'
    enqueue(c,revision=2);svc.clock=lambda:__import__('time').time()+13*3600
    assert svc.process_one()=='call_limit' and len(calls)==1
    c.post('/v1/ai/auto/control',headers=OWNER_AUTH,json={'expectedRevision':1,'enabled':False,'confirmation':'set_auto_control'})
    assert svc.process_one() is None


def test_auto_upgrade_tables_are_empty_and_preserved(auto):
    from upgrade_guard import create_verified_backup,verify_preserved
    c,svc,db,_,_,root=auto;grant(c);enable(c);enqueue(c);svc.process_one()
    saved=create_verified_backup(db,root/'backups');initialize_auto(db);verify_preserved(db,saved)


def test_owner_ai_pause_during_automatic_call_stops_before_write(auto):
    from dataclasses import replace
    c,service,db,calls,response,_=auto
    service.config=replace(service.config,owner_approval_required=True,approval_stamp='synthetic-config')
    assert c.post('/v1/ai/activation',headers=OWNER_AUTH,json={'expectedRevision':0,'enabled':True,'confirmation':'set_ai_activation'}).status_code==200
    # The app config uses a test stamp ''; pin the service to that same config.
    service.config=replace(service.config,approval_stamp='')
    enable(c);grant(c);enqueue(c)
    before=snapshot_rows(db)
    def pause():
        with sqlite3.connect(db) as con:con.execute('UPDATE ai_activation SET enabled=0,revision=revision+1')
    response['during']=pause
    assert service.process_one()=='ai_activation_changed'
    assert snapshot_rows(db)==before and len(calls)==1
