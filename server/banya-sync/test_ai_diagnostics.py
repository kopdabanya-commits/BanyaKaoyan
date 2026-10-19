"""Synthetic account checks and one-call script; no network or private production data."""
import importlib.util,json,sqlite3
from pathlib import Path
import pytest

ROOT=Path(__file__).parents[2]
def module(name):
    spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/f'{name}.py');value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

def test_readonly_diagnostics_report_only_safe_account_and_failure_flags(tmp_path):
    m=module('ai_runtime_diagnostics');db=tmp_path/'db'
    with sqlite3.connect(db) as con:
        con.executescript('CREATE TABLE ai_requests(status,result_json,created_at);CREATE TABLE auto_runs(status);')
        con.execute('INSERT INTO ai_requests VALUES(?,?,?)',('unknown',json.dumps({'reply':'Synthetic private text never log','errorCode':'provider_timeout'}),1))
        before=con.total_changes;paths=[]
        def get(path,key):
            paths.append(path)
            return {'status':200,'data':{'is_available':False,'balance_infos':[{'total_balance':'0.00'}]}} if path=='/user/balance' else {'status':200,'data':{'data':[{'id':'deepseek-flash'}]}}
        result=m.diagnose({'DEEPSEEK_API_KEY':'configured'},con,get)
        assert paths==['/user/balance','/models'];assert result['paidRequests']==0 and not result['positiveBalance'];assert result['configuredModelListed'];assert con.total_changes==before
        assert 'Synthetic private' not in json.dumps(result) and 'configured"' not in json.dumps(result)

def test_single_paid_check_never_activates_retries_or_commits_and_omits_reply(capsys):
    m=module('verify_one_chat');paths=[]
    def api(path,body=None):
        paths.append((path,body is not None))
        if path=='status':return {'ready':True,'currency':'CNY','monthlyBudget':50}
        if path.startswith('snapshot/'):return {'revision':1,'state':{'synthetic':'private'}}
        if path=='auto/status':return {'control':{'enabled':True},'grants':[{'enabled':True}]}
        if path=='chat':return {'status':'discussion','reply':'Synthetic private response','changes':[],'usage':{'total_tokens':1}}
        pytest.fail('Unexpected route')
    m.verify(api);assert sum(p=='chat' for p,_ in paths)==1
    assert all(p not in ('activation','auto/control') and 'commit' not in p for p,_ in paths)
    assert 'private response' not in capsys.readouterr().out
