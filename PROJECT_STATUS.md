# 板牙考研 v2 · 项目现状与工作流

> 给接手的任何人或 AI。**本文不含任何密钥**；密钥只在服务器与 GitHub Secrets 中。

## 1. 一句话现状

v2 已上线并接管根路径 `https://124.70.128.201/`；旧版已停用并完整归档在仓库 `legacy/v1/`；
代码在 GitHub `kopdabanya-commits/BanyaKaoyan`，CI 全绿，部署走手动工作流。

## 2. 线上环境

| 项 | 值 |
|---|---|
| 入口 | `https://124.70.128.201/`（PWA，可添加到主屏幕） |
| 接口前缀 | `/api` |
| 服务器 | 华为云 ECS，Ubuntu，nginx 1.24 |
| 证书 | Let's Encrypt 针对 IP，自动续期检查保留（80 端口仅 ACME 与跳转） |
| 服务 | `banya-v2.service` → uvicorn 127.0.0.1:8766，用户 `banya-sync` |
| 静态 | `/var/www/banya-v2/releases/<UTC 时间戳>`，`current` 软链原子切换 |
| 数据库 | `/var/lib/banya-v2/v2.sqlite3`（SQLite，WAL） |
| 配置 | `/etc/banya-v2.env`（应用口令、DeepSeek 密钥、模型名、DB 路径） |
| 旧版 | 服务 `banya-sync` 已停止并禁用；`/v1/*` 返回 404；数据 `/var/lib/banya-sync/sync.sqlite3` 保留未动 |

## 3. 架构

```
手机 PWA (localStorage)
   │  HTTPS /api
   ▼
nginx (443) ──静态──► /var/www/banya-v2/current
   │
   └──proxy──► FastAPI (127.0.0.1:8766) ──► SQLite 计划表
                     │
                     └──► DeepSeek chat/completions（仅一句话调整时）
```

- 前端本地优先：先写 localStorage，1.2 秒防抖后推送云端。
- 冲突：`revision` 条件写入；409 时按任务 `updatedAt` 取新再重推。
- 删除：任务带 `deleted` 墓碑同步，不会被旧数据复活。

## 4. 代码结构

```
index.html / manifest.webmanifest / sw.js
assets/app.js        前端全部逻辑（视图、同步、导入导出、AI 调用、每日整理）
assets/style.css     设计系统，变量集中在 :root
server/main.py       FastAPI：GET/PUT /plan、POST /adjust、GET /health
deploy/deploy.py     发布静态与后端（paramiko，环境变量配置主机/口令文件/known_hosts）
deploy/switch_root.py 首次切换根路径、旧版下线（已执行过，不需要再跑）
tests/smoke.py       假模型冒烟：计划读写、版本冲突、调整
legacy/v1/           旧版归档，只读参考，不参与构建
```

## 5. 数据模型

```js
task = { id, subject, date, title, type, minutes, done, notDone, actualMinutes, note, updatedAt, deleted }
```

- `subject`: `english` | `politics`
- 一天的任务 = 该 `date` 下未删除的任务；没有模板、覆盖层、镜像。

## 6. AI 的两条路径

| | 一句话调整 | 每日自动整理 |
|---|---|---|
| 触发 | 用户在底部输入一句话 | 每天首次打开 App |
| 是否调用模型 | 是（每次约 1–2k token） | **不调用**，纯规则 |
| 输出 | move / resize / delete / add 操作 | 移动逾期与超载任务 |
| 校验 | 日期 today..+60、已完成/不做不可改、id 必须存在、最多 80 个操作、单任务 5–240 分钟 | 每天上限 150 分钟，只移动未完成 |
| 失败 | 返回中文原因，计划不变 | 不修改任何数据 |
| 撤销 | 保留最近 15 次快照 | 同一撤销栈 |

模型：DeepSeek `deepseek-flash`，`response_format=json_object`，temperature 0，45 秒超时。

## 7. 协作工作流

```
改代码 → 本地自检 → 开 PR → CI(ci.yml) 绿 → 合并 main
                                            │
                                            └─ 手动触发 deploy.yml → 服务器发布 → 线上核验
```

**本地自检（提交前必须）**

```bash
node --check assets/app.js && node --check sw.js
python -m py_compile server/main.py
python tests/smoke.py          # 假模型，不产生费用
```

**发布**

- GitHub Actions → `deploy` 工作流 → Run workflow（只在 main）
- 或本地：`BANYA_ECS_PASS_FILE=... BANYA_KNOWN_HOSTS=deploy/known_hosts python deploy/deploy.py`

**回滚**

1. `ls /var/www/banya-v2/releases` 找上一个版本
2. `ln -sfn <旧目录> /var/www/banya-v2/current`
3. 代码回滚则 `git revert` 后重新发布；数据库改动前先备份

## 8. 安全边界

- 服务器口令只在 GitHub Secret `BANYA_ECS_SSH_PASSWORD` 与本机 `.secrets/`，**不进仓库、不进对话**。
- 应用口令在服务器 `/etc/banya-v2.env`，前端由用户手动填写一次，存在本机 localStorage。
- DeepSeek 密钥只在服务器，前端与仓库都没有。
- 不要给任何外部 AI 直接 SSH 权限；需要发布就让它在 GitHub 开 PR，由工作流部署。

## 9. 已知限制

- 单用户、单口令，没有账号体系。
- 多设备同时改同一任务时按"最后写入"合并，没有逐字段冲突界面。
- 旧版学习数据（打卡、错题、实际用时）**尚未迁移**到 v2。
- 每日整理只在打开 App 时执行，没有后台定时任务。
- PWA 更新依赖重新打开（Service Worker 版本 `banya-v2-2`）。

## 10. 待办（按优先级）

1. 旧版数据迁移：从 `/var/lib/banya-sync/sync.sqlite3` 只读导出为 v2 任务（打卡作为 `done` + `actualMinutes`）。
2. 多设备冲突提示：409 时显示"云端有更新"，而不是静默合并。
3. 周复盘页：把这周的实际 vs 计划生成一段可复制的总结。
4. 备份：每天自动 `sqlite3 .backup` 到 `/var/lib/banya-v2/backups`，保留 7 天。
5. 可选：接入 GitHub OAuth 或独立账号（目前单用户足够）。

## 11. 关键参数

| 参数 | 值 | 位置 |
|---|---|---|
| 每日上限 | 150 分钟 | `assets/app.js` `DAILY_CAP` |
| 同步防抖 | 1200 ms | `app.js` `schedulePush` |
| 撤销栈 | 15 次 | `app.js` `save()` |
| 墓碑保留 | 45 天 | `app.js` `prune()` |
| 调整窗口 | 过去 7 天 ~ 未来 45 天 | `app.js` `adjust()` |
| 操作上限 | 80 | `server/main.py` `MAX_OPS` |
| 模型超时 | 45 s | `server/main.py` `call_model` |
