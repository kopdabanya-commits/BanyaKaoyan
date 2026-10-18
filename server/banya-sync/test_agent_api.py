"""Synthetic data only; never contacts production or stores user schedules."""
import copy
import hashlib
import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import create_app

OWNER = "test-owner-" + "x" * 48
OWNER_AUTH = {"Authorization": "Bearer " + OWNER}
PROTO = {**OWNER_AUTH, "X-Banya-Plan-Protocol": "1"}


def document(subject="english"):
    return {"schema": "banya.sync.v1", "subject": subject, "templateVersion": "synthetic-v1", "record": {
        "done": {"protected-done": True}, "notDone": {"protected-skip": True},
        "notes": {"protected-done": "synthetic private note"}, "wrong": {"protected-skip": 2},
        "questionIds": {"protected-skip": "2,4"}, "actualMinutes": {"protected-skip": 33},
        "actualWritingMinutes": {"protected-skip": 21}, "actualReviewMinutes": {"protected-skip": 12},
        "edits": {}, "moved": {}, "added": [], "archive": {}, "settings": {"vocab": 35, "budget": 130}}}


def template(subject):
    return {"meta": {"planVersion": "synthetic-v1", "start": "2026-10-16", "end": "2026-12-18"}, "days": [
        {"date": "2026-10-20", "items": [{"id": task_id, "title": "Synthetic practice", "minutes": 10,
                                         "type": "阅读" if subject == "english" else "刷题", "detail": "Synthetic guidance"}
                                        for task_id in ("task-a", "protected-done", "protected-skip")]},
        {"date": "2026-10-21", "items": [{"id": "task-b", "title": "Another practice", "minutes": 10,
                                         "type": "阅读" if subject == "english" else "刷题", "detail": "Synthetic guidance"}]}]}


@pytest.fixture
def channel(tmp_path):
    for subject, filename in [("english", "plan.json"), ("politics", "politics-plan.json")]:
        (tmp_path / filename).write_text(json.dumps(template(subject)))
    db = tmp_path / "sync.sqlite3"
    app = create_app(db_path=db, token_sha256=hashlib.sha256(OWNER.encode()).hexdigest(),
                     agent_enabled=True, template_dir=tmp_path)
    with TestClient(app) as client:
        for subject in ("english", "politics"):
            assert client.put("/v1/snapshot/" + subject, headers=OWNER_AUTH,
                              json={"expectedRevision": 0, "state": document(subject)}).status_code == 200
        yield client, db, tmp_path


def mint(client, **overrides):
    settings = {"subjects": ["english"], "permissions": ["plan:read", "plan:write"],
                "start": "2026-10-20", "end": "2026-10-21", "expiresDays": 7, **overrides}
    response = client.post("/v1/agent/grants", headers=OWNER_AUTH, json=settings)
    assert response.status_code == 200, response.text
    grant = response.json()
    return {"Authorization": "Bearer " + grant["accessKey"]}, grant


def prepare(client, auth, tasks=None, **overrides):
    payload = {"expectedRevision": 1, "templateVersion": "synthetic-v1", "requestId": "synthetic-request-1",
               "tasks": tasks or [{"operation": "update", "taskId": "task-a", "date": "2026-10-21",
                                   "title": "Private changed task", "detail": "Private task content", "minutes": 25}], **overrides}
    return client.post("/v1/agent/plans/english/preview", headers=auth, json=payload)


def commit(client, auth, change_id, revision=1):
    return client.post(f"/v1/agent/changes/{change_id}/commit", headers=auth,
                       json={"expectedRevision": revision, "confirmation": "sync"})


def read_snapshot(client, subject="english"):
    return client.get("/v1/snapshot/" + subject, headers=PROTO).json()


def test_disabled_channel_does_not_create_tables_or_change_existing_api(tmp_path):
    with TestClient(create_app(db_path=tmp_path / "db", token_sha256=hashlib.sha256(OWNER.encode()).hexdigest())) as client:
        assert client.get("/health").status_code == 200
        assert client.get("/v1/agent/openapi.json").status_code == 503
        assert client.get("/v1/agent/capabilities").status_code == 503
    with sqlite3.connect(tmp_path / "db") as con:
        assert not con.execute("SELECT name FROM sqlite_master WHERE name LIKE 'agent_%'").fetchall()


def test_keys_are_separate_hashed_scoped_and_revocable(channel):
    client, db, _ = channel
    auth, grant = mint(client)
    assert client.get("/v1/agent/capabilities", headers=OWNER_AUTH).status_code == 401
    assert client.get("/v1/snapshot/english", headers=auth).status_code == 401
    assert client.get("/v1/agent/grants", headers=auth).status_code == 401
    assert client.get("/v1/agent/plans/politics?start=2026-10-20&end=2026-10-21", headers=auth).status_code == 403
    assert client.get("/v1/agent/plans/english?start=2026-10-19&end=2026-10-20", headers=auth).status_code == 403
    listing = client.get("/v1/agent/grants", headers=OWNER_AUTH)
    assert grant["accessKey"] not in listing.text and "token_hash" not in listing.text
    with sqlite3.connect(db) as con:
        assert con.execute("SELECT token_hash FROM agent_grants").fetchone()[0] == hashlib.sha256(grant["accessKey"].encode()).hexdigest()
    assert client.post(f'/v1/agent/grants/{grant["grantId"]}/revoke', headers=OWNER_AUTH).status_code == 200
    assert client.get("/v1/agent/capabilities", headers=auth).status_code == 401


def test_read_projects_only_necessary_tasks_and_status(channel):
    client, _, _ = channel
    auth, _ = mint(client, permissions=["plan:read"])
    response = client.get("/v1/agent/plans/english?start=2026-10-20&end=2026-10-20", headers=auth)
    assert response.status_code == 200
    payload = response.json()
    assert payload["revision"] == 1 and payload["phoneMayHaveOfflineChanges"]
    assert len(payload["tasks"]) == 3
    assert {t["status"] for t in payload["tasks"]} == {"completed", "not_doing", "pending"}
    assert "synthetic private note" not in response.text and "questionIds" not in response.text
    assert prepare(client, auth).status_code == 403


def test_preview_commit_backup_receipt_and_subject_isolation(channel):
    client, db, _ = channel
    auth, _ = mint(client)
    original, politics = read_snapshot(client), read_snapshot(client, "politics")
    preview = prepare(client, auth)
    assert preview.status_code == 200, preview.text
    change_id = preview.json()["changeId"]
    assert preview.json()["status"] == "prepared" and read_snapshot(client) == original
    result = commit(client, auth, change_id)
    assert result.status_code == 200, result.text
    receipt = result.json()
    assert receipt["status"] == "applied" and receipt["revision"] == 2 and receipt["backupId"]
    assert receipt["mobileDelivery"] == "awaiting_phone_sync"
    modified = read_snapshot(client)
    expected = copy.deepcopy(original["state"])
    expected["requiredCapabilities"] = ["private-plan-v1"]
    expected["record"]["edits"]["task-a"] = {"title": "Private changed task", "detail": "Private task content", "minutes": 25}
    expected["record"]["moved"]["task-a"] = "2026-10-21"
    assert modified["state"] == expected
    assert read_snapshot(client, "politics") == politics
    with sqlite3.connect(db) as con:
        backup = con.execute("SELECT state_json,revision FROM agent_backups WHERE id=?", (receipt["backupId"],)).fetchone()
        assert json.loads(backup[0]) == original["state"] and backup[1] == 1
        assert con.execute("SELECT count(*) FROM history WHERE subject='english'").fetchone()[0] == 1
    # A lost response can be resolved or retried without performing a second write.
    assert client.get(f"/v1/agent/changes/{change_id}", headers=auth).json() == receipt
    assert commit(client, auth, change_id).json() == receipt
    assert read_snapshot(client)["revision"] == 2


@pytest.mark.parametrize("task_id", ["protected-done", "protected-skip"])
def test_completed_and_not_doing_tasks_are_immutable_for_agent(channel, task_id):
    client, _, _ = channel
    auth, _ = mint(client)
    before = read_snapshot(client)
    response = prepare(client, auth, tasks=[{"operation": "update", "taskId": task_id, "minutes": 12}])
    assert response.status_code == 409
    assert read_snapshot(client) == before


def test_phone_race_and_preview_idempotency(channel):
    client, _, _ = channel
    auth, _ = mint(client)
    first = prepare(client, auth).json()
    assert prepare(client, auth).json()["changeId"] == first["changeId"]
    assert prepare(client, auth, tasks=[{"operation": "update", "taskId": "task-a", "minutes": 20}]).status_code == 409
    state = read_snapshot(client)["state"]
    state["record"]["notes"]["task-a"] = "new offline note"
    assert client.put("/v1/snapshot/english", headers=OWNER_AUTH, json={"expectedRevision": 1, "state": state}).status_code == 200
    assert commit(client, auth, first["changeId"]).status_code == 409
    assert client.get('/v1/agent/changes/' + first["changeId"], headers=auth).json()["status"] == "conflict"
    assert read_snapshot(client)["state"] == state


def test_old_phone_cannot_drop_new_private_overlays(channel):
    client, _, _ = channel
    auth, _ = mint(client)
    change_id = prepare(client, auth).json()["changeId"]
    assert commit(client, auth, change_id).status_code == 200
    assert client.get("/v1/snapshot/english", headers=OWNER_AUTH).status_code == 426
    assert client.get("/v1/snapshot/english?plan_protocol=1", headers=OWNER_AUTH).status_code == 200
    latest = read_snapshot(client)["state"]
    latest.pop("requiredCapabilities")
    assert client.put("/v1/snapshot/english", headers=OWNER_AUTH, json={"expectedRevision": 2, "state": latest}).status_code == 426
    assert client.put("/v1/snapshot/english", headers=PROTO, json={"expectedRevision": 2, "state": latest}).status_code == 200
    assert read_snapshot(client)["state"]["requiredCapabilities"] == ["private-plan-v1"]
    assert commit(client, auth, change_id).json()["revision"] == 2
    assert read_snapshot(client)["revision"] == 3


def test_template_changes_and_wrong_phone_template_stop_mutations(channel):
    client, _, directory = channel
    auth, _ = mint(client)
    change_id = prepare(client, auth).json()["changeId"]
    path = directory / "plan.json"
    path.write_text(path.read_text() + "\n")
    assert commit(client, auth, change_id).status_code == 409
    template_data = json.loads(path.read_text());template_data["meta"]["planVersion"] = "new-template"
    path.write_text(json.dumps(template_data))
    assert client.get("/v1/agent/plans/english?start=2026-10-20&end=2026-10-21", headers=auth).status_code == 409


def test_expired_grants_changes_and_cross_grant_access(channel):
    client, db, _ = channel
    auth, grant = mint(client)
    change_id = prepare(client, auth).json()["changeId"]
    other, _ = mint(client)
    assert commit(client, other, change_id).status_code == 404
    with sqlite3.connect(db) as con:
        con.execute("UPDATE agent_changes SET expires_at=0")
    assert commit(client, auth, change_id).status_code == 409
    assert client.get('/v1/agent/changes/' + change_id, headers=auth).json()["status"] == "expired"
    with sqlite3.connect(db) as con:
        con.execute("UPDATE agent_grants SET expires_at=0 WHERE id=?", (grant["grantId"],))
    assert client.get("/v1/agent/capabilities", headers=auth).status_code == 401


@pytest.mark.parametrize("operation", [
    {"operation": "update", "taskId": "task-a", "notes": "cannot write notes"},
    {"operation": "update", "taskId": "task-a", "done": True},
    {"operation": "update", "taskId": "task-a", "minutes": True},
    {"operation": "update", "taskId": "task-a", "minutes": None},
    {"operation": "update", "taskId": "__proto__", "minutes": 20},
    {"operation": "update", "taskId": "task-a", "date": "2026-02-31"},
    {"operation": "update", "taskId": "task-a", "date": "2026-10-22"},
    {"operation": "update", "taskId": "task-a", "title": " "},
    {"operation": "update", "taskId": "task-a", "type": "阅读"},
    {"operation": "update", "taskId": "task-a"},
    {"operation": "add", "taskId": "protected-skip", "date": "2026-10-21", "title": "fake", "type": "阅读", "minutes": 20},
])
def test_invalid_patches_never_mutate_records(channel, operation):
    client, _, _ = channel
    auth, _ = mint(client)
    original = read_snapshot(client)
    assert prepare(client, auth, tasks=[operation]).status_code in (403, 422)
    assert read_snapshot(client) == original


def test_added_tasks_are_private_and_batch_is_atomic(channel):
    client, _, _ = channel
    auth, _ = mint(client)
    task = {"operation": "add", "taskId": "custom-synthetic", "date": "2026-10-21", "title": "Synthetic extra practice", "type": "阅读", "minutes": 20}
    preview = prepare(client, auth, tasks=[task])
    assert preview.status_code == 200
    assert commit(client, auth, preview.json()["changeId"]).status_code == 200
    added = read_snapshot(client)["state"]["record"]["added"][0]
    assert added["custom"] is True and added["id"] == "custom-synthetic"
    assert prepare(client, auth, tasks=[task], expectedRevision=2, requestId="new-request-id").status_code == 422


def test_budget_backup_failure_and_concurrent_commits(channel):
    client, db, _ = channel
    auth, _ = mint(client)
    # The batch would exceed the vocabulary-inclusive day budget.
    assert prepare(client, auth, tasks=[{"operation": "update", "taskId": "task-a", "minutes": 90},
                                      {"operation": "update", "taskId": "task-b", "date": "2026-10-20", "minutes": 40}]).status_code == 409
    one = prepare(client, auth).json()["changeId"]
    two = prepare(client, auth, requestId="second-request-id").json()["changeId"]
    with sqlite3.connect(db) as con:
        con.execute("CREATE TRIGGER test_fail_backup BEFORE INSERT ON agent_backups BEGIN SELECT RAISE(ABORT, 'test-only'); END")
    failed = commit(client, auth, one)
    assert failed.status_code == 503 and failed.json()["detail"]["status"] == "unknown"
    assert read_snapshot(client)["revision"] == 1
    with sqlite3.connect(db) as con:
        con.execute("DROP TRIGGER test_fail_backup")
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda change_id: commit(client, auth, change_id).status_code, (one, two)))
    assert sorted(results) == [200, 409]
    with sqlite3.connect(db) as con:
        assert con.execute("SELECT count(*) FROM agent_backups").fetchone()[0] == 1


def test_schema_is_restricted_and_write_confirmation_is_consequential(channel):
    client, _, _ = channel
    schema = client.get("/v1/agent/openapi.json").json()
    assert len(schema["paths"]) == 5
    assert not any("snapshot" in path or "grants" in path for path in schema["paths"])
    commit_op = schema["paths"]["/v1/agent/changes/{change_id}/commit"]["post"]
    assert commit_op["x-openai-isConsequential"] is True
    assert commit_op["security"] == [{"PrivatePlanKey": []}]
    assert "accessKey" not in json.dumps(schema)
    auth, _ = mint(client)
    assert client.post("/v1/agent/plans/english/preview", headers={**auth, "Content-Type": "application/json"}, content=b" " * 65537).status_code == 413
    assert client.get("/v1/agent/capabilities").status_code == 401


def test_politics_move_and_content_change_preserve_all_english_data(channel):
    client, _, _ = channel
    auth, _ = mint(client, subjects=["politics"])
    before, english = read_snapshot(client, "politics"), read_snapshot(client)
    payload = {"expectedRevision": 1, "templateVersion": "synthetic-v1", "requestId": "politics-change-id",
               "tasks": [{"operation": "update", "taskId": "task-a", "date": "2026-10-21", "detail": "New synthetic guidance"}]}
    preview = client.post("/v1/agent/plans/politics/preview", headers=auth, json=payload)
    assert preview.status_code == 200, preview.text
    assert commit(client, auth, preview.json()["changeId"]).status_code == 200
    after = read_snapshot(client, "politics")["state"]
    assert after["record"]["moved"]["task-a"] == "2026-10-21"
    assert after["record"]["edits"]["task-a"] == {"detail": "New synthetic guidance"}
    for field in ("done", "notDone", "notes", "questionIds", "actualMinutes", "actualWritingMinutes", "actualReviewMinutes"):
        assert before["state"]["record"][field] == after["record"][field]
    assert read_snapshot(client) == english


def test_no_empty_snapshot_is_invented_for_unused_subject(channel):
    client, db, _ = channel
    auth, _ = mint(client, subjects=["politics"])
    with sqlite3.connect(db) as con:
        con.execute("DELETE FROM snapshots WHERE subject='politics'")
    response = client.get("/v1/agent/plans/politics?start=2026-10-20&end=2026-10-21", headers=auth)
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "phone_first_sync_required"
    assert read_snapshot(client, "politics")["revision"] == 0


def test_paged_reads_pin_revision_and_action_limits(channel):
    client, _, directory = channel
    auth, _ = mint(client)
    path = '/v1/agent/plans/english?start=2026-10-20&end=2026-10-21&limit=1'
    first = client.get(path, headers=auth).json()
    assert len(first['tasks']) == 1 and first['nextOffset'] == 1
    assert client.get(path + '&offset=1', headers=auth).status_code == 422
    second = client.get(path + '&offset=1&expectedRevision=1', headers=auth).json()
    assert first['tasks'][0]['id'] != second['tasks'][0]['id']
    assert client.get(path + '&expectedRevision=2', headers=auth).status_code == 409
    schema = client.get('/v1/agent/openapi.json').json()
    assert all(len(operation['description']) <= 300 for path in schema['paths'].values() for operation in path.values())
    template_data = template('english')
    template_data['days'][0]['items'][0]['detail'] = 'x' * 4000
    (directory / 'plan.json').write_text(json.dumps(template_data))
    page = client.get(path, headers=auth)
    assert len(page.content) < 100000
