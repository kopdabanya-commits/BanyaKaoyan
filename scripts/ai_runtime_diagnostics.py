"""Read-only production checks. No model calls, study records, or credential output."""
import json
import sqlite3
import urllib.request
import urllib.error
from decimal import Decimal
from pathlib import Path

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs): return None


def fetch(path, key):
    if path not in ('/user/balance', '/models'): raise ValueError('read-only path required')
    request=urllib.request.Request('https://api.deepseek.com'+path,headers={'Authorization':'Bearer '+key})
    try:
        with urllib.request.build_opener(NoRedirect()).open(request,timeout=15) as response:
            return {'status':response.status,'data':json.load(response)}
    except urllib.error.HTTPError as error:return {'status':error.code}
    except Exception:return {'status':'connection_failed'}


def diagnose(settings, con, getter=fetch):
    key=settings.get('DEEPSEEK_API_KEY','').strip().strip('"').strip("'")
    result={'keyPresent':bool(key),'paidRequests':0}
    if key:
        balance=getter('/user/balance',key);data=balance.get('data',{})
        result['balanceHttpStatus']=balance['status']
        if balance['status']==200:
            result['accountAvailable']=data.get('is_available') is True
            result['positiveBalance']=any(Decimal(str(x.get('total_balance','0')))>0 for x in data.get('balance_infos',[]))
        models=getter('/models',key)
        result['modelsHttpStatus']=models['status']
        if models['status']==200:result['configuredModelListed']=any(x.get('id')=='deepseek-flash' for x in models.get('data',{}).get('data',[]))
    result['pendingChat']=bool(con.execute("SELECT 1 FROM ai_requests WHERE status='pending' LIMIT 1").fetchone())
    result['pendingAutomation']=bool(con.execute("SELECT 1 FROM auto_runs WHERE status='pending' LIMIT 1").fetchone())
    # Select only failure enums. Never fetch original messages, snapshots or successful replies.
    allowed={'provider_auth_failed','provider_balance_low','provider_rate_limited','provider_request_rejected','provider_timeout','provider_unavailable','provider_invalid_response','provider_output_limit','ai_activation_changed'}
    codes=[row[0] for row in con.execute("SELECT json_extract(result_json,'$.errorCode') FROM ai_requests WHERE status='unknown' ORDER BY created_at DESC LIMIT 5")]
    result['recentFailureCodes']=sorted({x if x in allowed else 'legacy_unclassified' for x in codes})
    return result


if __name__=='__main__':
    try:
        path=Path('/etc/banya-sync.env')
        assert path.is_file() and not path.is_symlink() and not path.stat().st_mode&0o077
        settings=dict(line.split('=',1) for line in path.read_text().splitlines() if '=' in line and not line.lstrip().startswith('#'))
        with sqlite3.connect('file:'+settings.get('BANYA_DB_PATH','/var/lib/banya-sync/sync.sqlite3')+'?mode=ro',uri=True) as con:
            con.execute('PRAGMA query_only=ON')
            report=diagnose(settings,con)
        print(json.dumps(report,ensure_ascii=False))
    except Exception:raise SystemExit('Read-only AI diagnostics stopped; no secret or private response emitted.') from None
