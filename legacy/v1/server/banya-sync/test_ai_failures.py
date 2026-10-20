"""Synthetic provider failures. No external API, production data or secrets."""
import hashlib,json,sqlite3
import urllib.error
import pytest
from fastapi.testclient import TestClient
from app import create_app
from deepseek_ai import call_deepseek,ProviderFailure
from test_deepseek_ai import SETTINGS,chat,snap,upstream
from test_agent_api import OWNER,OWNER_AUTH,document,template

@pytest.mark.parametrize('failure,expected',[(401,'provider_auth_failed'),(402,'provider_balance_low'),(429,'provider_rate_limited'),(503,'provider_unavailable'),('timeout','provider_timeout')])
def test_http_failure_is_sanitized_and_never_reads_or_retries(monkeypatch,failure,expected):
    calls=[]
    class Opener:
        def open(self,*args,**kwargs):
            calls.append(1)
            if failure=='timeout':raise TimeoutError('synthetic private failure')
            raise urllib.error.HTTPError('https://api.deepseek.com/chat/completions',failure,'synthetic private response',{},None)
    monkeypatch.setattr('urllib.request.build_opener',lambda *_:Opener())
    with pytest.raises(ProviderFailure) as e:call_deepseek(SETTINGS,{})
    assert e.value.code==expected and str(e.value)==expected and calls==[1]

@pytest.mark.parametrize('kind,code',[('balance','provider_balance_low'),('length','provider_output_limit'),('json','provider_invalid_response')])
def test_terminal_failure_can_be_queried_without_another_paid_request_or_plan_write(tmp_path,kind,code):
    (tmp_path/'plan.json').write_text(json.dumps(template('english')));calls=[]
    def provider(*_):
        calls.append(1)
        if kind=='balance':raise ProviderFailure('provider_balance_low')
        value=upstream([])
        if kind=='length':value['choices'][0]['finish_reason']='length'
        else:value['choices'][0]['message']['content']='not synthetic JSON'
        return value
    with TestClient(create_app(db_path=tmp_path/'db',token_sha256=hashlib.sha256(OWNER.encode()).hexdigest(),template_dir=tmp_path,ai_config=SETTINGS,ai_provider=provider,auto_worker=False)) as client:
        client.put('/v1/snapshot/english',headers=OWNER_AUTH,json={'expectedRevision':0,'state':document()});before=snap(client)
        result=chat(client).json();assert result['status']=='unknown' and result['terminal'] and result['errorCode']==code
        query=client.get('/v1/ai/requests/'+result['requestId'],headers=OWNER_AUTH).json();assert query['terminal'] and query['errorCode']==code
        assert chat(client).json()['errorCode']==code and len(calls)==1 and snap(client)==before
        assert client.get('/v1/ai/status',headers=OWNER_AUTH).json()['estimatedReservedUsd']>0
        assert 'synthetic private' not in json.dumps(result)


def test_stale_pending_is_not_misrepresented_as_a_completed_failure(tmp_path):
    (tmp_path/'plan.json').write_text(json.dumps(template('english')));db=tmp_path/'db'
    with TestClient(create_app(db_path=db,token_sha256=hashlib.sha256(OWNER.encode()).hexdigest(),template_dir=tmp_path,ai_config=SETTINGS,ai_provider=lambda *_:pytest.fail('No model call allowed'),auto_worker=False)) as client:
        with sqlite3.connect(db) as con:
            con.execute("INSERT INTO ai_requests(id,body_hash,subject,base_revision,template_hash,date_start,date_end,status,cost_nano,month,created_at,expires_at) VALUES('synthetic-stale','synthetic','english',1,'synthetic','x','x','pending',1,'synthetic',0,1)")
        result=client.get('/v1/ai/requests/synthetic-stale',headers=OWNER_AUTH).json()
        assert result['status']=='unknown' and result['terminal'] is False
