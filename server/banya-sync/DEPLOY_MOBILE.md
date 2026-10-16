# 板牙考研｜只有手机的华为云部署说明

状态：部署脚本已备好，**不代表服务器已部署**。目前本文件所在开发分支包含私有后端源码与仅本机的安装脚本。

## 使用手机访问服务器
安卓Edge打开 https://console.huaweicloud.com/ ，进入ECS服务器列表并选正确区域，找到原2GB Ubuntu机器，确认状态“运行中”，点击「远程登录」→「使用CloudShell登录」；部分地域不支持CloudShell。官方步骤：https://support.huaweicloud.com/usermanual-ecs/ecs_03_0185.html 。

如果CloudShell无法使用，可采用华为云App连接Linux，官网：https://support.huaweicloud.com/usermanual-ecs/ecs_03_0192.html 。密码只在官方登录界面输入，不发给AI。

首次连接成功后只读核对：`uname -a`、`systemctl is-active njfu-seat || true`、`ss -ltn | grep -E ':8000|:8765|:443' || true`、`df -h /`。不要删除旧图书馆数据。

## 源码与安装
当前GitHub是Private，不能将未授权的raw.githubusercontent.com链接当成下载地址。优先由有授权的工作环境安全传递 `server/banya-sync` 文件，或用户在终端使用GitHub CLI设备网页登录、下载指定版本之后登出；不可把GitHub Token放在聊天、公开安装脚本或命令历史中。

安全获得完整目录后，在 `server/banya-sync` 执行 `sudo bash install-ecs.sh`。脚本新建专用`banya-sync`用户、`/opt/banya-sync`代码目录、`/var/lib/banya-sync` SQLite数据目录、`/etc/banya-sync.env`（仅存密钥SHA256）和独立systemd服务。**只绑定127.0.0.1:8765**，不会动旧`njfu-seat`、旧Nginx或原端口8000，也不会创建公网HTTP入口。安装输出一次性随机同步密钥，由用户离线保存，不得发给AI。

## 必须完成才算真正上线
要实现手机自动同步，还必须核实服务器当前Nginx、IP及受信任HTTPS证书；配置安全TLS入口，然后更新同一个板牙考研PWA前端，确保英语/政治分别同步，不从空云端覆盖本地原数据，先分别导出备份并明确确认首次上传。服务端409版本冲突不能自动覆盖，需要保留历史及人工冲突处理。最后在荣耀Edge真机验证双科打卡、重启、断网重连、导入导出和Cloudflare部署。

原 `NJFU-seat` 仓库记录：Ubuntu24.04、服务名`njfu-seat`、端口8000、旧目录`/opt/NJFU--main`。2026-09-19停用了旧应用，但ECS现时状态需登录重新检查，不能凭记录视为已上线。


## 2026-10-16 补充开发成果与上线门禁
- 同一PR已包含 `cloud-sync.js`，双科云客户端代码均已接入统一设置页，但**默认不开启**；配置真实HTTPS服务URL与随机密钥之后，英语/政治各自第一次上传或恢复仍需用户确认并保存备份，后续才自动同步。
- `backup_db.py` 利用SQLite在线备份API生成一致性副本，独立的 `banya-sync-backup.timer` 每天执行一次，保留30份，仅限ECS私有磁盘；这是本地故障回退，不是异地灾备。实际执行需从ECS登录取得证据。
- 重要：`_headers` 当前 `connect-src 'self'`，因此虽然云客户端代码完成，外部HTTPS API仍不能在网页访问。取得可信API主机名及受信任证书后，应由技术负责人把那个**准确 HTTPS origin**加到CSP；严禁先放行任意HTTPS主机，或把API改为不安全HTTP。
- `.assetsignore` 已排除 `server/`，切勿把Python服务器源码或数据库/私密密钥发布到Cloudflare静态网站。
- 此聊天没有华为云SSH/CloudShell工具权限；不要把说明中的ECS命令转给只会手机操作的用户作为操作要求。由有授权的Work云端浏览器/远程环境运行部署步骤，用户仅负责华为云登录或验证码。无法连接时停在部署阻塞状态。
- 真正上线条件：保留公网原PWA URL、后端本地/HTTPS健康检查、逐科初次上传与云恢复、409并发冲突保护、断网与新打开页面测试、浏览器密钥安全、服务重启与SQLite备份恢复验证。未验证不得合并或标成功。
