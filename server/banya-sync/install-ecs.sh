#!/usr/bin/env bash
# Ubuntu 24.04 ECS, isolated staging of 板牙考研 sync backend.
# IMPORTANT: local-only. HTTPS and frontend integration are separate steps.
set -Eeuo pipefail
umask 077
die(){ printf 'ERROR: %s\n' "$*" >&2; exit 1; }
[[ $(id -u) -eq 0 ]] || die "请使用 sudo bash install-ecs.sh"
SRC="$(cd "$(dirname "$0")" && pwd)"
[[ -f "$SRC/app.py" && -f "$SRC/requirements.txt" ]] || die "请下载完整的 server/banya-sync 目录"
command -v systemctl >/dev/null || die "要求systemd"
[[ ! -e /etc/banya-sync.env && ! -e /etc/systemd/system/banya-sync.service ]] || die "检测到现有banya-sync配置，为保护数据拒绝覆盖"
python3 -c 'import sys;sys.exit(0 if sys.version_info>=(3,10) else 1)' || die "要求Python3.10+"
command -v curl >/dev/null || die "缺少curl"
command -v ss >/dev/null || die "缺少ss命令"
if ss -ltn '( sport = :8765 )' | grep -q LISTEN; then die "8765端口被占用"; fi
echo "将在独立目录部署本机API，绝不改动旧NJFU-seat、旧Nginx或防火墙"
if ! python3 -m venv /tmp/banya-venv-check-$$ >/dev/null 2>&1; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y python3-venv
else
  rm -rf /tmp/banya-venv-check-$$
fi
if ! id banya-sync >/dev/null 2>&1; then
  useradd --system --home-dir /var/lib/banya-sync --shell /usr/sbin/nologin banya-sync
fi
install -d -o root -g root -m 0755 /opt/banya-sync
install -d -o banya-sync -g banya-sync -m 0700 /var/lib/banya-sync
install -m 0644 "$SRC/app.py" /opt/banya-sync/app.py
install -m 0644 "$SRC/requirements.txt" /opt/banya-sync/requirements.txt
python3 -m venv /opt/banya-sync/.venv
/opt/banya-sync/.venv/bin/python -m pip install --disable-pip-version-check -r /opt/banya-sync/requirements.txt
SECRET="$(python3 -c 'import secrets;print(secrets.token_urlsafe(48))')"
DIGEST="$(printf '%s' "$SECRET" | sha256sum | cut -d' ' -f1)"
{
  printf 'BANYA_DB_PATH=/var/lib/banya-sync/sync.sqlite3\n'
  printf 'BANYA_ALLOWED_ORIGIN=https://english-ii-plan.kopdabanya.workers.dev\n'
  printf 'BANYA_SYNC_TOKEN_SHA256=%s\n' "$DIGEST"
} > /etc/banya-sync.env
chmod 0600 /etc/banya-sync.env
cat > /etc/systemd/system/banya-sync.service <<'UNIT'
[Unit]
Description=Banya Kaoyan private study sync API
After=network.target
[Service]
Type=simple
User=banya-sync
Group=banya-sync
WorkingDirectory=/opt/banya-sync
EnvironmentFile=/etc/banya-sync.env
ExecStart=/opt/banya-sync/.venv/bin/uvicorn app:create_app --factory --host 127.0.0.1 --port 8765 --no-access-log
Restart=on-failure
RestartSec=5
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/banya-sync
[Install]
WantedBy=multi-user.target
UNIT
chmod 0644 /etc/systemd/system/banya-sync.service
systemctl daemon-reload
systemctl enable --now banya-sync.service
sleep 2
echo "本机健康检查："
if curl -fsS --max-time 6 http://127.0.0.1:8765/health; then
  echo "本机API安装成功。公网HTTPS和PWA同步尚未配置。"
else
  echo "本机服务健康检查失败，请查看 sudo systemctl status banya-sync --no-pager"
fi
echo "请在自己的安全位置保存以下同步密钥，绝不可发到聊天/GitHub："
printf '%s\n' "$SECRET"
unset SECRET DIGEST
echo "请勿向公网开放8765端口。旧项目完全不需要启动。"
