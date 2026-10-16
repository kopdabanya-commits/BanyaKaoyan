## 2026-10-16 08:55（Asia/Singapore）技术线最终部署核验（以此节优先）

- **PR #11 已合并**：squash SHA `3e7be62694bbdfdd5fdc35dd8956086da81f249a`；M2.9 原有单一「板牙考研」PWA 的双科云同步代码进入 main。旧Worker原URL、manifest ID及英语二/政治全部本地学习键未改。英语二/政治复习计划文件未改。
- 用户已在原手机导出英语二和政治两份原始备份并提交聊天核验；英语备份v2含65天141个唯一任务ID，政治备份v1保持原做题数。**未把这些真实学习数据导入ECS或GitHub**，恢复有效性与真机体验仍需用户确认。
- GitHub Actions [稳定同步密钥配置run 38830680085](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38830680085)通过：受控固定known_hosts SSH只传长期 `BANYA_SYNC_TOKEN` SHA256摘要，先做SQLite安全备份再轮换，事前正式云库快照数0；新密钥公网HTTPS授权英语/政治GET各 `revision=0`，错误密钥401，原PWA来源的PUT+Authorization CORS预检通过。无原始密钥值进GitHub代码或日志。
- [Certbot 续期钩子run 38830905645](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38830905645)：在已有ECS的真正证书换发成功时自动nginx -t/reload；snap certbot timer已启用。[正常续期复核 run 38831703180](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38831703180)成功但尚未签发新证书，2026-10-19 15:26:26 UTC到期未变。**真实续期尚未验收**；新增main每日定时Actions检查，禁止声称已延期。
- [唯一Worker生产发布与上线验收run 38831564350](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38831564350)：`verify`和`publish`均success；官方Wrangler生产版本ID `c81ef1d8-820e-4129-bb00-9ff4c2022182`，仍为 `https://english-ii-plan.kopdabanya.workers.dev/`。真实公网模拟移动Edge请求：`/index.html` 200且含 `cloud-sync.js`、同步脚本200、CSP精确放行 `https://124.70.128.201`；`server/banya-sync/app.py`、`docs/ECS_HANDOFF.md`、`AGENTS.md` 均404，公网静态防泄漏通过。
- 第一次main部署run `38831115125` 的上传实际成功、只在后续curl/urllib默认UA自动探测时403；独立 [诊断run 38831361262](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38831361262)确定为Cloudflare **1010浏览器特征拦截**。模拟正常Edge UA的 [诊断run 38831466680](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38831466680)200且检查通过；已修复发布工作流默认UA导致的验收误报。Cloudflare Workers Builds原生集成旧红色检查日志仍缺失、其独立根因没有证据，不能和上述HTTP 1010自动探测混同。
- **仍未验证**：荣耀Android16 Edge原已安装的PWA是否更新、两科真实手机本地数据安全上传/读取/多端同步、浏览器重启与断网重连、客户端409冲突体验、手机文件备份导入恢复。真实云库当前应保持revision0（未做授权手机首次上传）；用户必须逐科明确确认首次上传，不允许从服务器/聊天自动移植资料。数据库机内SQLite备份生成/integrity_check=ok，非异地灾备。

---

## 2026-10-16 08:45（Asia/Singapore）最新技术复核：用户已设置长期令牌
- 用户已在本对话提交原手机两份备份，并确认创建 `BANYA_SYNC_TOKEN` GitHub Actions Secret。两份本地JSON文件检查：英语 `yantu-english-ii`/v2、65天141个唯一任务ID、含历史学习状态；政治 `yantu-politics`/v1、含苍盾93/396进度。仅验证文件结构及存在，**没有提交用户数据到GitHub/ECS**，也不能把聊天备份当作已恢复或手机客户端授权首次上传。
- [首次令牌部署run 38830588303](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38830588303) 由于重启后即刻访问端口过快失败，自动回滚旧配置、没有动数据库。[修复重启就绪等待后的成功run 38830680085](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38830680085) 证明：正式库快照0条，服务端更换 SHA-256 摘要成功，英语与政治授权HTTPS读取都返回 `revision=0`、无效密钥401、精确Workers域名的PUT/Authorization CORS OPTIONS成功。Actions无需、也没有输出原始Token值。
- [Certbot自动Nginx reload钩子安装run 38830905645](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38830905645) 成功、nginx配置有效、certbot timer enabled。但**证书新签发/真实续期仍未发生，无法宣称已验收**；现有证书此前到期2026-10-19 15:26:26 UTC，需继续复查。
- Node自动新增断网本地记录保留→恢复连接CAS上传以及政治远端变化不覆盖英语本地记录测试，最新 `Validate planner` 需以PR对应GitHub最新head green为准。隔离ECS scratch库的跨科、409与重启持久化已通过，真实用户设备网络恢复、浏览器存储、首次上云还待真机测试。
- Cloudflare原生Workers Builds红色检查：API读取日志403，无法确定Cloudflare后台构建失败根因。GitHub Actions直接 `wrangler versions upload` 到**原 Worker 非激活版本**、真实静态白名单上传已通过。已加入main发布自动化工作流，在合并且门禁通过后才把同一个Worker更新到M2.9。
- 剩余：最新head全绿、合并与原Workers生产版本CSP/静态文件不可见验证、ECS正式snapshot暂维持0，用户在已安装Edge中逐科用自己的密钥认证并独立确认第一次上传（再次下载备份），再验证真实上传/下载、重启、离线与冲突。所有未实测项保持待验证。

---

## 2026-10-16 02:40（亚洲时区）更新：PR #11 技术线实际检查

本段基于 GitHub/Cloudflare Actions 当前实际结果，覆盖上文仍写作“尚未运行”但已被新检查取代的阶段；**PR目前仍为Draft、PWA生产尚未发布M2.9。**

- 服务器路径仍经 `BANYA_ECS_SSH_PASSWORD` Actions Secret 和 `server/banya-sync/known_hosts` 固定SSH ED25519公钥校验，**无明文密码进入聊天/GitHub源码**。
- [ECS readiness run 38786028694](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38786028694) 成功：服务active/enabled、备份timer active/enabled、HTTPS证书验证/health 200，两科未授权401；生产数据库snapshot count=0；用单独临时SQLite库真实执行英语/政治读写、409、错误科目422与重启持久化全部通过，未写入真实库。
- [数据库备份 run 38786340727](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38786340727) 成功：实际启动每日备份service生成一份机内SQLite备份并通过 `PRAGMA integrity_check=ok`。机内副本不是异地灾备。
- [证书续期 run 38786641233](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38786641233) 成功完成**正常certbot检查**，但没有颁发新证书（Certbot判定尚不到期）；HTTPS依然有效，证书实际截止仍为2026-10-19 15:26:26 UTC。之后仍必须复核实际新证书签发、Nginx reload以及正式站点。
- [Wrangler dry-run](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38785883329)成功；Cloudflare原有Workers Builds失败不能仅凭本地诊断推断原因。[Builds Logs API audit run 38786759865](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38786759865)实际返回HTTP 403（现有Cloudflare API Token缺少Workers CI Read授权）。请在真实Cloudflare Dashboard读取失败构建 `065a5292-5b9c-44a0-a12d-dbcb39b6622f` 的日志；用户无需把密码交给ChatGPT。
- [原Worker非激活版本上传 run 38787008715](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38787008715) 成功，`wrangler versions upload` 生成未激活版本，没有部署生产流量。发现扫描根目录文件数明显大于PWA资源数，已把 `.assetsignore` 改为**默认全部屏蔽+只允许应用16个静态文件及图标路径**，新的 [非激活版本上传 run 38787339344](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38787339344) 成功（16个既有 + 1个新增资产），杜绝未来把服务端源码、文档及工作流误作为公网静态资源。唯一现有Worker `english-ii-plan` / `workers.dev`地址均不变。
- `_headers` 中的CSP现只增加 `https://124.70.128.201` 为 `connect-src` 允许源；`cloud-sync.js`仅接受同一个精确HTTPS origin，防止Bearer发送到其他站点，仍默认不配置token、不传用户记录；仍保留全部历史学习数据键、单一manifest安装ID和原来的双科计划。
- [GitHub Actions readiness](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38786028694)表明 **`BANYA_SYNC_TOKEN` Secret目前未配置**。早期部署脚本自动生成临时令牌的fallback已移除；再次执行ECS部署在长期令牌缺失时**不会悄悄轮换服务器凭据**。
- 当前用户仍须先分别在**原已安装Edge PWA**内导出英语二/政治两份原始学习备份，并用个人密码管理器生成/保存足够强度的随机长期令牌（无需发给聊天），通过 [GitHub Repository Actions Secret](https://github.com/kopdabanya-commits/English-II-Plan/settings/secrets/actions/new) 写入 `BANYA_SYNC_TOKEN`；得到明确完成确认后，技术线才运行经过pin校验的Actions后端摘要轮换，并让用户在PWA设置中输入相同密钥逐科确认首次云上传。第一次上传前必须检查两科现存云revision。
- 已准备 `.github/workflows/publish-existing-worker.yml`：只在未来合并到main后的特定前端变更，完成双科回归、后端模拟测试、Wrangler验证后，使用现有Cloudflare Secret发布**原有单一Worker**并做线上CSP/文件泄露检查；这条流程当前没有执行生产发布。手机真机、备份恢复、离线重连等仍需用户在原PWA验证。

---

# 板牙考研 ECS 技术交接｜2026-10-16

本页是 PR #11 的部署交接；下一执行者先核对最新 main、PR 和 Actions 结果，不能把本页当实时监控。

## 已验证的服务器连接

- ECS 公网 IP `124.70.128.201`，SSH 22；从 GitHub Actions `ubuntu-latest` 可连接、收到 SSH-2.0 响应并用已授权账号登录。SSH 用户当前为 `root`（可由仓库变量 `BANYA_ECS_SSH_USER` 覆盖）。密码保存在该仓库 Actions Secret `BANYA_ECS_SSH_PASSWORD`，不得读出、打印或复制进代码/聊天。
- 连接时强制使用 `server/banya-sync/known_hosts` 固定的 ED25519 主机公钥，指纹 `SHA256:9oyfKbAJFel2TMt1diomTJvKJvFNh2HUqtDdLAEivwA`；公钥变化时先独立核实，不可盲目关闭校验。
- 当前 Codex 云执行器直接连 ECS 22/80/443 不通，代理的 CONNECT 成功不是 SSH 登录。经已授权 GitHub Actions 跳板执行是已实测可用的运维通道：`.github/workflows/ecs-ssh-audit.yml` 只读盘点；`.github/workflows/ecs-deploy.yml` 部署；`.github/workflows/ecs-retire-old.yml` 已按用户授权清理旧部署。工作流仅在 PR #11 源分支对应工作流文件变动时触发；若要维护，先更新工作流触发方式和审查命令，不要向用户索要聊天明文密码。
- 连接依赖上述 Secret、服务器密码与公钥、GitHub Actions 可用；密码轮换后需同步更新该 Secret。不能保证这些外部条件永不变化。

## 已执行的生产阶段

- GitHub Actions [部署 run 38784363727](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38784363727) 成功，部署代码提交 `77709db80333665392f8d6154e44960808787d45`：FastAPI/SQLite 后端在 `/opt/banya-sync`，仅监听 `127.0.0.1:8765`；systemd 服务与每日私有 SQLite 备份 timer 已安装；Nginx 公网 IP HTTPS 指向此后端。
- `https://124.70.128.201/health` 本机和外部均经可信证书验证返回 200。外部 [连通 run 38784581580](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38784581580)：22/80/443 已连接，HTTP→HTTPS 301，HTTPS `/health` 200，英语/政治未授权读取各 401。部署作业带临时令牌的英语读取通过，首次库 revision=0。
- 证书是 Let's Encrypt 的 IP SAN 证书，当前有效期至 2026-10-19 15:26:26 UTC。Nginx 已提供 `/.well-known/acme-challenge/` 的 webroot；同一部署作业的 `certbot renew --dry-run` 通过，续期 timer 已启用。**实际自动续出新证书尚需到期前复核**，不可把 dry-run 写成永久续期证明。
- 用户明确授权清空旧 NJFU 部署。[退役 run 38784675831](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38784675831) 成功：旧服务、旧 Nginx 站点、旧 systemd 单元与 `/opt/NJFU--main` 已移除；随后公网板牙 `/health` 仍通过。见 `docs/ECS_RETIREMENT.md`。
- 服务器数据库当前未导入用户手机学习数据，临时部署令牌未在日志公开，也未交给用户。因此**当前只是可用的后端基础设施，手机云同步尚未启用**。已有手机本地记录未被服务器操作覆盖。

## 下一技术聊天要完成

1. 核对最新 main、PR #11（仍为草稿且未合并）与检查；不覆盖别的分支。`Workers Builds: english-ii-plan` 在本轮 PR 检查出现失败，需查明构建/预览失败原因，不能视为生产发布成功。
2. 在确定 API 继续使用该 IP HTTPS 后，将现有 `_headers` 的 CSP `connect-src` 精确加入 `https://124.70.128.201`；检查前端 `cloud-sync.js` API 地址、CORS、静态资源排除规则、离线更新和同一个 Worker/PWA 身份。若改用已有域名，应先确认 DNS/TLS，再精确更新来源。不要新建第二站。
3. 为手机启用同步前，建立用户可持有的长期同步令牌，安全地放入 Actions Secret `BANYA_SYNC_TOKEN` 并将其 SHA-256 摘要部署到服务器；**不得在聊天、日志、GitHub 文档中输出令牌**。当前临时令牌不能交接给手机。轮换前先确认服务器两科库是否已有记录，禁止覆盖已有学习数据。
4. 英语二、政治分别先在手机导出可恢复备份，再做首次云同步选择；完成真实上传、下载、SQLite 持久化、跨科隔离、断网恢复、409 冲突处理及备份恢复测试。现有自动化测试不能代替手机实测。
5. 核查证书在 2026-10-19 前实际自动续期，核查每日数据库备份文件是否生成；本机备份不是异地容灾。最后才考虑合并 PR #11 并发布到**原有** `https://english-ii-plan.kopdabanya.workers.dev/`，核对 Worker 实际版本与手机旧记录。

不修改两科复习计划内容、原 localStorage 键、PWA 安装身份或用户学习进度。运行时状态与证据详见 `docs/ECS_CONNECTIVITY.md`、`docs/ECS_SSH_AUDIT.md`、`docs/ECS_DEPLOYMENT.md`、`docs/ECS_RETIREMENT.md`。
