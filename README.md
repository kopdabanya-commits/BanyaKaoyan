# 板牙考研 v2

给自己用的考研计划 PWA：**一张任务表 + 四个屏 + 一句话调整 + 每日自动整理 + 云端同步**。
无框架、无构建、无第三方前端依赖。

在线地址：`https://124.70.128.201/`
接口前缀：`/api`

## 功能

- **今天**：剩余分钟圆环、任务清单、完成/不做、实际用时
- **日历**：月视图 + 每天任务标记，点某天直接看安排
- **统计**：近 7 天完成率、实际分钟、进度基线（每天应做 / 落后）、题型分布
- **复制给 GPT**：今天 / 近 7 天 / 全部，紧凑文本，省 token
- **导入 GPT 计划**：Markdown 表格、每行一条、JSON；替换或合并
- **一句话改计划**：移动 / 改时长 / 删除 / 新增，直接落库，可撤销
- **每日自动整理**：逾期任务按容量分散、每天上限 150 分钟，附改动汇报
- **云端同步**：版本号条件写入、按任务时间戳合并、删除用墓碑同步

## 目录

```
index.html                 应用外壳
manifest.webmanifest       PWA 清单
sw.js                      离线缓存（只缓存外壳）
assets/
  app.js                   全部前端逻辑
  style.css                设计系统（CSS 变量集中在 :root）
  icon.svg
server/
  main.py                  FastAPI：计划存储 + 一句话调整
  requirements.txt
deploy/
  deploy.py                发布静态站与后端服务
  switch_root.py           把根路径切到 v2、旧版下线
  known_hosts              服务器主机公钥（用于严格校验）
tests/
  smoke.py                 计划读写、版本冲突、调整（假模型，不花钱）
legacy/v1/                 旧版完整归档，仅作参考，不参与构建
```

## 数据模型

```js
task = { id, subject, date, title, type, minutes, done, notDone, actualMinutes, note, updatedAt, deleted }
```

- 计划就是任务数组，没有模板、镜像、覆盖层。
- 删除写 `deleted` 墓碑 + `updatedAt`，同步时不会被旧数据复活。
- 本地 `localStorage`，云端 SQLite；靠 `revision` + 每任务 `updatedAt` 合并。

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/plan` | 取云端计划 `{ revision, tasks }` |
| PUT | `/api/plan` | `{ expectedRevision, tasks }`，冲突返回 409 + 云端任务 |
| POST | `/api/adjust` | `{ instruction, today, subject, tasks }` → 操作应用后的任务与改动摘要 |
| GET | `/api/health` | 服务与密钥状态 |

除 health 外都需要 `Authorization: Bearer <口令>`。

## 本地开发

```bash
cd server
pip install -r requirements.txt
BANYA_V2_TOKEN=dev BANYA_V2_FAKE=1 uvicorn main:app --port 8801
# 前端直接打开 index.html；?demo=1 生成示例，?view=calendar|stats|me 切屏
python tests/smoke.py
```

`BANYA_V2_FAKE=1` 时使用本地假模型，不调用 DeepSeek、不产生费用。

## 部署

不使用 GitHub Actions（私有仓库按分钟计费，避免额度依赖），改为本地一键脚本：

```bash
export BANYA_ECS_PASS_FILE=/path/to/pass.txt
export BANYA_KNOWN_HOSTS=$PWD/deploy/known_hosts
python deploy/deploy.py        # 发布静态文件 + 重启服务
python deploy/switch_root.py   # 首次切换根路径、旧版下线（已执行过）
```

`deploy/known_hosts` 固定服务器主机公钥；口令只从环境变量指向的文件读取。

服务器上：

- 静态：`/var/www/banya-v2/releases/<时间戳>` + `current` 软链
- 服务：`banya-v2.service`（127.0.0.1:8766，`/etc/banya-v2.env` 保存口令与密钥）
- 数据库：`/var/lib/banya-v2/v2.sqlite3`
- nginx：站点配置 `banya-sync`，80 仅做 ACME 与跳转，443 服务本应用

## 旧版

`legacy/v1/` 是旧版完整代码与文档，**不参与构建**，只作参考。
旧版数据仍在服务器 `/var/lib/banya-sync/sync.sqlite3`，未删除；旧服务已停用。

## 约定

- 不用框架、不加构建步骤、不引入前端依赖
- 不提交任何密钥、口令、`.secrets/`、数据库
- 改动先跑 `node --check assets/app.js` 与 `python tests/smoke.py`
- 发布只从 main 执行本地脚本；发布后确认 `/api/health` 正常
- 不使用 CI/Actions：提交前在本地跑完检查
