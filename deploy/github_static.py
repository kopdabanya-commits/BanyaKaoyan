"""GitHub Actions 专用前端部署：不触碰 FastAPI、SQLite、AI 配置或 nginx。

凭据只从 GitHub Actions 的 BANYA_ECS_PASSWORD secret 读取。
保留线上 config.js，不打印、不下载同步 token。
"""
from __future__ import annotations

import json
import os
import re
import shlex
from datetime import datetime, timezone
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("BANYA_ECS_HOST", "124.70.128.201")
USER = os.environ.get("BANYA_ECS_USER", "root")
PASSWORD = os.environ.get("BANYA_ECS_PASSWORD", "")
KNOWN_HOSTS = ROOT / "deploy" / "known_hosts"
LIVE = "/var/www/banya-v2/current"
RELEASES = "/var/www/banya-v2/releases"
VERSION_FILE = "/opt/banya-v2/version.json"
FILES = (
    "index.html",
    "manifest.webmanifest",
    "sw.js",
    "assets/app.js",
    "assets/style.css",
    "assets/icon.svg",
    "assets/icon-192.png",
    "assets/icon-512.png",
    "assets/icon-maskable.png",
    "assets/apple-touch-icon.png",
)


def q(value: str) -> str:
    return shlex.quote(value)


def main() -> None:
    if os.environ.get("GITHUB_REF") != "refs/heads/main":
        raise SystemExit("只允许从 main 部署")
    sha = os.environ.get("GITHUB_SHA", "")
    run_id = os.environ.get("GITHUB_RUN_ID", "")
    attempt = os.environ.get("GITHUB_RUN_ATTEMPT", "1")
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise SystemExit("缺少有效 GitHub 提交 ID")
    if not run_id.isdecimal() or not attempt.isdecimal():
        raise SystemExit("缺少有效 GitHub Actions 运行编号")
    if not PASSWORD:
        raise SystemExit("缺少 BANYA_ECS_PASSWORD；未连接服务器，也未部署")
    if not KNOWN_HOSTS.is_file():
        raise SystemExit("未找到服务器主机指纹，拒绝 SSH 连接")
    for relative in FILES:
        if not (ROOT / relative).is_file():
            raise SystemExit(f"缺少必要前端文件：{relative}")

    name = f"gh-{run_id}-{attempt}-{sha[:8]}"
    stage = f"{RELEASES}/{name}"
    next_link = f"/var/www/banya-v2/.next-{name}"
    version_tmp = f"{VERSION_FILE}.next-{name}"
    version_backup = f"{VERSION_FILE}.backup-{name}"
    built_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    ssh = paramiko.SSHClient()
    ssh.load_host_keys(str(KNOWN_HOSTS))
    ssh.set_missing_host_key_policy(paramiko.RejectPolicy())
    ssh.connect(
        HOST, username=USER, password=PASSWORD,
        timeout=20, banner_timeout=20, auth_timeout=20,
        allow_agent=False, look_for_keys=False,
    )

    def run(command: str) -> str:
        _, stdout, stderr = ssh.exec_command("set -eu; " + command, timeout=40)
        result = stdout.read().decode("utf-8", "replace").strip()
        error = stderr.read().decode("utf-8", "replace").strip()
        code = stdout.channel.recv_exit_status()
        if code:
            raise RuntimeError(f"服务器操作失败（退出码 {code}）：{error[-350:]}")
        return result

    switched = False
    previous = ""
    version_backed_up = False
    sftp = None
    try:
        # 首次接入只接受已存在的 v2 服务，不执行初始化、不改数据库。
        run(f"test -L {q(LIVE)} && test -s {q(LIVE + '/config.js')}")
        run("test -f /etc/banya-v2.env && test -f /var/lib/banya-v2/v2.sqlite3")
        run("systemctl is-active --quiet banya-v2.service")
        run("curl -fsSk --max-time 12 -o /dev/null -H 'Host: 124.70.128.201' https://127.0.0.1/api/health")
        previous = run(f"readlink -f {q(LIVE)}")
        if not previous.startswith(RELEASES + "/"):
            raise RuntimeError("当前站点不在预期 releases 目录，停止部署")
        run(f"install -d -m 0755 {q(stage + '/assets')}")
        sftp = ssh.open_sftp()
        for relative in FILES:
            local = ROOT / relative
            dest = f"{stage}/{relative}"
            sftp.put(str(local), dest)
            if sftp.stat(dest).st_size != local.stat().st_size:
                raise RuntimeError(f"文件大小校验失败：{relative}")

        # config.js 含同步口令：只在远端复制，永远不通过 GitHub 下载或打印。
        run(f"cp -p {q(LIVE + '/config.js')} {q(stage + '/config.js')}")
        # 保留既有交接文档，避免旧链接失效。
        for relative in ("handoff.html", "handoff.js", "handoff.txt", "handoff.md"):
            source = f"{LIVE}/{relative}"
            dest = f"{stage}/{relative}"
            run(f"if [ -f {q(source)} ]; then cp -p {q(source)} {q(dest)}; fi")

        with sftp.open(version_tmp, "w") as handle:
            handle.write(json.dumps(
                {"version": sha[:12], "builtAt": built_at},
                ensure_ascii=False,
            ))
        run(f"if [ -f {q(VERSION_FILE)} ]; then cp -p {q(VERSION_FILE)} {q(version_backup)}; fi")
        version_backed_up = True

        # 先原子换静态站点；验证失败立即恢复旧软链及旧版本。
        run(f"ln -s {q(stage)} {q(next_link)} && mv -Tf {q(next_link)} {q(LIVE)}")
        switched = True
        run(f"curl -fsSk --max-time 12 -o /dev/null -H 'Host: 124.70.128.201' https://127.0.0.1/")
        run(f"curl -fsSk --max-time 12 -o /dev/null -H 'Host: 124.70.128.201' https://127.0.0.1/assets/app.js")
        run(f"curl -fsSk --max-time 12 -o /dev/null -H 'Host: 124.70.128.201' https://127.0.0.1/api/health")
        run(f"mv -f {q(version_tmp)} {q(VERSION_FILE)}")
        print(f"前端已部署：{sha[:12]}；服务器后端、数据库与 AI 配置未改动")
    except Exception:
        if switched:
            try:
                rollback = f"/var/www/banya-v2/.rollback-{name}"
                run(f"ln -s {q(previous)} {q(rollback)} && mv -Tf {q(rollback)} {q(LIVE)}")
                if version_backed_up:
                    run(f"if [ -f {q(version_backup)} ]; then cp -p {q(version_backup)} {q(VERSION_FILE)}; fi")
                print("前端已回滚到上一版本")
            except Exception as rollback_error:
                print(f"警告：自动回滚失败，需要人工检查：{type(rollback_error).__name__}")
        raise
    finally:
        if sftp is not None:
            sftp.close()
        ssh.close()


if __name__ == "__main__":
    main()
