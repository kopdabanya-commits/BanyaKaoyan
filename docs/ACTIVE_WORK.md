## 2026-10-16 08:55（Asia/Singapore）技术线最终部署核验（以此节优先）

- **PR #11 已合并**：squash SHA `3e7be62694bbdfdd5fdc35dd8956086da81f249a`；M2.9 原有单一「板牙考研」PWA 的双科云同步代码进入 main。旧Worker原URL、manifest ID及英语二/政治全部本地学习键未改。英语二/政治复习计划文件未改。
- 用户已在原手机导出英语二和政治两份原始备份并提交聊天核验；英语备份v2含65天141个唯一任务ID，政治备份v1保持原做题数。**未把这些真实学习数据导入ECS或GitHub**，恢复有效性与真机体验仍需用户确认。
- GitHub Actions [稳定同步密钥配置run 38830680085](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38830680085)通过：受控固定known_hosts SSH只传长期 `BANYA_SYNC_TOKEN` SHA256摘要，先做SQLite安全备份再轮换，事前正式云库快照数0；新密钥公网HTTPS授权英语/政治GET各 `revision=0`，错误密钥401，原PWA来源的PUT+Authorization CORS预检通过。无原始密钥值进GitHub代码或日志。
- [Certbot 续期钩子run 38830905645](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38830905645)：在已有ECS的真正证书换发成功时自动nginx -t/reload；snap certbot timer已启用。[正常续期复核 run 38831703180](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38831703180)成功但尚未签发新证书，2026-10-19 15:26:26 UTC到期未变。**真实续期尚未验收**；新增main每日定时Actions检查，禁止声称已延期。
- [唯一Worker生产发布与上线验收run 38831564350](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38831564350)：`verify`和`publish`均success；官方Wrangler生产版本ID `c81ef1d8-820e-4129-bb00-9ff4c2022182`，仍为 `https://english-ii-plan.kopdabanya.workers.dev/`。真实公网模拟移动Edge请求：`/index.html` 200且含 `cloud-sync.js`、同步脚本200、CSP精确放行 `https://124.70.128.201`；`server/banya-sync/app.py`、`docs/ECS_HANDOFF.md`、`AGENTS.md` 均404，公网静态防泄漏通过。
- 第一次main部署run `38831115125` 的上传实际成功、只在后续curl/urllib默认UA自动探测时403；独立 [诊断run 38831361262](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38831361262)确定为Cloudflare **1010浏览器特征拦截**。模拟正常Edge UA的 [诊断run 38831466680](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38831466680)200且检查通过；已修复发布工作流默认UA导致的验收误报。Cloudflare Workers Builds原生集成旧红色检查日志仍缺失、其独立根因没有证据，不能和上述HTTP 1010自动探测混同。
- **仍未验证**：荣耀Android16 Edge原已安装的PWA是否更新、两科真实手机本地数据安全上传/读取/多端同步、浏览器重启与断网重连、客户端409冲突体验、手机文件备份导入恢复。真实云库当前应保持revision0（未做授权手机首次上传）；用户必须逐科明确确认首次上传，不允许从服务器/聊天自动移植资料。数据库机内SQLite备份生成/integrity_check=ok，非异地灾备。

---


## 2026-10-16 技术线继续负责共享M2.9 PR #11
- 分支 `feat/huawei-ecs-cloud-sync-m29` 仍为草稿PR，当前占用 `cloud-sync.js`、`_headers`、`.assetsignore`、`sw.js`、`app.js`、共享测试及GitHub部署工作流；英语/政治两条计划线勿盲改共享文件。具体当前SHA和CI每次新聊天须查PR实时元数据。
- 当前ECS已完成授权SSH通道、已安装后端、隔离API通过、机内SQLite备份已真实校验；证书正常renew检查时尚未到期。Cloudflare已有非激活Worker版本，**不能当作发布生产**。
- 云同步仍缺少用户手机各科分别导出原始备份、GitHub长期 `BANYA_SYNC_TOKEN` Secret（仅用户自行填写，禁止聊天粘贴）、真实Cloudflare Builds失败详情（当前API仅403）和Edge真机验收；PR仍未合并。
- 未来发布已准备原Worker的main分支自动化门禁，不新增第二站或改既有存储标识。
# 板牙考研｜并行开发登记表

本页为共享仓库的人工协作登记簿，**不是自动锁、自动任务队列，也不反映未提交到GitHub的聊天**。每个独立ChatGPT/Codex/Work开发对话开始前读最新main及开放PR，并在领取会修改共享代码的任务时登记，完成后更新。

## 当前状态（2026-10-15）
| 工作流 | 当前事实 | 下一动作 |
|---|---|---|
| 英语二 | M2.6计划revision6，65天141项；PR #6已合并，CI通过 | 继续收集用户实际打卡和错题反馈；只有必要时改日程 |
| 政治 | M2.7代码已进入main；PR #7已合并，关联CI通过；政治v1 64天192项 | 待验Cloudflare生产/荣耀Edge真机；必要时独立迭代政治计划更新机制 |
| 共享App品牌/工作流 | 「板牙考研」M2.8的[PR #8](https://github.com/kopdabanya-commits/English-II-Plan/pull/8) 已合并main（`80c3bd25873c652937429ee63fc28e881ba6cd3e`），CI绿 | 当前没有由这张表承诺的持续编辑任务；新的共享修改须重新查实时PR并另开分支 |
| 生产部署 | 未获得Cloudflare实际M2.7/M2.8版本或Edge真机通过证据；一次公开网页检测未能访问此Worker（不能以此推断站点一定宕机） | 按 `docs/OPERATIONS.md` 获取证据后更新状态，未验证不得写已上线 |

## 并行开发占用约定
- 需要同时编辑 `app.js`、`index.html`、`sw.js`、`styles.css`、manifest或共享测试时，先查看是否有其他活动PR正在改这些文件。若有，**暂停共享文件改动或在其分支经协调统一集成**，绝不单靠不同AI聊天“同时开发”赌合并顺序。
- 英语开发线负责自己的计划、离线镜像和英语专项测试。政治开发线负责独立政治计划、镜像与政治专项测试。两边都可以提交同一个仓库不同分支，但只在所有相关自动门禁通过、PR目标最新且无冲突时合并。
- 登记PR号、分支、修改文件和“已验证/待验证”，不要记录用户帐号、密码、学习笔记等私人数据。
- 不要长期把此文件当锁。未见PR或更新时间并不证明其他对话没在操作；必须同时读实时分支/PR/main提交。
- 本页的任务状态变更不是自动通知其他聊天。任何新对话必须主动取最新仓库文件。

工作规范：`docs/WORKFLOW.md`；技术不可破坏项：`docs/SINGLE_APP_CONTRACT.md`。

## 政治线最新审计及工作边界｜2026-10-16
- 检查源：main `6e2e4fc1980f1330637b71e0f5c937de7e203992`（M2.8；PR #8/#9已合并）。本轮核对时开放PR=0；此结果不是未来共享文件的独占锁。
- 政治模块代码与计划完整存在：64天192项、苍盾马原手动题数、独立打卡笔记和备份；英语65天141项未由本轮编辑。main CI [38763243103](https://github.com/kopdabanya-commits/English-II-Plan/actions/runs/38763243103) 成功。
- 本轮审计工作分支：`docs/politics-main-audit-20261016`，**仅修改 `docs/PROJECT_STATUS.md`、`docs/ACTIVE_WORK.md`**，没有占用 `app.js`、`index.html`、`styles.css`、`sw.js` 等共享文件，也不修改任何政治或英语计划数据。审计PR是否合并以GitHub实时状态为准。
- 当前政治线**没有可证实的生产/Edge手机验收结果**。继续任务是：先核对既有 Cloudflare Worker 部署成功信息（无需创建新项目），再请用户在原 Edge PWA 备份两科、切科、打卡撤销、重开、离线验证。网页探测失败不能直接标记服务故障。
- 政治专项待开发（此轮没有领取实现）：政治在线计划变更差异预览和安全迁移；苍盾进度从马原扩展至其他章节。这些需要先获得最新用户需求与移动端验收反馈。
- 英语线继续独立负责M2.6英语复习反馈和代码，不因这份政治审计文档自动修改英语任务。不开发计时器；保留三个历史本地记录键及原站点地址。


## 技术维护线占用｜2026-10-16（实时检查PR #11仍为Draft）
- PR [#11](https://github.com/kopdabanya-commits/English-II-Plan/pull/11)，分支 `feat/huawei-ecs-cloud-sync-m29`，由软件技术聊天处理共享云同步/部署，**占用** `index.html`、`app.js`、`sw.js`、`.assetsignore`、共享测试、CI以及 `server/banya-sync/`，正在开发和验证，不得由英语/政治分支在旧main盲覆盖。
- 仅新增无默认启用的云同步界面和后端；没有修改两科权威计划、手机记录数据或旧存储键。共享文件改动须经全量双科回归。
- 当前主要阻塞是缺少华为云ECS实际连接与可信HTTPS生产地址，不能宣称服务器上线；`_headers` CSP尚未改，必须待确定可信API域名后只放行该域名。
- 完成条件不是CI绿：必须实机验证原Edge安装入口、两科分别首次上传/恢复、断网、冲突与重启，Cloudflare已发布后才进入合并或交付判定。请以实时PR/head SHA和Actions结果校验本记录。
