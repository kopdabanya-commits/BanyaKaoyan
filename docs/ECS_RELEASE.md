# ECS 日常发布与历史入口

日常运行和发布仅使用华为云 ECS：GitHub → Validate planner → 手动 Reviewed ECS PWA release → 同一 PWA。普通 PR 不发布生产。后端仍使用已有备份优先的 Reviewed private-plan channel upgrade，不能用初次安装流程升级已有私人数据库。

本次只修改、测试流程，没有运行发布。正式发布必须在 main 经审阅后手动触发；后端升级仍需匹配同一 SHA 的 PWA。两个发布流程共享 banya-ecs-production 并发锁。现有 SSH Secrets 和 known_hosts 继续复用，不新增凭据。

静态发布包由 scripts/ecs_package.py 明确列出全部资源，校验 SHA256SUMS、文件类型和精确成员；拒绝额外源码、符号链接和路径穿越。线上 Nginx 仍只服务原资源允许列表。发布前校验私人 SQLite 在线备份完整性；原数据库不覆盖。静态版本目录不可覆盖，通过原子软链接切换；Nginx 或完整资源哈希、HTTPS、健康/未授权验证失败会恢复旧链接和配置。

CI 一次运行语法、Node、Python、双科/云同步/权限/备份、隐私和 ECS 包检查，使用路径过滤、并发取消和 pip 缓存。发布复用相同验证工作流，不引入 Wrangler 或 Cloudflare 账号依赖。

删除四个工作流：cf-build-log-audit.yml、cf-version-stage.yml、cloudflare-diagnose.yml、publish-existing-worker.yml。ecs-deploy.yml 的历史引导流程改为仅 main 手动，不能因旧分支 push 意外重装；它不用于已有服务器日常升级。

保留 wrangler.jsonc、.assetsignore、_headers 和原线上 Worker，仅作历史入口与旧设备恢复的资料。origin-transfer.js、cloud-sync.js、原 manifest 身份与存储键不变。不创建或删除 Worker，不再更新它以作为 ECS 发布前置条件。轻量历史恢复安全回归仍保留，CI 不调用任何 Cloudflare 构建/API。

Cloudflare 的 `Workers Builds: english-ii-plan` 是平台外部 GitHub 集成，不属于仓库 Actions；删除 YAML 不会关闭它。当前环境没有绑定 Cloudflare 管理身份或 API 凭据，不能安全修改外部设置，也未循环诊断。

需要关闭时：Cloudflare 控制台 → Workers & Pages → english-ii-plan → Settings → Builds → Build configuration → 断开 Git 仓库连接（Disconnect）。只断开自动构建，**不要删除 Worker**；旧网站继续作为恢复入口。若仓库分支保护把该检查列为必需，还需 GitHub 仓库 Settings → Rules → Rulesets（或 Branches 的保护规则）→ Required status checks，移除 `Workers Builds: english-ii-plan`，保留 Validate planner。此项未操作，外部失败状态可能仍显示，但不作为 ECS/M7.2 验收条件。

清理阶段本地验证：138 项 Node、96 项 Python（含7项 ECS 包、路径防护、公开验证和沙盒失败回滚）通过；静态包完整性、原双科/云同步、语法及隐私检查通过。模拟服务和沙盒文件不代表生产发布，真实 HTTPS/SSH 发布仍未运行。
