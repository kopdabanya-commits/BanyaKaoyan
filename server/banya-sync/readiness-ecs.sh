#!/usr/bin/env bash
# Read-only production inventory plus isolated synthetic API regression.
# Never reads or prints production bearer token, server env digest, or user notes.
set -Eeuo pipefail
umask 077
echo "== ECS production read-only checks =="
systemctl is-active --quiet banya-sync.service && echo "backend: active"
systemctl is-enabled --quiet banya-sync.service && echo "backend: enabled"
systemctl is-active --quiet banya-sync-backup.timer && echo "sqlite backup timer: active"
systemctl is-enabled --quiet banya-sync-backup.timer && echo "sqlite backup timer: enabled"
test "$(curl --noproxy '*' -sS -o /dev/null -w '%{http_code}' --max-time 8 https://124.70.128.201/health)" = 200
echo "public HTTPS /health: HTTP 200 (TLS verified)"
for sub in english politics; do
  test "$(curl --noproxy '*' -sS -o /dev/null -w '%{http_code}' --max-time 8 "https://124.70.128.201/v1/snapshot/$sub")" = 401
  echo "$sub without authorization: HTTP 401"
done
python3 - <<'PY'
import datetime, os, sqlite3
p='/var/lib/banya-sync/sync.sqlite3'
if os.path.exists(p):
  with sqlite3.connect('file:'+p+'?mode=ro',uri=True) as con:
    count=con.execute('SELECT COUNT(*) FROM snapshots').fetchone()[0]
  print('production snapshot rows (count only):', count)
else:
  print('production database missing')
p='/var/lib/banya-sync/backups'
files=[os.path.join(p,f) for f in os.listdir(p) if f.endswith('.sqlite3')] if os.path.isdir(p) else []
print('backup file count:',len(files))
if files:
  age=(datetime.datetime.now(datetime.timezone.utc).timestamp()-max(os.path.getmtime(f) for f in files))/3600
  print('newest backup age hours:',round(age,1))
PY
openssl x509 -in /etc/letsencrypt/live/124.70.128.201/cert.pem -noout -startdate -enddate -serial
systemctl list-timers --all --no-pager | grep -Ei 'certbot|banya-sync-backup|snap.certbot' || true
echo "== isolated scratch API integration (no writes to production) =="
/opt/banya-sync/.venv/bin/python - <<'PY'
import os, sys, json, time, secrets, hashlib, socket, shutil, tempfile, subprocess, urllib.request, urllib.error
from pathlib import Path
d=tempfile.mkdtemp(prefix='banya-isolated-api-',dir='/tmp')
token=secrets.token_urlsafe(48)
env=dict(os.environ, BANYA_DB_PATH=str(Path(d)/'scratch.sqlite3'),
 BANYA_SYNC_TOKEN_SHA256=hashlib.sha256(token.encode()).hexdigest(),
 BANYA_ALLOWED_ORIGIN='https://english-ii-plan.kopdabanya.workers.dev')
port=18765
def start():
 p=subprocess.Popen(['/opt/banya-sync/.venv/bin/uvicorn','app:create_app','--factory',
 '--app-dir','/opt/banya-sync','--host','127.0.0.1','--port',str(port),'--no-access-log'],
 env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 for _ in range(40):
  try:
   with urllib.request.urlopen('http://127.0.0.1:%d/health'%port,timeout=1) as r:
    if r.status==200:return p
  except Exception:time.sleep(.25)
 p.terminate();raise RuntimeError('scratch API startup failed')
def request(method,subject,body=None):
 headers={'Authorization':'Bearer '+token}
 if body is not None:headers['Content-Type']='application/json'
 data=json.dumps(body).encode() if body is not None else None
 req=urllib.request.Request('http://127.0.0.1:%d/v1/snapshot/%s'%(port,subject),
 data=data,headers=headers,method=method)
 try:
  with urllib.request.urlopen(req,timeout=6) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,None
def pack(s):return {'schema':'banya.sync.v1','subject':s,'record':{'done':{'synthetic':True},'notes':{'synthetic':'scratch only'}}}
p=None
try:
 p=start()
 for s in ['english','politics']:
  status,obj=request('GET',s)
  assert status==200 and obj['revision']==0
  status,obj=request('PUT',s,{'expectedRevision':0,'state':pack(s)})
  assert status==200 and obj['revision']==1
  status,obj=request('GET',s)
  assert status==200 and obj['state']['subject']==s and obj['revision']==1
 status,obj=request('PUT','english',{'expectedRevision':0,'state':pack('english')})
 assert status==409
 status,obj=request('PUT','english',{'expectedRevision':1,'state':pack('politics')})
 assert status==422
 p.terminate();p.wait(timeout=8);p=None
 p=start()
 for s in ['english','politics']:
  status,obj=request('GET',s)
  assert status==200 and obj['revision']==1 and obj['state']['subject']==s
 print('scratch API tests: two-subject PUT/GET, 409 conflict, 422 cross-subject, restart persistence PASS')
finally:
 if p is not None:
  p.terminate()
  try:p.wait(timeout=8)
  except subprocess.TimeoutExpired:p.kill()
 shutil.rmtree(d,ignore_errors=True)
PY
