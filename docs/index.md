# 研途英语二｜项目知识库总入口

更新：2026-10-15。后续对话、ChatGPT Work、Codex、GitHub 开发均从这里开始；**不要只依赖过去聊天的记忆**。

## 先读哪些文件
1. [PROJECT_STATUS.md](PROJECT_STATUS.md)：当前事实、最后确认状态、待验证事项，优先处理新旧信息冲突。
2. [WORKFLOW.md](WORKFLOW.md)：ChatGPT／Codex／Work／GitHub／Cloudflare 的职责与实际工作步骤。
3. [DECISIONS.md](DECISIONS.md)：用户已经做出的关键决定，尤其免费免绑卡和单词另计。
4. [GPT_HANDOFF.md](GPT_HANDOFF.md)：可复制到 ChatGPT 项目指令或新对话的交接提示。
5. [OPERATIONS.md](OPERATIONS.md)：手机使用、改计划、备份、故障排查和版本更新。
6. [STUDY_BASELINE_2026-10-15.md](STUDY_BASELINE_2026-10-15.md)：考研英语二成绩与学习状况的历史快照。
7. [VALIDATION.md](VALIDATION.md)：各阶段的历史测试记录；早期Access描述已过时，须结合最新状态阅读。

## 哪些是真正的数据源
- 当前学习计划：仓库根目录 `plan.json`；离线初始副本 `plan-data.js` 必须同步。
- 真正做过的题、错题和笔记：用户的即时反馈或其主动提供的 App 数据导出。**仓库里的计划不是完成证明**。
- 代码、部署配置、自动化：GitHub 当前 `main` 分支与仓库文件。
- 网站实际是否上线：Cloudflare 最近部署检查或用户真机反馈；不能仅凭代码提交认定上线成功。
- 历史讨论：辅助上下文。冲突时优先用户最新明确要求、真实进度和当前代码。

## 一句话工作原则
**不让用户花更多时间维护软件；优先帮助用户通过2027考研英语二。** 代码由有工具能力的 AI 尽量直接处理，复杂配置、重复登录、绑卡和清数据不得作为默认方案。
