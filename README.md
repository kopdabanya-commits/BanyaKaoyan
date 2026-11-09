# 板牙考研 · 学习档案

这是无服务器的轻量学习进度网页，仅记录已完成的英语二和政治内容，不再提供每日计划、AI 自动规划或旧后端服务。

- `index.html`：完整手机端网页，可离线查看、补录、修改及备份。
- `data/progress.json`：发布到网页的学习数据；以后通过 GitHub 更新这里，手机联网访问时会自动检查并合并更新。
- `sw.js`、`manifest.webmanifest`、`assets/icon.svg`：离线缓存和手机桌面入口。
- `.github/workflows/pages.yml`：只发布静态文件到 GitHub Pages。

旧版完整历史保留在分支 `archive/old-v2-2026-11-09`；无需旧服务器、数据库、SSH 凭据及旧 workflow。

## 使用

网站（启用 Pages 后）：https://kopdabanya-commits.github.io/BanyaKaoyan/

手机可以直接补录；本机记录存于 localStorage，切勿清理前忘记在“数据”页面导出 JSON。GitHub 上发布的新学习记录会合并到手机：**若同一条记录在手机上被修改过，会优先保留手机修改**，不会自动将本机数据上传到 GitHub。换手机时请先导出 JSON，再导入。

注意：本仓库为 **public**，`data/progress.json` 及其中的备注对所有人可见。不要上传私人信息、密码、学校账号或未经公开的个人资料。
