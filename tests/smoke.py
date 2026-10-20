"""本地/CI 冒烟：计划读写、版本冲突、一句话调整。使用假模型，不产生费用。"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "http://127.0.0.1:8801"
HEADERS = {"Authorization": "Bearer testtoken", "Content-Type": "application/json"}


def call(method, path, body=None):
    request = urllib.request.Request(
        BASE + path, method=method, headers=HEADERS,
        data=None if body is None else json.dumps(body).encode())
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)


def wait_ready():
    for _ in range(40):
        try:
            if call("GET", "/health")[0] == 200:
                return True
        except Exception:
            pass
        time.sleep(0.25)
    return False


def main() -> int:
    work = tempfile.mkdtemp(prefix="banya-smoke-")
    env = dict(os.environ, BANYA_V2_FAKE="1", BANYA_V2_TOKEN="testtoken",
               BANYA_V2_DB=os.path.join(work, "v2.sqlite3"))
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8801"],
        cwd=os.path.join(ROOT, "server"), env=env,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        assert wait_ready(), "server did not start"
        assert call("GET", "/plan") == (200, {"revision": 0, "tasks": []})

        task = {"id": "t1", "date": "2026-10-21", "title": "翻译", "type": "翻译",
                "minutes": 30, "done": False, "notDone": False, "subject": "english"}
        assert call("PUT", "/plan", {"expectedRevision": 0, "tasks": [task]}) == (200, {"revision": 1})

        status, payload = call("PUT", "/plan", {"expectedRevision": 0, "tasks": [task]})
        assert status == 409 and payload["revision"] == 1 and payload["tasks"][0]["id"] == "t1"

        status, payload = call("POST", "/adjust", {"instruction": "明天没空", "today": "2026-10-20",
                                                   "subject": "english", "tasks": [task]})
        assert status == 200, payload
        assert payload["tasks"][0]["date"] == "2026-10-22"
        assert payload["changes"][0]["kind"] == "move"

        print("smoke ok")
        return 0
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
