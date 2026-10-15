# 板牙考研｜ChatGPT × Codex × GitHub × Cloudflare 标准工作流

生效日期：2026-10-15。产品只有**一个板牙考研 PWA**，英语二和政治是同一App的两个科目模块。此文优先于旧版“研途英语二”开发流程。技术边界以 [单App契约](SINGLE_APP_CONTRACT.md) 为准，当前真实状态以 [状态快照](PROJECT_STATUS.md) 为准。

## 1. 人与工具如何分工
- **用户**：给出真实学习反馈、取舍决策；有需要时在手机验收并保留备份。用户零编程基础，不应被要求手工编辑大量代码、频繁登录、付款/绑卡、重新安装PWA。
- **ChatGPT**：查真实资料与用户基线、制定英语/政治计划、直接使用已授权GitHub工具创建分支、更新文件、检查CI、合并合格PR、记录项目决策。不能从用户手机或苍盾小程序私自获取真实打卡。
- **Codex**：工程代码、UI/测试、修复与PR主要执行者；读同一 GitHub 项目指令后开发，不自己重命名产品/重建Worker。
- **ChatGPT Work/云端浏览器**：仅当该模式可用、已授权时处理多步部署和真网页/手机模拟验收。不得假定不同聊天共享实时云电脑、登录状态或背景任务。
- **GitHub**：唯一代码、计划、开发规范和PR事实来源，不保存用户私密笔记。
- **Cloudflare**：仅负责同一个已存在 Worker 的免费静态部署，不负责实时云端学习同步；无需额外购买服务。

## 2. 每个开发对话开始必须执行
1. 读取最新GitHub仓库 `kopdabanya-commits/English-II-Plan` 的 `main`，特别是 `AGENTS.md`、`docs/index.md`、`docs/PROJECT_STATUS.md`、`docs/DECISIONS.md`、`docs/SINGLE_APP_CONTRACT.md`、`docs/ACTIVE_WORK.md`。
2. 查询**实时main提交、当前开放PR、活动分支**，检查是否有另一会话修改相同文件；不得依赖昨天的SHA、旧聊天或历史标题来判断最新版本。
3. 明确本次工作属于英语专项、政治专项还是共享App。查看 [文件所有权矩阵](SINGLE_APP_CONTRACT.md)；如需改别人正在改的共享文件，先协调并行分支，或者等其PR合并并重新基于最新main创建集成分支。
4. 告知用户简短的真实状态，然后直接执行允许的低风险操作；只有必须由用户完成登录/同意/真机步骤时再询问。

## 3. 分支命名、合并与防覆盖
- 英语计划：`feat/english-...`，政治计划：`feat/politics-...`，共享App/跨科目：`feat/shared-...` 或产品命名分支。不要在 `main` 上无测试地直接反复覆盖。
- 新分支使用**实际刚查询到的main提交**作为起点；一个分支尽量只做一个明确任务，复用同一个PR修复其中失败，不因失败新开一堆互相覆盖的PR。
- 修改前查 `docs/ACTIVE_WORK.md` 和最新开放PR；共享入口如 `app.js`、`index.html`、`sw.js`、`styles.css` 采用一个集成PR串行合并。GitHub PR mergeable为false时不能硬合并。
- 在PR正文写明：目标科目、计划/代码范围、是否动了共享入口、数据迁移、UI变更、测试结果与未验证项。新增用户决策同步 `docs/DECISIONS.md`，修改工程边界同步 `SINGLE_APP_CONTRACT.md`。
- CI必须经过对应commit的 `Validate planner`，失败要看具体job日志修复并复跑。PR合并前重新检查main SHA/PR head/合并冲突；任何别的分支提前合并导致main变化，先同步并重新做相关回归。
- 禁止通过重建仓库/Worker/改域名来“解决部署问题”，禁止为UI命名修改旧 localStorage 键、旧备份 app 标识、manifest `id`。

## 4. 两门科目如何独立调整计划
**英语二：** 权威 `plan.json`、镜像 `plan-data.js` 必须逐字段一致。每次计划调整递增 `meta.revision`、更新 `meta.planVersion` 与 `changeSummary`；旧任务ID稳定、改期保留ID、新任务新ID，特别维护“每天至少一篇阅读/一组新题型/一套完形、单词不显示、2024—2026模考卷保留”的M2.6规则。用户历史记录只来自其主动反馈或导出文件，缺一天不自动补双倍。
**政治：** 权威 `politics-plan.json`、镜像 `politics-plan-data.js` 必须完全一致；政治当前v1按徐涛强化课、苍盾肖1000题和上海60—65分目标制定，但已完成题数仅限用户曾报告的马原93/396；后续做题、错题必须由用户手动登记或真实反馈。计划变更需增加独立revision/version、保留任务ID并有前后兼容测试。当前政治不支持与英语同等的在线计划差异预览；完善前不要对用户声称“检查计划更新”同时更新了政治，也不可自动覆盖用户私人修改。
**跨科目：** 统一首页或数据总览可以只读合并汇总，但**单科完成率和题数永远分开**。共享的数据仅为配色、科目选择等UI偏好。用户使用番茄 Todo计时，板牙考研不开发计时器。

## 5. 自动测试和发布门禁
1. 语法检查：`node --check app.js`、`node --check planner-core.js`、`node --check politics-core.js`、`node --check politics-ui.js`、`node --check study-intelligence.js`、`node --check sw.js` 及计划JS镜像。
2. `node scripts/check.mjs` 检查英语；`node --test scripts/*.mjs` 跑所有子系统（但 `check.mjs` 单独运行，不要误将其当Node test）。
3. 新增 `scripts/integration-contract-test.mjs` 约束单一App、两科独立、备份/存储键不变、同一SW缓存；不因UI改动而删除相关安全断言。
4. 修改共享静态资源需要同步 `sw.js` CACHE名与 ASSETS，包含政治模块全部JS。旧缓存前缀保留清理，禁止对当前用户 `skipWaiting` 强更、不缓存计划联机检查JSON或HTML登录跳转。
5. PR绿色后才合并main并再次回读提交状态。GitHub的CI绿不表示Cloudflare生产上线，Cloudflare上线不表示荣耀Android Edge已安装的PWA成功更新/离线可用，任何状态都要分别记录。
6. 用户手机更新时**先建议分别导出英语备份和政治备份**，尽量避免卸载或清理网站数据；新的品牌名不需要新建地址和单独政治App。

## 6. 一次交付必须写回哪些东西
- `docs/PROJECT_STATUS.md`：目前品牌、两个科目的真实版本、PR/CI证据、Cloudflare状态、手机验收与未完成风险。最新状态放前面，旧日志只标历史，不得让过时段落冒充最新。
- `docs/DECISIONS.md`：如果用户做了新选择，唯一编号、日期、覆盖旧决定的说明。
- `docs/ACTIVE_WORK.md`：新PR占用共享文件、责任分支及合并状态。注意这不是自动锁，不可依赖它代替GitHub实时检查。
- `README.md` / `docs/GPT_HANDOFF.md` / `AGENTS.md`：重要架构变化要保持命名、交接与最短指令同步。
- PR合并后用户可只需要一段简短的手机操作说明。不能让他反复改脚本。

## 7. 验收等级（绝不混淆）
- **代码实现**：GitHub存在可检查的提交。
- **自动校验**：对应提交的Node/Actions检查通过。
- **生产上线**：Cloudflare构建成功并证实线上实际是该版本。
- **真实手机使用**：用户在Edge同一个已安装App中检查、切换两科、各完成/撤销一项、重开后记录分别保留、独立备份可导出；未收到这些反馈则只能写“待手机验收”。

## 8. 失联与故障恢复
- ChatGPT连接器暂不可用：说明阻塞，提供可复用的工作说明，不得冒充修改已完成；不要让用户为了重建项目付钱。
- CI红：读取具体job和断言，先修根因再合并；不能绕过测试或删掉关键覆盖。
- Cloudflare更新未见：先对照提交和Workers构建日志，检查manifest/SW缓存，再选择保守重试；不要清理用户存储、删除旧Worker或错误改地址。
- 用户记录丢失/损坏：立即停止自动覆写，优先单科导出备份与恢复前副本，必要时分析原始JSON；不可拿另一门科目备份来恢复。
