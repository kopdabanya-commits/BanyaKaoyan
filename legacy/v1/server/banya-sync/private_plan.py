"""Task-scoped private overlays. Never accepts learning-record replacement."""
from __future__ import annotations

import copy
import hashlib
import json
from datetime import date
from pathlib import Path

SUBJECT_TYPES = {
    "english": {"写作", "新题型", "翻译", "完形", "阅读", "复盘", "机动", "综合", "模考"},
    "politics": {"课程", "刷题", "复盘", "模拟", "背诵"},
}
PROTOCOL = "private-plan-v1"


class PlanError(ValueError):
    def __init__(self, code: str, status: int = 422):
        self.code, self.status = code, status
        super().__init__(code)


def valid_date(value):
    try:
        return isinstance(value, str) and date.fromisoformat(value).isoformat() == value
    except ValueError:
        return False


def load_template(directory: Path, subject: str):
    if subject not in SUBJECT_TYPES:
        raise PlanError("unknown_subject", 404)
    path = directory / ("plan.json" if subject == "english" else "politics-plan.json")
    try:
        raw = path.read_bytes()
        template = json.loads(raw)
        assert template["meta"]["planVersion"] and isinstance(template["days"], list)
    except (OSError, ValueError, KeyError, AssertionError, TypeError):
        raise PlanError("template_unavailable", 503)
    return template, hashlib.sha256(raw).hexdigest()


def effective_tasks(template: dict, record: dict, subject: str):
    if any(not isinstance(record.get(field, {}), dict) for field in
           ("done", "notDone", "notes", "wrong", "questionIds", "actualMinutes", "actualWritingMinutes", "actualReviewMinutes", "edits", "moved", "archive", "removed", "settings")):
        raise PlanError("invalid_snapshot_overlay", 409)
    if not isinstance(record.get("added", []), list) or any(not isinstance(edit, dict) for edit in record.get("edits", {}).values()):
        raise PlanError("invalid_snapshot_overlay", 409)
    tasks = {}
    for day in template["days"]:
        for item in day["items"]:
            tasks[item["id"]] = {**item, "date": day["date"]}
    for item in record.get("added", []):
        if item["id"] in tasks:
            raise PlanError("duplicate_task_id", 409)
        tasks[item["id"]] = copy.deepcopy(item)
    if subject == "english":
        for task_id, item in record.get("archive", {}).items():
            if task_id not in tasks:
                tasks[task_id] = copy.deepcopy(item)
    result = {}
    for task_id, item in tasks.items():
        if item.get("retired") or record.get("removed", {}).get(task_id):
            continue
        result[task_id] = {**item, **record.get("edits", {}).get(task_id, {}),
                           "date": record.get("moved", {}).get(task_id, item["date"])}
    return result


def protected(record, task_id):
    return bool(record.get("done", {}).get(task_id) or record.get("notDone", {}).get(task_id))


def public_task(task, record):
    task_id = task["id"]
    result = {key: task[key] for key in ("id", "date", "title", "minutes", "type", "detail") if key in task}
    if isinstance(result.get("detail"), str) and len(result["detail"]) > 3000:
        result["detail"] = result["detail"][:3000]
        result["detailTruncated"] = True
    result["status"] = ("completed" if record.get("done", {}).get(task_id) else
                        "not_doing" if record.get("notDone", {}).get(task_id) else "pending")
    # Notes and precise wrong-question IDs are deliberately outside plan access.
    result["recordedTimes"] = {key: record[key][task_id] for key in
                               ("actualMinutes", "actualWritingMinutes", "actualReviewMinutes")
                               if task_id in record.get(key, {})}
    return result


def apply_patch(template, document, subject, operations, start, end, *, policy=None, require_budget=False):
    if document.get("schema") != "banya.sync.v1" or document.get("subject") != subject:
        raise PlanError("invalid_snapshot", 409)
    if document.get("templateVersion") != template["meta"]["planVersion"]:
        raise PlanError("phone_template_sync_required", 409)
    record = document.get("record")
    if not isinstance(record, dict):
        raise PlanError("invalid_snapshot", 409)
    tasks = effective_tasks(template, record, subject)
    next_document = copy.deepcopy(document)
    target = next_document["record"]
    seen, changes, affected = set(), [], set()
    for operation in operations:
        task_id, kind = operation["taskId"], operation["operation"]
        if task_id in seen or task_id in {"__proto__", "constructor", "prototype"}:
            raise PlanError("duplicate_or_invalid_task")
        seen.add(task_id)
        before = tasks.get(task_id)
        if kind == "delete":
            # Deleting only ever removes a plan task from the private overlay. Learning
            # records (done, notDone, notes, times) are never touched and history is kept.
            if before is None:
                raise PlanError("task_not_found", 404)
            if protected(record, task_id):
                raise PlanError("completed_or_not_doing_task_is_protected", 409)
            if before["date"] < date.today().isoformat():
                raise PlanError("past_task_cannot_be_deleted", 403)
            if not start <= before["date"] <= end:
                raise PlanError("source_date_outside_grant", 403)
            target.setdefault("removed", {})[task_id] = True
            target.get("edits", {}).pop(task_id, None)
            target.get("moved", {}).pop(task_id, None)
            tasks.pop(task_id, None)
            affected.add(before["date"])
            changes.append({"taskId": task_id, "before": public_task(before, record), "after": None})
            continue
        if kind == "update":
            if before is None:
                raise PlanError("task_not_found", 404)
            if protected(record, task_id):
                raise PlanError("completed_or_not_doing_task_is_protected", 409)
            if not start <= before["date"] <= end:
                raise PlanError("source_date_outside_grant", 403)
            if "type" in operation:
                raise PlanError("task_type_cannot_change")
            after = {**before, **{key: value for key, value in operation.items()
                                  if key in {"date", "title", "minutes", "detail"}}}
        else:
            prefix = "custom-" if subject == "english" else "p-custom-"
            if before is not None or not task_id.startswith(prefix):
                raise PlanError("new_task_requires_unique_custom_id")
            # Never resurrect a removed, retired, or previously recorded ID.
            used = set(record.get("archive", {})) | set(record.get("removed", {}))
            for field in ("done", "notDone", "wrong", "questionIds", "notes", "actualMinutes", "actualWritingMinutes", "actualReviewMinutes"):
                used.update(record.get(field, {}))
            used.update(item["id"] for day in template["days"] for item in day["items"])
            used.update(item["id"] for item in record.get("added", []))
            if task_id in used:
                raise PlanError("new_task_requires_unique_custom_id")
            if not {"date", "title", "minutes", "type"} <= operation.keys():
                raise PlanError("incomplete_new_task")
            after = {key: operation[key] for key in ("date", "title", "minutes", "type", "detail") if key in operation}
            after.update(id=task_id, detail=after.get("detail", ""))
            if subject == "english":
                after["custom"] = True
        if not valid_date(after["date"]) or not start <= after["date"] <= end or not template["meta"]["start"] <= after["date"] <= template["meta"]["end"]:
            raise PlanError("destination_date_outside_grant", 403)
        if after["type"] not in SUBJECT_TYPES[subject]:
            raise PlanError("invalid_task_type")
        if kind == "update":
            edit = target.setdefault("edits", {}).setdefault(task_id, {})
            for key in ("title", "minutes", "detail"):
                if key in operation:
                    edit[key] = operation[key]
            # A total-duration change must not leave stale scheduled writing parts.
            if "minutes" in operation and operation["minutes"] != before["minutes"]:
                edit.pop("writingMinutes", None)
                edit.pop("reviewMinutes", None)
                after.pop("writingMinutes", None)
                after.pop("reviewMinutes", None)
            if not edit:
                target["edits"].pop(task_id)
            if "date" in operation:
                target.setdefault("moved", {})[task_id] = after["date"]
        else:
            limit = 5000 if subject == "english" else 500
            if len(target.get("added", [])) >= limit:
                raise PlanError("custom_task_limit")
            target.setdefault("added", []).append(after)
        tasks[task_id] = after
        affected.add(after["date"])
        if before: affected.add(before["date"])
        changes.append({"taskId": task_id, "before": public_task(before, record) if before else None,
                        "after": public_task(after, target)})
    for day in affected:
        day_tasks = [item for item in tasks.values() if item["date"] == day]
        total = sum(item["minutes"] for item in day_tasks)
        limit = 135
        if subject == "english":
            if not any(item.get("type")=="单词" or item["id"] == day + "-vocab" for item in day_tasks):
                total += record.get("settings", {}).get("vocab", 35)
            limit = min(135, max(130, record.get("settings", {}).get("budget", 130)))
        if total > limit:
            raise PlanError("day_budget_exceeded", 409)
    if policy is not None:
        from learning_policy import validate_limits
        validate_limits(tasks,target,subject,affected,policy,require_budget=require_budget)
    next_document["requiredCapabilities"] = sorted(set(document.get("requiredCapabilities", [])) | {PROTOCOL})
    return next_document, changes
