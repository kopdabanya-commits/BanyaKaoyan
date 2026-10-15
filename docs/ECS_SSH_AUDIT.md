# 华为云 ECS 授权只读检查

来源：GitHub Actions。此检查不修改服务器，也不记录凭据。

SSH 登录：成功。
```text
OS=ubuntu 24.04
KERNEL=6.8.0-136-generic
USER_ID=0
DISK=/dev/vda1        40G   11G   27G  29% /
MEMORY=Mem:            1775         401         863           2         663        1373
PYTHON=Python 3.12.3
LISTEN=0.0.0.0:22,0.0.0.0:443,0.0.0.0:631,0.0.0.0:80,127.0.0.1:29338,127.0.0.1:29339,127.0.0.53%lo:53,127.0.0.54:53,[::]:22,[::]:443,[::]:631,[::]:80
SERVICE_nginx=active
ENABLED_nginx=enabled
SERVICE_njfu-seat=inactive
ENABLED_njfu-seat=disabled
SERVICE_banya-sync=inactive
ENABLED_banya-sync=not-found
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
```
