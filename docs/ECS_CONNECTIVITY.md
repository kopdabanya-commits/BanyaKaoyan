# 华为云 ECS 只读网络探测

来源：GitHub Actions Ubuntu runner。未尝试登录或修改服务器。

- TCP 22: 已连接
- SSH 协议响应：有 SSH-2.0 banner
- TCP 80: 已连接
- TCP 443: 已连接
- HTTP HEAD /: 301
- HTTPS 证书验证及 HEAD /: 404
- HTTPS GET /health: 200，板牙服务响应
- HTTPS GET /v1/snapshot/english: 401
- HTTPS GET /v1/snapshot/politics: 401

此探测无凭据，只验证公网连通、证书和未授权访问。

SSH 公钥指纹（首次连接基线）：`SHA256:9oyfKbAJFel2TMt1diomTJvKJvFNh2HUqtDdLAEivwA`。部署前须保持主机公钥匹配。
