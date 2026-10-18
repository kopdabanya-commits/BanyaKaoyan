"""Only synthetic facts, local databases and disabled/fake providers."""
import copy
import hashlib
import json
import sqlite3
from dataclasses import replace
from datetime import date

import pytest
from fastapi.testclient import TestClient

import capabilities
from app import create_app, open_db
from context_engine import ContextRequest, build_context, size
from learning_memory import initialize_memory
from test_agent_api import OWNER, OWNER_AUTH, PROTO, document, template
from upgrade_guard import create_verified_backup, verify_preserved


def entry(key='daily-rule',category='preference',text='Synthetic brief feedback',**extra):
    return {'key':key,'category':category,'value':{'text':text},'source':{'kind':'user_confirmation','reference':'Synthetic owner entry'},
            'certainty':'confirmed','temporal':'current','active':True,**extra}


@pytest.fixture
def memory(tmp_path):
    for subject,name in [('english','plan.json'),('politics','politics-plan.json')]:
        (tmp_path/name).write_text(json.dumps(template(subject)))
    db=tmp_path/'db'
    def forbidden(*_):pytest.fail('No paid calls permitted')
    with TestClient(create_app(db_path=db,token_sha256=hashlib.sha256(OWNER.encode()).hexdigest(),template_dir=tmp_path,ai_provider=forbidden)) as client:
        for subject in ('english','politics'):
            assert client.put('/v1/snapshot/'+subject,headers=OWNER_AUTH,json={'expectedRevision':0,'state':document(subject)}).status_code==200
        yield client,db,tmp_path


def save(client,entries=None,revision=0,request='synthetic-profile-001',subject='english',**overrides):
    return client.post('/v1/ai/profiles/'+subject,headers=OWNER_AUTH,json={'schemaVersion':1,'requestId':request,'expectedRevision':revision,'entries':entries or [entry()],'confirmation':'save_profile',**overrides})


def get(client,subject='english'):
    return client.get('/v1/ai/profiles/'+subject,headers=OWNER_AUTH).json()


def ctx(client,**overrides):
    return client.post('/v1/ai/context',headers=OWNER_AUTH,json={'subject':'english','purpose':'day','targetDate':'2026-10-20',**overrides})


def snapshot_rows(db):
    with sqlite3.connect(db) as con:return con.execute('SELECT * FROM snapshots ORDER BY subject').fetchall(),con.execute('SELECT * FROM history ORDER BY id').fetchall()


def test_private_endpoints_need_owner_and_never_bill(memory):
    c,db,_=memory
    for path in ('profiles/english','profiles/english/history','capabilities'):
        assert c.get('/v1/ai/'+path).status_code==401
        assert c.get('/v1/ai/'+path,headers={'Authorization':'Bearer banya_plan_'+'x'*48}).status_code==401
    for path in ('profiles/english','context','read'):
        assert c.post('/v1/ai/'+path,json={}).status_code==401
    assert c.get('/v1/ai/status',headers=OWNER_AUTH).json()['ready'] is False
    assert get(c)['revision']==0 and ctx(c).status_code==200


def test_versions_backup_idempotence_and_subject_isolation(memory):
    c,db,_=memory;old=snapshot_rows(db)
    original=save(c);assert original.status_code==200
    assert save(c).json()==original.json()
    assert save(c,[entry(text='Synthetic changed body')]).status_code==409
    assert save(c,revision=0,request='synthetic-stale-001').status_code==409
    assert save(c,[entry(text='Synthetic newer preference')],revision=1,request='synthetic-profile-002').json()['revision']==2
    assert get(c,'politics')['revision']==0 and snapshot_rows(db)==old
    history=c.get('/v1/ai/profiles/english/history',headers=OWNER_AUTH).json()['versions']
    assert history[0]['revision']==1 and history[0]['document']['entries'][0]['value']['text']=='Synthetic brief feedback'
    assert history[1]['revision']==0
    context=ctx(c).json();assert context['background'][0]['value']['text']=='Synthetic newer preference'
    assert context['background'][0]['entryRevision']==2
    assert all('confirmedAt' in e and e['source']['kind']=='user_confirmation' for e in get(c)['entries'])


def test_backup_failure_rolls_back_every_profile_table(memory):
    c,db,_=memory
    with sqlite3.connect(db) as con:con.execute("CREATE TRIGGER synthetic_failure BEFORE INSERT ON learning_profile_history BEGIN SELECT RAISE(ABORT,'synthetic'); END")
    assert save(c).status_code==503
    assert get(c)['revision']==0
    with sqlite3.connect(db) as con:assert con.execute('SELECT count(*) FROM learning_profile_requests').fetchone()[0]==0


def test_history_is_not_checkin_and_unknown_is_not_fabricated(memory):
    c,db,_=memory;old=snapshot_rows(db)
    entries=[entry('old-progress','progress',value={'text':'Synthetic old section only','count':7,'total':50},temporal='historical',observedOn='2026-09-01',certainty='reported'),
             entry('current-progress','progress',text='Synthetic latest extent unknown',certainty='unknown')]
    assert save(c,entries).status_code==200
    value=ctx(c).json();assert value['serverSafety']['profileIsNotCheckin']
    assert value['recentPerformance']['currentOverallProgress']=='unknown'
    old_fact=next(e for e in value['background'] if e['key']=='old-progress');assert old_fact['effectiveState']=='historical_only'
    assert next(e for e in value['background'] if e['key']=='current-progress')['effectiveState']=='unknown'
    assert snapshot_rows(db)==old


def test_inactive_expired_and_same_key_rules(memory):
    c,db,_=memory
    assert save(c,[entry(category='constraint')]).status_code==200
    assert len(ctx(c).json()['hardRules'])==1
    assert save(c,[entry(category='constraint',text='Synthetic newer rule')],1,'synthetic-update-002').status_code==200
    assert ctx(c).json()['hardRules'][0]['value']['text']=='Synthetic newer rule'
    assert save(c,[entry(category='constraint',active=False)],2,'synthetic-disable-03').status_code==200
    assert not ctx(c).json()['hardRules']
    assert save(c,[entry(category='constraint',validUntil='2020-01-01')],3,'synthetic-expiry-004').status_code==200
    value=ctx(c).json();assert not value['hardRules'] and value['background'][0]['effectiveState']=='expired_unknown'


def test_context_has_scoped_real_records_sources_and_opt_in_review(memory):
    c,db,_=memory
    assert save(c,[entry('synthetic-politics',text='Synthetic peer-only data')],subject='politics').status_code==200
    before=snapshot_rows(db);value=ctx(c).json()
    assert value['sources']['snapshot']['revision']==1
    assert value['sources']['snapshot']['templateVersion']=='synthetic-v1'
    assert value['sources']['profile']['schemaVersion']==1
    assert 'Synthetic peer-only data' not in json.dumps(value)
    assert value['crossSubjectSummaries']==[]
    assert 'synthetic private note' not in json.dumps(value)
    assert 'synthetic private note' in ctx(c,shareReview=True).text
    assert 'Synthetic guidance' not in json.dumps(value)  # public prose isn't personal evidence
    assert ctx(c,coordinateSubjects=['politics']).status_code==422
    cross=ctx(c,coordinateSubjects=['politics'],crossSubjectConsent=True).json()
    assert cross['crossSubjectSummaries'][0]['subject']=='politics'
    assert 'Synthetic peer-only data' not in json.dumps(cross) and 'synthetic private note' not in json.dumps(cross['crossSubjectSummaries'])
    assert snapshot_rows(db)==before


def test_context_windows_and_missing_values(memory):
    c,db,templates=memory
    with open_db(db) as con:
        day=build_context(con,templates,ContextRequest(subject='english',purpose='day',targetDate='2026-10-20'),as_of=date(2026,10,20))
        week=build_context(con,templates,ContextRequest(subject='english',purpose='week'),as_of=date(2026,10,20))
    assert (day['start'],day['end'])==('2026-10-19','2026-10-21')
    assert week['recentPerformance']['start']=='2026-10-07' and week['end']=='2026-10-27'
    assert week['recentPerformance']['basis']=='task_date_not_completion_date'
    assert week['recentPerformance']['missingTimeValues']=='unknown_not_zero'
    assert next(t for t in day['tasks'] if t['id']=='task-a')['recordedTimes']=={}
    assert ctx(c,expectedRevision=2).status_code==409
    assert ctx(c,expectedProfileRevision=1).status_code==409


def test_safe_context_trimming_never_loses_hard_rules_or_latest_request(memory):
    c,db,_=memory
    entries=[entry('must-keep','constraint',text='Synthetic hard rule must remain')]+[entry(f'background-{n}',text='Synthetic background '*50) for n in range(25)]
    assert save(c,entries).status_code==200
    messages=[{'role':'user','content':'Synthetic old conversation '*60} for _ in range(5)]+[{'role':'user','content':'Synthetic latest required request'}]
    value=ctx(c,messages=messages,maxBytes=5000).json()
    assert value['hardRules'][0]['value']['text']=='Synthetic hard rule must remain'
    assert value['conversation'][-1]['content']=='Synthetic latest required request'
    assert value['truncation']['conversationMessages']>0 and value['truncation']['backgroundEntries']>0
    assert len(value['tasks'])==4 and size(value)<=5000
    rules=[entry(f'hard-{n}','constraint',text='Synthetic mandatory '*60) for n in range(8)]
    assert save(c,rules,1,'synthetic-many-hard').status_code==200
    assert ctx(c,maxBytes=4096).status_code==413


def test_repeated_initialization_restart_and_upgrade_preserve_memory(memory):
    c,db,templates=memory
    assert save(c).status_code==200
    before=get(c);saved=create_verified_backup(db,templates/'backups')
    initialize_memory(db);initialize_memory(db);verify_preserved(db,saved)
    with TestClient(create_app(db_path=db,token_sha256=hashlib.sha256(OWNER.encode()).hexdigest(),template_dir=templates)) as reopened:
        assert get(reopened)==before
    with sqlite3.connect(db) as con:con.execute("UPDATE learning_profiles SET schema_version=2 WHERE subject='english'")
    assert c.get('/v1/ai/profiles/english',headers=OWNER_AUTH).status_code==409
    assert ctx(c).status_code==409
    assert c.get('/v1/ai/capabilities',headers=OWNER_AUTH).status_code==409
    with pytest.raises(RuntimeError):verify_preserved(db,saved)


def test_capability_allowlist_contract_and_revocation(memory,monkeypatch):
    c,db,_=memory
    listed=c.get('/v1/ai/capabilities',headers=OWNER_AUTH).json()
    assert set(capabilities.IMPLEMENTATIONS)=={x.id for x in capabilities.REGISTRY}
    assert {x['id'] for x in listed['capabilities']}==set(capabilities.IMPLEMENTATIONS)
    text=json.dumps(listed).lower()
    assert all(term not in text for term in ('ssh','shell','github','deploy','secret','credential'))
    assert all(x['access']=='read_only' and x['permissions']==['owner:read'] for x in listed['capabilities'])
    for spec in listed['capabilities']:
        args={'subject':'english'}
        result=c.post('/v1/ai/read',headers=OWNER_AUTH,json={'capability':spec['id'],'version':spec['version'],'profileSchema':1,'contextVersion':'learning-context-v1','arguments':args})
        assert result.status_code==200
        assert set(spec['outputSchema']['required'])<=set(result.json()['result'])
        assert set(spec['inputSchema']['properties'])==set(next(x for x in capabilities.REGISTRY if x.id==spec['id']).input_model.model_fields)
    body={'capability':'learning.profile.read','version':'1','profileSchema':1,'contextVersion':'learning-context-v1','arguments':{'subject':'english'}}
    assert c.post('/v1/ai/read',headers=OWNER_AUTH,json={**body,'capability':'shell.run'}).status_code==409
    assert c.post('/v1/ai/read',headers=OWNER_AUTH,json={**body,'version':'2'}).status_code==409
    assert c.post('/v1/ai/read',headers=OWNER_AUTH,json={**body,'profileSchema':2}).status_code==409
    monkeypatch.setattr(capabilities,'REGISTRY',tuple(replace(x,enabled=False) for x in capabilities.REGISTRY))
    assert c.get('/v1/ai/capabilities',headers=OWNER_AUTH).json()['capabilities']==[]
    assert c.post('/v1/ai/read',headers=OWNER_AUTH,json=body).status_code==409
    assert ctx(c).status_code==409


def test_invalid_profile_cannot_store_reasoning_or_invent_checkins(memory):
    c,db,_=memory
    for override in ({'reasoning_content':'Synthetic hidden reasoning'},{'done':True},{'certainty':'estimate','category':'constraint'},{'temporal':'historical','observedOn':None}):
        assert save(c,[entry(**override)]).status_code==422
    assert get(c)['revision']==0


def test_missing_cloud_snapshot_and_unavailable_capability_are_unknown_or_denied(memory,monkeypatch):
    c,db,_=memory
    with sqlite3.connect(db) as con:con.execute("DELETE FROM snapshots WHERE subject='english'")
    value=ctx(c).json();assert value['tasks']==[] and value['sources']['snapshot']['state']=='unknown'
    assert value['recentPerformance']['state']=='unknown'
    assert ctx(c,expectedRevision=1).status_code==409
    monkeypatch.setattr(capabilities,'REGISTRY',tuple(replace(x,profile_schema=99) for x in capabilities.REGISTRY))
    assert c.get('/v1/ai/capabilities',headers=OWNER_AUTH).json()['capabilities']==[]
    assert ctx(c).status_code==409


def test_profile_rejects_implicit_current_history_and_unbounded_progress(memory):
    c,_,_=memory
    assert save(c,schemaVersion=True).status_code==422
    assert save(c,[entry(category='history')]).status_code==422
    assert save(c,[entry(category='progress')]).status_code==422
    assert save(c,[entry(category='progress',observedOn='2026-01-01',validUntil='2026-01-02')]).status_code==200
    assert ctx(c).json()['background'][0]['effectiveState']=='expired_unknown'


def test_history_pagination_retains_every_version(memory):
    c,_,_=memory
    for n in range(12):assert save(c,[entry(text=f'Synthetic revision {n}')],n,f'synthetic-version-{n:03}').status_code==200
    page=c.get('/v1/ai/profiles/english/history',headers=OWNER_AUTH).json()
    assert len(page['versions'])==10
    last=c.get('/v1/ai/profiles/english/history?before='+str(page['nextBefore']),headers=OWNER_AUTH).json()
    assert [v['revision'] for v in last['versions']]==[1,0]


def test_review_sensitive_profile_memory_requires_separate_consent(memory):
    c,_,_=memory
    assert save(c,[entry('review-fact','history',text='Synthetic private review baseline',temporal='historical',observedOn='2026-09-01',sensitivity='review')]).status_code==200
    assert 'Synthetic private review baseline' not in ctx(c).text
    assert 'Synthetic private review baseline' in ctx(c,shareReview=True).text
    assert save(c,[entry(category='constraint',sensitivity='review')],1,'synthetic-sensitive-constraint').status_code==422


def test_confirmed_structured_budget_outranks_legacy_settings_and_has_source(memory):
    c,_,_=memory
    assert save(c,[entry('daily-budget','budget',value={'text':'Synthetic owner daily budget','minutes':32})]).status_code==200
    value=ctx(c).json()
    assert value['dailyNonVocabularyBudgetMinutes']==32
    assert value['timeBudgetSource']=='profile:english:1:daily-budget'
    assert value['sources']['snapshot']['revision']==1


def test_owner_and_provider_credentials_cannot_be_saved_as_memory(memory):
    c,_,_=memory
    for text in (OWNER,'sk-'+'a'*40):
        assert save(c,[entry(text=text)]).status_code==422
    assert get(c)['revision']==0


def test_context_selects_relevant_background_instead_of_every_baseline(memory):
    c,_,_=memory
    entries=[entry('writing-base','history',text='Synthetic writing baseline',temporal='historical',observedOn='2026-09-01',topics=['writing']),
             entry('reading-base','history',text='Synthetic reading baseline',temporal='historical',observedOn='2026-09-01',topics=['reading']),
             entry('writing-hard','constraint',text='Synthetic always required',topics=['writing'])]
    assert save(c,entries).status_code==200
    result=ctx(c,focusTags=['reading']).json()
    assert 'Synthetic reading baseline' in json.dumps(result)
    assert 'Synthetic writing baseline' not in json.dumps(result)
    assert result['hardRules'][0]['value']['text']=='Synthetic always required'
    assert result['selection']['omittedBackgroundEntries']==1
    assert result['selection']['focusTags']==['reading']
