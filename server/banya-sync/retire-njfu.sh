#!/usr/bin/env bash
# Remove only the explicitly retired NJFU deployment after Banya is verified.
set -Eeuo pipefail
[[ $(id -u) -eq 0 ]]
systemctl is-active --quiet banya-sync.service
curl --noproxy '*' --resolve 124.70.128.201:443:127.0.0.1 \
  -fsS --max-time 8 https://124.70.128.201/health | grep -q 'banya-study-sync'
[[ -L /etc/nginx/sites-enabled/banya-sync ]]
[[ ! -e /etc/nginx/sites-enabled/njfu-seat && ! -L /etc/nginx/sites-enabled/njfu-seat ]]

systemctl disable --now njfu-seat.service 2>/dev/null || true
if [[ -e /opt/NJFU--main || -L /opt/NJFU--main ]]; then
  [[ -d /opt/NJFU--main && ! -L /opt/NJFU--main ]]
  ! mountpoint -q /opt/NJFU--main
  rm -rf --one-file-system -- /opt/NJFU--main
fi
rm -f -- /etc/nginx/sites-available/njfu-seat \
  /etc/systemd/system/njfu-seat.service \
  /root/banya-stage/njfu-seat-enabled.backup
systemctl daemon-reload
nginx -t
systemctl is-active --quiet banya-sync.service
echo 'Retired NJFU service, site, and /opt/NJFU--main; Banya remains healthy.'
