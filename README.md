# 板牙考研

板牙考研是一个可安装、可离线使用的学习 PWA。**手机日常只用[板牙考研](https://124.70.128.201/)这一个地址。**英语二和政治共用同一套界面、导航和更新机制，各自保存计划、打卡、错题、笔记、进度与备份。历史 Cloudflare Worker 地址仍作为旧设备数据恢复通道；云同步后端和日常网页在华为云服务器上，项目没有另建仓库或 Worker。

仓库名称为 `BanyaKaoyan`，旧仓库地址 `English-II-Plan` 会跳转到这里。公开仓库只存放程序、公开计划和技术说明。**任何人都可以查看公开仓库及其 Git 历史**；实际学习记录、导出的备份、账号和密钥不得提交。网站也公开提供计划内容；用户已选择暂不修改计划文件中现有的个人描述。

## 功能

- 英语二与政治在同一个 PWA 中切换，记录和备份彼此隔离。
- 本地优先：离线时继续学习；恢复网络后可在用户启用的前提下同步。
- 分科目导出、导入与恢复；同步冲突时保护本地记录，不静默覆盖。
- 统一的任务、日历、进度和设置页面。
- 在任务里可单独记下错题题号、实际用时和复盘；日历能直接看到所选日的任务。
- 每项任务可单独保存为“完成”或“不做”；“不做”不会被算作完成，也能恢复为待做。

打开“今日”即可打卡；点任务可补充做题记录。切到“日历”查看当天安排，或在“设置”分别导出英语二、政治备份。英语二和政治的“复制近况”只读取本机已保存的信息，复制后由你决定是否粘贴给对话。网页中的云同步需要先在设置里完成安全连接和首次确认；仅打开网站不会自动上传私人记录。

若需要换到华为云入口，先在原 Worker 入口开 VPN，进入“设置”，点“复制到华为云入口”。新页面会在同一浏览器内接收已有的双科本机记录与同步设置；原入口数据不会删除，新入口若已有记录会停止自动覆盖。请核对两科记录后再决定是否把新入口添加到桌面。两个网址属于不同浏览器 origin，因此 Android 会把它们当成不同安装入口；不能无损地自动改掉旧桌面图标。

仓库中的计划是**任务安排**，不能证明用户实际完成了任何任务。当前代码、生产发布和手机实测状态分别见[项目状态](docs/PROJECT_STATUS.md)与[待办清单](docs/BACKLOG.md)。

## 开发与发布

日常可以直接在板牙考研 GPT 项目里用中文说计划需求。额度不足时，可用仅获本仓库 PR 权限的 API agent；授权范围、可复制提示词和发布边界见[备用 agent 工作流](docs/AI_AGENT_WORKFLOW.md)。GPT 对话目前不能直接读取服务器私人学习快照。

从最新 `main` 开始，先读 [AGENTS.md](AGENTS.md) 与[简短工作流](docs/WORKFLOW.md)。英语计划以 `plan.json` 为准，政治计划以 `politics-plan.json` 为准；离线镜像可用 `node scripts/sync-plan-mirrors.mjs --write english` 或 `--write politics` 自动生成。修改后运行：

```bash
node scripts/sync-plan-mirrors.mjs --check
node scripts/privacy-check.mjs
node scripts/check.mjs
node --test scripts/test.mjs scripts/sw-test.mjs scripts/access-test.mjs scripts/intelligence-test.mjs scripts/daily-feel-test.mjs scripts/politics-test.mjs scripts/integration-contract-test.mjs scripts/cloud-sync-test.mjs scripts/origin-transfer-test.mjs
```

PR 经 CI 检查后合并；原 Worker 的发布工作流从 `main` 发布，再分别验证线上版本与用户手机上的更新。`.assetsignore` 只允许 PWA 静态文件上传，服务器代码、文档、Actions 和私人文件不得进入网站资源。

## 隐私边界

公开仓库无法设置成“别人基本看不到”；只有改为**私有仓库**才能限制 GitHub 访问。当前选择保留公开，以满足既有 Actions 使用方式。我们已清理当前技术文档中的具体个人学习近况，并在 CI 阻止常见凭据和备份文件误提交；历史提交、旧分支及未修改的公开计划仍可能包含此前的信息。不要把个人进度、做题成绩、笔记或备份发到公开 Issue、PR 或 Actions 日志。

普通 GPT 对话目前不能自行登录私人云同步 API。要让对话直接读取服务器记录，需要另行建立只读、可撤销的授权连接；不要把同步密钥粘贴到聊天里。当前可用的方式是由用户在设置页复制近况后自行粘贴。
