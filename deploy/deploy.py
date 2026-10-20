"""部署板牙考研 v2 到现有 ECS。幂等：可重复执行。"""
import json
import os
import secrets
import sys

import paramiko

HOST = os.environ.get("BANYA_ECS_HOST", "124.70.128.201")
USER = os.environ.get("BANYA_ECS_USER", "root")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # app/
PASS_FILE = os.environ.get("BANYA_ECS_PASS_FILE", os.path.join(ROOT, ".secrets", "ecs-pass.txt"))
KNOWN_HOSTS = os.environ.get("BANYA_KNOWN_HOSTS", os.path.join(ROOT, "deploy", "known_hosts"))

password = open(PASS_FILE, encoding="utf-8").read().strip()
client = paramiko.SSHClient()
if os.path.exists(KNOWN_HOSTS):
    client.load_host_keys(KNOWN_HOSTS)
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
else:
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=password, timeout=25, look_for_keys=False, allow_agent=False)
sftp = client.open_sftp()


def run(cmd, timeout=300, check=True):
    _, out, err = client.exec_command(cmd, timeout=timeout)
    text = out.read().decode("utf-8", "replace")
    error = err.read().decode("utf-8", "replace")
    code = out.channel.recv_exit_status()
    tail = (text + error).strip()[-500:]
    shown = "[redacted]" if "BANYA_V2_TOKEN" in cmd else cmd[:70]
    print(f"[{code}] {shown} | {tail}")
    if check and code != 0:
        raise SystemExit("failed: " + cmd)
    return text


# 1. 目录
run("install -d -m 0755 /var/www/banya-v2/releases /opt/banya-v2 /etc/nginx/snippets")
run("install -d -m 0700 -o banya-sync -g banya-sync /var/lib/banya-v2")

# 2. 静态文件
stamp = run("date -u +%Y%m%dT%H%M%SZ").strip()
dest = f"/var/www/banya-v2/releases/{stamp}"
run(f"install -d -m 0755 {dest}/assets")
for name in ["index.html", "manifest.webmanifest", "sw.js"]:
    sftp.put(os.path.join(ROOT, name), f"{dest}/{name}")
for name in ["app.js", "style.css", "icon.svg", "icon-192.png", "icon-512.png",
             "icon-maskable.png", "apple-touch-icon.png"]:
    sftp.put(os.path.join(ROOT, "assets", name), f"{dest}/assets/{name}")
# 交接文档同步到线上：txt 供下载，html 供手机直接阅读复制（不含密钥）
handoff = open(os.path.join(ROOT, "HANDOFF.md"), encoding="utf-8").read()
with sftp.open(f"{dest}/handoff.txt", "w") as fh:
    fh.write(handoff)
escaped = handoff.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
page = ('<!doctype html><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>板牙考研 v2 · 交接说明</title>'
        '<style>body{margin:0;background:#F4F2EC;color:#17181B;'
        'font:14px/1.7 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}'
        'header{position:sticky;top:0;display:flex;justify-content:space-between;align-items:center;gap:10px;'
        'padding:12px 18px;background:rgba(244,242,236,.96);border-bottom:1px solid #E7E4DB}'
        'header b{font-size:14px}'
        'button,a{display:inline-block;border:0;border-radius:10px;background:#1F5E4F;color:#fff;font-weight:600;font-size:13px;padding:9px 14px;text-decoration:none;margin-left:6px}'
        'button.alt,a.alt{background:#E6F0EC;color:#17453B}'
        'pre{white-space:pre-wrap;word-break:break-word;max-width:760px;margin:0 auto;padding:18px 18px 80px;'
        'font:12.5px/1.8 ui-monospace,SFMono-Regular,Menlo,monospace}'
        '</style><header><b>板牙考研 v2 · 交接说明</b><span class="acts">'
        '<button id="copy">复制全文</button>'
        '<button id="select" class="alt">全选</button>'
        '<a id="dl" href="handoff.md" download="HANDOFF.md" class="alt">下载</a>'
        '</span></header>'
        '<pre id="doc">' + escaped + '</pre>'
        '<script src="handoff.js"></script>')
with sftp.open(f"{dest}/handoff.html", "w") as fh:
    fh.write(page)
with sftp.open(f"{dest}/handoff.js", "w") as fh:
    fh.write("document.getElementById('copy').addEventListener('click',async()=>{"
             "const t=document.getElementById('doc').innerText;"
             "try{await navigator.clipboard.writeText(t);"
             "document.getElementById('copy').textContent='已复制';}"
             "catch(e){const r=document.createRange();r.selectNodeContents(document.getElementById('doc'));"
             "const s=getSelection();s.removeAllRanges();s.addRange(r);"
             "document.getElementById('copy').textContent='已选中，长按复制';}"
             "setTimeout(()=>{document.getElementById('copy').textContent='复制全文';},4000);});"
             "document.getElementById('select').addEventListener('click',()=>{"
             "const r=document.createRange();r.selectNodeContents(document.getElementById('doc'));"
             "const s=getSelection();s.removeAllRanges();s.addRange(r);"
             "document.getElementById('select').textContent='已选中';"
             "setTimeout(()=>{document.getElementById('select').textContent='全选';},3000);});")
with sftp.open(f"{dest}/handoff.md", "w") as fh:
    fh.write(handoff)
run(f"ln -sfn {dest} /var/www/banya-v2/current")

# 3. 服务端
sftp.put(os.path.join(ROOT, "server", "main.py"), "/opt/banya-v2/main.py")

token = run("test -f /etc/banya-v2.env && sed -n 's/^BANYA_V2_TOKEN=//p' /etc/banya-v2.env || true").strip()
built = run("date -u '+%Y-%m-%d %H:%M UTC'").strip()

if not token:
    token = secrets.token_urlsafe(24)
    run("umask 077; { "
        f"echo 'BANYA_V2_TOKEN={token}'; "
        "echo 'BANYA_V2_DB=/var/lib/banya-v2/v2.sqlite3'; "
        "} > /etc/banya-v2.env")

if token:
    payload = json.dumps({"token": token, "builtAt": built, "version": stamp}, ensure_ascii=False)
    with sftp.open(f"{dest}/config.js", "w") as fh:
        fh.write("window.BANYA_CONFIG = " + payload + ";" + chr(10))
    print("config.js written")

unit = """[Unit]
Description=Banya v2 plan storage
After=network.target

[Service]
User=banya-sync
Group=banya-sync
WorkingDirectory=/opt/banya-v2
EnvironmentFile=/etc/banya-v2.env
Environment=PYTHONUNBUFFERED=1
ExecStart=/opt/banya-sync/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8766 --workers 1
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
"""
with sftp.open("/etc/systemd/system/banya-v2.service", "w") as fh:
    fh.write(unit)
run("systemctl daemon-reload && systemctl enable banya-v2.service >/dev/null && systemctl restart banya-v2.service")
run("sleep 2; systemctl is-active banya-v2.service")

# 4. nginx：只在首次安装时接入；根路径已由 v2 提供服务时不重复插入
live = "/etc/nginx/sites-available/banya-sync"
with sftp.open(live) as fh:
    config = fh.read().decode()
if "root /var/www/banya-v2/current;" in config:
    print("site already serves v2 at root; nginx untouched")
else:
    snippet = '''location /v2/api/ {
    access_log off;
    proxy_pass http://127.0.0.1:8766/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_read_timeout 90s;
}
location /v2/ {
    alias /var/www/banya-v2/current/;
    index index.html;
    try_files $uri $uri/ /v2/index.html;
}
'''
    with sftp.open("/etc/nginx/snippets/banya-v2.conf", "w") as fh:
        fh.write(snippet)
    if "banya-v2.conf" not in config:
        run(f"cp -p {live} /root/nginx-banya-sync.bak-$(date -u +%Y%m%dT%H%M%SZ)")
        marker = "    include /etc/nginx/snippets/banya-v2.conf;" + chr(10)
        index = config.rstrip().rfind("}")
        with sftp.open(live, "w") as fh:
            fh.write(config[:index] + marker + config[index:])
        print("nginx include added")
    run("nginx -t && systemctl reload nginx")

# 5. 自检
run("curl -fsSk -H 'Host: 124.70.128.201' -o /dev/null -w 'index %{http_code}\n' https://127.0.0.1/")
run("curl -fsSk -H 'Host: 124.70.128.201' -o /dev/null -w 'health %{http_code}\n' https://127.0.0.1/api/health")
sftp.close()
client.close()
if os.environ.get("BANYA_PRINT_TOKEN") == "1":
    print("TOKEN=" + token)
else:
    print("token stored on server (/etc/banya-v2.env)")
print("DONE")
