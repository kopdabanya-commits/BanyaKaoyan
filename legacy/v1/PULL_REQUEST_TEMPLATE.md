## 本次改动属于哪一部分？
- [ ] 英语二计划/题型模块
- [ ] 政治计划/苍盾记录模块
- [ ] 板牙考研共享界面/离线缓存/统一入口
- [ ] 文档/测试/CI

## 开始前同步检查
- [ ] 已读最新main的 `AGENTS.md`、`docs/SINGLE_APP_CONTRACT.md`、`docs/ACTIVE_WORK.md`、`docs/PROJECT_STATUS.md`
- [ ] 已查最新main SHA及其他开放PR，确认没有未协调的共享文件编辑
- [ ] 只有一个App、一个 Worker；未新增政治App/站点/重复入口
- [ ] 若改共享 `app.js`/index/styles/sw，已同时确认英语和政治两门科目正常

## 计划与数据安全
- [ ] 本PR不改变任何科目的计划；或对应科目JSON及离线JS完全同步、各自revision/版本正确
- [ ] 本科旧任务ID、真实完成记录、错题与笔记仍可用；另一科计划和记录完全没有受到修改
- [ ] 未重命名/删除旧的 `yantu_english_2026_m1`、`yantu_english_plan_v2`、`yantu_politics_2026_v1`、备份内部app标识
- [ ] 未改变现有PWA manifest id、Worker `english-ii-plan`、网址，未清浏览器数据
- [ ] 无凭空创建的做题成绩/苍盾登录或自动同步/番茄Todo计时读取；无敏感信息写入静态文件

## 质量门槛
- [ ] 已完成JS语法检查、`node scripts/check.mjs`及完整CI运行的跨学科测试
- [ ] 共享静态文件有变化时已更新SW缓存，新增资源包含在ASSETS中；没有强制skipWaiting
- [ ] `Validate planner` 对此 PR 当前head提交显示**success**；红色测试未绕过
- [ ] 更新了 `docs/PROJECT_STATUS.md` 和相关决策/活动工作登记，注明不能确认的事项

## 四级交付证据
- GitHub PR/commit：
- 自动化Actions链接和结论：
- Cloudflare Workers生产构建和版本验证（没有就写**未验证**）：
- Android Edge真机单App双科记录与备份检查（没有就写**未验证**）：

> 不得为了UI换名字把板牙考研拆成两个App，也不得因另一个聊天同时开发而覆盖已合并的英语/政治模块。
