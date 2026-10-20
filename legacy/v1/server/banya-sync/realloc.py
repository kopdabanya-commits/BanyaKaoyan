"""Deterministic module reallocation for the private plan.

The plan is treated as a set of modules (type + minutes). A user instruction only changes
the *constraints* (window, daily capacity, skipped days); this module decides the layout
with review-friendly rules, so the result never depends on what a model happens to emit:

- every movable module keeps its type and minutes (nothing is invented or deleted);
- modules of the same type are spread across days instead of being stacked;
- heavier types take the earlier days of the window;
- a day never exceeds the daily non-vocabulary budget;
- completed / not-doing / past modules are never moved and never lose their records.

The engine only returns operations for ``apply_patch``; it never writes.
"""
from __future__ import annotations

import copy
from datetime import date, timedelta

from private_plan import PlanError, effective_tasks, protected

DEFAULT_DAILY_MINUTES = 135
MIN_DAILY_MINUTES = 5


def _window_days(start: str, end: str, skip: set[str]) -> list[date]:
    first, last = date.fromisoformat(start), date.fromisoformat(end)
    days, cursor = [], first
    while cursor <= last:
        if cursor.isoformat() not in skip:
            days.append(cursor)
        cursor += timedelta(days=1)
    return days


def plan_reallocation(template, document, subject, start, end, *,
                      daily_max: int | None = None, skip_dates=(), today=None):
    """Return ``(operations, report)`` without mutating anything."""
    record = document.get("record") or {}
    if not isinstance(record, dict):
        raise PlanError("invalid_snapshot", 409)
    budget = daily_max if isinstance(daily_max, int) else DEFAULT_DAILY_MINUTES
    budget = max(MIN_DAILY_MINUTES, min(DEFAULT_DAILY_MINUTES, budget))
    skip = {value for value in skip_dates if isinstance(value, str)}
    if today is None:
        today_iso = date.today().isoformat()
    elif isinstance(today, str):
        today_iso = today
    else:
        today_iso = today.isoformat()

    tasks = effective_tasks(template, record, subject)
    movable = [task for task in tasks.values()
               if start <= task["date"] <= end and task["date"] >= today_iso
               and not protected(record, task["id"])]
    if not movable:
        raise PlanError("nothing_to_reallocate", 409)
    movable_ids = {task["id"] for task in movable}
    original_dates = {task["id"]: task["date"] for task in movable}

    days = _window_days(start, end, skip)
    if not days:
        raise PlanError("no_available_day", 409)

    # Modules that stay put still consume the day's capacity.
    load = {day.isoformat(): 0 for day in days}
    for task in tasks.values():
        if task["id"] in movable_ids:
            continue
        if task["date"] in load:
            load[task["date"]] += task["minutes"]

    queues: dict[str, list[dict]] = {}
    for task in sorted(movable, key=lambda item: (item["date"], item["id"])):
        queues.setdefault(task["type"], []).append(copy.deepcopy(task))
    counts = {kind: len(items) for kind, items in queues.items()}
    # Heavier types claim the earliest days, so the week starts with the demanding work.
    order = sorted(queues, key=lambda kind: (-max(item["minutes"] for item in queues[kind]), kind))

    placed: list[dict] = []
    for kind in order:
        queue = queues[kind]
        cursor = 0
        idle = 0
        while queue:
            key = days[cursor % len(days)].isoformat()
            head = queue[0]
            if load[key] + head["minutes"] <= budget:
                queue.pop(0)
                load[key] += head["minutes"]
                head["date"] = key
                placed.append(head)
                idle = 0
            else:
                idle += 1
                if idle >= len(days):
                    raise PlanError("realloc_capacity_exceeded", 409)
            cursor += 1

    operations = [{"operation": "update", "taskId": task["id"], "date": task["date"]}
                  for task in sorted(placed, key=lambda item: item["id"])
                  if task["date"] != original_dates[task["id"]]]
    moved = len(operations)
    report = {
        "window": {"start": start, "end": end, "days": len(days), "skipped": sorted(skip)},
        "dailyBudget": budget,
        "modules": len(movable),
        "moved": moved,
        "perType": counts,
        "perDay": [{"date": day.isoformat(), "minutes": load[day.isoformat()],
                    "tasks": sum(1 for task in placed if task["date"] == day.isoformat())}
                   for day in days],
    }
    return operations, report
