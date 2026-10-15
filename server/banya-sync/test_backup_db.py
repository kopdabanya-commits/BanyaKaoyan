import sqlite3
from pathlib import Path

import pytest
from backup_db import backup_once


def test_backup_is_consistent_and_retained(tmp_path: Path):
    db = tmp_path / "sync.sqlite3"
    with sqlite3.connect(db) as con:
        con.execute("CREATE TABLE records (subject TEXT, note TEXT)")
        con.execute("INSERT INTO records VALUES (?,?)", ("english", "one"))
    backup_dir = tmp_path / "backups"
    old = backup_once(db, backup_dir, keep=2)
    with sqlite3.connect(db) as con:
        con.execute("INSERT INTO records VALUES (?,?)", ("politics", "two"))
    new = backup_once(db, backup_dir, keep=2)
    with sqlite3.connect(old) as con:
        assert con.execute("SELECT count(*) FROM records").fetchone()[0] == 1
    with sqlite3.connect(new) as con:
        assert con.execute("SELECT count(*) FROM records").fetchone()[0] == 2
    backup_once(db, backup_dir, keep=2)
    assert len(list(backup_dir.glob("sync-*.sqlite3"))) == 2
    assert not list(backup_dir.glob(".*.tmp"))


def test_backup_fails_closed_without_database(tmp_path: Path):
    with pytest.raises(FileNotFoundError):
        backup_once(tmp_path / "missing.sqlite3", tmp_path / "backups")
