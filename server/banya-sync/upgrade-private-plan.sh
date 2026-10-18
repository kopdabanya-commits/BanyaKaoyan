#!/usr/bin/env bash
# Manual, reviewed deployment only. Never accepts study data or rotates credentials.
set -Eeuo pipefail
umask 077
[[ $(id -u) -eq 0 ]] || { echo 'root required' >&2; exit 1; }
release="${1:?reviewed release SHA required}"
[[ "$release" =~ ^[0-9a-f]{40}$ ]] || { echo 'invalid release' >&2; exit 1; }
source_dir="$(cd "$(dirname "$0")" && pwd)"
test -s /etc/banya-sync.env
test -x /opt/banya-sync/.venv/bin/python
test -s /var/lib/banya-sync/sync.sqlite3
# The matching frontend must be deployed first; installed phone clients are guarded by protocol checks.
[[ "$(readlink /var/www/banya-pwa/current)" == "/var/www/banya-pwa/releases/$release" ]] || { echo 'matching PWA release required first' >&2; exit 1; }
grep -Fq "private-plan-v1" /var/www/banya-pwa/current/cloud-sync.js
grep -Fq 'access_log off;' /etc/nginx/sites-available/banya-sync
nginx -t
for file in app.py agent_api.py private_plan.py agent-openapi.json; do test -s "$source_dir/$file"; done
/opt/banya-sync/.venv/bin/python -m py_compile "$source_dir/app.py" "$source_dir/agent_api.py" "$source_dir/private_plan.py"
previous="$(mktemp -d /root/banya-plan-upgrade.XXXXXX)"
cp -p /etc/banya-sync.env "$previous/environment"
for file in app.py agent_api.py private_plan.py agent-openapi.json; do
  if [[ -f "/opt/banya-sync/$file" ]]; then cp -p "/opt/banya-sync/$file" "$previous/$file"; fi
done
cd /opt/banya-sync
# Consistent private on-server backup BEFORE additive capability tables or any code replacement.
runuser -u banya-sync -- /opt/banya-sync/.venv/bin/python - <<'PY'
import sqlite3
from pathlib import Path
from backup_db import backup_once
saved = backup_once(Path('/var/lib/banya-sync/sync.sqlite3'), Path('/var/lib/banya-sync/backups'))
with sqlite3.connect('file:' + str(saved) + '?mode=ro', uri=True) as con:
    assert con.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
print('Private pre-upgrade backup integrity verified; no study data printed.')
PY
rollback(){
  cp -p "$previous/environment" /etc/banya-sync.env
  for file in app.py agent_api.py private_plan.py agent-openapi.json; do
    if [[ -f "$previous/$file" ]]; then cp -p "$previous/$file" "/opt/banya-sync/$file"; else rm -f "/opt/banya-sync/$file"; fi
  done
  systemctl restart banya-sync.service || true
  echo 'Code/config restored. Private database was not replaced; retain the verified backup.' >&2
}
trap rollback ERR
for file in app.py agent_api.py private_plan.py agent-openapi.json; do install -m 0644 "$source_dir/$file" "/opt/banya-sync/$file"; done
python3 - <<'PY'
from pathlib import Path
p = Path('/etc/banya-sync.env')
lines = [line for line in p.read_text().splitlines() if not line.startswith(('BANYA_AGENT_ENABLED=', 'BANYA_TEMPLATE_DIR='))]
p.write_text('\n'.join(lines + ['BANYA_AGENT_ENABLED=1', 'BANYA_TEMPLATE_DIR=/var/www/banya-pwa/current']) + '\n')
p.chmod(0o600)
PY
systemctl restart banya-sync.service
ready=false
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl --fail --silent --max-time 3 http://127.0.0.1:8765/health >/dev/null; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]]
systemctl is-active --quiet banya-sync.service
curl --noproxy '*' --resolve 124.70.128.201:443:127.0.0.1 --fail --silent --show-error --max-time 10 https://124.70.128.201/v1/agent/openapi.json >/dev/null
for path in capabilities grants; do
  status_code="$(curl --noproxy '*' --resolve 124.70.128.201:443:127.0.0.1 --silent --show-error --max-time 10 -o /dev/null -w '%{http_code}' "https://124.70.128.201/v1/agent/$path")"
  [[ "$status_code" == 401 ]]
done
trap - ERR
echo 'Capability channel deployed. No grant created, private plan changed, or ChatGPT connection established by deployment.'
