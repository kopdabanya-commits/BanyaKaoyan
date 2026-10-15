## 最新：ECS 后端基础设施已部署｜2026-10-16（PR #11 分支）
- 经用户授权，使用仓库 Actions Secret 和固定 SSH 主机公钥，从 GitHub Actions 登录 `124.70.128.201`；此云执行器仍无法直接 SSH，连接方法见 `docs/ECS_HANDOFF.md`。
- [部署 run 38784363727](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38784363727) 成功：板牙后端 systemd/Nginx/IP HTTPS 在线，本机健康、授权英语读取、未授权政治 401 与证书续期 dry-run 已通过。[外部 run 38784581580](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38784581580) 验证公网 `/health` 200、两科未授权各 401。证书实际自动续期仍待到期前复核。
- 用户授权的[旧 NJFU 退役 run 38784675831](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38784675831) 成功；[退役后只读盘点 run 38784770680](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38784770680) 确认旧服务单元不存在、旧目录不存在、只有 banya-sync Nginx 站点启用，新服务 active/enabled、健康 200。
- **PR #11 仍为 Draft，未合并 main；同一个 Cloudflare Worker 尚未发布 M2.9。** `_headers` 的 CSP 仍只许同源，手机云同步尚未启用；临时服务令牌未交给用户，用户手机学习数据未上传。下一聊天应按 `docs/ECS_HANDOFF.md` 完成长期令牌、前端接入、Cloudflare 发布与手机实测。

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
