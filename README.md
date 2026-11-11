# 板牙考研 · 英语二真题完成记录

在线地址：https://kopdabanya-commits.github.io/BanyaKaoyan/

这是一个只记录「哪些年份、哪些题型已做 / 尚未确认完成」的极简手机网页。

- 首页：2010—2025 年度 × 题型紧凑矩阵；阅读一刷和二刷各用四个小格标识 Text 1—4，其余五项显示完成或未记录。
- 点年份：查看每一篇阅读和完形、新题型、翻译、大小作文；点击未记录的方格可一键标记完成并撤销，点击已完成的方格可编辑或删除。
- 备份：支持 JSON 导入 / 导出、独立 HTML 离线网页导出。
- 不提供每日计划、倒计时、政治模块、AI 规划或账户登录。

数据：内置此前确认的 **92 条英语完成记录**，存于 `data/progress.json`。灰色格表示「没有确认为已完成」，不能据此断言用户肯定没做。

技术：纯静态网页 + service worker，手机优先 CSS，无前端框架和第三方依赖。GitHub Pages 通过 `.github/workflows/pages.yml` 自动发布。

本机补录保存在浏览器 localStorage，跟旧版沿用相同键 `banya-offline-learning-archive-v2`，不会自动反向上传到 GitHub。网页联网时会尝试无损合入仓库新发布的数据。请在换机或清理缓存前下载 JSON 备份。

旧版已保留在 `archive/old-v2-2026-11-09` 分支。仓库和 `data/progress.json` 为公开内容，请勿在公开档案中放密码或私人信息。
