"""Synthetic dual-subject learning data and fake thinking provider only."""
import copy
import hashlib
import json
import sqlite3
from datetime import date,timedelta

import pytest
from fastapi.testclient import TestClient
from app import create_app,open_db
from deepseek_ai import AIConfig
from learning_analysis import AnalysisRequest,analyze
from learning_planner import PlanningRequest,PlanningSuggestion,prepare,validate_suggestion
from private_plan import PlanError
from test_agent_api import OWNER,OWNER_AUTH,PROTO,document
from test_learning_memory import entry,save,snapshot_rows

TODAY=date.today();TARGET=(TODAY+timedelta(days=1)).isoformat()


def synthetic_template(subject):
    days=[]
    for n in range(-13,11):
        day=(TODAY+timedelta(days=n)).isoformat();prefix=f'synthetic-{n+13}'
        if subject=='english':items=[{'id':prefix+'-reading','title':'Synthetic reading practice','type':'阅读','minutes':18,'questionCount':5,'detail':'Synthetic instructions'},
                                     {'id':prefix+'-vocab','title':'Synthetic vocabulary','type':'单词','minutes':37,'detail':''}]
        else:items=[{'id':prefix+'-course','title':'Synthetic course','type':'课程','minutes':35,'detail':''},
                    {'id':prefix+'-questions','title':'Synthetic questions','type':'刷题','minutes':25,'detail':''}]
        days.append({'date':day,'items':items})
    return {'meta':{'planVersion':'synthetic-analysis-v1','start':days[0]['date'],'end':days[-1]['date']},'days':days}


@pytest.fixture
def learning(tmp_path):
    for subject,name in [('english','plan.json'),('politics','politics-plan.json')]:
        (tmp_path/name).write_text(json.dumps(synthetic_template(subject)))
    calls=[];response={'value':None}
    def provider(config,payload):
        calls.append(payload)
        if response['value']=='error':raise ValueError('Synthetic malformed provider')
        body=response['value'] or suggestion(json.loads(payload['messages'][1]['content']))
        return {'choices':[{'finish_reason':'stop','message':{'content':json.dumps(body),'reasoning_content':'Synthetic hidden chain'}}]}
    db=tmp_path/'db'
    with TestClient(create_app(db_path=db,token_sha256=hashlib.sha256(OWNER.encode()).hexdigest(),template_dir=tmp_path,
                              ai_config=AIConfig(enabled=True,api_key='synthetic-provider-'+'x'*32,monthly_budget_nano=1_000_000_000),ai_provider=provider)) as client:
        for subject in ('english','politics'):
            doc=document(subject);doc['templateVersion']='synthetic-analysis-v1'
            doc['record'].update(done={},notDone={},notes={},wrong={},questionIds={},actualMinutes={},actualWritingMinutes={},actualReviewMinutes={})
            for n in range(14):
                key=f'synthetic-{n}-'+('reading' if subject=='english' else 'questions')
                doc['record']['done'][key]=True;doc['record']['actualMinutes'][key]=24
                doc['record']['wrong'][key]=0 if n<7 else 2
            client.put('/v1/snapshot/'+subject,headers=OWNER_AUTH,json={'expectedRevision':0,'state':doc})
            budget=38 if subject=='english' else 62
            facts=[entry('time-budget','budget',value={'text':'Synthetic explicitly available time','minutes':budget}),
                   entry('course-limit','constraint',value={'text':'Synthetic course limit','rule':'course_limit','minutes':27}),
                   entry('goal','goal',value={'text':'Synthetic goal'})]
            assert save(client,facts,subject=subject).status_code==200
        yield client,db,tmp_path,calls,response


def suggestion(context,changes=None):
    src=f"analysis:{context['detection']['fingerprint']}"
    changes=changes or []
    return {'summary':'Synthetic limited learning advice','findings':[{'text':'Synthetic finding based on saved data','sourceRefs':[src]}],
            'evidence':[{'sourceRef':src,'detail':'Synthetic saved evidence'}],'uncertainties':['Actual completion dates are unknown.'],
            'recommendations':['Keep most tasks; adjust only what is necessary.'],'proposedChanges':changes,
            'reasons':[{'taskId':c['taskId'],'reason':'Synthetic local adjustment','sourceRefs':[src]} for c in changes]}


def report(client,subject='english',**extra):
    return client.post('/v1/ai/analysis',headers=OWNER_AUTH,json={'subject':subject,'asOf':TODAY.isoformat(),**extra})


def plan(client,subject='english',mode='day',**extra):
    return client.post('/v1/ai/planning/prepare',headers=OWNER_AUTH,json={'subject':subject,'mode':mode,'targetDate':TARGET,'expectedRevision':1,**extra})


def chat_plan(client,subject='english',mode='day',**extra):
    return client.post('/v1/ai/chat',headers=OWNER_AUTH,json={'subject':subject,'requestId':'synthetic-planning-'+mode,'start':TARGET,'end':(TODAY+timedelta(days=7)).isoformat(),
        'expectedRevision':1,'consent':True,'planningMode':mode,'targetDate':TARGET,'messages':[{'role':'user','content':'Synthetic planning request'}],**extra})


def test_detection_uses_only_saved_records_and_never_calls_model(learning):
    c,db,_,calls,_=learning;before=snapshot_rows(db)
    assert save(c,[entry('old-history','history',text='Synthetic old completion claim',temporal='historical',observedOn='2020-01-01')],1,'synthetic-baseline').status_code==200
    result=report(c).json();assert result['windows']['14']['completed']==14 and result['windows']['7']['completed']==7
    assert result['windows']['7']['completionDates']=='unknown' and result['windows']['7']['examScoreEstimate'] is None
    assert result['future7Days'][0]['vocabularyMinutes']==37 and result['future7Days'][0]['plannedMinutes']==18
    assert all(set(('issueCode','subject','severity','dateRange','evidence','sourceRefs','sampleSize','confidence','recommendedAction','requiresAI'))<=set(i) for i in result['issues'])
    assert not calls and snapshot_rows(db)==before
    assert any(i['issueCode']=='error_rate_increase' for i in result['issues'])


def test_missing_times_and_denominators_never_become_zero_or_accuracy(learning):
    c,db,path,_,_=learning
    with sqlite3.connect(db) as con:
        row=con.execute("SELECT state_json FROM snapshots WHERE subject='english'").fetchone();doc=json.loads(row[0]);doc['record']['actualMinutes']={}
        con.execute("UPDATE snapshots SET state_json=? WHERE subject='english'",(json.dumps(doc),))
    template=json.loads((path/'plan.json').read_text())
    for d in template['days']:
        for t in d['items']:t.pop('questionCount',None)
    (path/'plan.json').write_text(json.dumps(template))
    group=report(c).json()['windows']['14']['distribution']['阅读']
    assert group['actualMinutes'] is None and group['pairedActualMinutes'] is None
    assert group['wrongCount']==14 and group['errorRate'] is None and group['questionTotal'] is None


@pytest.mark.parametrize('budget',[60,62])
def test_politics_budget_is_profile_based_and_course_limit_is_enforced(learning,budget):
    c,db,path,_,_=learning
    assert save(c,[entry('time-budget','budget',value={'text':'Synthetic revised budget','minutes':budget})],1,'synthetic-political-budget',subject='politics').status_code==200
    result=report(c,'politics').json();assert result['policy']['advisoryMinutes']==budget
    assert result['policy']['courseMax']==27
    assert any(i['issueCode']=='course_limit_exceeded' for i in result['issues'])
    prep=plan(c,'politics').json()
    patch=[{'operation':'update','taskId':'synthetic-14-course','minutes':31}]
    model=PlanningSuggestion.model_validate(suggestion(prep['context'],patch))
    with open_db(db) as con,pytest.raises(PlanError,match='course_limit_exceeded'):
        validate_suggestion(con,path,PlanningRequest(subject='politics',mode='day',targetDate=TARGET),prep,model)


def test_unknown_budget_never_falls_back_and_blocks_precise_planning(learning):
    c,db,_,calls,_=learning
    assert save(c,[entry('time-budget','budget',value={'text':'Synthetic withdrawn budget','minutes':38},active=False)],1,'synthetic-withdraw').status_code==200
    result=report(c).json();assert result['policy']['advisoryMinutes'] is None
    assert any(i['issueCode']=='budget_unknown' for i in result['issues'])
    assert chat_plan(c).status_code==409 and not calls
    assert plan(c).json()['context']['dailyNonVocabularyBudgetMinutes'] is None
    assert chat_plan(c,mode='diagnosis').json()['status']=='discussion'


def test_daily_planning_has_preview_but_no_commit_or_record_write(learning):
    c,db,_,calls,response=learning
    prepared=plan(c).json();patch=[{'operation':'update','taskId':'synthetic-14-reading','minutes':22}]
    response['value']=suggestion(prepared['context'],patch);before=snapshot_rows(db)
    result=chat_plan(c).json();assert result['status']=='prepared' and result['previewOnly'] is True
    assert result['changes'][0]['after']['minutes']==22
    assert len(calls)==1 and calls[0]['thinking']=={'type':'enabled'}
    denied=c.post('/v1/ai/proposals/'+result['requestId']+'/commit',headers=OWNER_AUTH,json={'expectedRevision':1,'confirmation':'sync'})
    assert denied.status_code==409 and denied.json()['detail']['code']=='planning_preview_only'
    assert snapshot_rows(db)==before
    with sqlite3.connect(db) as con:assert con.execute('SELECT count(*) FROM agent_backups').fetchone()[0]==0


def test_week_and_diagnosis_can_analyze_without_any_changes(learning):
    c,db,_,calls,_=learning;before=snapshot_rows(db)
    for mode in ('week','diagnosis'):
        prepared=plan(c,mode=mode).json();assert prepared['previewOnly']
        assert len(prepared['analysis']['future7Days'])==7
        assert chat_plan(c,mode=mode).json()['status']=='discussion'
    assert snapshot_rows(db)==before and len(calls)==2
    assert all('Synthetic hidden chain' not in json.dumps(p) for p in calls)


@pytest.mark.parametrize('patch,code',[
    ([{'operation':'update','taskId':'synthetic-14-reading','minutes':59}],'planning_budget_exceeded'),
    ([{'operation':'update','taskId':'synthetic-13-reading','minutes':20}],'completed_or_not_doing_task_is_protected'),
    ([{'operation':'update','taskId':'synthetic-14-reading','minutes':18}],'planning_noop_change'),
    ([{'operation':'add','taskId':'custom-synthetic-duplicate','title':'Synthetic reading practice','type':'阅读','date':TARGET,'minutes':10}],'planning_duplicate_practice'),
])
def test_invalid_or_protected_suggestions_are_rejected_without_writes(learning,patch,code):
    c,db,_,_,response=learning;prepared=plan(c).json();response['value']=suggestion(prepared['context'],patch);before=snapshot_rows(db)
    result=chat_plan(c).json();assert result['status']=='rejected' and result['validationCode']==code
    assert snapshot_rows(db)==before


def test_week_refuses_repeated_mass_carry_and_unknown_sources(learning):
    c,db,path,_,_=learning;prep=plan(c,mode='week').json()
    patches=[{'operation':'update','taskId':f'synthetic-{n}-reading','date':(TODAY+timedelta(days=3)).isoformat(),'minutes':10} for n in (14,15)]
    with open_db(db) as con,pytest.raises(PlanError,match='planning_backlog_dump'):
        validate_suggestion(con,path,PlanningRequest(subject='english',mode='week',targetDate=TARGET),prep,PlanningSuggestion.model_validate(suggestion(prep['context'],patches)))
    bad=suggestion(prep['context']);bad['findings'][0]['sourceRefs']=['not-a-real-source']
    with open_db(db) as con,pytest.raises(PlanError,match='planning_unknown_source'):
        validate_suggestion(con,path,PlanningRequest(subject='english',mode='week',targetDate=TARGET),prep,PlanningSuggestion.model_validate(bad))


def test_versions_unknown_samples_and_subject_isolation(learning):
    c,db,path,calls,_=learning
    first=report(c).json();peer=report(c,'politics').json();prepared=plan(c).json()
    assert all(i['subject']=='english' for i in first['issues']) and '课程' not in first['windows']['14']['distribution']
    assert peer['windows']['14']['distribution']['刷题']['errorRate'] is None
    assert save(c,[entry('time-budget','budget',value={'text':'Synthetic changed availability','minutes':33})],1,'synthetic-new-budget').status_code==200
    assert report(c).json()['fingerprint']!=first['fingerprint'] and report(c,'politics').json()['fingerprint']==peer['fingerprint']
    with open_db(db) as con,pytest.raises(PlanError,match='planning_sources_changed'):
        validate_suggestion(con,path,PlanningRequest(subject='english',mode='day',targetDate=TARGET),prepared,PlanningSuggestion.model_validate(suggestion(prepared['context'])))
    assert not calls


def test_no_automatic_api_calls_and_bad_models_cannot_change_state(learning):
    c,db,_,calls,response=learning;before=snapshot_rows(db)
    assert c.post('/v1/ai/analysis',json={'subject':'english'}).status_code==401
    assert c.post('/v1/ai/planning/prepare',json={}).status_code==401
    report(c);plan(c);c.get('/v1/ai/status',headers=OWNER_AUTH)
    assert not calls
    response['value']='error';assert chat_plan(c).json()['status']=='unknown'
    assert snapshot_rows(db)==before


def test_daily_practice_and_hard_budget_server_validation(learning):
    c,db,path,_,_=learning
    assert save(c,[entry('daily-practice','constraint',value={'text':'Synthetic daily short practice','rule':'daily_practice'}),
                   entry('hard-limit','constraint',value={'text':'Synthetic maximum','rule':'daily_limit','minutes':21})],1,'synthetic-hard-rules').status_code==200
    prepared=plan(c).json();patch=[{'operation':'update','taskId':'synthetic-14-reading','minutes':22}]
    with open_db(db) as con,pytest.raises(PlanError,match='hard_daily_limit_exceeded'):
        validate_suggestion(con,path,PlanningRequest(subject='english',mode='day',targetDate=TARGET),prepared,PlanningSuggestion.model_validate(suggestion(prepared['context'],patch)))


def test_daily_practice_missing_is_a_plan_issue_not_a_missed_study_claim(learning):
    c,db,path,_,_=learning
    assert save(c,[entry('daily-practice','constraint',value={'text':'Synthetic practice requirement','rule':'daily_practice'})],1,'synthetic-practice-rule').status_code==200
    doc=c.get('/v1/snapshot/english',headers=PROTO).json()['state'];doc['record']['notDone']['synthetic-14-reading']=True
    assert c.put('/v1/snapshot/english',headers=PROTO,json={'expectedRevision':1,'state':doc}).status_code==200
    value=report(c).json();issues=[i for i in value['issues'] if i['issueCode']=='daily_practice_missing']
    assert any(i['dateRange']['start']==TARGET for i in issues)
    assert value['windows']['7']['completionDates']=='unknown'
    prep=c.post('/v1/ai/planning/prepare',headers=OWNER_AUTH,json={'subject':'english','mode':'day','targetDate':TARGET,'expectedRevision':2}).json()
    patch=[{'operation':'update','taskId':'synthetic-14-reading','minutes':20}]
    with open_db(db) as con,pytest.raises(PlanError,match='completed_or_not_doing_task_is_protected'):
        validate_suggestion(con,path,PlanningRequest(subject='english',mode='day',targetDate=TARGET),prep,PlanningSuggestion.model_validate(suggestion(prep['context'],patch)))


def test_snapshot_template_changes_and_safe_context_budget(learning):
    c,db,path,_,_=learning
    prep=plan(c).json();model=PlanningSuggestion.model_validate(suggestion(prep['context']))
    template=path/'plan.json';template.write_text(template.read_text()+' ')
    with open_db(db) as con,pytest.raises(PlanError,match='planning_sources_changed'):
        validate_suggestion(con,path,PlanningRequest(subject='english',mode='day',targetDate=TARGET),prep,model)
    template.write_text(template.read_text().rstrip())
    doc=c.get('/v1/snapshot/english',headers=PROTO).json()['state'];doc['record']['notes']['synthetic-14-reading']='Synthetic new offline note'
    assert c.put('/v1/snapshot/english',headers=PROTO,json={'expectedRevision':1,'state':doc}).status_code==200
    assert plan(c).status_code==409
    with open_db(db) as con:
        bounded=prepare(con,path,PlanningRequest(subject='english',mode='day',targetDate=TARGET,expectedRevision=2,maxBytes=16000,messages=[{'role':'user','content':'Synthetic old '*130}]*5+[{'role':'user','content':'Synthetic latest request'}]))
    assert bounded['context']['serverSafety']['automaticPlanChanges'] is False
    assert bounded['context']['conversation'][-1]['content']=='Synthetic latest request'
    assert bounded['context']['truncation']['conversationMessages']>0


def test_model_wrong_data_stays_opt_in_and_temporary_budget_is_not_persisted(learning):
    c,db,_,calls,_=learning
    before=snapshot_rows(db)
    first=plan(c,availableMinutes=25).json();assert first['context']['planning']['availableMinutes']==25
    assert 'wrongCount' not in json.dumps(first['context'])
    with_review=plan(c,shareReview=True).json();assert 'wrongCount' in json.dumps(with_review['context'])
    assert report(c).json()['policy']['advisoryMinutes']==38 and snapshot_rows(db)==before and not calls


def test_expired_and_small_samples_are_flagged_without_mastery_claims(learning):
    c,db,_,_,_=learning
    assert save(c,[entry('old-rule','preference',validUntil='2020-01-01')],1,'synthetic-expired').status_code==200
    doc=c.get('/v1/snapshot/english',headers=PROTO).json()['state']
    doc['record']['wrong']={'synthetic-13-reading':0};doc['record']['actualMinutes']={}
    c.put('/v1/snapshot/english',headers=PROTO,json={'expectedRevision':1,'state':doc})
    result=report(c).json();assert result['windows']['7']['distribution']['阅读']['errorRate'] is None
    assert {'profile_information_expired','time_samples_insufficient'}<={i['issueCode'] for i in result['issues']}


def test_old_diagnosis_receipt_is_invalidated_when_availability_changes(learning):
    c,db,_,_,_=learning
    result=chat_plan(c,mode='diagnosis').json();assert result['status']=='discussion'
    assert save(c,[entry('time-budget','budget',value={'text':'Synthetic newer budget','minutes':34})],1,'synthetic-new-availability').status_code==200
    receipt=c.get('/v1/ai/requests/'+result['requestId'],headers=OWNER_AUTH).json()
    assert receipt['status']=='conflict'


def test_unexplained_uncertainty_and_daily_practice_removal_are_denied(learning):
    c,db,path,_,_=learning
    assert save(c,[entry('daily-practice','constraint',value={'text':'Synthetic daily requirement','rule':'daily_practice'})],1,'synthetic-practice').status_code==200
    prep=plan(c).json();args=PlanningRequest(subject='english',mode='day',targetDate=TARGET)
    patch=[{'operation':'update','taskId':'synthetic-14-reading','date':(TODAY+timedelta(days=2)).isoformat(),'minutes':10}]
    with open_db(db) as con,pytest.raises(PlanError,match='daily_practice_required'):
        validate_suggestion(con,path,args,prep,PlanningSuggestion.model_validate(suggestion(prep['context'],patch)))
    malformed=suggestion(prep['context']);malformed['uncertainties']=[]
    with open_db(db) as con,pytest.raises(PlanError,match='planning_uncertainties_required'):
        validate_suggestion(con,path,args,prep,PlanningSuggestion.model_validate(malformed))


def test_dates_outside_template_are_unknown_not_free_time(learning):
    c,_,_,_,_=learning
    result=report(c,asOf=(TODAY+timedelta(days=20)).isoformat()).json()
    assert all(d['scheduleState']=='unknown' and d['plannedMinutes'] is None for d in result['future7Days'])
    assert any(i['issueCode']=='future_plan_unavailable' for i in result['issues'])


@pytest.mark.parametrize('subject,task_id,minutes',[('english','synthetic-14-reading',22),('politics','synthetic-14-course',26)])
def test_both_subjects_produce_valid_local_weekly_preview_only(learning,subject,task_id,minutes):
    c,db,_,_,response=learning
    prep=plan(c,subject,mode='week').json();response['value']=suggestion(prep['context'],[{'operation':'update','taskId':task_id,'minutes':minutes}])
    before=snapshot_rows(db);result=chat_plan(c,subject,mode='week').json()
    assert result['status']=='prepared' and result['changes'][0]['after']['minutes']==minutes
    assert result['sources']['subject']==subject and result['previewOnly']
    assert snapshot_rows(db)==before


def test_vocabulary_scope_is_independent_and_total_hard_limit_includes_it(learning):
    c,db,path,_,_=learning
    assert save(c,[entry('hard-limit','constraint',value={'text':'Synthetic combined total limit','rule':'daily_limit','scope':'total','minutes':58})],1,'synthetic-total-limit').status_code==200
    prep=plan(c).json();args=PlanningRequest(subject='english',mode='day',targetDate=TARGET)
    # Non-vocabulary 22 is within advisory 38, but adding saved vocabulary 37 exceeds 58.
    patch=[{'operation':'update','taskId':'synthetic-14-reading','minutes':22}]
    with open_db(db) as con,pytest.raises(PlanError,match='hard_daily_limit_exceeded'):
        validate_suggestion(con,path,args,prep,PlanningSuggestion.model_validate(suggestion(prep['context'],patch)))


def test_sensitive_budget_cannot_leak_through_derived_policy_or_detection(learning):
    c,_,_,calls,_=learning
    assert save(c,[entry('time-budget','budget',value={'text':'Synthetic sensitive availability','minutes':43},sensitivity='review')],1,'synthetic-sensitive-budget').status_code==200
    result=plan(c,mode='diagnosis').json();context=result['context']
    assert context['learningPolicy']['advisoryMinutes'] is None
    assert context['detection']['policy']['advisoryMinutes'] is None
    assert all(d['budgetMinutes'] is None for d in context['detection']['future7Days'])
    assert plan(c,mode='diagnosis',shareReview=True).json()['context']['learningPolicy']['advisoryMinutes']==43
    assert not calls
