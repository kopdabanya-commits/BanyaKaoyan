# 华为云 ECS 只读网络探测

来源：GitHub Actions Ubuntu runner。未尝试登录或修改服务器。

- TCP 22: 已连接
- SSH 协议响应：有 SSH-2.0 banner
- TCP 80: 已连接
- TCP 443: 已连接
- HTTP HEAD /: 301
- HTTPS 证书验证及 HEAD /: 502

此探测不验证 SSH 身份、现有服务内容或板牙考研部署。

SSH 公钥指纹（首次连接基线）：`SHA256:9oyfKbAJFel2TMt1diomTJvKJvFNh2HUqtDdLAEivwA`。部署前须保持主机公钥匹配。
