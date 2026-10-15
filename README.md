# 研途英语二 · English-II-Plan

2027年考研英语二的**65天复习计划 + 本地打卡 PWA**。用户希望尽量少操作代码和部署，保留真实学习进度，优先提高英语成绩。

> **新ChatGPT / Codex / Work从这里进入：[项目知识库 docs/index.md](docs/index.md)。当前真实状态见 [PROJECT_STATUS.md](docs/PROJECT_STATUS.md)，协作流程见 [WORKFLOW.md](docs/WORKFLOW.md)。**

## 项目入口
- GitHub：`https://github.com/kopdabanya-commits/English-II-Plan`（**Private**，`main`）
- 部署：现有Cloudflare Worker `english-ii-plan`（Workers Static Assets，**不是Pages**）
- 网站：`https://english-ii-plan.kopdabanya.workers.dev`（用户已手动启用；当前**公开网页，不设置Access鉴权**）
- 手机：荣耀Android 16，经微软Edge安装PWA；具体实机回归状态见项目状态文档
- 原则：**永久免费、不绑银行卡、不购买额外套餐**；不删除/重建现有项目

## 当前学习计划（M2.3）
- 版本 `2026.10.15-m2.3`，`revision=5`；2026-10-15至12-18共65天，**99项专项任务**（不包括单词）。
- 用户最新要求：每天专项**60—80分钟**，背单词自己单独安排，**不显示在每日任务/打卡统计中**。预留约30—40分钟另学单词。
- 10月15日：2010年小作文30分钟 + 2014年新题型30分钟 + 5分钟作文回忆 = **65分钟**。原10月17日的2014新题型改为错题复盘。
- 目标按用户安排2026-12-19考试，冲刺80分；75分是努力争取的基础目标，不是成绩保证。
- 2024—2026真题预留后期弹性模拟，未确认做完前不能先记作已完成。

## 数据怎样运作
- `plan.json`：唯一权威日程；`plan-data.js`：完全同步的离线初始副本。
- `planner-core.js`：任务构建、数据校验、历史迁移；`app.js`：页面、打卡、错题、记录、计划更新；`sw.js`：离线静态资源缓存。
- 个人打卡、错题和笔记通过`localStorage`只保存在当前网站来源和浏览器，不在仓库或云端，不跨设备自动同步。存储键`yantu_english_2026_m1`须保持迁移兼容。
- 新计划发布后，手机在“设置 → 检查计划更新”手动确认并应用；已有记录、个人改期和笔记应保留。建议先导出备份。
- **私人GitHub不等于私人PWA网址**。当前网站公开访问，预设计划和前端代码不能当作秘密；不能提交凭据、个人笔记或身份信息。

## 开发与发布
- `AGENTS.md`：AI工程师快速规则；`docs/WORKFLOW.md`：完整协作与发布流程。
- 代码合并 `main` 后通过现有 GitHub→Cloudflare Workers 集成部署；任何一次提交是否真实上线须单独核实。
- `wrangler.jsonc` 保持 `workers_dev=true`、`preview_urls=false`。`.assetsignore` 排除文档、脚本和工作流，禁止公开发布内部开发材料。
- `.github/workflows/validate.yml`：提交和PR自动执行校验；`configure-access.yml`：旧Access实验流程，**已归档停用**，不得触发，也不要求用户绑卡。

## 基本检查（Node 22）
```sh
node --check planner-core.js
node --check app.js
node --check plan-data.js
node --check sw.js
node scripts/check.mjs
node --test scripts/test.mjs scripts/sw-test.mjs scripts/access-test.mjs
```

Node模拟检查不等于真实Edge安卓PWA验收。每次更新版本需同步测试中的特定版本号、任务数量等断言，而不是简单删除保护性检查。

## 长期文档导航
- [docs/index.md](docs/index.md)：唯一入口、阅读顺序和来源优先级。
- [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)：最新确认状态与待验收。
- [docs/DECISIONS.md](docs/DECISIONS.md)：用户长期决定、旧方案与新方案的取代关系。
- [docs/WORKFLOW.md](docs/WORKFLOW.md)：ChatGPT、Codex、Work、GitHub、Cloudflare分工与操作步骤。
- [docs/GPT_HANDOFF.md](docs/GPT_HANDOFF.md)：GPT项目指令与新聊天提示词。
- [docs/OPERATIONS.md](docs/OPERATIONS.md)：手机打卡、更新和备份。
- [docs/STUDY_BASELINE_2026-10-15.md](docs/STUDY_BASELINE_2026-10-15.md)：历史真实学习基线，需结合当前用户反馈。
- [docs/VALIDATION.md](docs/VALIDATION.md)：历史测试日志（旧Access部署要求已过时）。

## M2.4（界面、动效与交互优化；计划数据仍是M2.3）
不改变`plan.json`、`plan-data.js`、任务ID或localStorage键。优化考研学生使用场景：今日页按当前/过去/未来日期说明、下一项建议、完成进度与预计剩余分钟数；底部矢量导航、克制的页面/弹窗/勾选动效；支持系统减少动态效果设置；详情优先显示训练方法，再填写错题和一句话复盘，重命名/调分钟/改期收在可展开区域，可“一步保存并打卡”。日历的待练/完成/休息状态和读屏标签更加明确；进度页强调时长为计划估计而非真实计时；设置页给出简短上手流程。SW缓存版本升级到M2.4以更新静态资源，不修改Cloudflare收费和访问方式。
