## 2026-10-16 最新部署接力
PR #11 的华为云后端、IP HTTPS 与证书续期 dry-run 已通过；旧 NJFU 部署已按用户授权退役。当前云执行器仍不能直接 SSH，已验证的服务器连接方式是使用仓库 Actions Secret `BANYA_ECS_SSH_PASSWORD` 经 GitHub Actions 固定主机公钥登录。**请先读 `docs/ECS_HANDOFF.md` 和 `docs/PROJECT_STATUS.md` 顶部**；以下早期“未连接/未部署”的文字是历史记录。M2.9 前端仍未在原 Cloudflare Worker 上线，手机同步仍未验收。

## 2026-10-16 补充：技术维护专用聊天与M2.9部署接力
本聊天职责仅为程序、云服务器、PWA、双科独立记录/备份/数据安全，不负责编写英语/政治计划。2026-10-16 已在现有 PR [#11](https://github.com/kopdabanya-commits/English-II-Plan/pull/11) 分支中补全初版本地优先前端同步、严格后端科目校验、每日私有SQLite备份、静态资源隔离及测试；仍是Draft，main尚未包含，华为云/ECS/Cloudflare/荣耀Edge**均未完成本轮上线验收**。
本轮工具只有已授权GitHub连接，无法直接打开华为云CloudShell/SSH操控服务器；禁止用后端单测代替实际部署。原Workers网址和PWA安装身份不变，旧三种学习记录键不变。下一技术会话先查最新main/PR #11/head CI；注意同步默认关闭，首次每科手动确认，CSP仍限制 `connect-src 'self'`，待可信TLS API域名确定后再精确加入，绝不可把整个 `server/` 上传到静态Worker。

# 板牙考研｜ChatGPT、Codex、Work共用的最新交接

本文件可给同一“考研plan”ChatGPT项目中的新对话、Codex和Work阅读。**GitHub更新文档不会自动修改ChatGPT项目自定义指令，也不意味着不同聊天能看到另一聊天实时运行情况；必须主动读取最新main。**

## 一段可直接复制给新对话的交接
请接手我的 **「板牙考研」** 项目：我只有**一个PWA、一个GitHub仓库和Cloudflare Worker**，App内有英语二与政治两个独立科目模块，不是两个软件。代码库仍用历史名称 `kopdabanya-commits/English-II-Plan`，网址仍为 `https://english-ii-plan.kopdabanya.workers.dev`，不要另建仓库、重建Workers、改域名或存储键。用户零编程基础，尽量你直接完成授权范围内的GitHub操作、测试、PR和交付。

启动时务必读取main的 `AGENTS.md`、`docs/index.md`、`docs/PROJECT_STATUS.md`、`docs/DECISIONS.md`、`docs/SINGLE_APP_CONTRACT.md`、`docs/ACTIVE_WORK.md`、`docs/WORKFLOW.md`。检查最新main SHA/活动分支/开放PR，避免与另一开发对话修改同一个 `app.js`、`sw.js` 或计划文件。一个App内切换英语/政治，任务/打卡/笔记/备份互不覆盖，只有导航和外观共享。

英语二计划当前 M2.6（65天141项）：每天至少一篇阅读/一套英语二新题型/一套完形中的一项，保留作文翻译，单词自行安排、不列每日任务，2024—2026真题留作模拟。政治计划当前 v1（64天192项）：上海60—65目标，徐涛2027强化课、苍盾肖1000题，曾报道马原93/396；苍盾并不能与本App自动同步，后续真实完成情况须用户主动反馈。两个科目都有独立本机记录和备份。

修改英语计划时同步 `plan.json` 与 `plan-data.js`，修改政治同步 `politics-plan.json` 与 `politics-plan-data.js`，更新各自版本、保持任务ID和原记录。政治的在线差异预览目前不等同于英语，别假装双科同步完成。共享UI改动需同时跑两科测试和 `scripts/integration-contract-test.mjs`。用户用番茄Todo计时，不写新计时器。工作必须标明已提交、CI通过、Cloudflare部署验证、荣耀Android16 Edge手机验收四个不同阶段；没有证据不要冒称上线。

## 对 Codex 的工作要求
- 负责主要编码、回归测试与必要PR；不能跳过 `docs/SINGLE_APP_CONTRACT.md`和 `docs/ACTIVE_WORK.md`。
- 英语、政治各可单独在相同GitHub仓库的不同分支开发，但`app.js`、`sw.js`、`index.html`等共享文件采用一个集成PR合并。PR失败修根因并重跑，不绕过CI。
- 先读 `main`最新状态和近期其他PR，不能在过期分支强推共享文件，尤其不能把已经接入的政治重新变成“待建档”。
- 提交时更新状态/决策/交接文档和实际验证结果，保留老 `yantu_`内部分隔键以兼容旧备份。

## 对 ChatGPT Work / 云端浏览器的工作要求
- 仅在当前已授权可用的Cloudflare/浏览器环境中执行真实部署和测试。无法登录时停止重复失败操作，继续能授权的GitHub工作，不向用户要求为Access绑卡。
- 发布后实测同一PWA的英语、政治两个入口；若无法连接用户真实设备，明确标注未验收、给出最短用户手机检查步骤。
- 不要声称普通ChatGPT聊天能向另一工作会话实时发命令；跨会话靠GitHub当前main/PR/Docs。

## 用户学习近况如何交接
- 英语二：用户在App「英语二→设置→复制学习近况」主动发给ChatGPT，再根据实际打卡与错题更新未来安排。勿将参考基线当当前成绩。
- 政治：用户描述徐涛课听到哪里、苍盾每章已做/错题数/错因以及当天可用时间，必要时在政治设置导出JSON；**不索要微信/苍盾账号密码，不暗示可以自动查询**。
- 若用户希望双科总览，可以做只读今日聚合；不修改任何一科已保存的真实完成状态，不自动互相改计划或加倍补课。

## 两个必须遵守的现实限制
1. 私有仓库不等于私有网站。公开 Workers URL 只应包含公开静态计划与脚本，不含个人账号、真实笔记或凭据。
2. GitHub PR检查成功、Cloudflare Workers在线、手机当前安装的PWA已更新不是同一回事。所有完成度必须用各自证据证明。
