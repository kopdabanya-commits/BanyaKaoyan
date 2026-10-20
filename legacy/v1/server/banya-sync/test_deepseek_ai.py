"""Synthetic records and fake provider only. Never makes a paid API call."""
import copy
import hashlib
import json
import sqlite3
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from app import create_app
from deepseek_ai import AIConfig, ProviderFailure, from_environment
from test_agent_api import OWNER, OWNER_AUTH, PROTO, document, template

KEY = 'synthetic-provider-' + 'x' * 32
SETTINGS = AIConfig(enabled=True, api_key=KEY, monthly_budget_nano=1_000_000_000)
PATCH = [{'operation':'update','taskId':'task-a','date':'2026-10-21','minutes':20,'title':'Synthetic adjusted practice'}]


def upstream(changes=None, **extras):
    return {'choices':[{'finish_reason':'stop','message':{'content':json.dumps({'reply':'Synthetic advice; confirm before saving.','changes':PATCH if changes is None else changes,**extras})}}]}


@pytest.fixture
def ai(tmp_path):
    for subject, name in [('english','plan.json'),('politics','politics-plan.json')]:
        (tmp_path/name).write_text(json.dumps(template(subject)))
    calls=[]
    def provider(config,payload):
        calls.append(copy.deepcopy(payload))
        return upstream()
    db=tmp_path/'db'
    app=create_app(db_path=db,token_sha256=hashlib.sha256(OWNER.encode()).hexdigest(),template_dir=tmp_path,
                   ai_config=SETTINGS,ai_provider=provider)
    with TestClient(app) as client:
        for subject in ('english','politics'):
            assert client.put('/v1/snapshot/'+subject,headers=OWNER_AUTH,json={'expectedRevision':0,'state':document(subject)}).status_code==200
        from test_learning_memory import save,entry
        assert save(client,[entry('daily-budget','budget',value={'text':'Synthetic explicitly available time','minutes':92})]).status_code==200
        yield client,db,calls,tmp_path


def chat(client,**overrides):
    body={'requestId':'synthetic-request-123','subject':'english','start':'2026-10-20','end':'2026-10-21',
          'expectedRevision':1,'messages':[{'role':'user','content':'Discuss this synthetic plan.'}],'consent':True,**overrides}
    return client.post('/v1/ai/chat',headers=OWNER_AUTH,json=body)


def snap(client,subject='english'):
    return client.get('/v1/snapshot/'+subject,headers=PROTO).json()


def test_disabled_and_zero_budget_never_contact_provider(tmp_path):
    for settings in (AIConfig(),replace(SETTINGS,monthly_budget_nano=0),replace(SETTINGS,api_key='')):
        calls=[]
        with TestClient(create_app(db_path=tmp_path/'db',token_sha256=hashlib.sha256(OWNER.encode()).hexdigest(),
                                  ai_config=settings,ai_provider=lambda *args:calls.append(args))) as client:
            assert client.get('/v1/ai/status').status_code==401
            assert client.get('/v1/ai/status',headers=OWNER_AUTH).json()['ready'] is False
            assert chat(client).status_code==503
            assert not calls
    assert KEY not in repr(SETTINGS)


def test_invalid_environment_fails_closed_without_echo(monkeypatch):
    monkeypatch.setenv('BANYA_AI_ENABLED','1');monkeypatch.setenv('DEEPSEEK_MONTHLY_BUDGET_USD','NaN')
    assert not from_environment().ready


def test_owner_authentication_required_on_read_and_write(ai):
    client,db,calls,_=ai
    for path in ['/v1/ai/status','/v1/ai/requests/synthetic-request-123']:
        assert client.get(path).status_code==401
        assert client.get(path,headers={'Authorization':'Bearer banya_plan_'+'x'*48}).status_code==401
    assert client.post('/v1/ai/chat',json={}).status_code==401
    assert client.post('/v1/ai/proposals/x/commit',json={}).status_code==401
    assert not calls
    with sqlite3.connect(db) as con:assert con.execute('SELECT count(*) FROM ai_requests').fetchone()[0]==0


def test_status_has_no_provider_secret_and_does_not_bill(ai):
    client,_,calls,_=ai
    response=client.get('/v1/ai/status',headers=OWNER_AUTH)
    assert response.json()['ready'] is True
    assert KEY not in response.text and OWNER not in response.text
    assert response.json()['monthlyCalls']==0 and not calls


def test_chat_only_prepares_then_explicit_commit_backs_up_and_preserves_both_subjects(ai):
    client,db,calls,_=ai
    old,politics=snap(client),snap(client,'politics')
    proposal=chat(client).json()
    assert proposal['status']=='prepared' and proposal['mobileDelivery']=='not_sent'
    assert snap(client)==old and snap(client,'politics')==politics
    with sqlite3.connect(db) as con:assert con.execute('SELECT count(*) FROM agent_backups').fetchone()[0]==0
    response=client.post('/v1/ai/proposals/'+proposal['requestId']+'/commit',headers=OWNER_AUTH,json={'expectedRevision':1,'confirmation':'sync'})
    receipt=response.json();assert response.status_code==200 and receipt['status']=='applied'
    assert receipt['mobileDelivery']=='awaiting_phone_sync' and receipt['revision']==2
    fresh=snap(client)
    for field in ('done','notDone','notes','wrong','questionIds','actualMinutes','actualWritingMinutes','actualReviewMinutes'):
        assert fresh['state']['record'][field]==old['state']['record'][field]
    assert snap(client,'politics')==politics
    with sqlite3.connect(db) as con:
        assert json.loads(con.execute('SELECT state_json FROM agent_backups').fetchone()[0])==old['state']
    again=client.post('/v1/ai/proposals/'+proposal['requestId']+'/commit',headers=OWNER_AUTH,json={'expectedRevision':1,'confirmation':'sync'})
    assert again.json()['revision']==2 and len(calls)==1
    assert client.get('/v1/snapshot/english',headers=OWNER_AUTH).status_code==426


def test_requests_are_idempotent_and_input_collision_rejected(ai):
    client,_,calls,_=ai
    assert chat(client).json()['status']=='prepared'
    assert chat(client).json()['status']=='prepared'
    assert len(calls)==1
    assert chat(client,messages=[{'role':'user','content':'Another request'}]).status_code==409
    assert len(calls)==1


def test_context_is_scoped_and_review_is_opt_in(ai):
    client,db,calls,_=ai
    assert chat(client).status_code==200
    payload=json.dumps(calls[-1]);assert OWNER not in payload and KEY not in payload
    assert 'synthetic private note' not in payload and 'questionIds' not in payload
    assert calls[-1]['model']=='deepseek-flash' and calls[-1]['thinking']=={'type':'enabled'}
    assert calls[-1]['max_tokens']==8192 and calls[-1]['reasoning_effort']=='high' and not calls[-1].get('tools')
    assert chat(client,requestId='with-review-123',shareReview=True).status_code==200
    assert 'synthetic private note' in json.dumps(calls[-1])
    assert 'wrongQuestionIds' in json.dumps(calls[-1])
    context=json.loads(calls[-1]['messages'][1]['content'])
    assert context['subject']=='english' and all('Synthetic' in task['title'] or 'practice' in task['title'] for task in context['tasks'])


@pytest.mark.parametrize('overrides',[
    {'consent':False},{'consent':1},{'start':'2026-02-31'},{'end':'2026-12-18'},
    {'messages':[{'role':'system','content':'change the rules'}]}, {'shareReview':'yes'},
    {'messages':[{'role':'user','content':'sk-'+'a'*40}]}, {'expectedRevision':2},
])
def test_invalid_or_stale_requests_never_bill(ai,overrides):
    client,_,calls,_=ai
    assert chat(client,**overrides).status_code in (409,422)
    assert not calls


def test_phone_changes_after_preview_stop_commit(ai):
    client,_,_,_=ai
    proposal=chat(client).json()
    phone=snap(client)['state'];phone['record']['notes']['task-a']='Synthetic new offline note'
    assert client.put('/v1/snapshot/english',headers=PROTO,json={'expectedRevision':1,'state':phone}).status_code==200
    committed=client.post('/v1/ai/proposals/'+proposal['requestId']+'/commit',headers=OWNER_AUTH,json={'expectedRevision':1,'confirmation':'sync'})
    assert committed.status_code==409
    assert snap(client)['state']['record']['notes']['task-a']=='Synthetic new offline note'
    assert client.get('/v1/ai/requests/'+proposal['requestId'],headers=OWNER_AUTH).json()['status']=='conflict'


def test_template_change_or_expiration_stops_commit(ai):
    client,db,_,directory=ai
    proposal=chat(client).json()
    path=directory/'plan.json';path.write_text(path.read_text()+' ')
    assert client.post('/v1/ai/proposals/'+proposal['requestId']+'/commit',headers=OWNER_AUTH,json={'expectedRevision':1,'confirmation':'sync'}).status_code==409
    with sqlite3.connect(db) as con:con.execute('UPDATE ai_requests SET expires_at=0')
    assert client.get('/v1/ai/requests/'+proposal['requestId'],headers=OWNER_AUTH).json()['status']=='expired'


def test_model_cannot_edit_protected_records_or_other_subject(tmp_path):
    for patch in ([{'operation':'update','taskId':'protected-done','minutes':20}],
                  [{'operation':'update','taskId':'protected-skip','minutes':20}],
                  [{'operation':'update','taskId':'task-a','notes':'overwrite'}],
                  [{'operation':'update','taskId':'task-a','subject':'politics','minutes':20}]):
        for subject,name in [('english','plan.json'),('politics','politics-plan.json')]:
            (tmp_path/name).write_text(json.dumps(template(subject)))
        with TestClient(create_app(db_path=tmp_path/'db',token_sha256=hashlib.sha256(OWNER.encode()).hexdigest(),template_dir=tmp_path,ai_config=SETTINGS,ai_provider=lambda *_:upstream(patch))) as client:
            if snap(client)['revision']==0:
                client.put('/v1/snapshot/english',headers=OWNER_AUTH,json={'expectedRevision':0,'state':document()})
            before=snap(client)
            response=chat(client,requestId='protected-'+str(len(patch[0]))+patch[0]['taskId'])
            assert response.json()['status'] in ('rejected','unknown')
            assert snap(client)==before


def test_upstream_timeout_and_truncated_json_are_never_retried(tmp_path):
    (tmp_path/'plan.json').write_text(json.dumps(template('english')))
    calls=[]
    def bad_provider(*args):calls.append(1);raise ProviderFailure()
    with TestClient(create_app(db_path=tmp_path/'db',token_sha256=hashlib.sha256(OWNER.encode()).hexdigest(),template_dir=tmp_path,ai_config=SETTINGS,ai_provider=bad_provider)) as client:
        client.put('/v1/snapshot/english',headers=OWNER_AUTH,json={'expectedRevision':0,'state':document()})
        assert chat(client).json()['status']=='unknown'
        assert chat(client).json()['status']=='unknown' and calls==[1]
        assert snap(client)['revision']==1
        assert client.get('/v1/ai/status',headers=OWNER_AUTH).json()['estimatedReservedUsd']>0


def test_budget_reservation_and_call_limit_prevent_extra_paid_calls(tmp_path):
    (tmp_path/'plan.json').write_text(json.dumps(template('english')))
    for config in (replace(SETTINGS,monthly_budget_nano=1),replace(SETTINGS,monthly_calls=1)):
        db=tmp_path/str(config.monthly_budget_nano)
        calls=[]
        def provider(*args):calls.append(1);return upstream([])
        with TestClient(create_app(db_path=db,token_sha256=hashlib.sha256(OWNER.encode()).hexdigest(),template_dir=tmp_path,ai_config=config,ai_provider=provider)) as client:
            client.put('/v1/snapshot/english',headers=OWNER_AUTH,json={'expectedRevision':0,'state':document()})
            first=chat(client)
            if config.monthly_budget_nano==1:assert first.status_code==429 and not calls
            else:
                assert first.json()['status']=='discussion'
                assert chat(client,requestId='second-paid-request').status_code==429 and len(calls)==1


def test_backup_failure_rolls_back_learning_record(ai):
    client,db,_,_=ai
    proposal=chat(client).json();before=snap(client)
    with sqlite3.connect(db) as con:
        con.execute("CREATE TRIGGER synthetic_backup_failure BEFORE INSERT ON agent_backups BEGIN SELECT RAISE(ABORT,'synthetic'); END")
    response=client.post('/v1/ai/proposals/'+proposal['requestId']+'/commit',headers=OWNER_AUTH,json={'expectedRevision':1,'confirmation':'sync'})
    assert response.status_code==503 and snap(client)==before


def test_thinking_is_enabled_and_internal_reasoning_is_not_saved_or_replayed(tmp_path):
    (tmp_path/'plan.json').write_text(json.dumps(template('english')))
    calls=[]
    def provider(config,payload):
        calls.append(payload)
        answer=upstream([]);answer['choices'][0]['message']['reasoning_content']='Synthetic hidden provider reasoning'
        return answer
    with TestClient(create_app(db_path=tmp_path/'db',token_sha256=hashlib.sha256(OWNER.encode()).hexdigest(),template_dir=tmp_path,ai_config=SETTINGS,ai_provider=provider)) as client:
        client.put('/v1/snapshot/english',headers=OWNER_AUTH,json={'expectedRevision':0,'state':document()})
        response=chat(client)
        assert response.json()['status']=='discussion'
        assert calls[0]['thinking']=={'type':'enabled'} and calls[0]['reasoning_effort']=='high'
        assert calls[0]['max_tokens']==8192
        assert 'Synthetic hidden provider reasoning' not in response.text
        with sqlite3.connect(tmp_path/'db') as con:
            assert 'Synthetic hidden provider reasoning' not in con.execute('SELECT result_json FROM ai_requests').fetchone()[0]


def test_pending_reservation_prevents_parallel_calls_and_polled_status_is_free(ai):
    client,db,calls,_=ai
    proposal=chat(client).json()
    with sqlite3.connect(db) as con:con.execute("UPDATE ai_requests SET status='pending'")
    assert chat(client,requestId='parallel-request-123').status_code==409
    assert client.get('/v1/ai/requests/'+proposal['requestId'],headers=OWNER_AUTH).json()['status']=='pending'
    assert len(calls)==1


def test_new_phone_data_during_thinking_stays_intact(tmp_path):
    (tmp_path/'plan.json').write_text(json.dumps(template('english')))
    db=tmp_path/'db'
    def provider(*args):
        with sqlite3.connect(db) as con:
            row=con.execute("SELECT state_json FROM snapshots WHERE subject='english'").fetchone()
            value=json.loads(row[0]);value['record']['notes']['task-a']='Synthetic phone update during thinking'
            con.execute("UPDATE snapshots SET revision=2,state_json=? WHERE subject='english'",(json.dumps(value),))
        return upstream()
    with TestClient(create_app(db_path=db,token_sha256=hashlib.sha256(OWNER.encode()).hexdigest(),template_dir=tmp_path,ai_config=SETTINGS,ai_provider=provider)) as client:
        client.put('/v1/snapshot/english',headers=OWNER_AUTH,json={'expectedRevision':0,'state':document()})
        response=chat(client).json();assert response['status']=='conflict'
        assert snap(client)['state']['record']['notes']['task-a']=='Synthetic phone update during thinking'
        assert snap(client)['state']['record']['edits']=={}


def test_public_preset_narratives_are_not_sent_as_personal_evidence(ai):
    client,_,calls,directory=ai
    path=directory/'plan.json';value=json.loads(path.read_text())
    value['days'][0]['items'][0]['detail']='Synthetic public narrative claiming completion'
    path.write_text(json.dumps(value))
    assert chat(client).status_code==200
    payload=json.dumps(calls[0])
    assert 'Synthetic public narrative claiming completion' not in payload
    context=json.loads(calls[0]['messages'][1]['content'])
    assert next(t for t in context['tasks'] if t['id']=='task-a')['status']=='pending'


def test_existing_receipts_remain_readable_with_paid_calls_disabled(ai):
    client,db,calls,directory=ai
    request=chat(client).json()['requestId']
    old_call_count=len(calls)
    with TestClient(create_app(db_path=db,token_sha256=hashlib.sha256(OWNER.encode()).hexdigest(),template_dir=directory,
                              ai_config=AIConfig(),ai_provider=lambda *_:pytest.fail('No paid call permitted'))) as disabled:
        response=disabled.get('/v1/ai/requests/'+request,headers=OWNER_AUTH)
        assert response.status_code==200 and response.json()['status']=='prepared'
        assert chat(disabled,requestId='disabled-request-123').status_code==503
    assert len(calls)==old_call_count


def test_memory_rules_are_in_provider_context_and_new_profile_invalidates_preview(ai):
    from test_learning_memory import save, entry
    client,db,calls,_=ai
    assert save(client,[entry(category='constraint',text='Synthetic confirmed restriction')],1,'synthetic-rule-first').status_code==200
    proposal=chat(client).json();assert proposal['status']=='prepared'
    payload=json.loads(calls[0]['messages'][1]['content'])
    assert payload['hardRules'][0]['value']['text']=='Synthetic confirmed restriction'
    assert payload['sources']['profile']['revision']==2
    assert all(c['access']=='read_only' for c in payload['capabilities'])
    assert save(client,[entry(category='constraint',text='Synthetic changed restriction')],2,'synthetic-rule-change').status_code==200
    assert client.get('/v1/ai/requests/'+proposal['requestId'],headers=OWNER_AUTH).json()['status']=='conflict'
    before=snap(client)
    assert client.post('/v1/ai/proposals/'+proposal['requestId']+'/commit',headers=OWNER_AUTH,json={'expectedRevision':1,'confirmation':'sync'}).status_code==409
    assert snap(client)==before


def test_changed_profile_during_thinking_rejects_stale_advice(ai):
    from test_learning_memory import save, entry
    client,db,calls,_=ai
    def provider(config,payload):
        assert save(client,[entry(category='constraint')],1,'synthetic-during-thinking').status_code==200
        return upstream()
    # Reopen with a fake provider that changes only the synthetic local profile.
    with TestClient(create_app(db_path=db,token_sha256=hashlib.sha256(OWNER.encode()).hexdigest(),template_dir=ai[3],
                              ai_config=SETTINGS,ai_provider=provider)) as other:
        before=snap(client)
        assert chat(other).json()['status']=='conflict'
        assert snap(client)==before


def test_owner_credential_in_conversation_is_never_sent_to_provider(ai):
    client,_,calls,_=ai
    assert chat(client,messages=[{'role':'user','content':OWNER}]).status_code==422
    assert not calls


def delete_provider(changes):
    def provider(config, payload):
        return {'choices':[{'finish_reason':'stop','message':{'content':json.dumps(
            {'reply':'Synthetic deletion advice.','changes':changes})}}]}
    return provider


def test_delete_change_removes_task_and_undo_restores_previous_plan(tmp_path):
    (tmp_path/'plan.json').write_text(json.dumps(template('english')))
    provider=delete_provider([{'operation':'delete','taskId':'task-a'}])
    with TestClient(create_app(db_path=tmp_path/'db',token_sha256=hashlib.sha256(OWNER.encode()).hexdigest(),
                               template_dir=tmp_path,ai_config=SETTINGS,ai_provider=provider)) as client:
        client.put('/v1/snapshot/english',headers=OWNER_AUTH,json={'expectedRevision':0,'state':document()})
        from test_learning_memory import save,entry
        save(client,[entry('daily-budget','budget',value={'text':'Synthetic explicitly available time','minutes':92})])
        proposal=chat(client,requestId='delete-request-123').json()
        assert proposal['status']=='prepared' and proposal['changes'][0]['after'] is None, proposal
        assert snap(client)['state']['record'].get('removed',{})=={}
        applied=client.post('/v1/ai/proposals/delete-request-123/commit',headers=OWNER_AUTH,
                            json={'expectedRevision':1,'confirmation':'sync'}).json()
        assert applied['status']=='applied' and applied['revision']==2
        after=snap(client)
        assert after['state']['record']['removed']['task-a'] is True
        # Learning records are untouched by a plan deletion.
        assert after['state']['record']['done']=={'protected-done':True}
        assert after['state']['record']['notDone']=={'protected-skip':True}
        undone=client.post('/v1/ai/proposals/delete-request-123/undo',headers=OWNER_AUTH,
                           json={'expectedRevision':2,'confirmation':'undo_ai_change'}).json()
        assert undone['status']=='undone' and undone['revision']==3 and undone['undoRevision']==3
        restored=snap(client)
        assert restored['revision']==3 and 'task-a' not in restored['state']['record'].get('removed',{})
        assert client.post('/v1/ai/proposals/delete-request-123/undo',headers=OWNER_AUTH,
                           json={'expectedRevision':3,'confirmation':'undo_ai_change'}).json()['status']=='undone'


def test_delete_refuses_protected_and_past_tasks(tmp_path):
    plan=template('english')
    plan['days'].insert(0,{'date':'2026-10-01','items':[{'id':'task-past','title':'Old practice','minutes':10,
                                                         'type':'阅读','detail':'Synthetic guidance'}]})
    (tmp_path/'plan.json').write_text(json.dumps(plan))
    for task_id, reason in (('protected-done','completed_or_not_doing_task_is_protected'),
                            ('protected-skip','completed_or_not_doing_task_is_protected'),
                            ('task-past','past_task_cannot_be_deleted')):
        provider=delete_provider([{'operation':'delete','taskId':task_id}])
        with TestClient(create_app(db_path=tmp_path/('db-'+task_id),token_sha256=hashlib.sha256(OWNER.encode()).hexdigest(),
                                   template_dir=tmp_path,ai_config=SETTINGS,ai_provider=provider)) as client:
            client.put('/v1/snapshot/english',headers=OWNER_AUTH,json={'expectedRevision':0,'state':document()})
            from test_learning_memory import save,entry
            save(client,[entry('daily-budget','budget',value={'text':'Synthetic explicitly available time','minutes':92})])
            before=snap(client)
            proposal=chat(client,requestId='delete-'+task_id).json()
            assert proposal['status']=='rejected' and proposal['validationCode']==reason
            assert snap(client)==before


def test_undo_refuses_when_new_phone_records_arrived(tmp_path):
    (tmp_path/'plan.json').write_text(json.dumps(template('english')))
    provider=delete_provider([{'operation':'delete','taskId':'task-a'}])
    with TestClient(create_app(db_path=tmp_path/'db',token_sha256=hashlib.sha256(OWNER.encode()).hexdigest(),
                               template_dir=tmp_path,ai_config=SETTINGS,ai_provider=provider)) as client:
        client.put('/v1/snapshot/english',headers=OWNER_AUTH,json={'expectedRevision':0,'state':document()})
        from test_learning_memory import save,entry
        save(client,[entry('daily-budget','budget',value={'text':'Synthetic explicitly available time','minutes':92})])
        chat(client,requestId='delete-request-123')
        client.post('/v1/ai/proposals/delete-request-123/commit',headers=OWNER_AUTH,
                    json={'expectedRevision':1,'confirmation':'sync'})
        document_next=snap(client)['state']
        assert client.put('/v1/snapshot/english',headers=PROTO,
                          json={'expectedRevision':2,'state':document_next}).status_code==200
        before=snap(client)
        response=client.post('/v1/ai/proposals/delete-request-123/undo',headers=OWNER_AUTH,
                             json={'expectedRevision':2,'confirmation':'undo_ai_change'})
        assert response.status_code==409 and response.json()['detail']['code']=='ai_undo_conflict'
        assert snap(client)==before
