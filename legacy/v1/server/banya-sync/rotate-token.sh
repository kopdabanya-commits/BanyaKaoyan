#!/usr/bin/env bash
# Accept ONLY a 64-hex SHA-256 digest over SSH stdin. Never accept or print bearer secret.
# First-user-token provisioning is permitted only while both production snapshots are empty.
set -Eeuo pipefail
umask 077
[[ "$(id -u)" == 0 ]] || exit 1
IFS= read -r new_digest
[[ "$new_digest" =~ ^[0-9a-f]{64}$ ]] || { echo "Bad token digest format"; exit 1; }
unset REPLY
envfile=/etc/banya-sync.env
[[ -f "$envfile" && -f /var/lib/banya-sync/sync.sqlite3 ]] || { echo "Existing install not found"; exit 1; }
[[ "$(stat -c %a "$envfile")" == 600 ]] || { echo "Refuse unsafe env permissions"; exit 1; }
systemctl is-active --quiet banya-sync.service
# Always create a restorable snapshot of the current database before changing auth.
systemctl start banya-sync-backup.service
/opt/banya-sync/.venv/bin/python - <<'PY'
import sqlite3
p='file:/var/lib/banya-sync/sync.sqlite3?mode=ro'
with sqlite3.connect(p,uri=True) as con:
  rows=con.execute('SELECT subject,revision FROM snapshots ORDER BY subject').fetchall()
  assert len(rows)==0, 'Production already contains study snapshots: stop token initialization; never disrupt live users'
print('Production learning snapshot rows: 0. Only authentication configuration will change.')
PY
old_digest="$(sed -n 's/^BANYA_SYNC_TOKEN_SHA256=//p' "$envfile")"
[[ "$old_digest" =~ ^[0-9a-f]{64}$ ]] || { echo "Existing digest invalid"; exit 1; }
if [[ "$old_digest" == "$new_digest" ]]; then
  echo "Requested server digest already matches; no restart."
  exit 0
fi
rollback=$(mktemp /etc/.banya-sync-env-rollback.XXXXXXXX)
install -o root -g root -m 0600 "$envfile" "$rollback"
tmp=$(mktemp /etc/.banya-sync-env-next.XXXXXXXX)
cleanup() { rm -f "$tmp"; }
revert() {
  # Keep original service configuration if restart/health fails.
  install -o root -g root -m 0600 "$rollback" "$envfile"
  systemctl restart banya-sync.service || true
  echo "Service check failed; restored prior config."
}
trap cleanup EXIT
trap revert ERR
sed "s/^BANYA_SYNC_TOKEN_SHA256=.*/BANYA_SYNC_TOKEN_SHA256=$new_digest/" "$envfile" > "$tmp"
[[ "$(grep -c '^BANYA_SYNC_TOKEN_SHA256=' "$tmp")" == 1 ]] || exit 1
install -o root -g root -m 0600 "$tmp" "$envfile"
systemctl restart banya-sync.service
systemctl is-active --quiet banya-sync.service
# systemd active can precede uvicorn binding; retry health rather than immediately rolling back.
ready=false
for i in $(seq 1 30); do
  if curl --noproxy '*' --silent --fail --max-time 2 http://127.0.0.1:8765/health >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
[[ "$ready" == true ]] || { echo "New service failed to become healthy after restart"; exit 1; }
# Do not keep old auth hash available indefinitely once service is confirmed healthy.
trap - ERR
rm -f "$rollback"
unset old_digest new_digest
echo "ECS token digest changed successfully; database snapshots preserved."
