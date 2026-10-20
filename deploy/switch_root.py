"""把 v2 切到根路径，旧版下线（保留文件与数据库）。"""
import os

import paramiko

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASS_FILE = os.environ.get("BANYA_ECS_PASS_FILE", os.path.join(ROOT, ".secrets", "ecs-pass.txt"))
KNOWN_HOSTS = os.environ.get("BANYA_KNOWN_HOSTS", os.path.expanduser("~/.ssh/known_hosts"))

CONFIG = r"""server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name 124.70.128.201;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type text/plain;
    }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name 124.70.128.201;

    ssl_certificate /etc/letsencrypt/live/124.70.128.201/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/124.70.128.201/privkey.pem;

    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer always;
    add_header X-Frame-Options DENY always;
    add_header X-Robots-Tag "noindex, nofollow" always;
    add_header Cache-Control "no-cache" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://124.70.128.201; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" always;

    root /var/www/banya-v2/current;
    index index.html;

    location = /health {
        proxy_pass http://127.0.0.1:8766/health;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }

    location /api/ {
        access_log off;
        proxy_pass http://127.0.0.1:8766/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 90s;
    }

    location /v2/api/ {
        access_log off;
        proxy_pass http://127.0.0.1:8766/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 90s;
    }

    location /v1/ {
        return 404;
    }

    location /v2/ {
        alias /var/www/banya-v2/current/;
        index index.html;
        try_files $uri $uri/ /v2/index.html;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
"""

password = open(PASS_FILE, encoding="utf-8").read().strip()
client = paramiko.SSHClient()
if os.path.exists(KNOWN_HOSTS):
    client.load_host_keys(KNOWN_HOSTS)
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
else:
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("124.70.128.201", username="root", password=password, timeout=25,
               look_for_keys=False, allow_agent=False)
sftp = client.open_sftp()


def run(cmd, check=True):
    _, out, err = client.exec_command(cmd, timeout=180)
    text = (out.read() + err.read()).decode("utf-8", "replace").strip()
    code = out.channel.recv_exit_status()
    print(f"[{code}] {cmd[:64]} | {text[-300:]}")
    if check and code != 0:
        raise SystemExit("failed: " + cmd)
    return text


live = "/etc/nginx/sites-available/banya-sync"
run(f"cp -p {live} /root/nginx-banya-sync.before-v2-root-$(date -u +%Y%m%dT%H%M%SZ)")
with sftp.open(live, "w") as fh:
    fh.write(CONFIG)
print("site config rewritten")

# 证书续期 hook 只依赖 80 端口的 acme 路径，保持不变。
run("nginx -t")
run("systemctl reload nginx")

# 旧版服务下线：只停服务，不删文件、不动数据库。
run("systemctl stop banya-sync.service")
run("systemctl disable banya-sync.service || true")
run("systemctl is-active banya-sync.service || true", check=False)
run("systemctl is-active banya-v2.service")

run("curl -fsS -o /dev/null -w 'root %{http_code}\\n' -H 'Host: 124.70.128.201' https://127.0.0.1/ -k")
run("curl -fsS -k -H 'Host: 124.70.128.201' https://127.0.0.1/health")
sftp.close()
client.close()
print("DONE")
