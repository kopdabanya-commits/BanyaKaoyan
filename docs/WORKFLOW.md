# 研途英语二｜跨ChatGPT、Codex、Work和GitHub的操作工作流

## 为什么需要它
用户考研备考很忙，零编程基础。最重要的交付不是聊天写出一堆步骤，而是**AI直接在已获授权的GitHub中安全修改、测试、记录，并让用户只做必要的手机确认**。不同聊天可能无法共享实时电脑与未保存的上下文；全部关键决策必须落地GitHub。

## 职责分工
| 角色 | 主要职责 | 不应默认做什么 |
|---|---|---|
| 用户 | 告知真实学习情况、目标、体验；决定有风险或需要本人授权的操作；用手机验收 | 逐文件改代码、登录多次、绑卡、复杂终端操作 |
| ChatGPT（当前聊天及新聊天） | 核实学习基线；制定、调整英语二计划；协调GitHub读写；记录决策；复核测试证据；提供最短使用说明 | 伪造App学习记录或真机测试，宣称能遥控另一个聊天中的Work |
| Codex | 读取AGENTS.md和最新文档；直接编码、编写测试、修复、提交PR；按验收单交付 | 未读状态就推翻架构，重建Cloudflare Worker，写入密码 |
| ChatGPT Work | 若该模式能实际使用已授权GitHub或浏览器，执行多步操作、下载、部署与页面测试，并回写仓库状态 | 假定Chrome/Cloudflare已登录；登录403后无限重试；声称普通聊天能直接指挥Work |
| GitHub | 代码、计划、Docs、PR、Actions的长期“事实底座” | 存储本机个人错题/学习笔记、Token |
| Cloudflare Workers | 使用已有项目部署HTTPS静态PWA | 付费数据库、自动从ChatGPT获取本地数据或邮件提醒 |

## 新会话的标准开场
1. 用户一句“按GitHub当前项目继续”；若 GitHub 插件/连接器已授权，AI直接打开仓库。
2. 顺序读取根目录 `AGENTS.md` → `docs/index.md` → `docs/PROJECT_STATUS.md` → `docs/DECISIONS.md` → `docs/STUDY_BASELINE_2026-10-15.md` → 本次涉及文件。
3. 检查 `main` 最新提交、现有PR、是否有别人并行编辑。不要依赖旧聊天给的固定SHA判断当前代码。
4. 先向用户报告1—2句明确状态，接着直接执行允许的安全操作；缺少必要用户授权才问一个具体问题。

## 一次计划调整从头到尾
1. 获取最新真实完成情况：当前消息 ＞ 用户主动贴出的“复制学习近况”或导出文件 ＞ 已记录历史基线。不能自动读取用户手机 localStorage。
2. 查看 `plan.json` 中旧安排与具体ID；锁定本次调整影响的日期。不能无故重排完整65天、消耗2024—2026预留新卷。
3. 尽量以 **专项60—80分钟/天** 安排写作、新题型、翻译、完形和少量阅读。单词自行安排、**不在App每日打卡显示**。历史已完成任务不要补债。
4. 同时改 `plan.json` 和 `plan-data.js`；两者数据逐字段一致。`meta.revision` 每次+1、`meta.planVersion` 必须改变、`changeSummary` 说明差异。原任务改期保留ID；真正新增任务用新ID；防止重复安排同一年题型。
5. `planner-core.js` 与 `app.js` 控制计划读取、合并、笔记等；如果变更前端静态资源，同步更新 `sw.js` 的CACHE名称，避免旧资源与新资源混用。
6. 运行 `node --check app.js`、`node --check planner-core.js`、`node --check plan-data.js`、`node --check sw.js`、`node scripts/check.mjs`、`node --test scripts/test.mjs scripts/sw-test.mjs scripts/access-test.mjs`。注意 `scripts/check.mjs` 与 `scripts/test.mjs` 有特定版本/任务数量断言，**未来计划变更时必须同步维护测试，不可为过测删除必要约束**。
7. 使用分支/PR，等 `Validate planner` 检查通过，再合并 `main`；主分支触发原Cloudflare Worker构建流程。验证线上版本；**不要把推送成功当成网页更新成功**。
8. 用户在Edge PWA：`设置 → 检查计划更新 → 查看变化 → 保留记录并应用`。已经打卡、错题、笔记、个人改期不能被新版抹除；更新前提醒先导出备份。
9. 更新 `docs/PROJECT_STATUS.md` 的版本、证据、待验收项；新决定写 `docs/DECISIONS.md`。用户只需验收关键体验，不应反复提交截图。

## 一次代码修复
- 建立可复现行为 → 定位代码 → 最小改动 → 补回归测试 → PR → 检查 → 合并 → 真机验收。
- 不随意修改localStorage键 `yantu_english_2026_m1`；迁移兼容 `planner-core.js` 和v1/v2备份。
- Service Worker只缓存完整且内容类型正确的App静态资源，不缓存 `plan.json` 更新请求、登陆跳转或开发文件；不要用 `skipWaiting` 强行打断当前学习。
- `.assetsignore` 排除 `docs/`、`scripts/`、`.github/` 等开发资源；新增开发目录需要同步保护。
- 严禁将个人学习数据、token、邮箱、Cloudflare账户凭据写入网页资源或提交公开日志。

## CI / CD当前机制
- `.github/workflows/validate.yml` 在push和PR运行静态检查/Node模拟测试。
- Cloudflare同名Worker的GitHub构建集成此前有成功记录，但**本文件并不证明任一特定提交已上线**，必须核实。
- 当前 `wrangler.jsonc` 要保持 `workers_dev=true`、`preview_urls=false`。网页公开可访问，不要误认为GitHub Private提供了站点登录限制。
- 历史 `.github/workflows/configure-access.yml` 是Access尝试，用户已拒绝绑卡。**不得触发**；详见决策记录。

## 不同工具没有权限时
先确认已有连接器能否读GitHub。不能写仓库时，产出带路径、内容和测试要求的明确提交材料，要求有权限的Codex/Work执行；不能假称已提交。用户可在ChatGPT项目中保留简短指令指向 `docs/index.md`，但**ChatGPT 项目和GitHub的指令并非自动双向同步**。新聊天需实际读取最新文件。

## 完成定义
- “代码已写”：GitHub有提交/PR。
- “测试通过”：有本次提交相符的检查结果。
- “部署成功”：有本次提交对应的Cloudflare构建或线上访问验证。
- “手机验收通过”：用户真机按步骤确认。
四者不可以互相代替。
