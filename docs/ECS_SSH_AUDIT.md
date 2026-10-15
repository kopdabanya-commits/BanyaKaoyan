# 华为云 ECS 授权只读检查

来源：GitHub Actions。此检查不修改服务器，也不记录凭据。

SSH 登录：成功。
```text
OS=ubuntu 24.04
KERNEL=6.8.0-136-generic
USER_ID=0
DISK=/dev/vda1        40G   11G   27G  29% /
MEMORY=Mem:            1775         442         630           2         892        1332
PYTHON=Python 3.12.3
LISTEN=0.0.0.0:22,0.0.0.0:443,0.0.0.0:631,0.0.0.0:80,127.0.0.1:29338,127.0.0.1:29339,127.0.0.53%lo:53,127.0.0.54:53,[::]:22,[::]:443,[::]:631,[::]:80
SERVICE_nginx=active
ENABLED_nginx=enabled
SERVICE_njfu-seat=inactive
ENABLED_njfu-seat=disabled
SERVICE_banya-sync=activating
ENABLED_banya-sync=enabled
BANYA_HEALTH=000
CERTBOT=/snap/bin/certbot
CERTBOT_TIMER=enabled
CERTBOT_CERTIFICATES_BEGIN
  Certificate Name: 124.70.128.201
    Expiry Date: 2026-10-19 15:26:26+00:00 (VALID: 3 days)
CERTBOT_CERTIFICATES_END
OLD_DEPLOY_SIZE=3.4G	/opt/NJFU--main
NGINX_VERSION=nginx version: nginx/1.24.0 (Ubuntu)
NGINX_ENABLED_SITES=njfu-seat,
NGINX_ROUTING_BEGIN
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name 124.70.128.201;
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name 124.70.128.201;
    ssl_certificate /etc/letsencrypt/live/124.70.128.201/fullchain.pem;
        proxy_pass http://127.0.0.1:8000;
NGINX_ROUTING_END
TLS_LEAF_BEGIN
subject=
issuer=C = US, O = Let's Encrypt, CN = YE1
notBefore=Oct 12 23:26:27 2026 GMT
notAfter=Oct 19 15:26:26 2026 GMT
X509v3 Subject Alternative Name: critical
    IP Address:124.70.128.201
TLS_LEAF_END
BANYA_CONFIG_EXISTS=yes
BANYA_STAGE_FILES=app.py,install-ecs.sh,backup_db.py,requirements.txt,deploy-ecs.sh,nginx-ip.conf,install-result.log,
BANYA_INSTALL_LOG_TAIL_BEGIN
  Using cached https://pypi.tuna.tsinghua.edu.cn/packages/04/4b/29cac41a4d98d144bf5f6d33995617b185d14b22401f75ca86f384e87ff1/h11-0.16.0-py3-none-any.whl (37 kB)
Collecting annotated-types>=0.6.0 (from pydantic>=2.7.0->fastapi==0.128.2->-r /opt/banya-sync/requirements.txt (line 1))
  Using cached https://pypi.tuna.tsinghua.edu.cn/packages/99/91/8acff4f5e50511b911bbccb72b8628a49c68ce14148cd9f6431094859a90/annotated_types-0.8.0-py3-none-any.whl (13 kB)
Collecting pydantic-core==2.50.1 (from pydantic>=2.7.0->fastapi==0.128.2->-r /opt/banya-sync/requirements.txt (line 1))
  Downloading https://pypi.tuna.tsinghua.edu.cn/packages/90/24/48cd98388e4ac2c08d0800af36d15413db15e20387f1038123a2c86cb2f6/pydantic_core-2.50.1-cp312-cp312-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (2.2 MB)
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.2/2.2 MB 1.0 MB/s eta 0:00:00
Collecting anyio<5,>=3.6.2 (from starlette<0.51.0,>=0.40.0->fastapi==0.128.2->-r /opt/banya-sync/requirements.txt (line 1))
  Using cached https://pypi.tuna.tsinghua.edu.cn/packages/12/b8/4bd346e22b28902df4d651910f5242c28d84e4a5c2435ca5c3f797ed7e2e/anyio-4.15.1-py3-none-any.whl (132 kB)
Collecting idna>=2.8 (from anyio<5,>=3.6.2->starlette<0.51.0,>=0.40.0->fastapi==0.128.2->-r /opt/banya-sync/requirements.txt (line 1))
  Downloading https://pypi.tuna.tsinghua.edu.cn/packages/58/a2/bb081bab032533a855d44de1d56f8e8426114ff1ba5d1f07a438a0a654f8/idna-3.20-py3-none-any.whl (69 kB)
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 69.6/69.6 kB 6.3 MB/s eta 0:00:00
Installing collected packages: typing-extensions, idna, h11, click, annotated-types, annotated-doc, uvicorn, typing-inspection, pydantic-core, anyio, starlette, pydantic, fastapi
Successfully installed annotated-doc-0.0.5 annotated-types-0.8.0 anyio-4.15.1 click-8.5.0 fastapi-0.128.2 h11-0.16.0 idna-3.20 pydantic-2.14.1 pydantic-core-2.50.1 starlette-0.50.0 typing-extensions-4.16.0 typing-inspection-0.4.4 uvicorn-0.40.0
Created symlink /etc/systemd/system/multi-user.target.wants/banya-sync.service → /etc/systemd/system/banya-sync.service.
Created symlink /etc/systemd/system/timers.target.wants/banya-sync-backup.timer → /etc/systemd/system/banya-sync-backup.timer.
本机健康检查：
curl: (7) Failed to connect to 127.0.0.1 port 8765 after 0 ms: Couldn't connect to server
本机服务健康检查失败，请查看 sudo systemctl status banya-sync --no-pager
同步密钥由部署方提供；仅保存哈希，安装日志未输出密钥。
请勿向公网开放8765端口。旧项目完全不需要启动。
BANYA_INSTALL_LOG_TAIL_END
```
