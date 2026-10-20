# 板牙考研｜单一App双学科架构

本文件取代旧 M2.5“政治待建档”设计说明；旧状态见 Git 历史/PR #5，不代表当前情况。用户在2026-10-15再次明确：**英语二和政治不是两个App；只是同一App里不同科目和计划**。

## 代码分工
- **一个入口与安装实例**：`index.html` → `manifest.webmanifest`（`id="./"`）→ 同一 `app.js`底部导航/科目切换；`styles.css`共享视觉；`sw.js`为两门科目提供一个完整离线壳。
- **英语模块**：`plan.json`权威计划→`plan-data.js`离线镜像；`planner-core.js`校验/安全迁移；`app.js`的英语首页/日历/分析/设置；本地键`yantu_english_2026_m1`与已确认计划键`yantu_english_plan_v2`。
- **政治模块**：`politics-plan.json`权威计划→`politics-plan-data.js`离线镜像；`politics-core.js`校验/独立记录；`politics-ui.js`的政治今日/日历/进度/设置/手动苍盾题库记录；本地键`yantu_politics_2026_v1`。
- **共享模块**：`study-intelligence.js`注册两个 active 科目并提供英语本机规则建议；不同学科的统计独立计算。UI选中科目新键`banya_active_subject_v1`仅保存`english`或`politics`，主题旧键 `yantu_theme_v1`保持不变。
- 未来可用一个只读的首页聚合展示两科今日任务，但决不能共享或混合实际“已完成”记录，也不要替用户自动改某科日程。

## 实际已实现与尚未实现
- 目前政治 M2.7已经合入同仓库main：[PR #7](https://github.com/kopdabanya-commits/English-II-Plan/pull/7) 自动化检查通过；政治64天192项 v1，英语65天141项 M2.6，各有记录与导出恢复。UI命名与开发流程M2.8不改变两科计划版本。
- 苍盾肖1000题进度需要人工输入，不能自动读取微信小程序；未来肖八肖四应以实际发布和拥有资料为前提。
- 英语的 `plan.json` 与手机客户端已有差异预览/手动确认机制；政治**暂时没有同等级联机更新预览**，政治本身随 `politics-plan-data.js` 进行离线更新。政治后续版本变动需要对旧任务ID、笔记、备份做专门回归；不能直接套用英语 `planner-core.js`。
- PWA静态界面/规则建议不是可自主读取手机信息的云端AI，预计分钟不是番茄Todo计时结果，无服务器数据同步、定时提醒。
- 安卓Edge真机体验、Cloudflare实际生产版本仍须分别核实；自动化通过不等于已部署或已验收。

## 数据与部署不可变项目
- 改名**只改外观**，历史内部键`yantu_...`、备份app字段`yantu-english-ii`与`yantu-politics`暂留；保证原已安装同一网址的localStorage读取不丢。
- 不能把仓库历史名称 English-II-Plan 理解成应再建政治仓库，也不能因正式品牌「板牙考研」而改Worker名称/域名；网站origin一变，旧本地记录通常不会自动随迁移。
- 不使用Cloudflare Access绑卡，不另买数据库，不改政治/英语彼此计划ID；单词在英语App内预算预留但不列任务，番茄 Todo管计时。
- 最新详细守则见 [SINGLE_APP_CONTRACT.md](SINGLE_APP_CONTRACT.md) 和 [WORKFLOW.md](WORKFLOW.md)。
