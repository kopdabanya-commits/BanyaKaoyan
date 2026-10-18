"""Operator verification mocked locally: no production or model calls."""
import copy,importlib.util,json
from pathlib import Path
import pytest
spec=importlib.util.spec_from_file_location('real_probe',Path(__file__).parents[2]/'scripts/verify_real_ai.py')
probe=importlib.util.module_from_spec(spec);spec.loader.exec_module(probe)


def fake(fail=False):
    calls=[];enabled=False;revision=0
    def api(path,method='GET',body=None):
        nonlocal enabled,revision
        calls.append((path,method,copy.deepcopy(body)))
        if path=='status':return {'configuredReady':True,'ready':enabled,'currency':'CNY','monthlyBudget':50,'monthlyCallLimit':None,'estimatedReserved':0.1,'monthlyCalls':2,'activation':{'enabled':enabled,'revision':revision}}
        if path=='auto/status':return {'control':{'enabled':False}}
        if path.startswith('snapshot/'):return {'revision':1,'state':{'private-canary':'synthetic private record'}}
        if path=='activation':enabled=body['enabled'];revision+=1;return {}
        if path=='chat':
            if fail:raise TimeoutError('synthetic sensitive upstream body')
            return {'status':'discussion','changes':[],'reply':'私人合成文本，不可打印','usage':{'total_tokens':20},'previewOnly':True,'analysis':{'uncertainties':['synthetic unknown']}}
        raise AssertionError('unexpected route')
    return api,calls


def test_real_verification_never_commits_or_logs_private_text():
    api,calls=fake();result=probe.verify(api)
    assert len(result['checks'])==2 and result['snapshotsUnchanged']
    assert 'private-canary' not in json.dumps(result) and '私人' not in json.dumps(result,ensure_ascii=False)
    assert [(p,m) for p,m,_ in calls if m!='GET']==[('activation','POST'),('chat','POST'),('chat','POST')]


def test_timeout_pauses_without_repeating_paid_request():
    api,calls=fake(True)
    with pytest.raises(TimeoutError):probe.verify(api)
    assert sum(p=='chat' for p,_,_ in calls)==1
    assert calls[-1][0]=='activation' and calls[-1][2]['enabled'] is False


def test_probe_route_allowlist_refuses_commit_before_network(monkeypatch):
    monkeypatch.setattr(probe.urllib.request,'build_opener',lambda *_:pytest.fail('network must not run'))
    with pytest.raises(RuntimeError):probe.client('proposals/private/commit','POST',{})
    with pytest.raises(RuntimeError):probe.client('snapshot/english','PUT',{})
