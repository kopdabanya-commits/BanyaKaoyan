# 工程约定（板牙考研 v2）

面向任何接手这个仓库的 agent（包括 AI）。

## 这是什么

一个给自己用的考研计划 PWA。前端原生 JS，后端 FastAPI + SQLite。
根目录是 v2；`legacy/v1/` 是旧版完整归档，**只读参考，不要修改、不要接入构建**。

## 硬规则

1. **不提交密钥**：口令、服务器密码、`.secrets/`、数据库、`*.pem` 一律不进仓库。
2. **不用框架、不加构建**：前端保持原生 JS + CSS；不要引入 React/Vue/Tailwind/打包器。
3. **不改 legacy**：旧版只作参考；需要旧逻辑时复制片段，不要动目录。
4. **数据安全**：任何迁移先备份 `/var/lib/banya-v2/v2.sqlite3`；不写脚本直接清库。
5. **已完成/不做不可被自动改动**：一句话调整和每日整理都必须跳过这类任务。

## 代码风格

- 前端：一个 IIFE、无全局变量泄漏；视图函数返回模板字符串；事件用 `data-action` 委托。
- 样式：设计变量集中在 `style.css` 的 `:root`；不要散落硬编码颜色。
- 后端：单文件 `server/main.py`；Pydantic 严格校验；错误用 `HTTPException(detail=中文提示)`。
- 注释写"为什么"，不写"是什么"；不要留 TODO 假实现。

## 提交前必须跑

```bash
node --check assets/app.js && node --check sw.js
python -m py_compile server/main.py
python tests/smoke.py        # 假模型，不花钱
```

改动了界面，再用 Edge/Chrome 无头截一张图确认没有布局塌陷：

```bash
msedge --headless=new --window-size=500,1050 --screenshot=shot.png "file:///<repo>/index.html?demo=1"
```

## 发布

- 只从 `main` 发布；先合并 PR、CI 绿。
- `python deploy/deploy.py` 发布静态与后端；`switch_root.py` 只在首次切换根路径时用。
- 发布后核验：`GET /api/health` 200、首页 200、`/assets/app.js` 200。
- 出问题回滚：`/var/www/banya-v2/current` 指回上一个 `releases/<时间戳>`，`systemctl restart banya-v2`。

## 与旧版的关系

旧版站点与接口已停用；旧数据保留在 `/var/lib/banya-sync/sync.sqlite3`，未迁移。
若需要旧数据，只做只读导出，不恢复旧服务。
