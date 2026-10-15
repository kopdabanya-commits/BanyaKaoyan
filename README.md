# 研途英语二 · M2.2

私人考研英语二 PWA，沿用 `english-ii-plan` Cloudflare Worker Static Assets；不是 Pages。GitHub 仓库必须保持 Private。计划截止日 2026-12-18，考试日按用户指定为 2026-12-19。

## 学习安排

2026-10-15 至 12-18 共65天，98项主任务，另有每天单词。默认每天95—100分钟；单词30—40分钟时总计90—105分钟。保留原有任务ID，短日加入作文表达回忆。2024—2026卷仅在预定窗口分四天计时作答，不安排超120分钟的单日模考。

## 数据与更新

`plan.json` 是权威计划，`plan-data.js` 是完全一致的离线初始快照；`planner-core.js` 提供共用校验、任务组装和历史迁移。记录只保存在当前来源的 localStorage，不上传服务器。原版 `yantu_english_2026_m1` 存储键保留。

检查计划更新只获取同源受 Access 保护的 `plan.json`，不直接读取 GitHub Private API，不在前端放令牌。新版先展示版本、数量和变化，再由用户应用；计划持久化后重启可继续使用。历史、已完成、错题、笔记、个人修改和改期保留，移出的未来未完成任务退出待办并在进度页保留。个人安排造成未来剩余任务超出预算时，拒绝应用并提示调整。

备份v2包含记录与计划；兼容原版v1备份。恢复前严格校验并保留本机恢复前副本，可在设置导出。清除浏览器数据、改变域名或设备不会自动迁移记录。损坏记录不会被静默重置覆盖；写入失败回滚当前操作。

## 部署与保护

沿用控制台现有 GitHub main 触发器及静态资源根目录。`.assetsignore` 排除文档、脚本与测试，`_headers` 设置内容类型保护、CSP、禁止嵌入、禁止索引及更新资源的缓存策略。不要删建项目，不要为运行PWA绕过 Access，不要提交记录或账户令牌。

发布域名前，先在 Worker Access 中为该 Worker 的 All traffic 配置仅当前账户邮箱允许访问。必须验证生产及预览均被保护；如未配置好则保持 workers.dev Disabled。Zero Trust 开通若要求本人接受条款、输入付款信息或付费，则停在该步骤交给用户。

Service Worker 只缓存完整且类型正确的App静态资源，不缓存计划检查、Access接口或登录跳转。新版等旧标签页全部关闭后激活，防止混用版本。设置中的重新验证访问链接绕过离线缓存并到达 Access。离线副本是已登录设备的本机副本，网络访问限制仍由 Access 执行；Access不能远程收回已下载的离线内容。

## 检查

```
node --check app.js
node --check planner-core.js
node --check sw.js
node scripts/check.mjs
node --test scripts/test.mjs scripts/sw-test.mjs
```

测试为 Node VM 集成与逻辑模拟，不代替真实浏览器布局、Cloudflare登录或Android安装验收。实际执行范围和待办见 `docs/VALIDATION.md`，后续开发从 `AGENTS.md` 开始。

用户已在2026-10-15明确选择无须绑卡的免费方案，并自行启用 workers.dev、确认本人能打开。`wrangler.jsonc` 现设置 workers_dev=true，避免以后推送覆盖后台设置而关闭网址；preview_urls=false 保持不变。GitHub仓库 Private，但网页本身公开访问；打卡、错题与笔记仅存在本机，不会自动上传。

## M2.2 学习内容与手机体验优化
为53项缺少操作步骤的任务补充限时做题、错题定位、作文修改与翻译润色指引；保持65天、98项任务原有日期、ID和分钟数。首页展示未完成任务剩余预计用时；错题填写提示按题型区分；计划变化超过6项时可折叠浏览；设置页增加Edge/荣耀桌面安装提醒并删除旧Access叙述。
