"""Public HTTPS-only checks, never reads authorized private data."""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.error
import urllib.request
from ecs_package import ASSETS


def verify(base,root):
    def get(path):
        try:
            with urllib.request.urlopen(base+path,timeout=15) as r:return r.status,r.read(),r.headers
        except urllib.error.HTTPError as e:return e.code,b'',e.headers
    for path in ASSETS:
        status,body,headers=get('/'+path)
        assert status==200 and hashlib.sha256(body).digest()==hashlib.sha256((root/path).read_bytes()).digest(),'PWA resource mismatch'
        if path=='index.html':assert "connect-src 'self' https://124.70.128.201;" in headers.get('Content-Security-Policy',''),'CSP mismatch'
    status,body,_=get('/health');assert status==200 and json.loads(body).get('service')=='banya-study-sync','Backend health failed'
    for path in ('/v1/snapshot/english','/v1/snapshot/politics'):
        assert get(path)[0]==401,'Unauthorized snapshot access accepted'
    for path in ('/server/banya-sync/app.py','/docs/PROJECT_STATUS.md','/AGENTS.md','/SHA256SUMS'):
        assert get(path)[0]==404,'Private file exposed'

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--base',default='https://124.70.128.201');args=p.parse_args()
    verify(args.base,args.root)
    print('ECS TLS, complete resource hashes, health, unauthorized 401 and private-file 404 verified.')
