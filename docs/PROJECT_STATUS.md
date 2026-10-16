## 2026-10-16 英语规划小调整 M2.7.1（待PR测试及发布确认）
用户反馈今天已经做完阅读，不想练2011年小作文。权威计划原2011小作文位于10/18，现拟将该项**替换为邀请信三段式55分钟**，保留原任务ID/类别、10/18新题型与回忆任务不动，其他日期不变。英语计划版本 `2026.10.16-m2.7.1` revision8，65天143项；具体见 `docs/ENGLISH_RESTART_2026-10-16.md`。阅读已做是用户口头反馈，不代表已在手机自动打卡；没收到错题数，禁止虚构。PR和CI、实际生产部署、手机应用需要逐一核对后更新本节。

---

## 2026-10-16 政治融合省时计划v2（GitHub合并、CI与Cloudflare部署已核实）

- 用户明确决定：正式采用徐涛重点课（2倍速以上、实际每日≤30分钟）＋苍盾肖1000题重点/错题＋**已购买**腿姐背诵手册少量记忆＋帕拉迪宇真题选项辨析，政治普通日**总计60分钟**，12/18考前40分钟。肖八按实际取得精选练习，不要求八套刷完；肖四到手后冲刺分析题。新决策见 `docs/DECISIONS.md` D18，**覆盖旧D13政治70—120分钟及固定30分钟听课**。
- 政治独立计划已升级 `politics.2026-10-16-v2` / revision2，64天192任务，日期10/16—12/18，任务ID全部保留，苍盾既有马原93/396仅为真实历史基线；旧打卡、错题、笔记和本机题数不得随计划发布重置。权威JSON和离线JS镜像同步；修改 `sw.js` CACHE以使原安装PWA在安全的SW升级后读取新计划，保留原Worker、manifest id和全部旧本机键。
- [政治PR #14](https://github.com/kopdabanya-commits/English-II-Plan/pull/14) 已squash合并 main，SHA `43e1dc4b4073b72b68c31f093966397e6a65765a`；[PR双路Validate CI 38840210548](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38840210548) success，[main CI 38840312941](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38840312941) success。[原Worker发布 38840312893](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38840312893) `verify`、`publish` 均 success（不新建站点）。独立 Cloudflare Workers Builds PR检查依然失败，历史已知、日志根因未证实，不混同已成功的Github发布。
- 政治模块尚无与英语一致的在线计划差异确认/本机迁移预览。更换任务说明时旧ID的已完成标记仍保留；本轮未读取或修改用户手机的实际记录。**荣耀Android16 Edge原已安装PWA的政治新计划显示、历史打卡与备份/云同步效果仍待用户真机验收**。
- **本次未修改英语计划、用户实际云同步数据、ECS后端或云同步凭据**；手机更新前建议政治及英语分别导出备份，**禁止卸载PWA、清除站点数据**。此段为政治专项状态，部署状态请看最新Actions证据。

---

## 2026-10-16 09:30 CST 英语二 M2.7 重新起步已合并与发布（以此节为准）

- 用户明确反馈2026-10-15**没有学习**，要求10/16重新规划并同步。英语规划线已把权威 `plan.json` / `plan-data.js` 升为 `2026.10.16-m2.7` revision7，历史日历65天、任务143项；**昨天的旧任务不自动补给今天**。原141个任务ID全保留，另增两项10/16重启任务；原10/16大作文入门任务ID移动到10/17，整年预留的2024—2026三套真题及10/18之后计划未变。详细见 `docs/ENGLISH_RESTART_2026-10-16.md`。
- [英语PR #12](https://github.com/kopdabanya-commits/English-II-Plan/pull/12)已squash合并主分支，commit `852fb22dda9a0b2d61b23dbd72f7f8918bd2dfa5`，PR head `b9610c2456d225c74c6071e569df84115844ae47`；[PR CI 38835858081](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38835858081) success，[main CI 38835946329](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38835946329) success。
- [原Cloudflare Worker正式发布 38835946239](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38835946239) 中 `verify` 与 `publish` 两个job均success。未改原网站 `https://english-ii-plan.kopdabanya.workers.dev` 或PWA安装身份，不涉及服务器、云同步、政治计划和本机旧存储键。此证据是生产发布完成，**不代表手机Edge已点击“保留记录并应用”**。用户需要在现有「板牙考研→英语二→设置」中检查计划更新、预览变更后自行确认，不卸载App、不清除站点数据。
- **用户手机私有记录未被ChatGPT写入或读取**，计划meta中标记“10/15未学”不等于实际手机自动打休息标记。政治线按原计划独立继续，技术线维护其他系统。

---

## 2026-10-16 英语二复习重新起步（英语计划独立M2.7；以最新main/PR检查为准）

用户明确反馈2026-10-15没有学习，要求10-16重新规划并同步。英语权威计划调整为 `2026.10.16-m2.7`/revision7（10/15—12/18历史日历65天，143任务；10/16起为实际重启），今天2010小作文30分、2014新题型30分、2011阅读Text4 25分，明天2014错题复盘20分、2013完形30分、2010大作文三段提纲15分。旧10/15原计划保留，不向10/16自动滚动；不替用户打卡或更改私人记录。2024—2026模考日期未动，政治不动。具体见 `docs/ENGLISH_RESTART_2026-10-16.md`。英语规划聊天负责计划，技术聊天负责PWA/服务器，两者须查实时PR避免覆盖。

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

## 最新补充｜2026-10-16 M2.9 技术线复核（仍为PR #11草稿）

- 实时检查：main仍为 `afd3ed47` M2.8；PR #11仍open/draft，M2.9源分支持续更新。英语二/政治权威计划内容、旧记录键、Workers站点URL、manifest ID没有改变。
- GitHub Actions通过现有固定主机公钥及仓库Secret真实SSH完成 [ECS只读+隔离API测试 38786028694](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38786028694)：公网IP HTTPS、服务systemd和timer正常；正式snapshot行数为0；隔离临时数据库完成双科PUT/GET、409、错误科目422和进程重启持久化。此测试不等于手机真实数据上传。
- [机内备份校验 38786340727](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38786340727)已实际生成机内SQLite备份，数据库完整性 `ok`；仍无异地副本。
- [证书正常续期检查 38786641233](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38786641233)未签发新证书、因尚不符合Certbot续期条件，真实到期仍2026-10-19 15:26:26 UTC；HTTPS健康校验已通过，**实际续期尚未验收**。
- 仅放行公网 `https://124.70.128.201` 的CSP `connect-src`，前端云客户端也只接受此精确IP HTTPS。更新 `.assetsignore` 为默认拒绝/明确白名单，新的 [Cloudflare非激活版本上传 38787339344](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38787339344)成功（仅16个既有+1个新增资产），没有发布生产；[本地Wrangler dry-run 38785883329](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38785883329)成功。
- Cloudflare GitHub集成 `Workers Builds: english-ii-plan` 红色检查的具体根因尚无日志。现有Cloudflare Token可用来上传非激活版本，但 `GET /builds/builds/{uuid}/logs` 返回 **403**（[API审计 run 38786759865](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38786759865)）；不能因本地构建成功便假装已修复 Cloudflare Builds。
- `BANYA_SYNC_TOKEN` 长期同步Secret尚未配置（Actions已检查）；不能交付用户可登录的云同步。修改ecs-deploy工作流，**缺少长期Secret时不再自动生成新的短期令牌/覆盖服务器原配置**。需要用户仅在GitHub Secret表单/手机密码管理器完成一次安全设置，无需发送聊天密钥或SSH。
- 新增原有Worker单一站点的main分支CI门禁发布工作流，但目前未执行；本机英语/政治分别导出备份、首次上传、正式库下载和重启、离线恢复、跨科真实数据隔离、409冲突、荣耀Edge已安装PWA的更新和实际证书新签发，全部维持**未完成真机/生产验收**。不建议在个人学习数据未另存及Secret未配置时合并PR或公开上线。
- 旧NJ FU资源退役成果以 `docs/ECS_HANDOFF.md` 与此前三个成功Actions记录为准。此轮没有修改复习计划，也没有再次删除服务器旧数据。

---

## 最新：ECS 后端基础设施已部署｜2026-10-16（PR #11 分支）
- 经用户授权，使用仓库 Actions Secret 和固定 SSH 主机公钥，从 GitHub Actions 登录 `124.70.128.201`；此云执行器仍无法直接 SSH，连接方法见 `docs/ECS_HANDOFF.md`。
- [部署 run 38784363727](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38784363727) 成功：板牙后端 systemd/Nginx/IP HTTPS 在线，本机健康、授权英语读取、未授权政治 401 与证书续期 dry-run 已通过。[外部 run 38784581580](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38784581580) 验证公网 `/health` 200、两科未授权各 401。证书实际自动续期仍待到期前复核。
- 用户授权的[旧 NJFU 退役 run 38784675831](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38784675831) 成功；[退役后只读盘点 run 38784770680](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38784770680) 确认旧服务单元不存在、旧目录不存在、只有 banya-sync Nginx 站点启用，新服务 active/enabled、健康 200。
- **PR #11 仍为 Draft，未合并 main；同一个 Cloudflare Worker 尚未发布 M2.9。** `_headers` 的 CSP 仍只许同源，手机云同步尚未启用；临时服务令牌未交给用户，用户手机学习数据未上传。下一聊天应按 `docs/ECS_HANDOFF.md` 完成长期令牌、前端接入、Cloudflare 发布与手机实测。
- 原 Worker 网址在 2026-10-16 实测 HTTP 200、页面为「板牙考研」，但 HTML 未加载 `cloud-sync.js`、响应 CSP 仍为 `connect-src 'self'`；因此旧 PWA 可访问不等于 M2.9 上线。PR 最新 `Validate planner` [run 38784916624](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38784916624) 成功，而 `Workers Builds: english-ii-plan` 检查失败，需在 Cloudflare 构建日志诊断。

以下早期检查记录为历史时间点，不代表当前部署状态。

## 云环境接手核验｜2026-10-16（PR #11 分支）
- Git 原生读取确认 `origin/main=afd3ed47b6529b7d2cd103f41f0b70ac8a601673`，`refs/pull/11/head=39a3a6e60e5efcce1acb5239e49c7f18eb8b149`；M2.9 尚未在 main。GitHub GraphQL/REST API 在当前云环境返回 403，因此 PR 当前的草稿标志、审查状态及最新 CI 状态无法独立核实；不得把旧文档快照当成实时状态。
- 在 PR #11 源码上，本地 Node 22 语法/计划检查与 64 项测试通过，Python 后端与备份 9 项测试通过，部署脚本 `bash -n` 通过。独立启动后端进程验证 `/health` 为 200、未授权快照读取为 401、两科分别保存并可读取、旧 revision 写入为 409。此为本地验证，不代表 ECS 已部署。
- 当前云环境 `/etc/codex/network-policy.json` 显示 TCP 允许域名/IP 范围均为空，未配置 VPN；对 ECS `124.70.128.201` 的 22/80/443 直接连接均立即返回 `ConnectionRefusedError`，经 HTTP 代理访问 80/443 返回 403，TCP CONNECT 代理 8088 自身拒绝连接。这些结果只证明本环境当前无法抵达目标，不能判断 ECS 服务或 SSH 凭据是否正常。
- 当前环境与旧项目没有找到适用的 SSH config 或身份文件，也没有可用的华为云/SSH 凭据绑定。未登录 ECS，未核实磁盘、现有服务、Nginx、域名、证书，也未部署。应先在云环境网络设置中放行针对 `124.70.128.201` 的必要 TCP 访问并提供受支持的 SSH 身份授权，然后重新做只读连接检查；无需把密码或私钥发到聊天。

### 用户发布网络配置后的重测
- 运行时 HTTP 策略现为 `unrestricted/enforced`，代理对 `124.70.128.201:22/80/443` 返回 CONNECT 200；但直连三个端口仍立即拒绝，SSH 隧道等候 10 秒未收到 `SSH-2.0` banner，80 隧道也未收到有效上游响应。经代理访问 HTTP 根路径返回 Envoy 301；HTTPS 隧道呈现 `openai.com` 证书，和目标 IP 不匹配，TLS 验证失败。代理 CONNECT 成功不等于 ECS 可达，更不等于身份验证成功；当前仍无法安全 SSH 或验证 ECS HTTPS。运行时 TCP 允许范围依然为空。

## 技术线最新记录｜2026-10-16 M2.9 华为云云同步（草稿PR #11）
- 已实时核对 `main=afd3ed47b6529b7d2cd103f41f0b70ac8a601673`；开放PR只有 [#11](https://github.com/kopdabanya-commits/English-II-Plan/pull/11)，分支 `feat/huawei-ecs-cloud-sync-m29`。**main尚未合并M2.9，Cloudflare生产未发布本轮代码。**
- 已在 PR #11 实际提交：原有FastAPI/SQLite后端的科目绑定格式校验，拒绝空白/跨科写入；`cloud-sync.js` 客户端与同一个设置页集成、服务工作线程离线缓存更新；本地优先、每科单独首次确认、CAS/409冲突暂停、云恢复前备份和同页刷新；自动SQLite备份脚本+systemd每日备份timer；静态部署 `.assetsignore` 排除私有 `server/` 目录；新增 Node/Python 测试。
- 2026-10-16 CI证据：PR中间提交 `f3342295` 对应 [Validate planner 38777800459](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38777800459) 成功（Node双科/云同步测试、Python后端与备份测试、shell语法）。截至开发分支提交 `f45276f0583f6503a1af55b2a8629de0cf4ec6cb`，最新 [Validate planner 38778476336](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38778476336) 已复核为 **completed/success**，包含新增静态文件防泄漏回归测试。此后纯状态文档更新仍需按新head检查，生产部署与手机验收仍未发生。
- 只动共享技术代码与部署文档；未修改英语 `plan.json` / 政治 `politics-plan.json`，未修改任何旧localStorage键、PWA ID、原 Worker 名称或现有网址。当前同步功能默认关闭、未经用户首次授权不会上传或拉取记录。
- 重大上线闸门：本站 `_headers` 的 CSP `connect-src 'self'` 尚未放行真实ECS HTTPS API 域名；不能随意扩展到任意HTTPS源。需先取得真实服务器连接/公网域名及受信任TLS证书，然后限定具体API来源。云端首次写入和跨设备实际冲突回归必须在手机实测。
- 当前聊天工具已授权GitHub，但没有华为云控制台/CloudShell/SSH实际远程操作能力，未登录ECS、未配置数据库实例、Nginx或HTTPS，也未做 Cloudflare生产部署；服务端备份仅为**安装准备**，未启动。不得把代码/CI通过写成ECS部署成功。私有ECS盘内30份备份不等于异地容灾；后续仍需独立备份介质或用户导出文件。
- 安全要求：同步Bearer随机长密钥只在设备本地设置（当前选用localStorage储存以实现自动重启同步，需视为敏感设备凭据），server仅存SHA256摘要；不得提交GitHub/在聊天发送密钥或笔记。发现 XSS/设备失窃需轮换令牌。
- 下一步：完成最后一轮PR CI，获取授权云端浏览器/华为云服务器连接，审计ECS现存占用→安全获取私有代码→部署独立API与每日备份→受信任HTTPS→CSP 精确放行→发布**同一个**Cloudflare Worker→在原 HONOR Android Edge PWA 双科各自备份、首次上传、断网/重连/409/恢复验收；证据逐项写回本页。**未验证不能关闭或合并PR #11为上线完成。**

---
# 板牙考研｜当前事实与待验收状态

## 最新补充｜2026-10-16 政治模块核验（main 6e2e4fc；政治开发线）

> 本节仅记录 2026-10-16 通过 GitHub 最新 main、Actions 和公开站点尝试得到的事实，不宣称完成了用户手机实测。产品依旧是「板牙考研」单一 PWA；政治不是独立 App。

### 本轮已有核验证据
- 当前检查基准：`main=6e2e4fc1980f1330637b71e0f5c937de7e203992`，PR #8 已合并提交 `80c3bd25873c652937429ee63fc28e881ba6cd3e`，PR #9 已合并提交 `6e2e4fc1980f1330637b71e0f5c937de7e203992`。检查时开放PR为0，但**不是对未来并行工作的锁定**。
- 最新main `Validate planner` Actions run [38763243103](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38763243103) 状态 `completed/success`。原有政治 `politics-test.mjs`、跨科 `integration-contract-test.mjs`、SW测试均在工作流覆盖范围；绿CI是自动化成功而非云端或真机验收。
- 回读确认 `index.html` / `manifest.webmanifest` 均显示「板牙考研」，同一个manifest安装身份 `id:"./"`、原站点/Worker不变。统一 `app.js` 路由进入政治 `politics-ui.js`，政治独立键 `yantu_politics_2026_v1` 与英语 `yantu_english_2026_m1`、`yantu_english_plan_v2` 原样保留，科目偏好独立 `banya_active_subject_v1`。
- 政治计划 `politics-plan.json` / `politics-plan-data.js` 为原v1（2026-10-16—12-18、64天、192项），未擅自调整任务，也未推断用户实际已学。阶段约70分钟/天起，后期85—105分钟建议值，未与英语任务时间混算。
- 政治今日、日历、进度、设置、单项打卡/撤销、错题/笔记、马原93/396初始进度手动更新、政治导出/导入等**代码路径存在**，且自动测试覆盖关键路径。备份内部 `app:'yantu-politics'` 保留兼容；尚无本次手机完整导入/重启证明。
- 2026-10-16尝试从外部打开原 `workers.dev` 网址，访问工具无法访问；另一次探测无法解析该域名。以上**不能证明Worker宕机**，也无法证明生产代码与main一致。没有获得 Cloudflare Dashboard 部署日志，生产版本继续标为**未验证**。

### 政治代码真实差距与风险等级
1. **P0验收缺口：** Cloudflare实际部署版本、荣耀Android16 Edge既有PWA更新/重启、两科学习数据不被覆盖、政治记录/备份的实际可用性都没有用户真机证据。更新前先建议两科分别备份；禁止清站点数据、卸载重装、改域名或另建Worker来“修复”。
2. **P1现有能力限制：** `politics-ui.js` 只提供马原题数的手动汇总，不是肖1000题各章节实时统计，也不能从苍盾小程序自动抓取用户真实进度。若用户进入其他章节，后续政治专项开发需先收集真实需求。
3. **P1计划更新缺口：** 政治目前只有静态计划镜像随PWA更新，缺少英语一样的联网计划差异预览/确认迁移；在安全更新机制完成前，避免对政治192项作大规模修改，必须保留已打卡任务ID及备份兼容。
4. **P2自动化覆盖不足：** Node/Service Worker模拟与静态契约可防常见回归，但无法代替实际移动端触摸、文件选择器、暗色模式、离线和旧浏览器缓存升级验证。历史决策里的“政治待建档”仅为旧阶段文档，不得覆盖当前active状态。

### 下一步只进行验收，不重复开发
- 优先获取Cloudflare现有 `english-ii-plan` Worker的**最新部署版本/时间/成功日志**，对照M2.8主分支；此步骤需要现有Cloudflare有效授权或用户提供后台部署状态，不要求绑卡、重建或新项目。
- 用户用原Edge桌面入口打开同一「板牙考研」，先英语、政治各导出一份备份，再分别确认：科目切换／已有英语记录／政治打卡后撤销／马原手动题数（可先不改真实数据）／关闭重开／离线进入两科。只有用户实际确认后把结果写入本页。
- 政治在线计划安全更新和章节型肖1000题记录作为后续独立政治专项PR，先待上线与手机验收后决定范围；需要编辑共享文件时必须重新查main/PR并协调英语线。


更新：2026-10-15。**最新事实写在本页顶部；历史PR、旧聊天中的“研途/英语单科/政治待建档”不是当前产品状态。** 此文件不自动监控GitHub或手机，必须在每次合并后用真实检查更新。

## 1. 当前唯一项目身份
- 正式产品名称：**板牙考研**。**一个PWA、一个GitHub仓库、一个Cloudflare Worker、一个网页入口**，内部有英语二和政治两门独立科目。用户明确不希望分开成两个App。
- GitHub（仓库历史名保留）：`https://github.com/kopdabanya-commits/English-II-Plan`；Private，默认分支main。
- Cloudflare Worker（历史技术名暂不更改）：`english-ii-plan`，Workers Static Assets；网址 `https://english-ii-plan.kopdabanya.workers.dev`。改变地址会导致手机现有本地数据无法自动跨源访问，禁止为改名另建站点。
- 安卓：HONOR PTP-AN10、Android16，微软Edge PWA安装路径。公开站点未配置Access，GitHub仓库私有不代表网页私有。
- **品牌/工作流 M2.8 已合并 GitHub：** [PR #8](https://github.com/kopdabanya-commits/English-II-Plan/pull/8) 的 `Validate planner` run `38762823851` completed/success；main合并提交 `80c3bd25873c652937429ee63fc28e881ba6cd3e`。已回读main确认manifest的短名称为「板牙考研」、网页顶部也显示「板牙考研」。包括单App内选中科目持久化、过时政治待建档说明修正、双科测试和工作流规约。**Cloudflare生产部署/用户真机仍未验证**。

## 2. 英语二计划及功能：代码已确认
- 英语权威计划：`plan.json`，版本`2026.10.15-m2.6`、revision6，65天（10/15—12/18），141项专项，2026-12-19按用户安排考试。
- 用户最新要求：每天阅读一篇/英语二新题型一组/完形一套至少一项，不能整天只有作文/翻译；通常专项85—90分钟、最多90分钟，单词单独学习不列每日任务；2024—2026新卷留作后期分段模考。政治时间不混入英语的130分钟建议总预算。
- 英语主要题型、复盘、错题、打卡、导出导入、人工计划差异预览均存在代码中。任何“已完成”只以手机实际打卡/用户反馈为准。
- M2.6通过 [PR #6](https://github.com/kopdabanya-commits/English-II-Plan/pull/6) 合并main，相关Actions已成功；不等于这台Edge手机已经应用新版。

## 3. 政治计划及功能：M2.7代码已确认
- [PR #7](https://github.com/kopdabanya-commits/English-II-Plan/pull/7) 已合并main，合并提交 `dfcdd17254ab759922ba03a91d1fcfccd6fe671b`；PR head `c5b2e406533209510f069ffb9aeada2aaa9a4fed` 对应 `Validate planner` Actions run `38756024582` 状态success。这是自动测试证据，不是生产验证。
- 政治权威计划 `politics-plan.json`，镜像 `politics-plan-data.js`，版本 `politics.2026-10-15-v1` / revision1；10/16—12/18共64天、192项（课程/刷题/复盘等）。
- 用户截至上次报告：上海地区，政治目标60—65，徐涛2027强化课第6集“对立统一规律”，苍盾考研小程序肖1000题马原93/396（仅马原题库进度，不是全科完成率），未购买纸质资料。预定肖八肖四仅在实际出版/取得后使用，不能自动认作已学。
- `politics-core.js`/`politics-ui.js`已实现政治的今日、日历、进度、设置、打卡/撤销、错题和笔记、苍盾马原做题数手动录入、政治独立导出/导入；政治内部记录键 `yantu_politics_2026_v1`。苍盾与本App**没有自动同步**，不读外部账号。
- 政治的`politics-plan.json`目前**没有像英语一样完整的联机版本差异预览和用户确认迁移操作**。未来单独变更政治计划前先完善/核实安全兼容机制，不能把英语按钮当政治按钮。
- 两科均从一个 `index.html`、`manifest.webmanifest`、`app.js`科目切换、同一 `sw.js`离线资源加载。旧App UI界面 M2.7，新的品牌/工作流升级版本 M2.8 已在GitHub main合并且CI通过，Cloudflare与手机使用仍未验证。

## 4. 兼容性/数据/部署事实
- 英语记录键 `yantu_english_2026_m1`、旧本机英语计划键 `yantu_english_plan_v2`；政治记录键 `yantu_politics_2026_v1`。旧备份结构 `app:yantu-english-ii`、`app:yantu-politics` 必须继续可导入，新品牌仅影响界面和新下载文件名。
- 新增UI偏好 `banya_active_subject_v1` 可记住英语/政治选中科目，不能把两科用户记录合成一份互相覆盖的localStorage。
- GitHub最近一次已确认政治CI通过不代表 Cloudflare上线；**M2.7/M2.8 Workers生产部署与荣耀Edge真机离线、分别打卡、重开持久化、备份恢复、动态效果等均尚无本次可引用的验证证据**。不要称为上线/真机已完成。
- 网站当前公开、仅有本机记录不自动云同步；没有Push提醒或番茄Todo时长读取，用户明确不需要应用内计时器。

## 5. 已识别的工程隐患和修正方向
1. M2.7主分支 `app.js` 设置文字仍称政治“下一阶段待建档”；当前政治已上线至代码，应在品牌升级中改成实际64天任务和手动苍盾进度。
2. 旧 `docs/DECISIONS.md` 两条不同决定都叫D12，并有政治“英语专项60—80分钟不变”的过时表述；整理成独立编号，强调英语最新M2.6规则优先。
3. 改名时如果改worker地址/manifest id/`yantu_...`存储键，手机学习记录可能看似消失。故只更新 UI显示、安装名称、备份下载文件名和文档，**保持旧内部标识稳定**。
4. 多个聊天同时改同一仓库的共享 `app.js`/`sw.js` 可能产生覆盖或旧PR覆盖新功能。新增 `docs/ACTIVE_WORK.md`、`docs/SINGLE_APP_CONTRACT.md` 和跨科自动门禁，要求先查最新main/开放PR再动手。
5. 政治日程更新机制、公共首页概览、PWA在荣耀Edge的实际安装标签是否自动变更仍属于**后续待验收与改进项**，不可未经确认宣称已完成。

## 6. 下一个执行者要做什么
先读 `AGENTS.md` → `docs/index.md` → `docs/DECISIONS.md` → `docs/SINGLE_APP_CONTRACT.md` → `docs/ACTIVE_WORK.md`。核实目前打开的PR及main最新提交。M2.8代码与测试已合并main，接下来须单独核实Cloudflare Worker实际部署版本，再请用户手机确认：板牙考研同一App能切换两科、独立记录仍保留；无特殊原因不卸载、不清网站数据、不更换网址。详细手册见 `docs/OPERATIONS.md`。

## 2026-10-16 M3 手机界面专项改版（待main合并/生产发布）
- 用户要求顶部紧凑、倒计时缩小且降到任务后、当天任务优先、英语二/政治双色统一逻辑；日历点击日期打开独立详情页，安卓后退键/页面返回恢复原月日历；左右滑动和相邻日按钮均支持查看每日安排。
- 共享App修改 `index.html`, `app.js`, `styles.css`, `sw.js`，政治独立UI `politics-ui.js` 改为相同的按月七列日历和七日快捷切换。新增两科移动日历及返回的回归测试，更新旧视觉文字断言。保留主Worker名、PWA manifest身份、英语/政治计划文件、原本机记录键和云同步数据结构，禁止旧备份自动上传。
- 修改分支 `feat/mobile-ui-navigation-m3-20261016`，本节提交时均未宣称安卓真机验收，正式CI和发布以 GitHub Actions 最新运行结果为准。
