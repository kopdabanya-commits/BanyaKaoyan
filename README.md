# 板牙考研 · 英语二学习档案

这是一个无服务器、无需登录的英语二真题完成记录网页。只看已经做过的内容，不再安排每日任务；已移除政治科目、旧 AI 规划以及旧服务端。

- `index.html`：手机版学习记录、逐年图表、补录与编辑、导出 JSON / HTML
- `data/progress.json`：网站发布的英语二记录（当前 92 条，不含政治）
- `sw.js`、`manifest.webmanifest`、`assets/icon.svg`：离线缓存和手机桌面入口
- `.github/workflows/pages.yml`：通过 GitHub Pages 自动发布

在线地址：https://kopdabanya-commits.github.io/BanyaKaoyan/

手机浏览器的本地补录仍只保存在当前设备；联网时可获取 GitHub 上已经发布的记录，但本机修改不会自动反向同步。换手机或清理浏览器数据前，请导出 JSON 备份。

旧版完整代码保存于 `archive/old-v2-2026-11-09` 分支，不再使用原 VPS、FastAPI、数据库或旧发布脚本。

注意：本仓库是公开的，`data/progress.json` 也公开。不要将私人信息、密码或账号提交到此数据文件。
