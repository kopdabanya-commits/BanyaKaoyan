#!/usr/bin/env bash
# Atomic static release on the existing ECS; never touches the private sync DB.
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
mkdir -p "$dest"
tar -xzf "$archive" -C "$dest" --no-same-owner
for file in index.html update.html refresh.html refresh.js app.js cloud-sync.js origin-transfer.js sw.js manifest.webmanifest icons/icon-192.png icons/icon-512.png; do test -s "$dest/$file"; done
chown -R root:root "$dest"
chmod -R a+rX "$dest"
ln -sfn "$dest" "$base/current.next"
mv -Tf "$base/current.next" "$base/current"
install -m 0644 "$config" "$live"
rollback(){
  cp -p "$stage/nginx-before.conf" "$live"
  if [[ -n "$old_link" ]]; then ln -sfn "$old_link" "$base/current.next"; mv -Tf "$base/current.next" "$base/current"; else rm -f "$base/current"; fi
  nginx -t >/dev/null 2>&1 && systemctl reload nginx || true
}
if ! nginx -t >/dev/null 2>&1 || ! systemctl reload nginx; then rollback; echo 'Nginx update failed; old route restored' >&2; exit 1; fi
ready=false
# systemctl reload returns before old Nginx workers have finished switching.
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl --noproxy '*' --fail --silent --max-time 5 https://124.70.128.201/health >/dev/null && \
     curl --noproxy '*' --fail --silent --max-time 5 -o "$stage/index-check.html" https://124.70.128.201/index.html && \
     grep -Fq 'origin-transfer.js' "$stage/index-check.html"; then ready=true; break; fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  code="$(curl --noproxy '*' --silent -o /dev/null -w '%{http_code}' --max-time 5 https://124.70.128.201/index.html || true)"
  rollback; echo "HTTPS PWA validation failed (index HTTP $code); old route restored" >&2; exit 1
fi
echo 'Existing IP HTTPS serves Banya PWA and backend health; private DB untouched.'
