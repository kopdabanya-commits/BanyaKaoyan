# 板牙考研 · Banya Kaoyan

面向2027考研的免费、离线优先 **单一PWA**。英语二和政治是一个App内的两门独立科目：共用同一安装入口、主题和导航，但各有复习任务、做题记录、计划版本和数据备份。不内置计时器（用户使用番茄 Todo）。

> 新AI/Codex/Work应先阅读 [AGENTS.md](AGENTS.md) → [项目知识库](docs/index.md) → [当前状态](docs/PROJECT_STATUS.md) → [单App契约](docs/SINGLE_APP_CONTRACT.md) → [并行任务登记](docs/ACTIVE_WORK.md)。不要只凭旧聊天开发。

## 项目与部署
- **正式产品名：板牙考研**。旧产品名「研途」只属于历史版本。
- **唯一GitHub仓库：** [kopdabanya-commits/English-II-Plan](https://github.com/kopdabanya-commits/English-II-Plan)（Private）。仓库历史名故意保留以避免扰乱现有集成。
- **唯一Cloudflare Worker：** `english-ii-plan`（Workers Static Assets），部署网址 `https://english-ii-plan.kopdabanya.workers.dev`。产品改名不等于迁移网站；不要创建第二个站点/仓库或更改域名。
- 安卓设备：荣耀Android16，微软Edge安装PWA；网址目前公开，并不通过Cloudflare Access私有化，不绑银行卡、不启用收费服务。
- **版本区分：** App外观/缓存 M2.8（品牌/协作升级），英语计划版本 `2026.10.16-english-r9`（revision9），政治计划版本 `politics.2026-10-15-v1`（revision1）。App版本与科目计划版本不是一回事；实际合并/部署以 [PROJECT_STATUS](docs/PROJECT_STATUS.md) 为准。

## 科目与记录
| 科目 | 当前计划 | 核心特点 |
|---|---|---|
| 英语二 | 10/15—12/18，65天/143项（10/16重新起步，10/15未学） | 每天至少阅读1篇/新题型1组/完形1套；作文翻译照常；单词另计；2024—2026卷留后期模拟 |
| 政治 | 10/16—12/18，64天/192项 | 徐涛27强化课、苍盾考研肖1000题和错题、按实际取得情况使用肖八肖四；政治目标60—65分，上海地区 |

两个科目共用 `index.html` 和底部导航；英语由 `app.js` / `planner-core.js` 及 `plan.json` / `plan-data.js` 提供，政治由 `politics-ui.js` / `politics-core.js` 及 `politics-plan.json` / `politics-plan-data.js` 提供。

旧存储键 `yantu_english_2026_m1`、`yantu_english_plan_v2`、`yantu_politics_2026_v1` 及备份里的历史标识特意不随品牌迁移。页面的「板牙考研」名与旧内部键并不矛盾。用户打卡/错题/笔记仅保存在当前浏览器localStorage，仓库和AI都不能自动读取。政治与苍盾小程序没有登录或实时同步，题数须用户手动登记。

**更新提醒：** 英语可以在设置检查最新 `plan.json` 并预览、确认迁移；政治目前随应用资源更新加载 `politics-plan-data.js`，还未拥有同等的差异预览/人工确认。修改政治计划必须格外注意稳定ID及旧记录，且不要在UI里假称两个科目都已独立联机同步。

## 开发与部署
- [跨聊天开发流程](docs/WORKFLOW.md)、[单App数据隔离契约](docs/SINGLE_APP_CONTRACT.md)、[活动工作清单](docs/ACTIVE_WORK.md)、[长期决策](docs/DECISIONS.md)、[ChatGPT/Codex交接](docs/GPT_HANDOFF.md)。
- 英语/政治计划与镜像必须一一对应，代码/数据改动通过分支、PR、`Validate planner` 全部相关测试后合并；共享入口和SW只通过一个集成PR协调修改。
- CI调用 Node22 的静态检查、`node scripts/check.mjs`、`node --test ...`（含跨科隔离测试）；CI绿不等于Cloudflare生产部署成功，更不等于荣耀手机真机验证通过。
- 升级静态资源改 `sw.js` 缓存版本；Service Worker离线更新保守、不强更正在运行的App。不清除或重建用户Edge网站存储。
- Cloudflare公开静态文件由 `.assetsignore` 排除私有项目文档/脚本；不要把敏感账号或真实笔记加入 `plan.json`。
