"""板牙考研 v2 服务端。

职责只有两件：
1. 云端计划存储（单用户、带版本号的条件写入）；
2. 一句话调整（把任务表和指令发给模型，拿回操作并轻校验）。

计划始终以客户端为准；这里不推断、不生成、不缓存模型回复。
"""
from __future__ import annotations

import hmac
import json
import os
import re
import sqlite3
import uuid
from contextlib import closing
from datetime import date, timedelta
from pathlib import Path

import urllib.error
import urllib.request

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

TOKEN = os.environ.get("BANYA_V2_TOKEN", "")
API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
MODEL = os.environ.get("BANYA_V2_MODEL", "deepseek-flash")
UPSTREAM = os.environ.get("DEEPSEEK_BASE", "https://api.deepseek.com")
DB_PATH = Path(os.environ.get("BANYA_V2_DB", "/var/lib/banya-v2/v2.sqlite3"))
FAKE = os.environ.get("BANYA_V2_FAKE", "") == "1"
HORIZON_DAYS = 60
MAX_OPS = 80
MAX_TASKS = 4000
MIN_MINUTES, MAX_MINUTES = 5, 240

SYSTEM = """你是考研计划助手。你会收到一份任务列表（JSON 数组）和用户的一句中文要求。
只输出一个 JSON 对象：{"reply":"一句简短中文说明","ops":[...]}。
可用操作：
{"op":"move","id":"任务id","date":"YYYY-MM-DD"}
{"op":"resize","id":"任务id","minutes":30}
{"op":"delete","id":"任务id"}
{"op":"add","date":"YYYY-MM-DD","title":"任务名","type":"阅读","minutes":40}
规则：
- 只能使用列表里存在的 id；add 不要写 id。
- 日期只能在 today 到 today+60 天之间。
- done=true 或 notDone=true 的任务绝不能改。
- 用户说某天没空时，把那天的任务顺延到之后几天，保持每天总分钟不超过 150。
- 能少改就少改；无法判断时 ops 为空，并在 reply 里说明缺什么信息。
- 不要输出 Markdown、不要解释，只输出 JSON。"""


# --------------------------------------------------------------------------- 数据模型
class Task(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    date: str
    title: str = Field(min_length=1, max_length=300)
    type: str = ""
    minutes: int = 30
    done: bool = False
    notDone: bool = False
    note: str = ""
    subject: str = ""
    actualMinutes: int | None = None
    updatedAt: int | None = None
    deleted: bool | None = None


class AdjustIn(BaseModel):
    instruction: str = Field(min_length=1, max_length=500)
    today: str
    subject: str = "english"
    tasks: list[Task] = Field(default_factory=list, max_length=MAX_TASKS)


class PlanIn(BaseModel):
    expectedRevision: int = Field(ge=0)
    tasks: list[Task] = Field(default_factory=list, max_length=MAX_TASKS)


app = FastAPI(title="Banya v2", docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "PUT", "POST"],
                   allow_headers=["Authorization", "Content-Type"])


def require(authorization: str | None) -> None:
    if not TOKEN:
        raise HTTPException(status_code=503, detail="服务端未配置口令")
    prefix = "Bearer "
    supplied = authorization[len(prefix):] if authorization and authorization.startswith(prefix) else ""
    if not supplied or not hmac.compare_digest(supplied, TOKEN):
        raise HTTPException(status_code=401, detail="口令不正确")


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=10, isolation_level=None)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA busy_timeout=8000")
    return con


def initialize() -> None:
    with closing(connect()) as con:
        con.execute("""CREATE TABLE IF NOT EXISTS plan (
            id INTEGER PRIMARY KEY CHECK(id=1),
            revision INTEGER NOT NULL,
            tasks_json TEXT NOT NULL,
            updated_at TEXT NOT NULL)""")


@app.on_event("startup")
def startup() -> None:
    initialize()


# --------------------------------------------------------------------------- 工具
def valid_day(value: str) -> bool:
    return bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", value or ""))


# --------------------------------------------------------------------------- 计划同步
@app.get("/plan")
def read_plan(authorization: str | None = Header(default=None)):
    require(authorization)
    with closing(connect()) as con:
        row = con.execute("SELECT revision, tasks_json, updated_at FROM plan WHERE id=1").fetchone()
    if not row:
        return {"revision": 0, "tasks": []}
    return {"revision": row["revision"], "tasks": json.loads(row["tasks_json"]), "updatedAt": row["updated_at"]}


@app.put("/plan")
async def write_plan(request: Request, authorization: str | None = Header(default=None)):
    require(authorization)
    try:
        body = PlanIn.model_validate(await request.json())
    except Exception:
        raise HTTPException(status_code=422, detail="计划格式不正确") from None
    encoded = json.dumps([t.model_dump(exclude_none=True) for t in body.tasks], ensure_ascii=False)
    if len(encoded.encode()) > 4_000_000:
        raise HTTPException(status_code=413, detail="计划过大")
    now = date.today().isoformat()
    with closing(connect()) as con:
        con.execute("BEGIN IMMEDIATE")
        try:
            row = con.execute("SELECT revision, tasks_json FROM plan WHERE id=1").fetchone()
            current = row["revision"] if row else 0
            if body.expectedRevision != current:
                con.execute("ROLLBACK")
                return JSONResponse(status_code=409, content={
                    "detail": "版本冲突，已把云端最新版本返回",
                    "revision": current,
                    "tasks": json.loads(row["tasks_json"]) if row else []})
            con.execute("""INSERT INTO plan(id, revision, tasks_json, updated_at) VALUES(1,?,?,?)
                           ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,
                           tasks_json=excluded.tasks_json, updated_at=excluded.updated_at""",
                        (current + 1, encoded, now))
            con.execute("COMMIT")
        except Exception:
            if con.in_transaction:
                con.execute("ROLLBACK")
            raise
    return {"revision": current + 1}


# --------------------------------------------------------------------------- 调整
class ProviderError(Exception):
    def __init__(self, code: str):
        self.code = code


def call_model(instruction: str, today: str, tasks: list[dict]) -> dict:
    if FAKE:
        return fake_model(instruction, today, tasks)
    if not API_KEY:
        raise HTTPException(status_code=503, detail="服务端未配置模型密钥")
    payload = {
        "model": MODEL,
        "temperature": 0,
        "max_tokens": 2000,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": json.dumps({"today": today, "tasks": tasks}, ensure_ascii=False)},
            {"role": "user", "content": instruction},
        ],
    }
    request = urllib.request.Request(
        UPSTREAM.rstrip("/") + "/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode(),
        method="POST",
        headers={"Authorization": "Bearer " + API_KEY, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            raw = json.load(response)
    except urllib.error.HTTPError as error:
        raise HTTPException(status_code=502, detail={401: "模型密钥无效", 402: "账户余额不足",
                                                    429: "请求过于频繁"}.get(error.code, "模型请求失败")) from None
    except Exception:
        raise HTTPException(status_code=504, detail="模型响应超时") from None
    try:
        content = raw["choices"][0]["message"]["content"]
        content = re.sub(r"^```(?:json)?|```$", "", content.strip(), flags=re.M).strip()
        return json.loads(content)
    except Exception:
        raise HTTPException(status_code=502, detail="模型返回格式不正确") from None


def fake_model(instruction: str, today: str, tasks: list[dict]) -> dict:
    ops = []
    if "明天" in instruction and ("没空" in instruction or "不" in instruction):
        target = (date.fromisoformat(today) + timedelta(days=1)).isoformat()
        for task in tasks:
            if task["date"] == target and not task["done"] and not task["notDone"]:
                ops.append({"op": "move", "id": task["id"],
                            "date": (date.fromisoformat(task["date"]) + timedelta(days=1)).isoformat()})
        return {"reply": "把明天的任务顺延一天。", "ops": ops}
    return {"reply": "本地联调模式：没有匹配的指令。", "ops": []}


def apply_ops(tasks: list[dict], ops: list[dict], today: str) -> tuple[list[dict], list[dict], list[str]]:
    lo = date.fromisoformat(today)
    hi = lo + timedelta(days=HORIZON_DAYS)
    by_id = {task["id"]: dict(task) for task in tasks}
    changes: list[dict] = []
    violations: list[str] = []

    for op in ops[:MAX_OPS]:
        if not isinstance(op, dict):
            continue
        kind = op.get("op")
        if kind == "add":
            day = str(op.get("date", ""))
            title = str(op.get("title", "")).strip()
            minutes = int(op.get("minutes") or 30)
            if not valid_day(day) or not (lo <= date.fromisoformat(day) <= hi) or not title:
                violations.append("有一条新增被跳过：日期或内容不合法")
                continue
            new_id = "a" + uuid.uuid4().hex[:10]
            by_id[new_id] = {"id": new_id, "date": day, "title": title[:300],
                             "type": str(op.get("type") or "其他")[:20],
                             "minutes": max(MIN_MINUTES, min(MAX_MINUTES, minutes)),
                             "done": False, "notDone": False, "note": "", "subject": ""}
            changes.append({"kind": "add", "title": title, "date": day})
            continue

        task = by_id.get(str(op.get("id", "")))
        if not task:
            violations.append("有一条改动找不到对应任务，已跳过")
            continue
        if task.get("done") or task.get("notDone"):
            violations.append("已完成或不做的任务不能改")
            continue

        if kind == "move":
            day = str(op.get("date", ""))
            if not valid_day(day) or not (lo <= date.fromisoformat(day) <= hi):
                violations.append("有一条改期超出可调整范围")
                continue
            changes.append({"kind": "move", "title": task["title"], "from": task["date"], "to": day})
            task["date"] = day
        elif kind == "resize":
            minutes = max(MIN_MINUTES, min(MAX_MINUTES, int(op.get("minutes") or 0)))
            if minutes == task.get("minutes"):
                continue
            changes.append({"kind": "resize", "title": task["title"], "from": task.get("minutes"), "to": minutes})
            task["minutes"] = minutes
        elif kind == "delete":
            changes.append({"kind": "delete", "title": task["title"], "date": task["date"]})
            task["_deleted"] = True
        else:
            continue
        by_id[task["id"]] = task

    return [t for t in by_id.values() if not t.get("_deleted")], changes, violations


@app.post("/adjust")
def adjust(body: AdjustIn, authorization: str | None = Header(default=None)):
    require(authorization)
    if not valid_day(body.today):
        raise HTTPException(status_code=422, detail="today 格式不正确")
    tasks = [t.model_dump(exclude_none=True) for t in body.tasks]
    answer = call_model(body.instruction, body.today, tasks)
    ops = answer.get("ops") or []
    if not isinstance(ops, list):
        raise HTTPException(status_code=502, detail="模型返回格式不正确")
    updated, changes, violations = apply_ops(tasks, ops, body.today)
    return {"tasks": updated, "changes": changes, "violations": violations,
            "reply": str(answer.get("reply", ""))[:500]}


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL, "fake": FAKE, "keyPresent": bool(API_KEY)}
