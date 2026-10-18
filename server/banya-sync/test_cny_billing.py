"""Synthetic ledgers only; never contacts the provider."""
import hashlib,json,sqlite3
from dataclasses import replace
import pytest
from fastapi.testclient import TestClient
from app import create_app
from configure_ai import render
from deepseek_ai import from_environment,initialize_ai
from test_deepseek_ai import SETTINGS,upstream,chat,snap
from test_agent_api import OWNER,OWNER_AUTH,document,template


def test_native_cny_unlimited_configuration_keeps_automation_disabled(monkeypatch):
    text=render('', 'synthetic-key-'+'x'*25,'prepare-enabled','50','unlimited','CNY')
    for line in text.splitlines():
        k,v=line.split('=',1);monkeypatch.setenv(k,v)
    c=from_environment()
    assert c.ready and c.currency=='CNY' and c.monthly_budget_nano==50_000_000_000
    assert c.monthly_calls is None and (c.input_nano_per_token,c.output_nano_per_token)==(2000,8000)
    assert 'BANYA_AUTO_ENABLED=0' in text and 'DEEPSEEK_MONTHLY_BUDGET_USD=0' in text


def test_currency_change_cannot_reset_existing_paid_reservations(tmp_path):
    db=tmp_path/'db';initialize_ai(db)
    with sqlite3.connect(db) as con:
        con.execute("INSERT INTO ai_requests(id,body_hash,subject,base_revision,template_hash,date_start,date_end,status,cost_nano,month,created_at,expires_at) VALUES('synthetic','s','english',1,'s','x','x','unknown',100,'old-month',1,1)")
    with pytest.raises(RuntimeError,match='cannot be reset'):initialize_ai(db,'CNY')
    with sqlite3.connect(db) as con:
        assert con.execute('SELECT currency FROM ai_billing_policy').fetchone()[0]=='USD'
        assert con.execute('SELECT cost_nano FROM ai_requests').fetchone()[0]==100


def test_unlimited_monthly_calls_still_enforces_cny_budget_and_preserves_records(tmp_path):
    (tmp_path/'plan.json').write_text(json.dumps(template('english')))
    db=tmp_path/'db';calls=[]
    config=replace(SETTINGS,currency='CNY',monthly_calls=None,monthly_budget_nano=50_000_000_000,input_nano_per_token=2000,output_nano_per_token=8000)
    def provider(*_):calls.append(1);return upstream([])
    with TestClient(create_app(db_path=db,token_sha256=hashlib.sha256(OWNER.encode()).hexdigest(),template_dir=tmp_path,ai_config=config,ai_provider=provider)) as c:
        assert c.put('/v1/snapshot/english',headers=OWNER_AUTH,json={'expectedRevision':0,'state':document('english')}).status_code==200
        old=snap(c)
        with sqlite3.connect(db) as con:
            # Over the legacy maximum call count, still below the money budget.
            month=__import__('datetime').datetime.now(__import__('datetime').timezone.utc).strftime('%Y-%m')
            con.executemany("INSERT INTO ai_requests(id,body_hash,subject,base_revision,template_hash,date_start,date_end,status,cost_nano,month,created_at,expires_at) VALUES(?,'s','english',1,'s','x','x','discussion',1,?,1,1)",[(f'synthetic-{n}',month) for n in range(1002)])
        result=chat(c).json();assert result['status']=='discussion' and len(calls)==1
        status=c.get('/v1/ai/status',headers=OWNER_AUTH).json()
        assert status['currency']=='CNY' and status['monthlyCallLimit'] is None and status['monthlyBudget']==50
        assert status['monthlyBudgetUsd'] is None and status['estimatedReserved']>0
        with sqlite3.connect(db) as con:con.execute('UPDATE ai_requests SET cost_nano=50000000000 WHERE id=?',('synthetic-0',))
        assert chat(c,requestId='synthetic-over-budget').status_code==429 and len(calls)==1
        assert snap(c)==old


def test_old_client_cannot_enable_cny_using_a_dollar_confirmation(tmp_path):
    config=replace(SETTINGS,currency='CNY',owner_approval_required=True,approval_stamp='synthetic-cny',monthly_calls=None)
    with TestClient(create_app(db_path=tmp_path/'db',token_sha256=hashlib.sha256(OWNER.encode()).hexdigest(),ai_config=config)) as c:
        body={'expectedRevision':0,'enabled':True,'confirmation':'set_ai_activation'}
        assert c.post('/v1/ai/activation',headers=OWNER_AUTH,json=body).status_code==409
        assert c.post('/v1/ai/activation',headers=OWNER_AUTH,json={**body,'currency':'CNY'}).status_code==200
