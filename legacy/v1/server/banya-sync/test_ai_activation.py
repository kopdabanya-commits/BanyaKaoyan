"""Synthetic configuration and approval only. No real API requests or production files."""
import hashlib,json,sqlite3
from dataclasses import replace
import pytest
from fastapi.testclient import TestClient
from app import create_app
from deepseek_ai import AIConfig,from_environment,ai_allowed,activation,initialize_activation
from configure_ai import render
from test_agent_api import OWNER,OWNER_AUTH,document,template
from test_deepseek_ai import SETTINGS,chat,upstream,snap

@pytest.fixture
def approved(tmp_path):
    for subject,name in [('english','plan.json'),('politics','politics-plan.json')]:
        (tmp_path/name).write_text(json.dumps(template(subject)))
    calls=[];during={'callback':None};db=tmp_path/'db'
    config=replace(SETTINGS,owner_approval_required=True,approval_stamp='synthetic-config-v1')
    def provider(config,payload):
        calls.append(payload)
        if during['callback']:during['callback']()
        return {**upstream(),'id':'synthetic-provider-id','usage':{'prompt_tokens':11,'completion_tokens':22,'total_tokens':33,'reasoning_content':'discard'}}
    app=create_app(db_path=db,token_sha256=hashlib.sha256(OWNER.encode()).hexdigest(),template_dir=tmp_path,ai_config=config,ai_provider=provider,auto_worker=False)
    with TestClient(app) as c:
        for subject in ('english','politics'):
            assert c.put('/v1/snapshot/'+subject,headers=OWNER_AUTH,json={'expectedRevision':0,'state':document(subject)}).status_code==200
        from test_learning_memory import save,entry
        assert save(c,[entry('budget','budget',value={'text':'Synthetic budget','minutes':92})]).status_code==200
        yield c,db,calls,during,config

def set_active(c,enabled=True,revision=0):
    return c.post('/v1/ai/activation',headers=OWNER_AUTH,json={'expectedRevision':revision,'enabled':enabled,'confirmation':'set_ai_activation'})

def test_configuration_requires_owner_approval_and_status_never_calls(approved):
    c,db,calls,_,_=approved
    assert c.get('/v1/ai/status').status_code==401
    assert c.post('/v1/ai/activation',json={}).status_code==401
    s=c.get('/v1/ai/status',headers=OWNER_AUTH).json()
    assert s['configuredReady'] and not s['ready'] and s['activation']=={'revision':0,'enabled':False}
    assert chat(c).status_code==503 and not calls
    assert set_active(c).json()['providerCalled'] is False
    assert not calls
    assert set_active(c).status_code==409
    result=chat(c).json()
    assert result['status']=='prepared' and len(calls)==1
    assert result['usage']=={'prompt_tokens':11,'completion_tokens':22,'total_tokens':33}
    assert result['providerRequestId']=='synthetic-provider-id'
    assert set_active(c,False,1).status_code==200
    assert c.post('/v1/ai/proposals/synthetic-request-123/commit',headers=OWNER_AUTH,json={'expectedRevision':1,'confirmation':'sync'}).status_code==503
    assert snap(c)['revision']==1

def test_disable_during_model_call_prevents_preview_or_write(approved):
    c,db,calls,during,_=approved;set_active(c)
    before=snap(c)
    def disable():
        with sqlite3.connect(db) as con:con.execute('UPDATE ai_activation SET enabled=0,revision=revision+1')
    during['callback']=disable
    assert chat(c).json()['status']=='unknown'
    assert len(calls)==1 and snap(c)==before

def test_config_replacement_requires_new_approval_and_restart_preserves_it(approved):
    c,db,calls,_,config=approved;set_active(c)
    initialize_activation(db)
    with sqlite3.connect(db) as con:
        assert activation(con)['revision']==1 and ai_allowed(config,con)
        assert not ai_allowed(replace(config,approval_stamp='synthetic-new-config'),con)
    assert not calls

@pytest.mark.parametrize('key',['short','synthetic\nBANYA_AI_ENABLED=1','synthetic;$(execute-command)','synthetic key with spaces'])
def test_configuration_rejects_unsafe_credentials(key):
    with pytest.raises(ValueError):render('BANYA_DB_PATH=synthetic\n',key,'install-disabled')

def test_config_preserves_sync_and_defaults_disabled_and_zero_budget(monkeypatch):
    result=render('BANYA_DB_PATH=synthetic\nBANYA_SYNC_TOKEN_SHA256=synthetic-digest\nBANYA_AI_ENABLED=1\n','synthetic-key-'+'x'*25,'install-disabled','2','40')
    assert 'BANYA_DB_PATH=synthetic\n' in result and 'BANYA_SYNC_TOKEN_SHA256=synthetic-digest' in result
    assert result.count('BANYA_AI_ENABLED=')==1 and 'BANYA_AI_ENABLED=0' in result and 'BANYA_AUTO_ENABLED=0' in result
    assert 'DEEPSEEK_MONTHLY_BUDGET_USD=0' in result
    for line in result.splitlines():
        key,value=line.split('=',1);monkeypatch.setenv(key,value)
    config=from_environment()
    assert config.owner_approval_required and config.approval_stamp and not config.ready
    for budget,calls in [('NaN','1'),('101','1'),('2','1001'),('0','40'),('2','0')]:
        with pytest.raises(ValueError):render('', 'synthetic-key-'+'x'*25,'prepare-enabled',budget,calls)
    enabled=render('', 'synthetic-key-'+'x'*25,'prepare-enabled','2','40')
    assert 'BANYA_AI_ENABLED=1' in enabled and 'BANYA_AUTO_ENABLED=0' in enabled
    assert 'DEEPSEEK_MONTHLY_BUDGET_USD=2' in enabled and 'DEEPSEEK_MONTHLY_CALLS=40' in enabled


def test_provider_receipt_excludes_reasoning_and_credentials():
    from deepseek_ai import provider_receipt
    assert provider_receipt({'id':SETTINGS.api_key,'usage':{'total_tokens':12,'reasoning_content':'synthetic hidden thought'}},SETTINGS)=={'providerRequestId':'','usage':{'total_tokens':12}}
    assert provider_receipt({'id':'bad\nheader','usage':['invalid']},SETTINGS)=={'providerRequestId':'','usage':{}}
