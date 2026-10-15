"""板牙考研：single-user, two-subject snapshot API. No external login integrations."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import sqlite3
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

SUBJECTS = {"english", "politics"}
MAX_BODY_BYTES = 524_288
HISTORY_KEEP = 30
DEFAULT_ORIGIN = "https://english-ii-plan.kopdabanya.workers.dev"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def open_db(db_path: Path) -> sqlite3.Connection:
    con = sqlite3.connect(str(db_path), timeout=15.0, isolation_level=None)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA busy_timeout=15000")
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA synchronous=FULL")
    return con


def initialize(db_path: Path) -> None:
    db_path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    with open_db(db_path) as con:
        con.execute("""CREATE TABLE IF NOT EXISTS snapshots (
            subject TEXT PRIMARY KEY CHECK(subject IN ('english','politics')),
            revision INTEGER NOT NULL CHECK(revision>=1),
            state_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )""")
        con.execute("""CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject TEXT NOT NULL CHECK(subject IN ('english','politics')),
            revision INTEGER NOT NULL,
            state_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )""")
        con.execute("CREATE INDEX IF NOT EXISTS idx_history_subject ON history(subject, id)")


def create_app(*, db_path: str | Path | None = None,
               token_sha256: str | None = None,
               allowed_origin: str | None = None) -> FastAPI:
    db = Path(db_path or os.environ.get("BANYA_DB_PATH", "/var/lib/banya-sync/sync.sqlite3"))
    digest = token_sha256 if token_sha256 is not None else os.environ.get("BANYA_SYNC_TOKEN_SHA256", "")
    origin = allowed_origin or os.environ.get("BANYA_ALLOWED_ORIGIN", DEFAULT_ORIGIN)
    if not isinstance(digest, str) or len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest.lower()):
        raise RuntimeError("BANYA_SYNC_TOKEN_SHA256 must be a SHA-256 hex digest; refuse insecure startup.")
    digest = digest.lower()
    if not origin.startswith("https://") or "/" in origin[len("https://"):]:
        raise RuntimeError("BANYA_ALLOWED_ORIGIN must be one HTTPS origin without a path.")

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        initialize(db)
        yield

    app = FastAPI(title="Banya Study Sync", version="1.0", docs_url=None,
                  redoc_url=None, openapi_url=None, lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=[origin], allow_credentials=False,
                       allow_methods=["GET", "PUT", "OPTIONS"],
                       allow_headers=["Authorization", "Content-Type"],
                       expose_headers=["X-Cloud-Revision"])

    @app.middleware("http")
    async def no_cache(request: Request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    def authorize(authorization: str | None) -> None:
        # No cookies, sessions or password storage; HTTPS and a random per-user secret required.
        prefix = "Bearer "
        token = authorization[len(prefix):] if authorization and authorization.startswith(prefix) else ""
        supplied = hashlib.sha256(token.encode("utf-8")).hexdigest() if token else "0" * 64
        if len(token) < 32 or not hmac.compare_digest(supplied, digest):
            raise HTTPException(status_code=401, detail="Unauthorized",
                                headers={"WWW-Authenticate": "Bearer"})

    def check_subject(subject: str) -> None:
        if subject not in SUBJECTS:
            raise HTTPException(status_code=404, detail="Unknown subject")

    @app.get("/health")
    def health():
        return {"ok": True, "service": "banya-study-sync", "version": 1}

    @app.get("/v1/snapshot/{subject}")
    def read_snapshot(subject: str, authorization: str | None = Header(default=None)):
        authorize(authorization)
        check_subject(subject)
        with open_db(db) as con:
            row = con.execute("SELECT revision,state_json,updated_at FROM snapshots WHERE subject=?",
                              (subject,)).fetchone()
        if row is None:
            return JSONResponse({"subject": subject, "revision": 0,
                                 "state": None, "updatedAt": None})
        return JSONResponse({"subject": subject, "revision": row["revision"],
                             "state": json.loads(row["state_json"]),
                             "updatedAt": row["updated_at"]},
                            headers={"X-Cloud-Revision": str(row["revision"])})

    @app.put("/v1/snapshot/{subject}")
    async def save_snapshot(subject: str, request: Request,
                            authorization: str | None = Header(default=None)):
        authorize(authorization)
        check_subject(subject)
        if request.headers.get("content-type", "").split(";")[0].strip().lower() != "application/json":
            raise HTTPException(status_code=415, detail="JSON required")
        buffer = bytearray()
        async for chunk in request.stream():
            buffer.extend(chunk)
            if len(buffer) > MAX_BODY_BYTES:
                raise HTTPException(status_code=413, detail="Snapshot too large")
        try:
            envelope = json.loads(buffer)
        except (UnicodeDecodeError, ValueError):
            raise HTTPException(status_code=400, detail="Malformed JSON")
        if not isinstance(envelope, dict):
            raise HTTPException(status_code=400, detail="Expected JSON object")
        expected = envelope.get("expectedRevision")
        state = envelope.get("state")
        if isinstance(expected, bool) or not isinstance(expected, int) or expected < 0:
            raise HTTPException(status_code=422, detail="Invalid revision")
        if not isinstance(state, dict):
            raise HTTPException(status_code=422, detail="Invalid state")
        # State shape belongs to the two independently versioned JS cores.
        # The backend stores the full validated-by-client document without normalizing away future fields.
        encoded = json.dumps(state, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        if len(encoded.encode("utf-8")) > MAX_BODY_BYTES:
            raise HTTPException(status_code=413, detail="Snapshot too large")
        now = utc_now()
        with open_db(db) as con:
            con.execute("BEGIN IMMEDIATE")
            try:
                prev = con.execute("SELECT revision,state_json,updated_at FROM snapshots WHERE subject=?",
                                   (subject,)).fetchone()
                revision = int(prev["revision"]) if prev is not None else 0
                if revision != expected:
                    con.execute("ROLLBACK")
                    raise HTTPException(status_code=409, detail="Revision conflict: refresh before replacing")
                updated = revision + 1
                if prev is not None:
                    con.execute("INSERT INTO history(subject,revision,state_json,updated_at) VALUES(?,?,?,?)",
                                (subject, revision, prev["state_json"], prev["updated_at"]))
                con.execute("""INSERT INTO snapshots(subject,revision,state_json,updated_at)
                               VALUES(?,?,?,?)
                               ON CONFLICT(subject) DO UPDATE SET
                               revision=excluded.revision,state_json=excluded.state_json,
                               updated_at=excluded.updated_at""", (subject, updated, encoded, now))
                con.execute("""DELETE FROM history WHERE subject=? AND id NOT IN
                               (SELECT id FROM history WHERE subject=? ORDER BY id DESC LIMIT ?)""",
                            (subject, subject, HISTORY_KEEP))
                con.execute("COMMIT")
            except Exception:
                if con.in_transaction:
                    con.execute("ROLLBACK")
                raise
        return JSONResponse({"subject": subject, "revision": updated, "updatedAt": now},
                            headers={"X-Cloud-Revision": str(updated)})

    return app


app = create_app()
