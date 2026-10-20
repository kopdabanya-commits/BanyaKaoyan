# 板牙考研 v2 · 交接说明书

> 这份文件给接手的人或 AI 阅读。**不含任何密钥**（口令、服务器密码、模型密钥都不在这里）。
> 最近更新：2026-10-20。

---

## 1. 一句话

一个给自己用的考研计划 PWA：**一张任务表 + 四个屏 + 一句话调整 + 每日自动整理 + 云端同步**。
无框架、无构建步骤、无第三方前端依赖。

- 线上：`https://124.70.128.201/`（可添加到手机主屏幕）
- 接口：`/api`
- 仓库：`github.com/kopdabanya-commits/BanyaKaoyan`（公开，main 分支）

---

## 2. 架构

```
手机 PWA（localStorage 本地优先）
   │  HTTPS /api
   ▼
nginx 443 ──静态──► /var/www/banya-v2/current
   │
   └──proxy──► FastAPI 127.0.0.1:8766 ──► SQLite /var/lib/banya-v2/v2.sqlite3
                     │
                     └──► DeepSeek chat/completions（仅一句话调整时）
```

- 80 端口只用于证书续期（`/.well-known/acme-challenge/`）和跳转 443。
- 证书是 Let's Encrypt 针对 IP 的证书，自动续期检查保留。
- 旧版（v1）站点与接口已停用，代码归档在仓库 `legacy/v1/`，数据保留未动。

---

## 3. 仓库结构

```
index.html                应用外壳
manifest.webmanifest      PWA 清单
sw.js                     离线缓存（只缓存外壳，数据在 localStorage）
assets/app.js             全部前端逻辑（视图 / 同步 / 导入导出 / AI / 每日整理）
assets/style.css          设计系统，变量集中在 :root，含深色模式
assets/icon.svg
server/main.py            FastAPI：计划存储 + 一句话调整
server/requirements.txt
deploy/deploy.py          发布静态与后端（paramiko）
deploy/switch_root.py     首次切换根路径、旧版下线（已执行过）
deploy/known_hosts        服务器主机公钥
tests/smoke.py            假模型冒烟：计划读写、版本冲突、调整
scripts/check.sh          一条命令跑完全部本地检查
tools/migrate_v1.py       旧版 SQLite → v2 任务（只读）
legacy/v1/                旧版完整归档，只读参考，不参与构建
```

---

## 4. 数据模型

```js
task = {
  id,        // 字符串，科目前缀 + 原任务 id
  subject,   // 'english' | 'politics'
  date,      // YYYY-MM-DD
  title,     // 任务名
  type,      // 阅读/翻译/写作/完形/新题型/单词/背诵/刷题/复盘/课程/其他
  minutes,   // 计划分钟 5–240
  done,      // 已完成
  notDone,   // 主动不做（与 done 互斥）
  actualMinutes, // 实际用时，可为 null
  note,      // 备注
  updatedAt, // 毫秒时间戳，合并依据
  deleted    // 墓碑：true 表示已删除，仍参与同步
}
```

**没有模板、没有镜像文件、没有私人覆盖层。** 计划就是这张表。
删除写墓碑 + `updatedAt`，同步后旧设备不会把任务“复活”。

---

## 5. 同步协议

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/plan` | `{ revision, tasks }` |
| PUT | `/api/plan` | `{ expectedRevision, tasks }` → `{ revision }`；版本不符返回 **409** 并附带云端任务 |
| POST | `/api/adjust` | `{ instruction, today, subject, tasks }` → 应用操作后的任务 + 改动摘要 |
| GET | `/api/health` | 服务状态、模型名、密钥是否存在（不返回值） |

- 除 health 外都需要 `Authorization: Bearer <口令>`。
- 客户端：先写本地，1.2 秒防抖推送；打开与切回前台时拉取。
- 冲突：按任务 `updatedAt` 取新合并，然后重推；合并时提示「云端有更新，已自动合并」。
- 墓碑保留 45 天后本地清理。

---

## 6. 功能与规则

### 今天
- 日期切换、任务勾选完成、标记不做、编辑（日期/内容/类型/计划分钟/实际用时/备注/删除）。
- 时间圆环 = 已完成分钟 / 计划分钟；中心是剩余分钟。
- 进度提示：距考试天数、每天应做分钟、近 7 天平均；低于应做 80% 且有 3 天以上时标红「落后」。

### 日历
- 月视图，圆点表示当天有任务（实心 = 全部完成），点某天跳到该天并显示任务。

### 统计
- 近 7 天：完成数/计划数、实际分钟、完成率、每日柱状图。
- 进度：剩余项与分钟、到计划结束天数、每天应做 vs 近 7 天平均。
- 题型分布（近 7 天）。
- **本周复盘**：自动生成一段结论（完成率评价、最弱题型、节奏判断），可一键复制给 GPT。
- 复制给 GPT：今天 / 近 7 天 / 全部，紧凑文本，含完成状态、计划与实际分钟、备注。

### 导入（三种模式）
1. **按日期覆盖（默认）**：替换导入内容覆盖到的日期；**保留已完成和标记不做的记录**。
2. **只添加**：相同日期 + 相同标题跳过，不产生重复。
3. **全部替换**：清空当前科目后导入。

导入完成后提示「新增 N · 删除 M · 保留已完成 K」。
支持 Markdown 表格、每行一条、JSON。

### 一句话调整
底部输入框 → 服务端把「当前任务 + 这句话」交给模型 → 模型只返回操作：
`move / resize / delete / add` → 服务端校验 → 直接落库 → 提示「调整 N 项 · 点这里撤销」。
撤销栈保留最近 15 次。

### 每日自动整理
每天首次打开（或切回前台跨天）执行，纯规则、不调用模型：
- 逾期未完成的任务按当天剩余容量分散到今天起（不会全堆在今天）。
- 未来 14 天里超过 150 分钟的日子，把当天最小的任务往后挪。
- 只移动，不改时长；已完成/不做不动。
- 顶部卡片汇报改了哪几项，可撤销。

---

## 6.5 设计与交互

- **深色主题**，单一强调色 `#7C5CFF`；背景 `#08090B`，卡片 `#0F1115`，1px 边框替代阴影。
- **8pt 栅格**：4/8/12/16/20/24 的间距尺度；卡片 18px 圆角，按钮 10px。
- **数字全部 tabular**：任务分钟右对齐、统计数字等宽，避免跳动。
- **对齐规则**：任务行固定三列（勾选 / 内容 / 分钟）；焦点卡每行"标签左、数值右"共用一条基线；日期头三等分网格。
- **图标**：全部内联 SVG（1.7 线宽），不再用汉字当图标。
- **动效**：页面淡入上移、圆环扫入、勾选回弹、底部弹层上滑；只用 transform/opacity，并支持 `prefers-reduced-motion`。
- **缓存**：`sw.js` 的 `CACHE` 是版本号，改前端资源时必须同步 +1，否则手机会继续用旧资源。

## 7. AI 的两条路径

| | 一句话调整 | 每日整理 |
|---|---|---|
| 触发 | 用户主动说一句 | 每天首次打开 |
| 调用模型 | 是 | 否 |
| 成本 | 每次约 1–2k token | 0 |
| 失败影响 | 返回中文原因，计划不变 | 不修改任何数据 |

**模型**：DeepSeek `deepseek-flash`，`response_format=json_object`，temperature 0，45 秒超时。
**服务端校验**：日期必须在 today..today+60；已完成/不做不可改；id 必须存在；最多 80 个操作；单任务 5–240 分钟。

---

## 8. 给 GPT 的导入格式

应用内「我的 → 复制导入提示词」会生成下面这段（日期自动替换为当天）：

```
请帮我排一份考研学习计划，只输出 Markdown 表格，不要解释、不要额外文字。

表格格式：
| 日期 | 任务 | 类型 | 分钟 |
| --- | --- | --- | --- |
| 2026-10-20 | 示例：阅读真题 2021 Text 1 | 阅读 | 40 |

要求：
1. 日期用 YYYY-MM-DD，从 2026-10-20 开始，按天递增，不要排到考试之后。
2. 类型只能从：阅读、翻译、写作、完形、新题型、单词、背诵、刷题、复盘、课程、其他 中选。
3. 每项 15-120 分钟；每天总时长不超过 150 分钟；每 7 天留 1 天休息。
4. 任务名具体到材料，例如「阅读真题 2021 Text 1」「马原 第 3 章 刷题 30 题」。
5. 我的情况：（在这里补充：目标院校/专业、考试日期、每天可用时间、薄弱科目、已做过的真题）。
```

**修改已有计划**：让 GPT 只输出需要变更的那几天，导入时选「按日期覆盖」，
这些天的旧安排（未完成的）会被替换，已完成的打卡保留。
若要把某天清空，让 GPT 输出该天「休息」或干脆不写该天，再选「按日期覆盖」即可。

---

## 9. 部署与回滚

不使用 GitHub Actions（避免私有仓库额度依赖），本地脚本发布：

```bash
export BANYA_ECS_PASS_FILE=/path/to/pass.txt
export BANYA_KNOWN_HOSTS=$PWD/deploy/known_hosts
python deploy/deploy.py
```

脚本会：上传静态文件到 `/var/www/banya-v2/releases/<UTC 时间戳>` → 原子切换 `current` 软链 →
安装 `/opt/banya-v2/main.py` → 重启 `banya-v2.service` → 自检 `/` 与 `/api/health`。
如果站点已是 v2 根路径，脚本不再改 nginx。

**回滚**：`ln -sfn /var/www/banya-v2/releases/<上一个> /var/www/banya-v2/current && systemctl restart banya-v2`。

---

## 10. 数据与备份

- v2 数据库：`/var/lib/banya-v2/v2.sqlite3`（WAL）。
- **每日备份**：`banya-v2-backup.timer` 每天 03:17 运行，写到 `/var/lib/banya-v2/backups/v2-YYYY-MM-DD.sqlite3`，保留 7 份。
- 旧版数据：`/var/lib/banya-sync/sync.sqlite3` 保留未动。
- **已完成迁移**：旧版英语二 191 项（6 完成 / 5 不做 / 79 分钟实际用时）已导入 v2；
  旧版政治没有快照，因此为空。

---

## 11. 已知限制

- 单用户、单口令，没有账号体系。
- 多设备同时修改同一任务时按 `updatedAt` 合并，没有逐字段冲突界面。
- 每日整理只在打开 App 时执行，没有后台定时任务。
- 一句话调整只处理当前科目、过去 7 天到未来 45 天的窗口。
- 旧版政治记录不存在（从未同步过），无法迁移。
- PWA 更新依赖重新打开；缓存版本见 `sw.js` 的 `CACHE`。

---

## 12. 关键参数

| 参数 | 值 | 位置 |
|---|---|---|
| 每日上限 | 150 分钟 | `assets/app.js` `DAILY_CAP` |
| 同步防抖 | 1200 ms | `schedulePush` |
| 撤销栈 | 15 次 | `save()` |
| 墓碑保留 | 45 天 | `prune()` |
| 调整窗口 | 过去 7 天 ~ 未来 45 天 | `adjust()` |
| 操作上限 | 80 | `server/main.py` `MAX_OPS` |
| 单任务分钟 | 5–240 | `server/main.py` |
| 模型超时 | 45 s | `call_model` |
| 备份保留 | 7 份 | `/opt/banya-v2/backup.py` |

---

## 13. 给协作者的约定

**可以改**：`assets/`、`server/`、`tests/`、`deploy/`、文档。
**不要改**：`legacy/v1/`（只读参考）。
**不要做**：引入前端框架或构建步骤；提交任何密钥；直接改服务器数据库。

**改动流程**：改代码 → `bash scripts/check.sh` → 提交 → 本地 `python deploy/deploy.py` 发布 → 核验 `/api/health`。

**提交前检查**（`scripts/check.sh` 会全跑）：

```bash
node --check assets/app.js && node --check sw.js
python -m py_compile server/main.py tests/smoke.py
python tests/smoke.py
```

---

## 14. 建议的下一步

1. 多设备冲突的可视化（现在只提示"已合并"）。
2. 计划模板/常用组合（例如"真题周""背诵周"一键切换）。
3. 错题与笔记的结构化（现在只有自由文本备注）。
4. 一句话调整支持跨科目（例如英语多给点、政治压缩）。
