# 板牙考研｜项目知识库总入口

最后整理：2026-10-15。**当前品牌是板牙考研，不是研途；一个PWA、两门独立科目；一个GitHub仓库和Cloudflare Worker。** 旧代码中的 `yantu_` 键用于兼容老数据，不是产品名称。

## 新ChatGPT、Codex、Work必读
1. [PROJECT_STATUS.md](PROJECT_STATUS.md)：版本、政治开发实际进度、GitHub/CI证据与未完成事项（先读最新事实）。
2. [DECISIONS.md](DECISIONS.md)：用户确认的产品身份、单App双科目、备考原则、禁止计时器等长期决定。
3. [SINGLE_APP_CONTRACT.md](SINGLE_APP_CONTRACT.md)：两门科目文件所有权、存储/备份隔离、离线/测试不可破坏事项。
4. [ACTIVE_WORK.md](ACTIVE_WORK.md)：并行英语、政治、共享壳的开发占用；必须搭配GitHub实时PR/分支检查，不能当自动锁。
5. [WORKFLOW.md](WORKFLOW.md)：直接通过GitHub开发、跨聊天协调、PR、CI、Cloudflare部署与手机验收。
6. [GPT_HANDOFF.md](GPT_HANDOFF.md)：用户新建聊天以及给Codex/Work的最新交接规则。
7. [OPERATIONS.md](OPERATIONS.md)：用户在同一个手机App中切换、备份、更新、恢复。

## 科目资料和历史
- [STUDY_BASELINE_2026-10-15.md](STUDY_BASELINE_2026-10-15.md)：英语二历史学习基线，真实进度以用户最新反馈为准。
- [DAILY_QUESTION_FEEL_2026-10-15.md](DAILY_QUESTION_FEEL_2026-10-15.md)：英语二每天保持阅读/新题型/完形题感的研究与65天调整依据。
- [MULTI_SUBJECT_ARCHITECTURE.md](MULTI_SUBJECT_ARCHITECTURE.md)：当前单App双科技术结构与历史变化。
- [VALIDATION.md](VALIDATION.md)：历史自动验证与上线试验，不能覆盖当前真实状态。

## 哪些才是权威数据
- 当前计划：`plan.json`（英语）与 `politics-plan.json`（政治），对应 `plan-data.js` 和 `politics-plan-data.js` 离线镜像。
- 真正做过的题和笔记：**用户手机实际记录/主动导出/亲口反馈**；GitHub里的未来计划绝不等于已完成。
- App源代码、PR及分支：GitHub实时main。产品最新决定优先于旧聊天，遇到不同分支并行改共享代码必须先协调。
- Cloudflare生产状态、Android Edge真机效果：需要真实部署与手机证据，不能由“CI通过”推断。

**目标：少打扰用户复习，用一个稳定的板牙考研App管理两个相互独立的科目。**
