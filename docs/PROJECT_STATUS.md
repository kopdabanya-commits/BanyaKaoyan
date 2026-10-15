# 板牙考研｜当前事实与待验收状态

更新：2026-10-15。**最新事实写在本页顶部；历史PR、旧聊天中的“研途/英语单科/政治待建档”不是当前产品状态。** 此文件不自动监控GitHub或手机，必须在每次合并后用真实检查更新。

## 1. 当前唯一项目身份
- 正式产品名称：**板牙考研**。**一个PWA、一个GitHub仓库、一个Cloudflare Worker、一个网页入口**，内部有英语二和政治两门独立科目。用户明确不希望分开成两个App。
- GitHub（仓库历史名保留）：`https://github.com/kopdabanya-commits/English-II-Plan`；Private，默认分支main。
- Cloudflare Worker（历史技术名暂不更改）：`english-ii-plan`，Workers Static Assets；网址 `https://english-ii-plan.kopdabanya.workers.dev`。改变地址会导致手机现有本地数据无法自动跨源访问，禁止为改名另建站点。
- 安卓：HONOR PTP-AN10、Android16，微软Edge PWA安装路径。公开站点未配置Access，GitHub仓库私有不代表网页私有。
- 本次品牌改造：分支 `feat/banya-kaoyan-brand-workflow-m28` 负责网页标题、manifest名称、单App切换持久化、设置过时文案、工作流防并发与跨科回归。实际是否合并/测试通过需要检查PR和main；**此段在CI/合并完成前不是发布完成证明**。

## 2. 英语二计划及功能：代码已确认
- 英语权威计划：`plan.json`，版本`2026.10.15-m2.6`、revision6，65天（10/15—12/18），141项专项，2026-12-19按用户安排考试。
- 用户最新要求：每天阅读一篇/英语二新题型一组/完形一套至少一项，不能整天只有作文/翻译；通常专项85—90分钟、最多90分钟，单词单独学习不列每日任务；2024—2026新卷留作后期分段模考。政治时间不混入英语的130分钟建议总预算。
- 英语主要题型、复盘、错题、打卡、导出导入、人工计划差异预览均存在代码中。任何“已完成”只以手机实际打卡/用户反馈为准。
- M2.6通过 [PR #6](https://github.com/kopdabanya-commits/English-II-Plan/pull/6) 合并main，相关Actions已成功；不等于这台Edge手机已经应用新版。

## 3. 政治计划及功能：M2.7代码已确认
- [PR #7](https://github.com/kopdabanya-commits/English-II-Plan/pull/7) 已合并main，合并提交 `dfcdd17254ab759922ba03a91d1fcfccd6fe671b`；PR head `c5b2e406533209510f069ffb9aeada2aaa9a4fed` 对应 `Validate planner` Actions run `38756024582` 状态success。这是自动测试证据，不是生产验证。
- 政治权威计划 `politics-plan.json`，镜像 `politics-plan-data.js`，版本 `politics.2026-10-15-v1` / revision1；10/16—12/18共64天、192项（课程/刷题/复盘等）。
- 用户截至上次报告：上海地区，政治目标60—65，徐涛2027强化课第6集“对立统一规律”，苍盾考研小程序肖1000题马原93/396（仅马原题库进度，不是全科完成率），未购买纸质资料。预定肖八肖四仅在实际出版/取得后使用，不能自动认作已学。
- `politics-core.js`/`politics-ui.js`已实现政治的今日、日历、进度、设置、打卡/撤销、错题和笔记、苍盾马原做题数手动录入、政治独立导出/导入；政治内部记录键 `yantu_politics_2026_v1`。苍盾与本App**没有自动同步**，不读外部账号。
- 政治的`politics-plan.json`目前**没有像英语一样完整的联机版本差异预览和用户确认迁移操作**。未来单独变更政治计划前先完善/核实安全兼容机制，不能把英语按钮当政治按钮。
- 两科均从一个 `index.html`、`manifest.webmanifest`、`app.js`科目切换、同一 `sw.js`离线资源加载。旧App UI界面 M2.7，新的品牌/工作流升级版本 M2.8 待本次PR核实。

## 4. 兼容性/数据/部署事实
- 英语记录键 `yantu_english_2026_m1`、旧本机英语计划键 `yantu_english_plan_v2`；政治记录键 `yantu_politics_2026_v1`。旧备份结构 `app:yantu-english-ii`、`app:yantu-politics` 必须继续可导入，新品牌仅影响界面和新下载文件名。
- 新增UI偏好 `banya_active_subject_v1` 可记住英语/政治选中科目，不能把两科用户记录合成一份互相覆盖的localStorage。
- GitHub最近一次已确认政治CI通过不代表 Cloudflare上线；**M2.7/M2.8 Workers生产部署与荣耀Edge真机离线、分别打卡、重开持久化、备份恢复、动态效果等均尚无本次可引用的验证证据**。不要称为上线/真机已完成。
- 网站当前公开、仅有本机记录不自动云同步；没有Push提醒或番茄Todo时长读取，用户明确不需要应用内计时器。

## 5. 已识别的工程隐患和修正方向
1. M2.7主分支 `app.js` 设置文字仍称政治“下一阶段待建档”；当前政治已上线至代码，应在品牌升级中改成实际64天任务和手动苍盾进度。
2. 旧 `docs/DECISIONS.md` 两条不同决定都叫D12，并有政治“英语专项60—80分钟不变”的过时表述；整理成独立编号，强调英语最新M2.6规则优先。
3. 改名时如果改worker地址/manifest id/`yantu_...`存储键，手机学习记录可能看似消失。故只更新 UI显示、安装名称、备份下载文件名和文档，**保持旧内部标识稳定**。
4. 多个聊天同时改同一仓库的共享 `app.js`/`sw.js` 可能产生覆盖或旧PR覆盖新功能。新增 `docs/ACTIVE_WORK.md`、`docs/SINGLE_APP_CONTRACT.md` 和跨科自动门禁，要求先查最新main/开放PR再动手。
5. 政治日程更新机制、公共首页概览、PWA在荣耀Edge的实际安装标签是否自动变更仍属于**后续待验收与改进项**，不可未经确认宣称已完成。

## 6. 下一个执行者要做什么
先读 `AGENTS.md` → `docs/index.md` → `docs/DECISIONS.md` → `docs/SINGLE_APP_CONTRACT.md` → `docs/ACTIVE_WORK.md`。核实目前打开的PR及main最新提交。M2.8界面测试通过、合并后单独核实Cloudflare Worker版本，再请用户手机确认：板牙考研同一App能切换两科、独立记录仍保留；无特殊原因不卸载、不清网站数据、不更换网址。详细手册见 `docs/OPERATIONS.md`。
