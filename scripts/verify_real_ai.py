"""Explicitly authorized real, read-only advice verification. Never logs private text.
Owner credential stays in the runner environment; no retries or plan commit routes.
"""
import json
import os
import re
import uuid
from datetime import datetime, timezone
import urllib.request

BASE = 'https://124.70.128.201'


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def client(path, method='GET', body=None):
    allowed = path in ('status', 'auto/status') and method == 'GET'
    allowed |= path == 'activation' and method == 'POST'
    allowed |= path == 'chat' and method == 'POST'
    allowed |= path in ('snapshot/english', 'snapshot/politics') and method == 'GET'
    if not allowed:
        raise RuntimeError('Verification route refused')
    url = BASE + ('/v1/' if path.startswith('snapshot/') else '/v1/ai/') + path
    headers = {'Authorization': 'Bearer ' + os.environ['BANYA_OWNER_TOKEN'],
               'X-Banya-Plan-Protocol': '1', 'Content-Type': 'application/json'}
    request = urllib.request.Request(url, headers=headers, method=method,
                                     data=None if body is None else json.dumps(body).encode())
    # A timeout has an unknown paid outcome; never retry it automatically.
    with urllib.request.build_opener(NoRedirect()).open(request, timeout=115) as response:
        return json.load(response)


def verify(api, expected_budget=50, expected_currency="CNY", expected_limit=None):
    status = api('status')
    assert status['configuredReady'] and status['currency'] == expected_currency
    assert status['monthlyBudget'] == expected_budget and status['monthlyCallLimit'] == expected_limit
    assert not api('auto/status')['control']['enabled']
    before = {s: api('snapshot/' + s) for s in ('english', 'politics')}
    available = [s for s in before if before[s]['revision'] > 0]
    if not available:
        raise RuntimeError('Phone first sync required; no synthetic production snapshot will be created')
    api('activation', 'POST', {'expectedRevision': status['activation']['revision'],
                             'enabled': True, 'confirmation': 'set_ai_activation'})
    receipts = []
    try:
        # Two independent real calls: ordinary discussion and structured diagnosis.
        for mode in (None, 'diagnosis'):
            subject = available[0]
            today = datetime.now(timezone.utc).date().isoformat()
            body = {'requestId': 'live-verification-' + uuid.uuid4().hex,
                    'subject': subject, 'start': today, 'end': today,
                    'expectedRevision': before[subject]['revision'], 'shareReview': False,
                    'consent': True, 'messages': [{'role': 'user', 'content':
                    '这是正式接入验证。请简短说明现有资料是否足够进行学习规划，指出未知信息。'
                    '不要编造完成情况，不要复述私人细节，不提出任务改动，changes/proposedChanges 必须为空。'}]}
            if mode:
                body.update(planningMode=mode, targetDate=today)
            result = api('chat', 'POST', body)
            assert result['status'] == 'discussion' and not result.get('changes')
            assert re.search('[\u4e00-\u9fff]', result['reply'])
            assert result.get('usage', {}).get('total_tokens', 0) > 0
            if mode:
                assert result['previewOnly'] and result['analysis']['uncertainties']
            receipts.append({'mode': mode or 'discussion', 'usage': result['usage'],
                             'status': result['status'], 'chineseReply': True, 'planCommitted': False})
        after = {s: api('snapshot/' + s) for s in ('english', 'politics')}
        assert before == after, 'Concurrent phone records changed; do not overwrite or restore'
        status = api('status')
        assert status['ready'] and status['estimatedReserved'] <= expected_budget
        assert not api('auto/status')['control']['enabled']
        return {'checks': receipts, 'currency': status['currency'],
                'monthlyBudget': status['monthlyBudget'], 'monthlyCallLimit': status['monthlyCallLimit'],
                'monthlyCalls': status['monthlyCalls'], 'reserved': status['estimatedReserved'],
                'snapshotsUnchanged': True, 'automaticManagement': False}
    except Exception:
        # Fail closed without logging exception bodies or repeating a paid request.
        try:
            current = api('status')
            api('activation', 'POST', {'expectedRevision': current['activation']['revision'],
                                     'enabled': False, 'confirmation': 'set_ai_activation'})
        except Exception:
            pass
        raise


if __name__ == '__main__':
    try:
        print(json.dumps(verify(client,float(os.environ["BUDGET"]),os.environ["CURRENCY"],None if os.environ["CALLS"]=="unlimited" else int(os.environ["CALLS"])), ensure_ascii=False))
    except Exception:
        raise SystemExit('Real verification stopped safely; no plan commit or automatic retry. Inspect private server status if needed.') from None
