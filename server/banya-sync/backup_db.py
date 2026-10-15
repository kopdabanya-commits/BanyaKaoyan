"""Atomic SQLite online backup; intentionally stays inside private ECS data directory."""
from __future__ import annotations

import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path


def backup_once(db_path: Path, backup_dir: Path, keep: int = 30) -> Path:
    if not db_path.is_file():
        raise FileNotFoundError("Database not initialized; refusing empty backup")
    if keep < 1:
        raise ValueError("keep must be positive")
    backup_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(backup_dir, 0o700)
    suffix = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]
    destination = backup_dir / ("sync-" + suffix + ".sqlite3")
    temporary = backup_dir / ("." + destination.name + ".tmp")
    try:
        with sqlite3.connect("file:" + str(db_path) + "?mode=ro", uri=True, timeout=15) as src:
            with sqlite3.connect(temporary, timeout=15) as dst:
                src.backup(dst)
        os.chmod(temporary, 0o600)
        os.replace(temporary, destination)
        older = sorted(backup_dir.glob("sync-*.sqlite3"))
        for old in older[:-keep]:
            old.unlink()
    finally:
        if temporary.exists():
            temporary.unlink()
    return destination


if __name__ == "__main__":
    db = Path(os.environ.get("BANYA_DB_PATH", "/var/lib/banya-sync/sync.sqlite3"))
    saved = backup_once(db, db.parent / "backups")
    print("Private SQLite backup created:", saved.name)
