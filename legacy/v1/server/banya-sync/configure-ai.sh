#!/usr/bin/env bash
# Reviewed future operation only. Never calls a provider or prints secret input.
set -Eeuo pipefail
umask 077
[[ $(id -u) -eq 0 ]] || exit 1
mode="${1:?operation required}"; budget="${2:?budget required}"; calls="${3:?calls required}"; currency="${4:-USD}"
[[ "$mode" == install-disabled || "$mode" == prepare-enabled ]] || exit 1
[[ "$budget" =~ ^[0-9]{1,3}(\.[0-9]{1,2})?$ && ( "$calls" =~ ^[0-9]{1,4}$ || "$calls" == unlimited ) ]] || exit 1
[[ "$currency" == USD || "$currency" == CNY ]] || exit 1
source_dir="$(cd "$(dirname "$0")" && pwd)"
test -f /opt/banya-sync/autonomous.py
grep -Fq 'owner_approval_required' /opt/banya-sync/deepseek_ai.py
test -f /etc/banya-sync.env
systemctl is-active --quiet banya-sync.service
saved="$(mktemp -d /root/banya-ai-config.XXXXXX)"
cp -p /etc/banya-sync.env "$saved/environment"
rollback(){ cp -p "$saved/environment" /etc/banya-sync.env; systemctl restart banya-sync.service || true; echo 'Previous protected configuration restored; no database replaced.' >&2; }
trap rollback ERR
# stdin goes directly to the validated root-only writer, never a shell variable.
python3 "$source_dir/configure_ai.py" "$mode" "$budget" "$calls" "$currency"
systemctl restart banya-sync.service
ready=false
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl --fail --silent --max-time 3 http://127.0.0.1:8765/health >/dev/null; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]]
code="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 10 http://127.0.0.1:8765/v1/ai/status)"
[[ "$code" == 401 ]]
trap - ERR
echo 'Health and unauthenticated denial verified. No provider request; enable explicitly in App after review.'
