"""Synthetic module reallocation tests. No model call, no private record."""
import hashlib
import json

import pytest
from fastapi.testclient import TestClient

from app import create_app
from realloc import plan_reallocation
from test_agent_api import OWNER, OWNER_AUTH, PROTO, document

VERSION = "synthetic-v1"


def week_template(days=7, reading=40, translation=25):
    rows = []
    for index in range(days):
        day = f"2026-10-{20 + index:02d}"
        rows.append({"date": day, "items": [
            {"id": f"read-{index}", "title": "Synthetic reading", "minutes": reading,
             "type": "阅读", "detail": "Synthetic guidance"},
            {"id": f"trans-{index}", "title": "Synthetic translation", "minutes": translation,
             "type": "翻译", "detail": "Synthetic guidance"},
        ]})
    return {"meta": {"planVersion": VERSION, "start": "2026-10-20", "end": "2026-11-30"}, "days": rows}


def empty_record():
    return {"done": {}, "notDone": {}, "notes": {}, "wrong": {}, "questionIds": {},
            "actualMinutes": {}, "edits": {}, "moved": {}, "added": [], "removed": {},
            "archive": {}, "settings": {}}


def doc_for(record=None):
    return {"schema": "banya.sync.v1", "subject": "english", "templateVersion": VERSION,
            "record": record or empty_record()}


def test_engine_spreads_types_and_respects_daily_budget():
    operations, report = plan_reallocation(week_template(), doc_for(), "english",
                                           "2026-10-20", "2026-10-26", daily_max=90, today="2026-10-19")
    assert report["modules"] == 14 and report["perType"] == {"阅读": 7, "翻译": 7}
    assert all(day["minutes"] <= 90 for day in report["perDay"])
    # Interleaving: each day holds one module per type (40 + 25 = 65 <= 90).
    assert all(day["tasks"] == 2 and day["minutes"] == 65 for day in report["perDay"])
    assert sum(day["minutes"] for day in report["perDay"]) == 7 * 40 + 7 * 25


def test_engine_never_touches_completed_not_doing_or_past_modules():
    record = empty_record()
    record["done"] = {"read-0": True}
    record["notDone"] = {"trans-1": True}
    operations, report = plan_reallocation(week_template(), doc_for(record), "english",
                                           "2026-10-20", "2026-10-26", daily_max=135, today="2026-10-19")
    moved_ids = {item["taskId"] for item in operations}
    assert "read-0" not in moved_ids and "trans-1" not in moved_ids
    assert report["modules"] == 12


def test_engine_refuses_when_capacity_cannot_hold_modules():
    with pytest.raises(Exception) as caught:
        plan_reallocation(week_template(), doc_for(), "english", "2026-10-20", "2026-10-21",
                          daily_max=5, today="2026-10-19")
    assert "realloc_capacity_exceeded" in str(caught.value)


@pytest.fixture
def app_with_plan(tmp_path):
    (tmp_path / "plan.json").write_text(json.dumps(week_template()))
    (tmp_path / "politics-plan.json").write_text(json.dumps(
        {"meta": {"planVersion": VERSION, "start": "2026-10-20", "end": "2026-11-30"}, "days": []}))
    app = create_app(db_path=tmp_path / "db", token_sha256=hashlib.sha256(OWNER.encode()).hexdigest(),
                     template_dir=tmp_path)
    with TestClient(app) as client:
        assert client.put("/v1/snapshot/english", headers=OWNER_AUTH,
                          json={"expectedRevision": 0, "state": doc_for()}).status_code == 200
        yield client, tmp_path


def reallocate(client, **overrides):
    body = {"subject": "english", "start": "2026-10-20", "end": "2026-10-26",
            "expectedRevision": 1, "dailyMax": 90, **overrides}
    return client.post("/v1/plan/reallocate", headers=OWNER_AUTH, json=body)


def test_reallocation_preview_does_not_write(app_with_plan):
    client, _ = app_with_plan
    response = reallocate(client)
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "preview" and payload["report"]["modules"] == 14
    assert client.get("/v1/snapshot/english", headers=PROTO).json()["revision"] == 1


def test_reallocation_apply_writes_one_revision_and_preserves_records(app_with_plan):
    client, _ = app_with_plan
    applied = reallocate(client, apply=True, confirmation="reallocate_plan")
    assert applied.status_code == 200
    payload = applied.json()
    assert payload["status"] == "applied" and payload["revision"] == 2
    current = client.get("/v1/snapshot/english", headers=PROTO).json()
    assert current["revision"] == 2
    record = current["state"]["record"]
    assert record["done"] == {} and record["notDone"] == {}
    assert current["state"]["requiredCapabilities"] == ["private-plan-v1"]


def test_reallocation_requires_confirmation_and_current_revision(app_with_plan):
    client, _ = app_with_plan
    assert reallocate(client, apply=True).status_code == 422
    assert reallocate(client, expectedRevision=99).status_code == 409
    assert reallocate(client, subject="chemistry").status_code == 404
