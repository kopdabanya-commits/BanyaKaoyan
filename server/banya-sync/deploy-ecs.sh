#!/usr/bin/env bash
# Run on the authorized ECS as root after the full directory is copied there.
set -Eeuo pipefail
umask 077
[[ $(id -u) -eq 0 ]] || { echo 'Root required' >&2; exit 1; }
[[ -n "${BANYA_SYNC_TOKEN_SHA256:-}" ]] || { echo 'Token digest required' >&2; exit 1; }
SRC="$(cd "$(dirname "$0")" && pwd)"
test -s /etc/letsencrypt/live/124.70.128.201/fullchain.pem
test -s /etc/letsencrypt/live/124.70.128.201/privkey.pem
test -s "$SRC/nginx-ip.conf"

if [[ ! -e /etc/banya-sync.env ]]; then
  bash "$SRC/install-ecs.sh" > "$SRC/install-result.log" 2>&1 || {
    tail -30 "$SRC/install-result.log" >&2
    exit 1
  }
fi
systemctl is-active --quiet banya-sync.service
curl -fsS --max-time 8 http://127.0.0.1:8765/health > /dev/null

install -m 0644 "$SRC/nginx-ip.conf" /etc/nginx/sites-available/banya-sync
if [[ -e /etc/nginx/sites-enabled/njfu-seat || -L /etc/nginx/sites-enabled/njfu-seat ]]; then
  cp -a /etc/nginx/sites-enabled/njfu-seat "$SRC/njfu-seat-enabled.backup"
  rm /etc/nginx/sites-enabled/njfu-seat
fi
ln -sfn /etc/nginx/sites-available/banya-sync /etc/nginx/sites-enabled/banya-sync
rollback() {
  rm -f /etc/nginx/sites-enabled/banya-sync
  if [[ -e "$SRC/njfu-seat-enabled.backup" || -L "$SRC/njfu-seat-enabled.backup" ]]; then
    cp -a "$SRC/njfu-seat-enabled.backup" /etc/nginx/sites-enabled/njfu-seat
  fi
  nginx -t >/dev/null 2>&1 && systemctl reload nginx || true
}
if ! nginx -t; then rollback; exit 1; fi
if ! systemctl reload nginx; then rollback; exit 1; fi
if ! curl --noproxy '*' --resolve 124.70.128.201:443:127.0.0.1 \
  -fsS --max-time 8 https://124.70.128.201/health > /dev/null; then
  rollback
  echo 'HTTPS health validation failed; old Nginx site restored' >&2
  exit 1
fi
echo 'Banya backend and verified HTTPS health are active.'
echo 'Old NJFU deployment files remain for separate retirement after full validation.'
