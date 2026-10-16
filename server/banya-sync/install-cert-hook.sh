#!/usr/bin/env bash
# Non-invasive installation of certbot deploy hook. No forced renewal.
set -Eeuo pipefail
[[ "$(id -u)" == 0 ]] || exit 1
test -r /etc/letsencrypt/live/124.70.128.201/cert.pem
test -r /etc/nginx/sites-enabled/banya-sync
certbot --version >/dev/null
install -d -o root -g root -m 0755 /etc/letsencrypt/renewal-hooks/deploy
hook=/etc/letsencrypt/renewal-hooks/deploy/50-banya-nginx-reload
tmp="$(mktemp /etc/letsencrypt/renewal-hooks/deploy/.banya-renew.XXXXXXXX)"
cat > "$tmp" <<'HOOK'
#!/bin/sh
# Invoked only after a certificate is actually renewed.
set -eu
/usr/sbin/nginx -t >/dev/null
/bin/systemctl reload nginx
HOOK
install -o root -g root -m 0755 "$tmp" "$hook"
rm -f "$tmp"
/bin/sh -n "$hook"
/usr/sbin/nginx -t >/dev/null
systemctl is-active --quiet nginx
systemctl is-active --quiet snap.certbot.renew.timer || systemctl is-enabled --quiet snap.certbot.renew.timer
echo 'Certbot deploy hook installed; Nginx config valid and certbot timer enabled.'
echo 'This does not constitute an actual certificate renewal.'
