"""板牙考研 v2 服务端。

只做一件事：云端计划存储（单用户、带版本号的条件写入）。
计划始终以客户端为准；服务端不推断、不生成、不缓存任何内容。
"""
from __future__ import annotations

import hmac
import json
import os
import sqlite3
from contextlib import closing
from datetime import date
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

TOKEN = os.environ.get("BANYA_V2_TOKEN", "")
DB_PATH = Path(os.environ.get("BANYA_V2_DB", "/var/lib/banya-v2/v2.sqlite3"))
VERSION_FILE = Path(os.environ.get("BANYA_V2_VERSION", "/opt/banya-v2/version.json"))
MAX_TASKS = 4000


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
    score: float | None = None
    scoreMax: float | None = None
    round: int | None = None
    updatedAt: int | None = None
    deleted: bool | None = None


class PlanIn(BaseModel):
    expectedRevision: int = Field(ge=0)
    tasks: list[Task] = Field(default_factory=list, max_length=MAX_TASKS)


app = FastAPI(title="Banya v2", docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "PUT"],
                   allow_headers=["Authorization", "Content-Type"])


def require(authorization: str | None) -> None:
    if not TOKEN:
        raise HTTPException(status_code=503, detail="服务端未配置同步密码")
    prefix = "Bearer "
    supplied = authorization[len(prefix):] if authorization and authorization.startswith(prefix) else ""
    if not supplied or not hmac.compare_digest(supplied, TOKEN):
        raise HTTPException(status_code=401, detail="同步密码不正确")


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


@app.get("/health")
def health():
    return {"ok": True, "storage": "sqlite"}


@app.get("/version")
def version():
    try:
        return json.loads(VERSION_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"version": "", "builtAt": ""}
