"""把旧版 v1 的学习记录转换成 v2 任务表。

输入：旧版 SQLite（snapshots.state_json）+ legacy/v1 的模板计划
输出：{"tasks": [...]}，可直接 PUT /api/plan 或粘贴导入
只读，不修改任何旧数据。
"""
import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEGACY = ROOT / "legacy" / "v1"
TYPES = {"阅读", "翻译", "写作", "完形", "新题型", "单词", "背诵", "刷题", "复盘", "课程", "其他"}


def load_template(subject: str) -> dict:
    name = "plan.json" if subject == "english" else "politics-plan.json"
    return json.loads((LEGACY / name).read_text(encoding="utf-8"))


def build(subject: str, state: dict) -> list[dict]:
    template = load_template(subject)
    record = state.get("record") or {}
    edits = record.get("edits") or {}
    moved = record.get("moved") or {}
    removed = record.get("removed") or {}
    done = record.get("done") or {}
    not_done = record.get("notDone") or {}
    notes = record.get("notes") or {}
    actual = record.get("actualMinutes") or {}
    stamp = int(datetime.now(timezone.utc).timestamp() * 1000)
    tasks = []

    def add(item_id, date, title, kind, minutes, detail=""):
        tasks.append({
            "id": f"{subject}-{item_id}"[:80],
            "subject": subject,
            "date": date,
            "title": (title or "任务")[:300],
            "type": kind if kind in TYPES else "其他",
            "minutes": max(5, min(240, int(minutes or 30))),
            "done": bool(done.get(item_id)),
            "notDone": bool(not_done.get(item_id)),
            "actualMinutes": int(actual[item_id]) if item_id in actual else None,
            "note": notes.get(item_id, "")[:300] if isinstance(notes.get(item_id), str) else "",
            "updatedAt": stamp,
        })

    for day in template["days"]:
        for item in day["items"]:
            item_id = item["id"]
            if removed.get(item_id):
                continue
            edit = edits.get(item_id) or {}
            date = moved.get(item_id, day["date"])
            add(item_id, date, edit.get("title", item.get("title")),
                item.get("type"), edit.get("minutes", item.get("minutes")),
                edit.get("detail", item.get("detail", "")))

    for item in record.get("added") or []:
        item_id = item.get("id")
        if not item_id or removed.get(item_id):
            continue
        add(item_id, item.get("date"), item.get("title"), item.get("type"), item.get("minutes"))

    tasks.sort(key=lambda t: (t["date"], t["title"]))
    return tasks


def main(db_path: str) -> int:
    result = {"tasks": [], "summary": {}}
    with sqlite3.connect(f"file:{db_path}?mode=ro", uri=True) as con:
        con.row_factory = sqlite3.Row
        for subject in ("english", "politics"):
            row = con.execute("SELECT state_json FROM snapshots WHERE subject=?", (subject,)).fetchone()
            if not row:
                result["summary"][subject] = 0
                continue
            tasks = build(subject, json.loads(row["state_json"]))
            result["tasks"].extend(tasks)
            result["summary"][subject] = {
                "tasks": len(tasks),
                "done": sum(1 for t in tasks if t["done"]),
                "notDone": sum(1 for t in tasks if t["notDone"]),
                "actualMinutes": sum(t["actualMinutes"] or 0 for t in tasks),
                "first": tasks[0]["date"] if tasks else None,
                "last": tasks[-1]["date"] if tasks else None,
            }
    out = ROOT / "migration.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(result["summary"], ensure_ascii=False, indent=1))
    print("written:", out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1]))
