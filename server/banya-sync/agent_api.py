"""Revocable GPT Action capabilities; no SSH or full-sync credential delegation."""
from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import sqlite3
import time
from contextlib import closing
from pathlib import Path
from typing import Literal

from fastapi import Header, HTTPException, Request, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from private_plan import PROTOCOL, PlanError, apply_patch, effective_tasks, load_template, public_task, valid_date

MAX_REQUEST = 65_536


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Grant(StrictModel):
    subjects: list[Literal["english", "politics"]] = Field(min_length=1, max_length=2)
    permissions: list[Literal["plan:read", "plan:write"]] = Field(min_length=1, max_length=2)
    start: str
    end: str
    expiresDays: int = Field(ge=1, le=30)


class TaskChange(StrictModel):
    operation: Literal["update", "add"]
    taskId: str = Field(min_length=1, max_length=150, pattern=r"^[A-Za-z0-9_-]+$")
    date: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    detail: str | None = Field(default=None, max_length=3000)
    minutes: int | None = Field(default=None, ge=1, le=90)
    type: str | None = Field(default=None, min_length=1, max_length=20)


class Preview(StrictModel):
    expectedRevision: int = Field(ge=1)
    templateVersion: str = Field(min_length=1, max_length=100)
    requestId: str = Field(min_length=8, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")
    tasks: list[TaskChange] = Field(min_length=1, max_length=40)


class Commit(StrictModel):
    expectedRevision: int = Field(ge=1)
    confirmation: Literal["sync"]


def initialize_agent(db):
    with closing(sqlite3.connect(db)) as con:
        con.executescript("""
        CREATE TABLE IF NOT EXISTS agent_grants (
          id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL,
          subjects TEXT NOT NULL, permissions TEXT NOT NULL,
          date_start TEXT NOT NULL, date_end TEXT NOT NULL,
          expires_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS agent_changes (
          id TEXT PRIMARY KEY, grant_id TEXT NOT NULL, request_id TEXT NOT NULL,
          request_hash TEXT NOT NULL, subject TEXT NOT NULL,
          base_revision INTEGER NOT NULL, template_hash TEXT NOT NULL,
          patch_json TEXT NOT NULL, expires_at INTEGER NOT NULL,
          applied_revision INTEGER, backup_id INTEGER,
          UNIQUE(grant_id,request_id));
        CREATE TABLE IF NOT EXISTS agent_backups (
          id INTEGER PRIMARY KEY, change_id TEXT UNIQUE NOT NULL,
          subject TEXT NOT NULL, revision INTEGER NOT NULL,
          state_json TEXT NOT NULL, updated_at TEXT NOT NULL);
        """)


def fail(code, status=422):
    raise HTTPException(status_code=status, detail={"status": "not_applied", "code": code})


async def read_model(request, model):
    if request.headers.get("content-type", "").split(";")[0].strip().lower() != "application/json":
        fail("json_required", 415)
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > MAX_REQUEST:
            fail("request_too_large", 413)
    try:
        return model.model_validate(json.loads(body))
    except (ValidationError, ValueError, UnicodeDecodeError):
        fail("invalid_request")


def install_routes(app, db, connect, owner_authorize, enabled, template_dir, clock=time.time):
    def ready():
        if not enabled:
            fail("private_plan_channel_not_enabled", 503)

    def actor(con, authorization):
        ready()
        raw = authorization[7:] if authorization and authorization.startswith("Bearer ") else ""
        token_hash = hashlib.sha256(raw.encode()).hexdigest()
        grant = con.execute("SELECT * FROM agent_grants WHERE token_hash=?", (token_hash,)).fetchone()
        if not raw.startswith("banya_plan_") or not grant or grant["revoked"] or grant["expires_at"] <= int(clock()):
            fail("invalid_or_expired_plan_key", 401)
        return grant

    def scope(grant, subject, start, end, permission="plan:read"):
        if subject not in json.loads(grant["subjects"]) or permission not in json.loads(grant["permissions"]):
            fail("permission_denied", 403)
        if not valid_date(start) or not valid_date(end) or not grant["date_start"] <= start <= end <= grant["date_end"]:
            fail("date_outside_grant", 403)

    def snapshot(con, subject):
        row = con.execute("SELECT * FROM snapshots WHERE subject=?", (subject,)).fetchone()
        if not row:
            fail("phone_first_sync_required", 409)
        document = json.loads(row["state_json"])
        template, digest = load_template(template_dir, subject)
        if document.get("templateVersion") != template["meta"]["planVersion"]:
            fail("phone_template_sync_required", 409)
        return row, document, template, digest

    def receipt(change):
        return {"changeId": change["id"], "subject": change["subject"],
                "status": "applied" if change["applied_revision"] is not None else
                          "expired" if change["expires_at"] <= int(clock()) else "prepared",
                "baseRevision": change["base_revision"], "revision": change["applied_revision"],
                "backupId": change["backup_id"], "expiresAt": change["expires_at"],
                "mobileDelivery": "awaiting_phone_sync" if change["applied_revision"] is not None else "not_sent"}

    @app.exception_handler(PlanError)
    async def plan_error(_request, error):
        return JSONResponse(status_code=error.status, content={"detail": {"status": "not_applied", "code": error.code}})

    @app.exception_handler(sqlite3.DatabaseError)
    async def storage_error(_request, _error):
        # Do not leak SQL, parameters or learning records; a lost commit response is ambiguous.
        return JSONResponse(status_code=503, content={"detail": {
            "status": "unknown", "code": "storage_unavailable_check_change_status_before_retry"}})

    @app.get("/v1/agent/openapi.json")
    def schema():
        ready()
        return json.loads(Path(__file__).with_name("agent-openapi.json").read_text())

    @app.post("/v1/agent/grants")
    async def create_grant(request: Request, authorization: str | None = Header(default=None)):
        ready()
        owner_authorize(authorization)
        settings = await read_model(request, Grant)
        if "plan:read" not in settings.permissions or len(set(settings.subjects)) != len(settings.subjects) or len(set(settings.permissions)) != len(settings.permissions):
            fail("invalid_scope")
        if not valid_date(settings.start) or not valid_date(settings.end) or settings.start > settings.end:
            fail("invalid_date_range")
        for subject in settings.subjects:
            template, _ = load_template(template_dir, subject)
            if not template["meta"]["start"] <= settings.start <= settings.end <= template["meta"]["end"]:
                fail("date_outside_template")
        raw = "banya_plan_" + secrets.token_urlsafe(48)
        grant_id, now = secrets.token_hex(16), int(clock())
        expires = now + settings.expiresDays * 86400
        with closing(connect(db)) as con:
            con.execute("BEGIN IMMEDIATE")
            if con.execute("SELECT count(*) FROM agent_grants WHERE revoked=0 AND expires_at>?", (now,)).fetchone()[0] >= 20:
                fail("active_grant_limit", 409)
            con.execute("INSERT INTO agent_grants VALUES (?,?,?,?,?,?,?,?,?)",
                        (grant_id, hashlib.sha256(raw.encode()).hexdigest(), json.dumps(settings.subjects),
                         json.dumps(settings.permissions), settings.start, settings.end, expires, 0, now))
            con.execute("COMMIT")
        return {"grantId": grant_id, "accessKey": raw, "expiresAt": expires,
                "subjects": settings.subjects, "permissions": settings.permissions}

    @app.get("/v1/agent/grants")
    def list_grants(authorization: str | None = Header(default=None)):
        ready()
        owner_authorize(authorization)
        with closing(connect(db)) as con:
            rows = con.execute("SELECT id,subjects,permissions,date_start,date_end,expires_at,revoked FROM agent_grants ORDER BY created_at DESC").fetchall()
        return {"grants": [{"grantId": row["id"], "subjects": json.loads(row["subjects"]),
                             "permissions": json.loads(row["permissions"]), "start": row["date_start"],
                             "end": row["date_end"], "expiresAt": row["expires_at"], "revoked": bool(row["revoked"])} for row in rows]}

    @app.post("/v1/agent/grants/{grant_id}/revoke")
    def revoke_grant(grant_id: str, authorization: str | None = Header(default=None)):
        ready()
        owner_authorize(authorization)
        with closing(connect(db)) as con:
            result = con.execute("UPDATE agent_grants SET revoked=1 WHERE id=?", (grant_id,))
        if not result.rowcount:
            fail("grant_not_found", 404)
        return {"status": "revoked", "grantId": grant_id}

    @app.get("/v1/agent/capabilities")
    def capabilities(authorization: str | None = Header(default=None)):
        with closing(connect(db)) as con:
            grant = actor(con, authorization)
        return {"subjects": json.loads(grant["subjects"]), "permissions": json.loads(grant["permissions"]),
                "start": grant["date_start"], "end": grant["date_end"], "expiresAt": grant["expires_at"]}

    @app.get("/v1/agent/plans/{subject}")
    def read_plan(subject: str, start: str, end: str, authorization: str | None = Header(default=None),
                  offset: int = Query(default=0, ge=0, le=10000), limit: int = Query(default=20, ge=1, le=25),
                  expected_revision: int | None = Query(default=None, alias="expectedRevision", ge=1)):
        with closing(connect(db)) as con:
            grant = actor(con, authorization)
            scope(grant, subject, start, end)
            if (date_value(end) - date_value(start)).days > 30:
                fail("read_at_most_31_days")
            row, document, template, _ = snapshot(con, subject)
            if offset and expected_revision is None:
                fail("paged_read_requires_revision")
            if expected_revision is not None and row["revision"] != expected_revision:
                fail("revision_conflict", 409)
        record = document["record"]
        tasks = effective_tasks(template, record, subject)
        ordered = [task for task in sorted(tasks.values(), key=lambda t: (t["date"], t["id"])) if start <= task["date"] <= end]
        page = []
        for task in ordered[offset:offset + limit]:
            candidate = public_task(task, record)
            if len(json.dumps(page + [candidate], ensure_ascii=False).encode()) > 60000:
                break
            page.append(candidate)
        return {"subject": subject, "revision": row["revision"], "templateVersion": template["meta"]["planVersion"],
                "tasks": page, "nextOffset": offset + len(page) if offset + len(page) < len(ordered) else None,
                "source": "private_server_snapshot", "phoneMayHaveOfflineChanges": True}

    @app.post("/v1/agent/plans/{subject}/preview")
    async def preview(subject: str, request: Request, authorization: str | None = Header(default=None)):
        ready()
        payload = await read_model(request, Preview)
        if any(any(value is None for value in task.model_dump(exclude_unset=True).values()) for task in payload.tasks):
            fail("null_task_field")
        patch = [item.model_dump(exclude_unset=True) for item in payload.tasks]
        if any(item.get("title") is not None and not item["title"].strip() for item in patch):
            fail("empty_title")
        if any(item["operation"] == "update" and not set(item) & {"date", "title", "detail", "minutes"} for item in patch):
            fail("empty_change")
        request_hash = hashlib.sha256(json.dumps(payload.model_dump(), sort_keys=True).encode()).hexdigest()
        with closing(connect(db)) as con:
            con.execute("BEGIN IMMEDIATE")
            grant = actor(con, authorization)
            scope(grant, subject, grant["date_start"], grant["date_end"], "plan:write")
            existing = con.execute("SELECT * FROM agent_changes WHERE grant_id=? AND request_id=?", (grant["id"], payload.requestId)).fetchone()
            if existing:
                if existing["subject"] != subject or not hmac.compare_digest(existing["request_hash"], request_hash):
                    fail("request_id_reused_with_different_change", 409)
                return receipt(existing)
            row, document, template, template_hash = snapshot(con, subject)
            if row["revision"] != payload.expectedRevision or template["meta"]["planVersion"] != payload.templateVersion:
                fail("revision_or_template_conflict", 409)
            _, changes = apply_patch(template, document, subject, patch, grant["date_start"], grant["date_end"])
            if len(json.dumps(changes, ensure_ascii=False).encode()) > 90000:
                fail("preview_response_too_large_use_smaller_batch", 413)
            if con.execute("SELECT count(*) FROM agent_changes WHERE grant_id=? AND applied_revision IS NULL AND expires_at>?", (grant["id"], int(clock()))).fetchone()[0] >= 50:
                fail("pending_change_limit", 409)
            change_id, expires = secrets.token_hex(24), min(int(clock()) + 600, grant["expires_at"])
            con.execute("INSERT INTO agent_changes (id,grant_id,request_id,request_hash,subject,base_revision,template_hash,patch_json,expires_at) VALUES (?,?,?,?,?,?,?,?,?)",
                        (change_id, grant["id"], payload.requestId, request_hash, subject, row["revision"], template_hash, json.dumps(patch, ensure_ascii=False), expires))
            con.execute("COMMIT")
        return {"status": "prepared", "changeId": change_id, "subject": subject, "baseRevision": row["revision"],
                "expiresAt": expires, "changes": changes, "instruction": "Show the proposed changes; commit only after the user explicitly confirms sync."}

    @app.get("/v1/agent/changes/{change_id}")
    def change_status(change_id: str, authorization: str | None = Header(default=None)):
        with closing(connect(db)) as con:
            grant = actor(con, authorization)
            change = con.execute("SELECT * FROM agent_changes WHERE id=? AND grant_id=?", (change_id, grant["id"])).fetchone()
            if not change:
                fail("change_not_found", 404)
            result = receipt(change)
            current = con.execute("SELECT revision FROM snapshots WHERE subject=?", (change["subject"],)).fetchone()
            if result["status"] == "prepared" and (not current or current["revision"] != change["base_revision"]):
                result["status"] = "conflict"
            if result["status"] == "prepared":
                try:
                    _, template_hash = load_template(template_dir, change["subject"])
                    if template_hash != change["template_hash"]:
                        result["status"] = "conflict"
                except PlanError:
                    result["status"] = "conflict"
        return result

    @app.post("/v1/agent/changes/{change_id}/commit")
    async def commit(change_id: str, request: Request, authorization: str | None = Header(default=None)):
        ready()
        payload = await read_model(request, Commit)
        with closing(connect(db)) as con:
            con.execute("BEGIN IMMEDIATE")
            grant = actor(con, authorization)
            change = con.execute("SELECT * FROM agent_changes WHERE id=? AND grant_id=?", (change_id, grant["id"])).fetchone()
            if not change:
                fail("change_not_found", 404)
            scope(grant, change["subject"], grant["date_start"], grant["date_end"], "plan:write")
            if payload.expectedRevision != change["base_revision"]:
                fail("revision_conflict", 409)
            if change["applied_revision"] is not None:
                return receipt(change)
            if change["expires_at"] <= int(clock()):
                fail("preview_expired", 409)
            row, document, template, template_hash = snapshot(con, change["subject"])
            if row["revision"] != change["base_revision"] or template_hash != change["template_hash"]:
                fail("revision_or_template_conflict", 409)
            updated_document, _ = apply_patch(template, document, change["subject"], json.loads(change["patch_json"]), grant["date_start"], grant["date_end"])
            encoded = json.dumps(updated_document, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
            if len(encoded.encode()) > 524_288:
                fail("snapshot_too_large", 413)
            updated = row["revision"] + 1
            # The exact previous document is durable in the same transaction BEFORE replacement.
            backup = con.execute("INSERT INTO agent_backups(change_id,subject,revision,state_json,updated_at) VALUES(?,?,?,?,?)",
                                 (change_id, change["subject"], row["revision"], row["state_json"], row["updated_at"]))
            con.execute("INSERT INTO history(subject,revision,state_json,updated_at) VALUES(?,?,?,?)",
                        (change["subject"], row["revision"], row["state_json"], row["updated_at"]))
            con.execute("DELETE FROM history WHERE subject=? AND id NOT IN (SELECT id FROM history WHERE subject=? ORDER BY id DESC LIMIT 30)", (change["subject"], change["subject"]))
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc).isoformat(timespec="seconds")
            con.execute("UPDATE snapshots SET revision=?,state_json=?,updated_at=? WHERE subject=?", (updated, encoded, now, change["subject"]))
            con.execute("UPDATE agent_changes SET applied_revision=?,backup_id=? WHERE id=?", (updated, backup.lastrowid, change_id))
            result = receipt(con.execute("SELECT * FROM agent_changes WHERE id=?", (change_id,)).fetchone())
            con.execute("COMMIT")
        return result


def date_value(value):
    from datetime import date
    return date.fromisoformat(value)
