"""一次性任务安排：复用服务器现有 /plan API，不直接写数据库。不要输出用户计划或密钥。"""
import base64
import os
import shlex
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = "124.70.128.201"
REMOTE = r'''
import json
import re
import secrets
import sqlite3
import time
from datetime import datetime, timedelta
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from zoneinfo import ZoneInfo

TODAY = "2026-10-30"
if datetime.now(ZoneInfo("Asia/Shanghai")).date().isoformat() != TODAY:
    raise SystemExit("日期不再是目标日期，未修改计划")
CONFIG = Path("/var/www/banya-v2/current/config.js").read_text(encoding="utf-8").strip()
PREFIX = "window.BANYA_CONFIG = "
if not CONFIG.startswith(PREFIX) or not CONFIG.endswith(";"):
    raise SystemExit("同步配置格式不匹配，未修改计划")
TOKEN = json.loads(CONFIG[len(PREFIX):-1]).get("token", "")
if not TOKEN:
    raise SystemExit("缺少现有同步令牌，未修改计划")
API = "http://127.0.0.1:8766/plan"
def request(method, payload=None):
    raw = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
    req = Request(API, data=raw, method=method, headers={
        "Authorization": "Bearer " + TOKEN, "Content-Type": "application/json",
    })
    try:
        with urlopen(req, timeout=12) as res:
            return res.status, json.load(res)
    except HTTPError as err:
        if err.code == 409:
            return 409, json.loads(err.read())
        raise

def active(t):
    return not t.get("deleted") and not t.get("notDone")
def pending(t):
    return active(t) and not t.get("done")
def essay(t):
    return t.get("subject") == "english" and re.search(r"大作文|图表作文", str(t.get("title", ""))) is not None
def minutes(t):
    return max(0, int(t.get("minutes") or 0))
def total(tasks, date):
    return sum(minutes(t) for t in tasks if t.get("date") == date and active(t))

def proposal(tasks):
    now_ms = int(time.time() * 1000)
    todays = [t for t in tasks if essay(t) and t.get("date") == TODAY and pending(t)]
    shifts = 0
    if todays:
        chosen = todays[0]
        mode = "PRIORITIZED"
    else:
        future = sorted(
            (t for t in tasks if essay(t) and pending(t) and t.get("date", "") > TODAY),
            key=lambda t: t["date"]
        )
        if future:
            chosen = future[0]
            chosen["date"] = TODAY
            chosen["updatedAt"] = now_ms
            mode = "RESCHEDULED"
        else:
            used = {int(m.group(1)) for t in tasks if essay(t) and active(t) and t.get("done")
                    if (m := re.search(r"20\d{2}", str(t.get("title", ""))))}
            year = next((y for y in range(2015, 2024) if y not in used), 2023)
            chosen = {
                "id": "eng-essay-" + TODAY + "-" + secrets.token_hex(5),
                "subject": "english", "date": TODAY,
                "title": f"英语二·大作文 {year} 独立写作",
                "type": "写作", "minutes": 30,
                "done": False, "notDone": False,
                "score": None, "actualMinutes": None,
                "note": "", "updatedAt": now_ms,
            }
            tasks.append(chosen)
            mode = "ADDED"
    # 将今天要写的大作文排到今天英语任务首位；不碰其他已完成记录。
    tasks.remove(chosen)
    tasks.insert(0, chosen)
    chosen["updatedAt"] = now_ms

    # 保证英语 + 政治合计不超过每日150分钟。
    # 只顺延尚未完成、且非大作文的今日任务，绝不改已完成/不做记录。
    while total(tasks, TODAY) > 150:
        movable = [t for t in tasks if t is not chosen and pending(t)
                   and t.get("date") == TODAY and t.get("subject") == "english"]
        if not movable:
            raise ValueError("今日超过150分钟，且没有可安全顺延的任务；未修改")
        movable.sort(key=lambda t: (
            0 if re.search(r"复盘|错题|回顾", str(t.get("title", ""))) else 1,
            -minutes(t),
        ))
        task = movable[0]
        day = datetime.strptime(TODAY, "%Y-%m-%d").date()
        options = []
        for i in range(1, 31):
            target = (day + timedelta(days=i)).isoformat()
            load = total(tasks, target)
            if load + minutes(task) <= 150:
                # 优先塞进已有学习安排的日期，避免占用休息日。
                options.append((load == 0, i, target))
        if not options:
            raise ValueError("后续30天无法满足150分钟上限；未修改")
        target = min(options)[2]
        task["date"] = target
        task["updatedAt"] = now_ms
        shifts += 1
    return mode, shifts

backup_done = False
for attempt in range(3):
    status, plan = request("GET")
    if status != 200 or not isinstance(plan.get("tasks"), list):
        raise RuntimeError("读取计划失败，未修改")
    original = plan["tasks"]
    tasks = json.loads(json.dumps(original))
    mode, shifts = proposal(tasks)
    if tasks == original:
        print("RESULT=ALREADY_SET")
        break
    if not backup_done:
        db = Path("/var/lib/banya-v2/v2.sqlite3")
        backups = Path("/var/lib/banya-v2/backups")
        backups.mkdir(mode=0o700, parents=True, exist_ok=True)
        dest = backups / ("manual-essay-" + TODAY + "-" + str(int(time.time())) + ".sqlite3")
        src = sqlite3.connect("file:" + str(db) + "?mode=ro", uri=True)
        out = sqlite3.connect(str(dest))
        try:
            src.backup(out)
        finally:
            out.close()
            src.close()
        dest.chmod(0o600)
        backup_done = True
    status, response = request("PUT", {"expectedRevision": plan["revision"], "tasks": tasks})
    if status == 409:
        continue
    if status != 200:
        raise RuntimeError("写入未成功")
    print("RESULT=" + mode)
    print("SHIFTED=" + str(shifts))
    print("BACKUP=YES")
    break
else:
    raise RuntimeError("云端版本连续冲突，已中止，未强制覆盖")
'''
def main():
    if os.environ.get("GITHUB_REF") != "refs/heads/main":
        raise SystemExit("只允许 main")
    password = os.environ.get("BANYA_ECS_PASSWORD", "")
    if not password:
        raise SystemExit("缺少生产部署凭据；未修改")
    ssh = paramiko.SSHClient()
    ssh.load_host_keys(str(ROOT / "deploy/known_hosts"))
    ssh.set_missing_host_key_policy(paramiko.RejectPolicy())
    ssh.connect(HOST, username="root", password=password, timeout=20,
                auth_timeout=20, banner_timeout=20, allow_agent=False, look_for_keys=False)
    try:
        script = base64.b64encode(REMOTE.encode("utf-8")).decode("ascii")
        command = "python3 -c " + shlex.quote(
            "import base64;exec(base64.b64decode(" + repr(script) + "))"
        )
        _, stdout, stderr = ssh.exec_command(command, timeout=50)
        result = stdout.read().decode("utf-8", "replace").strip()
        err = stderr.read().decode("utf-8", "replace").strip()
        code = stdout.channel.recv_exit_status()
        if code:
            # 不将异常堆栈或任何可能包含敏感内容的服务器输出发送到公开 Actions。
            raise RuntimeError("远端调整失败（退出码 " + str(code) + "），未确认写入；仅查看服务器私有日志")
        for line in result.splitlines():
            if line.startswith(("RESULT=", "SHIFTED=", "BACKUP=")):
                print(line)
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
