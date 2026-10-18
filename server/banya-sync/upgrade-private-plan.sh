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
# Public operational metadata only; never print environment contents or records.
systemctl is-active --quiet nginx
systemctl is-active --quiet banya-sync.service
nginx -t
openssl x509 -in /etc/letsencrypt/live/124.70.128.201/cert.pem -noout -enddate
df -h /var/lib/banya-sync
free -m
if [[ -f /opt/banya-sync/RELEASE_SHA ]]; then cat /opt/banya-sync/RELEASE_SHA; else sha256sum /opt/banya-sync/app.py; fi
python3 - <<'PREFLIGHT'
from pathlib import Path
values=dict(line.split('=',1) for line in Path('/etc/banya-sync.env').read_text().splitlines() if '=' in line and not line.startswith('#'))
print('Server DeepSeek key present:', bool(values.get('DEEPSEEK_API_KEY','').strip().strip('"').strip("'")))
assert Path('/etc/banya-sync.env').stat().st_mode & 0o077 == 0
PREFLIGHT
# The matching frontend must be deployed first; installed phone clients are guarded by protocol checks.
[[ "$(readlink /var/www/banya-pwa/current)" == "/var/www/banya-pwa/releases/$release" ]] || { echo 'matching PWA release required first' >&2; exit 1; }
grep -Fq "private-plan-v1" /var/www/banya-pwa/current/cloud-sync.js
grep -Fq 'access_log off;' /etc/nginx/sites-available/banya-sync
nginx -t
for file in app.py backup_db.py autonomous.py agent_api.py deepseek_ai.py learning_memory.py learning_policy.py learning_analysis.py learning_planner.py context_engine.py capabilities.py private_plan.py agent-openapi.json upgrade_guard.py; do test -s "$source_dir/$file"; done
/opt/banya-sync/.venv/bin/python -m py_compile "$source_dir/app.py" "$source_dir/autonomous.py" "$source_dir/agent_api.py" "$source_dir/deepseek_ai.py" "$source_dir/learning_memory.py" "$source_dir/learning_policy.py" "$source_dir/learning_analysis.py" "$source_dir/learning_planner.py" "$source_dir/context_engine.py" "$source_dir/capabilities.py" "$source_dir/private_plan.py"
previous="$(mktemp -d /root/banya-plan-upgrade.XXXXXX)"
cp -p /etc/banya-sync.env "$previous/environment"
if [[ -f /opt/banya-sync/RELEASE_SHA ]]; then cp -p /opt/banya-sync/RELEASE_SHA "$previous/RELEASE_SHA"; fi
for file in app.py backup_db.py autonomous.py agent_api.py deepseek_ai.py learning_memory.py learning_policy.py learning_analysis.py learning_planner.py context_engine.py capabilities.py private_plan.py agent-openapi.json; do
  if [[ -f "/opt/banya-sync/$file" ]]; then cp -p "/opt/banya-sync/$file" "$previous/$file"; fi
done
cd /opt/banya-sync
rollback(){
  cp -p "$previous/environment" /etc/banya-sync.env
  if [[ -f "$previous/RELEASE_SHA" ]]; then cp -p "$previous/RELEASE_SHA" /opt/banya-sync/RELEASE_SHA; else rm -f /opt/banya-sync/RELEASE_SHA; fi
  for file in app.py backup_db.py autonomous.py agent_api.py deepseek_ai.py learning_memory.py learning_policy.py learning_analysis.py learning_planner.py context_engine.py capabilities.py private_plan.py agent-openapi.json; do
    if [[ -f "$previous/$file" ]]; then cp -p "$previous/$file" "/opt/banya-sync/$file"; else rm -f "/opt/banya-sync/$file"; fi
  done
  systemctl restart banya-sync.service || true
  echo 'Code/config restored. Private database was not replaced; retain the verified backup.' >&2
}
trap rollback ERR
# Freeze phone writes only for the backup/additive initialization window.
systemctl is-active --quiet banya-sync.service
systemctl stop banya-sync.service
backup_path="$(runuser -u banya-sync -- /opt/banya-sync/.venv/bin/python - backup < "$source_dir/upgrade_guard.py")"
test -s "$backup_path"
echo 'Private pre-upgrade backup integrity verified; no study data printed.'
for file in app.py backup_db.py autonomous.py agent_api.py deepseek_ai.py learning_memory.py learning_policy.py learning_analysis.py learning_planner.py context_engine.py capabilities.py private_plan.py agent-openapi.json; do install -m 0644 "$source_dir/$file" "/opt/banya-sync/$file"; done
python3 - <<'PY'
from pathlib import Path
p = Path('/etc/banya-sync.env')
lines = [line for line in p.read_text().splitlines() if not line.startswith(('BANYA_AGENT_ENABLED=', 'BANYA_TEMPLATE_DIR=', 'BANYA_AI_ENABLED=', 'BANYA_AUTO_ENABLED=', 'DEEPSEEK_MONTHLY_BUDGET_USD=', 'DEEPSEEK_MONTHLY_CALLS='))]
p.write_text('\n'.join(lines + ['BANYA_AGENT_ENABLED=1', 'BANYA_TEMPLATE_DIR=/var/www/banya-pwa/current', 'BANYA_AI_ENABLED=0', 'BANYA_AUTO_ENABLED=0', 'DEEPSEEK_MONTHLY_BUDGET_USD=0', 'DEEPSEEK_MONTHLY_CALLS=0']) + '\n')
p.chmod(0o600)
PY
# Initialize only additive tables while external writes remain stopped, then prove
# exact preservation before allowing the service to accept phone requests again.
runuser -u banya-sync -- /opt/banya-sync/.venv/bin/python - <<'PYINIT'
from pathlib import Path
from app import initialize
from agent_api import initialize_agent
from autonomous import initialize_auto
from learning_memory import initialize_memory
from deepseek_ai import from_environment, initialize_ai, initialize_activation
from private_plan import load_template
for subject in ("english", "politics"):
    load_template(Path("/var/www/banya-pwa/current"), subject)
db = Path('/var/lib/banya-sync/sync.sqlite3')
initialize(db)
initialize_agent(db)
initialize_memory(db)
initialize_auto(db)
if from_environment().enabled:
    initialize_ai(db)
initialize_activation(db)
PYINIT
runuser -u banya-sync -- /opt/banya-sync/.venv/bin/python - verify "$backup_path" < "$source_dir/upgrade_guard.py"
systemctl start banya-sync.service
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
for file in app.py backup_db.py autonomous.py agent_api.py deepseek_ai.py learning_memory.py learning_policy.py learning_analysis.py learning_planner.py context_engine.py capabilities.py private_plan.py agent-openapi.json; do cmp "$source_dir/$file" "/opt/banya-sync/$file"; done
printf '%s\n' "$release" > /opt/banya-sync/RELEASE_SHA
trap - ERR
echo 'Capability channel deployed. No grant created, private plan changed, or ChatGPT connection established by deployment.'
