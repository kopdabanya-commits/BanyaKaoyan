# AGENTS.md — 研途英语二 PWA

用户是零编程基础的2027考研考生；ChatGPT负责需求、计划调整和验收，Codex负责主要代码与测试，GitHub是持久化源。

- 目标考试日期2026-12-19；2026-10-15至12-18日计划65天。每天英语90–120分钟含背词30–40分钟。2024、2025、2026年真题预留弹性模考。
- 不把缺席任务自动累积成第二天双倍工作量。用户告诉我们学习近况时，保留真实进度，优先调整未来的计划。
- 仓库Private；网站默认可能公开，Cloudflare部署前必须明确私密访问方案。绝不提交本地打卡、错题笔记、身份信息。
- `plan.json`是可编辑权威计划；`plan-data.js`为初次离线兜底快照。修改计划须同步这两个文件，版本号必须变化，且保留同一任务的稳定ID。历史打卡不能被线上计划更新覆盖。
- localStorage用于本地记录，无服务端数据库、不支持自动多端同步。导出备份包含个人笔记，提醒用户妥善保管。
- 测试：Node语法与数据校验，安卓Chrome小屏、打卡、错题、改期、漏学、导入导出、在线更新、离线缓存、后退与刷新等实机验收。
- 未经真机及部署验证，不可声称已稳定可用；后台提醒、自动云同步尚未实现。
- 变更流程：更新数据/代码→静态校验→PR或提交→检查→发布→真实手机验证。


## M2.1 维护约束

- 本项目由用户指定托管于现有 Cloudflare Workers Static Assets，不得改为Pages或另建Sites项目。账户授权不等同于云端浏览器已登录，先看页面状态。
- 计划必须同时递增 `meta.revision` 和更改 `planVersion`，添加 `changeSummary`，同步完整快照。版本相同而内容不同会拒绝更新。不得复用旧ID表示全新任务。
- 保留旧存储键。共享校验在 `planner-core.js`，新增字段须兼容v1记录和备份。所有写入失败不得显示成功或覆盖最后的可保存记录。
- Service Worker每次静态资源变更必须改CACHE版本。不得skipWaiting强制替换正在使用的页面，不缓存plan检查或身份页。首次缓存必须完整校验后启用。
- 至少执行README所列语法、计划、Node集成和SW模拟测试。真实浏览器/Android测试未做应明确记录，不能用模拟通过替代真机通过。
- 原始任务改期和标题/分钟编辑须保留稳定ID；未完成未来任务被新版移出时不继续占待办预算，记录仍保留。已完成单词任务时长不随设置追溯变动。
- 文档、测试、新增工具脚本不得被发布到静态网站；新增开发目录同时更新.assetsignore。不得把GitHub token或Cloudflare token放进前端。
- 发布保护闸门：当前 `wrangler.jsonc` 将workers_dev和preview_urls设为false，防止自动部署意外开放。只有在该Worker的All traffic Access邮箱白名单验证后，才能把workers_dev改为true；预览无需求继续关闭。
- Cloudflare浏览器登录已出现403，停止重复尝试。替代流程见docs/ACCESS_AUTOMATION.md，手动触发configure-access.yml；令牌仅GitHub Actions Secret，禁止让用户贴到聊天。
- 自动配置通过API回读单邮箱政策及四入口无凭证Access重定向后，才提交workers_dev=true和.cloudflare/access-state.json。预览保持false。配置未完成不得宣称Access有效或Android验收通过。
