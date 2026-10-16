# AGENTS.md｜板牙考研：AI工程师必须先读

**产品唯一身份：板牙考研 = 一个PWA、一套UI/导航/部署、两门独立科目（英语二+政治）。** 绝不能当成两个软件，也不要为政治创建第二个仓库或Cloudflare项目。GitHub旧仓库名 `English-II-Plan`、Worker旧名称 `english-ii-plan` 和各 `yantu_...` localStorage键出于用户数据兼容**故意保留**。正式UI/安装名称是「板牙考研」。

## 新对话强制阅读顺序
1. `docs/index.md`、`docs/PROJECT_STATUS.md`、`docs/DECISIONS.md`。
2. `docs/SINGLE_APP_CONTRACT.md`（数据/计划/跨科隔离契约）。
3. `docs/ACTIVE_WORK.md`、`docs/WORKFLOW.md`（其他对话当前共享文件占用与PR流程）。
4. 当前main最新提交、开放PR、分支和本次要动的文件；再读 `docs/STUDY_BASELINE_2026-10-15.md`、对应政治资料和测试。

## 用户与边界
- 用户零编程基础，正备考2027研究生招生考试。尽量由AI在授权范围内完成GitHub代码、文档、测试、PR及合并；用户只执行必要真机或账户动作。不要频繁要求手工改代码、绑定银行卡、重建Cloudflare、卸载PWA。
- 目标设备HONOR PTP-AN10 Android16，微软Edge安装PWA；部署为现有免费公开Workers静态站点 `https://english-ii-plan.kopdabanya.workers.dev`，不等于私人站点。不提交用户学习笔记、账户/密钥等到公开静态目录。
- 用户使用番茄 Todo计时，本项目**不做番茄钟/计时器**，不能宣称读取其计时记录。日程预计分钟不等于实际学习时长。
- 一个软件内英语二、政治计划互不干扰。新 UI 偏好键可以独立增加，但**不得修改原英语本机记录键** `yantu_english_2026_m1`、英语本机计划 `yantu_english_plan_v2`、政治本机记录键 `yantu_politics_2026_v1`，历史备份内部 `app:yantu-english-ii` 和 `app:yantu-politics` 也不得为改品牌随意换。
- 用户已学习题目/错题/笔记都来自用户实际反馈或主动导出，绝不根据日期假定“已完成”，也不能私自读取苍盾小程序。

## 当前两科计划（历史截至2026-10-15；实际状态以main为准）
- 英语二 `plan.json` + `plan-data.js`：M2.7.1/revision8、2026-10-15至12-18共65个历史计划日/191项专项，用户确认10/15完全未学、10/16重新起步；每天至少阅读一篇/新题型一组/完形一套，通常专项85—90分钟，单词另外约30—40分钟不列任务，英语日总预算130分钟建议；2024—2026年真题保留后期模考。用户2012新题型曾错0题，不可改写。
- 政治 `politics-plan.json` + `politics-plan-data.js`：politics.2026-10-15-v1/revision1、2026-10-16至12-18共64天、192项。目标上海地区60—65分；用户此前徐涛27强化课第6集、苍盾肖1000题马原93/396（不是全科正确率）、无纸质资料。政治仅手工登记题数/错题；肖八肖四按实际发布及用户取得情况再启用。
- 政治 `politics-ui.js`、`politics-core.js`；英语 `app.js`内英语视图、`planner-core.js`；共享 `index.html`/manifest/styles/app.js路由/Service Worker。政治目前尚无与英语一致的在线计划差异预览/确认迁移流程，不得伪称具备。
- 品牌/共享壳界面M2.8是新 UI 与工作流版本号，**不意味着英语或政治各自计划版本自动升级**。

最新英语计划 `2026.10.16-english-r10`/revision10：10/16实际已写2011年小作文20分钟（2010年小作文更早已做），用户反馈今天阅读已做但App完成状态只能用户自己打卡；10/18原2011小作文已换成独立邀请信25分钟限时练习，不能回滚。详见D20。

最新英语用户真实反馈、日程和减少复盘的规则详见 `docs/ENGLISH_PROGRESS_PRACTICE_FIRST_2026-10-16.md`，绝不可将历史计划的2010小作文当作10月16日已做题。

最新英语重启执行及旧数据兼容规则见 `docs/ENGLISH_RESTART_2026-10-16.md`。只记录用户真实反馈，不在GitHub代替手机打卡；10/15原计划保留，10/16不叠加欠债。政治模块及云同步均由其他开发线维护。

## PR和CI最低要求
1. 真实核对最新main+开放PR、共享文件占用，切分英语/政治/共享修改范围；在旧分支上反复覆盖共享文件不可接受。
2. 计划修改必须同时更改对应JSON和离线JS镜像，递增独立版本/修订号，旧任务ID与用户记录保留；加入学科专项/跨科测试。
3. 每个PR执行 `node --check`、`node scripts/check.mjs`、`node --test scripts/*.mjs`，以 `.github/workflows/validate.yml` 实际命令为准；先绿CI再合并，并核实最新main SHA。CI/部署/真机验收分层记录，不夸大完成状态。
4. 共享静态资源修改同步 `sw.js` 的CACHE版本/ASSETS，旧前缀用于安全清除旧缓存；不缓存计划JSON或重定向登录页，不强制skipWaiting。保持同一PWA manifest id、同一workers.dev域名和同一Worker。
5. 合并时同步 `docs/PROJECT_STATUS.md`、`docs/DECISIONS.md`、`docs/ACTIVE_WORK.md`。必要时更新 `docs/GPT_HANDOFF.md`。所有信息以**最新明确用户决定 > 实际用户学习反馈 > 当前main代码 > 当前状态文档 > 历史描述**为准。

详细规范：`docs/SINGLE_APP_CONTRACT.md`、`docs/WORKFLOW.md`、`docs/OPERATIONS.md`。
