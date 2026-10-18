#!/usr/bin/env bash
# Primary atomic ECS static release; private DB backup only, never replacement.
set -Eeuo pipefail
umask 077
[[ $(id -u) -eq 0 ]] || { echo 'root required' >&2; exit 1; }
release="${1:?release SHA required}"
[[ "$release" =~ ^[0-9a-f]{40}$ ]] || { echo 'invalid release SHA' >&2; exit 1; }
stage=/root/banya-pwa-stage
archive="$stage/site.tgz"
config="$stage/nginx-ip.conf"
live=/etc/nginx/sites-available/banya-sync
base=/var/www/banya-pwa
dest="$base/releases/$release"
test -s "$archive" && test -s "$config"
test -s /etc/letsencrypt/live/124.70.128.201/fullchain.pem
test -L /etc/nginx/sites-enabled/banya-sync
test -f "$live"
old_link="$(readlink "$base/current" 2>/dev/null || true)"
cp -p "$live" "$stage/nginx-before.conf"
install -d -m 0755 "$base" "$base/releases"
reuse=false
if [[ -e "$dest" || -L "$dest" ]]; then
  python3 "$stage/ecs_package.py" verify-installed "$archive" --root "$dest"
  reuse=true
  if [[ "$old_link" == "$dest" ]]; then
    python3 "$stage/verify_ecs.py" --root "$dest"
    echo 'Matching immutable release already active and verified; nothing replaced.'
    exit 0
  fi
fi
python3 "$stage/ecs_package.py" verify "$archive"
# Online SQLite backup includes every private table. Never send backup to Actions.
runuser -u banya-sync -- /opt/banya-sync/.venv/bin/python - <<'PYBACKUP'
from pathlib import Path
import sys
sys.path.insert(0, '/opt/banya-sync')
from backup_db import backup_once
import sqlite3
saved=backup_once(Path('/var/lib/banya-sync/sync.sqlite3'),Path('/var/lib/banya-sync/backups'))
with sqlite3.connect(saved) as con:
    assert con.execute('PRAGMA integrity_check').fetchall()==[('ok',)]
print('Private pre-release backup integrity verified; no data printed.')
PYBACKUP
created_here=false
rollback(){
  cp -p "$stage/nginx-before.conf" "$live"
  if [[ -n "$old_link" ]]; then ln -sfn "$old_link" "$base/current.next"; mv -Tf "$base/current.next" "$base/current"; else rm -f "$base/current"; fi
  nginx -t >/dev/null 2>&1 && systemctl reload nginx || true
  # Quarantine only this invocation's new public assets; never touch private data.
  if [[ "$created_here" == true && -d "$dest" ]]; then mv "$dest" "$dest.failed.$(date +%s%N)" || true; fi
}
trap 'rollback; echo "ECS release failed; previous route restored" >&2' ERR
if [[ "$reuse" != true ]]; then
  created_here=true
  mkdir -p "$dest"
  tar -xzf "$archive" -C "$dest" --no-same-owner
fi
python3 "$stage/ecs_package.py" verify-installed "$archive" --root "$dest"
for file in index.html update.html refresh.html refresh.js app.js study-assistant.js learning-diagnostics.js plan-import.js cloud-sync.js origin-transfer.js sw.js manifest.webmanifest icons/icon-192.png icons/icon-512.png; do test -s "$dest/$file"; done
chown -R root:root "$dest"
chmod -R a+rX "$dest"
ln -sfn "$dest" "$base/current.next"
mv -Tf "$base/current.next" "$base/current"
install -m 0644 "$config" "$live"

if ! nginx -t >/dev/null 2>&1 || ! systemctl reload nginx; then rollback; echo 'Nginx update failed; old route restored' >&2; exit 1; fi
ready=false
# Full verification is inside the rollback boundary, including hashes and auth.
for _ in 1 2 3; do
  if python3 "$stage/verify_ecs.py" --root "$dest"; then ready=true; break; fi
  sleep 1
done
if [[ "$ready" != true ]]; then rollback; echo 'ECS verification failed; old release restored' >&2; exit 1; fi
trap - ERR
echo 'Primary ECS static release verified; private database never replaced.'
