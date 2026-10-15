import hashlib
import json
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import HISTORY_KEEP, create_app

SECRET = "a" * 48
DIGEST = hashlib.sha256(SECRET.encode()).hexdigest()
ORIGIN = "https://english-ii-plan.kopdabanya.workers.dev"


@pytest.fixture
def api(tmp_path: Path):
    service = create_app(db_path=tmp_path / "sync.sqlite3",
                         token_sha256=DIGEST, allowed_origin=ORIGIN)
    with TestClient(service) as client:
        yield client, tmp_path / "sync.sqlite3"


def auth():
    return {"Authorization": f"Bearer {SECRET}"}


def pack(subject, record):
    return {"schema": "banya.sync.v1", "subject": subject, "record": record}


def test_fails_closed_on_missing_or_insecure_auth(tmp_path):
    for value in ["", "hello", "0" * 55]:
        with pytest.raises(RuntimeError):
            create_app(db_path=tmp_path / "db.sqlite", token_sha256=value)


def test_health_and_empty_snapshot(api):
    client, _ = api
    assert client.get("/health").json()["ok"] is True
    result = client.get("/v1/snapshot/english", headers=auth())
    assert result.status_code == 200
    assert result.json() == {"subject": "english", "revision": 0, "state": None, "updatedAt": None}
    assert result.headers["cache-control"] == "no-store"
    assert client.get("/v1/snapshot/politics").status_code == 401


def test_auth_and_origin(api):
    client, _ = api
    assert client.get("/v1/snapshot/english", headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.get("/v1/snapshot/math", headers=auth()).status_code == 404
    ok = client.options("/v1/snapshot/english", headers={
        "Origin": ORIGIN, "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "authorization,content-type"})
    assert ok.status_code == 200 and ok.headers["access-control-allow-origin"] == ORIGIN
    nope = client.options("/v1/snapshot/english", headers={
        "Origin": "https://evil.example", "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "authorization,content-type"})
    assert nope.status_code != 200
    assert nope.headers.get("access-control-allow-origin") is None


def test_subjects_isolated_and_cas_conflict(api):
    client, path = api
    s1 = {"done": {"en-1": True}, "notes": {"en-1": "中文笔记"}}
    s2 = {"done": {"pol-1": True}, "notes": {}, "questions": {"marx": {"done": 93, "total": 396, "updated": "2026-10-15"}}}
    a = client.put("/v1/snapshot/english", headers=auth(), json={"expectedRevision": 0, "state": pack("english", s1)})
    assert a.status_code == 200 and a.json()["revision"] == 1
    b = client.put("/v1/snapshot/politics", headers=auth(), json={"expectedRevision": 0, "state": pack("politics", s2)})
    assert b.status_code == 200 and b.json()["revision"] == 1
    assert client.get("/v1/snapshot/english", headers=auth()).json()["state"] == pack("english", s1)
    assert client.get("/v1/snapshot/politics", headers=auth()).json()["state"] == pack("politics", s2)
    stale = client.put("/v1/snapshot/english", headers=auth(), json={
        "expectedRevision": 0, "state": pack("english", {"done": {"en-1": False}, "notes": {}})})
    assert stale.status_code == 409
    assert client.get("/v1/snapshot/english", headers=auth()).json()["state"] == s1
    next_rev = client.put("/v1/snapshot/english", headers=auth(), json={
        "expectedRevision": 1, "state": {"done": {"en-1": False}}})
    assert next_rev.json()["revision"] == 2
    with sqlite3.connect(path) as con:
        old = con.execute("SELECT state_json FROM history WHERE subject='english'").fetchone()[0]
        assert json.loads(old) == pack("english", s1)
    assert client.get("/v1/snapshot/politics", headers=auth()).json()["state"] == s2


def test_invalid_types_large_body_and_wrong_content_type(api):
    client, _ = api
    base = "/v1/snapshot/politics"
    assert client.put(base, headers=auth(), json={"expectedRevision": True, "state": {}}).status_code == 422
    assert client.put(base, headers=auth(), json={"expectedRevision": 0, "state": []}).status_code == 422
    assert client.put(base, headers=auth(), content=b"x",).status_code == 415
    assert client.put(base, headers={**auth(), "Content-Type": "application/json"},
                      content=b"{invalid").status_code == 400
    huge = json.dumps({"expectedRevision": 0, "state": {"note": "X" * 550000}}).encode()
    assert client.put(base, headers={**auth(), "Content-Type": "application/json"},
                      content=huge).status_code == 413


def test_revision_history_bounded(api):
    client, path = api
    for i in range(HISTORY_KEEP + 5):
        res = client.put("/v1/snapshot/english", headers=auth(), json={
            "expectedRevision": i, "state": pack("english", {"done": {}, "notes": {"counter": str(i)}})})
        assert res.status_code == 200
    with sqlite3.connect(path) as con:
        assert con.execute("SELECT count(*) FROM history").fetchone()[0] == HISTORY_KEEP
    assert client.get("/v1/snapshot/english", headers=auth()).json()["state"] == {
        "counter": HISTORY_KEEP + 4}


def test_reject_blank_and_cross_subject_payloads(api):
    client, _ = api
    url = "/v1/snapshot/english"
    for bad in [{}, pack("politics", {"done": {}, "notes": {}}),
                pack("english", {"done": [], "notes": {}}),
                pack("english", {"done": {}, "notes": []})]:
        response = client.put(url, headers=auth(), json={"expectedRevision": 0, "state": bad})
        assert response.status_code == 422
    assert client.get(url, headers=auth()).json()["revision"] == 0
