#!/usr/bin/env bash
# Read-only deployment prerequisite inventory. Never print environment files or keys.
set -u
printf 'OS='; . /etc/os-release; printf '%s %s\n' "$ID" "$VERSION_ID"
printf 'KERNEL='; uname -r
printf 'USER_ID='; id -u
printf 'DISK='; df -h / | tail -1
printf 'MEMORY='; free -m | sed -n '2p'
printf 'PYTHON='; python3 --version 2>&1
printf 'LISTEN='; ss -ltnH | awk '{print $4}' | sort -u | paste -sd, -
for unit in nginx njfu-seat banya-sync; do
  printf 'SERVICE_%s=' "$unit"; systemctl is-active "$unit" 2>/dev/null || true
  printf 'ENABLED_%s=' "$unit"; systemctl is-enabled "$unit" 2>/dev/null || true
done
printf 'BANYA_HEALTH='
curl -sS --max-time 3 -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8765/health 2>/dev/null || true
printf 'CERTBOT='; command -v certbot || true
printf 'CERTBOT_TIMER='; systemctl is-enabled snap.certbot.renew.timer 2>/dev/null || systemctl is-enabled certbot.timer 2>/dev/null || true
printf 'CERTBOT_CERTIFICATES_BEGIN\n'; certbot certificates 2>/dev/null | grep -E 'Certificate Name:|Expiry Date:|Domains:' || true; printf 'CERTBOT_CERTIFICATES_END\n'
printf 'OLD_DEPLOY_SIZE='; du -sh /opt/NJFU--main 2>/dev/null || true
printf 'NGINX_VERSION='; nginx -v 2>&1 || true
printf 'NGINX_ENABLED_SITES='; find /etc/nginx/sites-enabled -maxdepth 1 -mindepth 1 -printf '%f,' 2>/dev/null; echo
printf 'NGINX_ROUTING_BEGIN\n'
nginx -T 2>/dev/null | grep -E '^[[:space:]]*(listen|server_name|ssl_certificate|proxy_pass)[[:space:]]' | head -50 || true
printf 'NGINX_ROUTING_END\n'
printf 'TLS_LEAF_BEGIN\n'
openssl s_client -connect 127.0.0.1:443 -servername 124.70.128.201 -showcerts </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates -ext subjectAltName 2>/dev/null || true
printf 'TLS_LEAF_END\n'
