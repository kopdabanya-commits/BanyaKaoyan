# AGENTS.md｜English-II-Plan AI工程师入口

**读取顺序**：`docs/index.md` → `docs/PROJECT_STATUS.md` → `docs/DECISIONS.md` → `docs/WORKFLOW.md` → `docs/STUDY_BASELINE_2026-10-15.md` → 涉及的代码、测试和PR。GitHub `main` 是代码事实源，项目状态文档是可更新快照；旧聊天不能覆盖最新用户指令。

## 用户与目的
- 用户零编程基础、时间紧，2027考研英语二，目标80分、努力争取75分，2026-12-19考试（用户当前安排）。
- 对话以中文简洁答复、尽量由AI直接完成可授权GitHub操作；不让用户反复登录、手工编辑代码、绑银行卡或为维护软件挤占复习时间。
- 2026-10-15至12-18共65天，**每天至少练一篇阅读、一组新题型或一套完形，专项每日60—90分钟（多数日85—90分钟）；单词自行学习、不显示在任务打卡列表**。作文优先，翻译/新题型次之，完形次之，少量阅读保持手感。
- 10/13和10/14没学，不双倍补课。2024—2026新真题为后期弹性模考保留。学习进度必须来自用户真实反馈或其主动导出的App记录，不能根据日期推断完成。

## 单一项目身份与部署
- 仓库`kopdabanya-commits/English-II-Plan`、Private、`main`；Cloudflare现有 Workers Static Assets `english-ii-plan`，不是Pages。禁止另建/重建项目。
- `https://english-ii-plan.kopdabanya.workers.dev` 为用户自己启用的免费**公开站点**；不要声称私人仓库让网页私密。用户拒绝Access绑卡/付费；默认不配置、不触发旧Access流程。
- `wrangler.jsonc`：`workers_dev=true`，`preview_urls=false`；部署检查必须与真实站点核实，不能假装工具已登录Cloudflare。Cloudflare云端浏览器历史403，勿循环重试。
- 用户设备HONOR PTP-AN10 Android 16；使用微软Edge安装PWA，桌面图标问题用户已处理。

## 代码和数据的不可破坏约束
- `plan.json`是权威日程，`plan-data.js`必须完全同步。修改计划递增`meta.revision`、变更`planVersion`、`changeSummary`；旧任务改期保留ID，新任务使用新ID。M2.6：`2026.10.15-m2.6`/revision6、65天/141专项任务。**这些是当时快照，不要把固定数当作未来永不变化。**
- 用户已打卡、错题、笔记、个人修改、改期必须保留；不可擅自清空浏览器数据或改动`localStorage`键`yantu_english_2026_m1`；备份/迁移详见`planner-core.js`与`docs/OPERATIONS.md`。
- 当前M2.6每天至少安排一项阅读、新题型或完形，专项上限90分钟；单词在App内部预算中可以保留用于总时间约束，但不出现在每日任务/进度中。新题型2012年**错0题**；绝不能把用户报告的错题数写成正确题数。
- 2024—2026新卷未经用户确认不可先标做完；不把遗漏任务自动加倍挤到第二天。
- 静态代码每次变更视需要同步`sw.js` CACHE版本；不`skipWaiting`强更正在用的App；Service Worker不缓存plan检查或重定向登录页。
- `.assetsignore`禁止部署`docs/`、`.github/`、`scripts/`、密钥/备份；绝不将API token、账号、邮箱、身份或私人笔记写进前端。

## 开发/测试/交付的最低动作
1. 查`main`/现有PR，避免和其他AI重复修改。Codex主要编码；ChatGPT负责策略、需求、测试和GitHub协调；Work按其实际授权执行，**会话之间不保证实时同步**。
2. 小范围变更，更新计划数据、测试、版本、相关文档，走分支PR。
3. 运行`node --check`（JS）、`node scripts/check.mjs`、`node --test scripts/test.mjs scripts/sw-test.mjs scripts/access-test.mjs`；检查`Validate planner`。
4. **必须区分**：GitHub提交成功／CI测试通过／Cloudflare生产部署成功／Android真机验收成功。无法证实时标“未验证”。
5. 更新`docs/PROJECT_STATUS.md`，有新用户决定则写`docs/DECISIONS.md`，后续ChatGPT/Work/Codex才能接手。
6. 不要要求用户为旧`configure-access.yml`配置Token或银行卡。该流程为归档历史试验。

详细流程、验收、故障处理见`docs/WORKFLOW.md`与`docs/OPERATIONS.md`。

## M2.5 多科目准备与UI约束（2026-10-15）
- 用户要求明显提升UI视觉质感、动效和智能功能，**但不开发计时/番茄钟**（用户用番茄 Todo），不虚构与其集成。
- 英语二已有计划仍为M2.3、65天99项；政治暂时只准备独立科目入口、注册表和计划数据命名空间，不能假定用户已经开始政治学习。
- `study-intelligence.js` 是透明、离线、本机规则推荐和实际打卡分析，不是云端AI/自动读取用户手机数据；不会自动调整复习计划。
- 科目正式启用、记录隔离、导出备份及版本管理以 `docs/MULTI_SUBJECT_ARCHITECTURE.md` 为准。
- 新增JS需同步 `index.html`、`sw.js` 静态离线资源表、Service Worker模拟测试、GitHub Actions检查和 `.assetsignore` 约束；轻动效必须遵守 `prefers-reduced-motion`。
- UI版本M2.5与英语计划版本M2.3是两个层面，别为纯UI更新擅自修改 `plan.json` 或迁移用户学习数据。

## M2.6 每日题感训练（最新高优先级规则）
- **新用户要求覆盖旧60—80分钟限制**：每天至少完成一个客观题训练单元（阅读Text一篇或新题型一组或完形一套），另加原定作文/翻译等；日专项最高90分钟，通常85—90分钟。单词额外安排30—40分钟，不列入App每日打卡，总预算130分钟建议（最大硬边界135分钟）。
- 不把英语二新题型全部叫“七选五”：按所选真题实际题型；用户2012年新题型一刷为错0题，记忆不能改写。
- 此版没有调整任何已存在的99项任务和10月15日既有65分钟任务，只对42个无客观题日新增20—25分钟练手，优先旧卷，2024—2026模考保留。
- 新任务ID以`daily-feel-YYYY-MM-DD`为前缀。计划文件和离线副本同步，revision6、版本M2.6，代码、测试与离线缓存版本M2.6；升级用户预算应明确预览，禁止无确认覆盖个人完成记录。
- 研究依据和具体实施见`docs/DAILY_QUESTION_FEEL_2026-10-15.md`。社会平台经验属于个人观点、不能当官方考试大纲；小红书公开原文未核实时不虚构来源。
