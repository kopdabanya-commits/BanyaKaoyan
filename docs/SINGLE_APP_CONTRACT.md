# 板牙考研｜单一 App、双科目不可破坏契约

更新：2026-10-15。本文件是两条 ChatGPT/Codex 开发线必须共同遵守的技术事实。若后续有用户新决定，在 `docs/DECISIONS.md` 写入并同步修订本文件。

## 1. 产品的唯一身份
- **唯一 App 的正式名称：板牙考研**。2027考研英语二与政治只是同一软件的两个**科目模块**，不是两个软件、两个安装包、两个网页入口或两个部署项目。
- 唯一代码库为私有 GitHub `kopdabanya-commits/English-II-Plan`，默认分支 `main`。仓库历史名字含 English，并不代表它只能开发英语；不要未经用户明确同意便重命名/移动仓库。
- 唯一生产 Cloudflare Worker 为 `english-ii-plan`（Workers Static Assets），现有 `https://english-ii-plan.kopdabanya.workers.dev`；改产品名称**不改网址和 origin**，否则旧 localStorage 数据无法随域名自动迁移。不要创建第二个 Worker、Pages 项目、独立政治站点，不要启用付费服务或 Access 绑卡方案。
- PWA 入口仅为 `index.html`，安装身份由 `manifest.webmanifest`（`id:"./"`，`start_url:"./index.html"`）定义。导航和主题属于共享 UI；切换英语/政治是 App 内部行为。
- UI名称用「板牙考研」，但技术文件名 `English-II-Plan`、`english-ii-plan` 与 legacy `yantu_...` **刻意暂留**，避免破坏原用户记录/链接/安装身份。

## 2. 科目隔离矩阵
| 关注点 | 英语二 | 政治 |
|---|---|---|
| 权威计划 | `plan.json` | `politics-plan.json` |
| 离线镜像 | `plan-data.js` | `politics-plan-data.js` |
| 校验与迁移 | `planner-core.js` | `politics-core.js` |
| UI与记录入口 | `app.js` 内英语视图 | `politics-ui.js` + `app.js` 的路由 |
| 本地打卡、错题 | `yantu_english_2026_m1` | `yantu_politics_2026_v1` |
| 计划版本 | `2026.10.16-english-r8`，revision8 | `politics.2026-10-15-v1`，revision1 |
| 基线 | 2026-10-15—12-18，65天，143项 | 2026-10-16—12-18，64天，192项 |
| 用户目标 | 英语二冲刺80，阶段目标75 | 政治目标60—65，上海地区 |
| 操作要求 | 每天阅读/新题型/完形至少一项；单词不进任务清单；2024—26卷留模考 | 苍盾题库进度手动记；徐涛课程与1000题以实学为准；肖八/肖四取得后再启用 |

- 两门科目不共享任务ID命名空间、完成态、错题、笔记或进度；任何一科的任务变化不得触发另一科的增删/打卡/改期；单科的错过任务绝不自动加到次日造成双倍负担。
- **共享的只有外观、顶部/底部导航、科目切换和静态离线发布资源**。当前选中的科目只保存到 `banya_active_subject_v1`，仅属于 UI 偏好；历史外观偏好仍使用 `yantu_theme_v1`。
- **不要因改名而迁移**英语键 `yantu_english_2026_m1`、英语计划键 `yantu_english_plan_v2`、政治键 `yantu_politics_2026_v1`，或旧备份的 `app:'yantu-english-ii'`、`app:'yantu-politics'` 标识。用户看到的是板牙考研，但历史数据必须能原样恢复。只有单独经过测试、有旧数据备份的迁移PR才能修改这些键。
- **政治当前不具备英语那样的在线 `politics-plan.json` 差异预览/用户确认迁移机制**，现阶段经SW更新静态政治镜像后展示新计划。任何政治计划变更必须保持旧ID和已有记录，并专项补迁移或兼容性测试。不能用英语按钮“检查计划更新”假装同时更新了政治计划。
- 政治不直接读取苍盾小程序、不能自动访问用户账号；英语与政治均无实时云端学习同步。个性化计划的依据是用户主动确认的进度，而不是仓库初始值。

## 3. 允许的开发范围与所有权
- **英语计划工作**：改 `plan.json`、`plan-data.js`、`planner-core.js`及对应英语UI/测试；不能动政治计划或政治本机键。修改 App 的共享 `app.js` 时要增加跨科目回归测试。
- **政治计划工作**：改 `politics-plan.json`、`politics-plan-data.js`、`politics-core.js`、`politics-ui.js`及政治测试；不能动英语计划/记录键。政策课和政治资料未实际发布时不能宣称用户已拥有。
- **共享壳/UI工作**：改 `index.html`、`styles.css`、`manifest.webmanifest`、`app.js`、`study-intelligence.js`、`sw.js`、构建/部署文件时需两门科目一起回归，不得让其中任意一科消失。
- 工作集中修改目录和自动测试入口见 `docs/WORKFLOW.md`。同一共享文件只允许通过最新main上的一个集成PR串行落地，不准在两个独立分支各自盲目合并覆盖。
- 已有 App 图标文件 `icons/icon-192.png` / `icons/icon-512.png` 不因本次仅改产品名称而偷偷更换；如后续需要专属视觉logo，另立可验收的设计任务。

## 4. 必须通过的防回归门禁
1. `index.html`、manifest、App设置显示「板牙考研」，只有一个可安装PWA；英语和政治均是 active 并可在同一导航切换。
2. 英语65天/143项revision8，政治64天/192项v1，各自 JSON 与离线 JS **逐字段相同**、ID唯一、分钟数合法；修改计划需另有版本号与变更摘要、合理的迁移策略。
3. 原有英语和政治打卡/错题/笔记备份都能读取。点击政治打卡绝不改英语 `localStorage`，点击英语打卡不改政治。改名不改历史备份的内部标识。
4. 共享PWA更新缓存 `sw.js` 版本和 ASSETS，仍保留旧缓存前缀 `yantu-english-ii-` 以安全清理旧包，不缓存 `plan.json`、`politics-plan.json` 联机请求，不调用 `skipWaiting` 强更使用中的旧版本。
5. `node scripts/check.mjs` 与 **完整Node测试**（含 `scripts/integration-contract-test.mjs`）及PR `Validate planner` 都通过才允许合并。
6. CI成功不等于生产发布；Cloudflare构建成功不等于已安装的Android Edge PWA更新；手机验收要逐科打卡、重开与恢复验证，未验证要在状态文件显式标注。
7. 用户习惯用番茄 Todo计时，**板牙考研不做计时器**、不伪称读取其专注时长。不额外绑银行卡或购买服务。

## 5. 防止两个开发对话互相覆盖
每个开发对话/Work/Codex都必须从GitHub **最新main** 开始，先查 `docs/ACTIVE_WORK.md`、当前开放PR和分支，确认别的开发线是否在改 `app.js`、`sw.js`、`AGENTS.md` 或任一计划文件。针对同一共享文件应先交流并复用/等待既有PR，禁止平行盲改；跨科目需要共同修改时由一个集成分支负责最终整合。完成后在状态文档写明真实证据。GitHub是跨聊天协作载体，但**不提供聊天之间实时同步或互斥锁**，此规则需要每位执行者自觉读取。


## 6. M2.9 待上线云同步安全契约（2026-10-16补充）
现有PR #11草稿在同一PWA设置页加入云同步入口：两科各自云快照/修订号/本机基线独立，只在配置HTTPS地址和本机随机密钥、用户逐科确认首次上传/恢复后启用；冲突409、来源版本回退、本机与云端双变更一律停止覆盖。云恢复前必须保存独立本机副本，断网不阻断任何本地打卡。服务器仅监听本机环回地址，通过后续受信任的HTTPS反代/网络边界提供访问。私有 `server/` 在 `.assetsignore` 明确排除。首次部署前保持 `_headers` 的外联 CSP 不扩权，可信API主机名确定后仅放行其origin。现有静态站点地址、manifest id、两门科目原localStorage键、备份内部app标识全部原样保留。**本节定义合入后的预期行为，并不是当前生产部署事实。**
