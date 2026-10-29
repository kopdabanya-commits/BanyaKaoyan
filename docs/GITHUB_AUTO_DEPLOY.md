# GitHub 自动测试与前端部署（板牙考研 v2）

## 已接入

- PR / main 提交：GitHub Actions 自动运行 `scripts/check.sh` 和部署脚本语法检查。
- 前端自动发布：仅当 main 的 Actions 变量 `BANYA_AUTO_DEPLOY` 是字面值 `true` 才自动部署。
- 手机手动发布：仓库 → Actions →「板牙考研 · 自动检查与前端发布」→ Run workflow → Branch 选 main → 勾选 `deploy_now`。
- 生产发布调用 `deploy/github_static.py`，固定校验 `deploy/known_hosts` 里的 SSH 主机公钥；SSH 口令只读取 `BANYA_ECS_PASSWORD` Secret。
- 发布先创建静态版本目录、上传并核验文件大小，再原子切换 `current`；健康检查失败恢复上一个静态版本。
- 当前 **只发布静态前端**。不修改 `server/main.py`、服务、数据库、部署环境文件、DeepSeek Key、nginx，避免将现有复杂后端意外替换为仓库里的简化版本。

## 首次开通（一次性，可在手机 GitHub 网页完成）

1. 仓库 Settings → Secrets and variables → Actions → Secrets → New repository secret，名称：`BANYA_ECS_PASSWORD`，值：当前华为云 ECS 的 SSH 登录口令。**不要把口令发给 AI/写入仓库**。
   - 若优先选择 Environment secret，可在 Settings → Environments → production 设置同名 Secret；工作流使用 environment `production`。
   - 发布脚本当前使用 `root` 登录，与旧版 `deploy/deploy.py` 一致。后续建议迁移到权限受限的独立部署用户及 SSH 私钥。
2. 合并本 PR 后，进入 Actions 手动运行一次（`deploy_now=true`），核对日志与手机 PWA 更新。GitHub 没配置 Secret 时运行会明确失败，**不会改服务器**。
3. 只有首次手动验收成功，才在 Settings → Secrets and variables → Actions → Variables → New repository variable 添加 `BANYA_AUTO_DEPLOY=true`。此后每次 main 分支提交且离线测试通过，自动发布前端。删除该变量或改为 `false` 即停用自动发布。

## 范围与保护

- 后端更新**不会自动部署**。如果今后修改 `server/`，必须另做经过比对、备份、回滚和权限校验的后端发布流程。
- 云端部署不读取或改动 `v2.sqlite3`；对数据库仅检查文件存在。同步口令所在 `config.js` 只在 ECS 内部复制，不进入工作流日志。
- 任何涉及密钥、token、SSH 密码的数据都不要放到 PR、Issue、聊天内容或 `GITHUB_OUTPUT`。
- 当前原有设计会把同步 token 放在浏览器可访问的 `config.js` 中。它**不是安全的用户认证机制**；本次沿用既有行为避免破坏登录和数据同步，之后应专项修复。
- 失败排查：打开 Actions 对应 run；如未设置自动变量，部署 job 为 skipped，是预期行为。运行前必须确认仓库代码与线上实际部署的基线匹配。
