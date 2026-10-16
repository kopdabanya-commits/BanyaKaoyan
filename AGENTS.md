# 板牙考研：公开仓库工程约定

这是一个 PWA、一个 GitHub 仓库、一个 Cloudflare Worker，包含英语二与政治两个独立科目。修改前读取 `docs/index.md`、`docs/PROJECT_STATUS.md`、`docs/SINGLE_APP_CONTRACT.md`、`docs/WORKFLOW.md`，并核对最新 main 和开放 PR。

## 隐私优先
仓库已公开。不要提交真实学习进度、做题成绩、错题、笔记、备份、设备识别信息、密码、令牌、私钥或完整服务器日志。个人数据只保存在用户设备和经授权的服务器私有数据库；不能从公开计划推断用户实际完成情况。若需要个人反馈，向用户询问，不能从 Git 历史中复制已删除的私人记录。

保持原有 `yantu_` 本地存储键、备份格式、PWA manifest ID、Worker 地址；保护两科数据隔离。不要自行更改复习计划内容。修改共享 UI 或存储代码时跑双科及跨科测试，更新 Service Worker 缓存版本，并区分代码、CI、线上发布与手机验收。合并前检查 PR、CI 和生产部署证据。
