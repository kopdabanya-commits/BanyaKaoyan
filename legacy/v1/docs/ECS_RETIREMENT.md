# 旧 NJFU 部署退役

用户明确授权清空旧部署。GitHub Actions 作业执行自提交 47fee1ec92ad80237ecafc9562659a053df6196b。

- 已停用旧 njfu-seat 服务，移除旧 Nginx 站点、systemd 单元和 /opt/NJFU--main。
- 删除前验证板牙考研服务与本机 HTTPS 健康；删除后 Nginx 配置和公网 HTTPS 健康再次通过。
- 保留板牙考研目录、数据目录、IP 证书和证书自动续期；未记录或更改凭据。
