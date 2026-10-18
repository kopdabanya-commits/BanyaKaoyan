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


def test_failed_backup_keeps_last_good_copy_and_removes_temporary(tmp_path):
    db=tmp_path/'sync.sqlite3'
    with sqlite3.connect(db) as con:con.execute('CREATE TABLE synthetic(value TEXT)')
    backup_dir=tmp_path/'backups';good=backup_once(db,backup_dir,keep=1);before=good.read_bytes()
    with sqlite3.connect(db) as con:
        page=con.execute("SELECT rootpage FROM sqlite_master WHERE name='synthetic'").fetchone()[0]
        size=con.execute('PRAGMA page_size').fetchone()[0]
    data=bytearray(db.read_bytes());data[(page-1)*size]=255;db.write_bytes(data)
    with pytest.raises(sqlite3.DatabaseError):backup_once(db,backup_dir,keep=1)
    assert good.read_bytes()==before and list(backup_dir.glob('sync-*.sqlite3'))==[good]
    assert not list(backup_dir.glob('.*.tmp'))
    assert good.stat().st_mode&0o777==0o600
