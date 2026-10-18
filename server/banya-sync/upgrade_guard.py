"""Private, on-server upgrade checks. Never prints records, credentials or digests."""
from __future__ import annotations

import sqlite3
import sys
from contextlib import closing
from pathlib import Path

from backup_db import backup_once

TABLES = ("snapshots", "history", "agent_grants", "agent_changes", "agent_backups", "ai_requests", "learning_profiles", "learning_profile_history", "learning_profile_requests", "learning_summaries", "auto_control", "auto_permissions", "auto_permission_history", "auto_events", "auto_runs")


def read_only(path):
    return sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True, timeout=15)


def intact(con):
    if con.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
        raise RuntimeError("Private database integrity verification failed")


def create_verified_backup(db_path, backup_dir):
    saved = backup_once(db_path, backup_dir)
    with closing(read_only(saved)) as con:
        intact(con)
    return saved


def verify_preserved(db_path, saved):
    with closing(read_only(saved)) as before, closing(read_only(db_path)) as after:
        intact(before)
        intact(after)
        old_tables = {row[0] for row in before.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        new_tables = {row[0] for row in after.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if not {"snapshots", "history"} <= old_tables:
            raise RuntimeError("Private backup lacks required tables")
        for table in TABLES:
            if table in old_tables:
                if table not in new_tables:
                    raise RuntimeError("An existing private table is missing")
                query = f'SELECT * FROM "{table}" ORDER BY rowid'
                if before.execute(query).fetchall() != after.execute(query).fetchall():
                    raise RuntimeError("Private data changed during upgrade; stop without replacing database")
            elif table in new_tables and after.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0]:
                raise RuntimeError("Upgrade unexpectedly created private authorization or changes")


if __name__ == "__main__":
    db = Path("/var/lib/banya-sync/sync.sqlite3")
    if sys.argv[1:] == ["backup"]:
        # Captured by the root script; not emitted to Actions logs.
        print(create_verified_backup(db, db.parent / "backups"))
    elif len(sys.argv) == 3 and sys.argv[1] == "verify":
        verify_preserved(db, Path(sys.argv[2]))
        print("Verified private backup integrity and exact preservation of existing records and authorizations.")
    else:
        raise SystemExit("Unsupported upgrade check")
