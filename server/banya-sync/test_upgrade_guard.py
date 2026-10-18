"""Synthetic private databases only; no production access."""
import sqlite3

import pytest

from app import initialize
from agent_api import initialize_agent
from upgrade_guard import create_verified_backup, verify_preserved


def sample(tmp_path):
    db = tmp_path / 'db'
    initialize(db)
    with sqlite3.connect(db) as con:
        con.execute("INSERT INTO snapshots VALUES ('english',1,?,?)", ('synthetic private snapshot', 'synthetic timestamp'))
        con.execute("INSERT INTO history(subject,revision,state_json,updated_at) VALUES ('politics',1,?,?)", ('synthetic private history', 'synthetic timestamp'))
    return db


def test_additive_tables_preserve_all_existing_records(tmp_path):
    db = sample(tmp_path)
    saved = create_verified_backup(db, tmp_path / 'backups')
    assert saved.stat().st_mode & 0o777 == 0o600
    initialize_agent(db)
    verify_preserved(db, saved)
    # Repeated upgrades must also protect pre-existing authorizations and receipts.
    saved_again = create_verified_backup(db, tmp_path / 'backups')
    initialize_agent(db)
    verify_preserved(db, saved_again)


@pytest.mark.parametrize('table', ['snapshots', 'history'])
def test_modified_learning_data_stops_verification_without_restoring(tmp_path, table):
    db = sample(tmp_path)
    saved = create_verified_backup(db, tmp_path / 'backups')
    with sqlite3.connect(db) as con:
        con.execute(f"UPDATE {table} SET state_json='synthetic later record'")
    with pytest.raises(RuntimeError, match='Private data changed'):
        verify_preserved(db, saved)
    with sqlite3.connect(db) as con:
        assert con.execute(f'SELECT state_json FROM {table}').fetchone()[0] == 'synthetic later record'


def test_upgrade_must_not_mint_authorizations(tmp_path):
    db = sample(tmp_path)
    saved = create_verified_backup(db, tmp_path / 'backups')
    initialize_agent(db)
    with sqlite3.connect(db) as con:
        con.execute("INSERT INTO agent_grants VALUES ('synthetic','synthetic','[]','[]','x','x',1,0,1)")
    with pytest.raises(RuntimeError, match='unexpectedly created'):
        verify_preserved(db, saved)


def test_corrupt_backup_is_rejected(tmp_path):
    db = sample(tmp_path)
    corrupt = tmp_path / 'corrupt'
    corrupt.write_bytes(b'not a database')
    with pytest.raises(sqlite3.DatabaseError):
        verify_preserved(db, corrupt)


def test_upgrade_guard_preserves_ai_receipts_and_rejects_unexpected_creation(tmp_path):
    from deepseek_ai import initialize_ai
    db=sample(tmp_path)
    saved=create_verified_backup(db,tmp_path/'backups')
    initialize_ai(db)
    verify_preserved(db,saved)
    with sqlite3.connect(db) as con:
        con.execute("INSERT INTO ai_requests(id,body_hash,subject,base_revision,template_hash,date_start,date_end,status,cost_nano,month,created_at,expires_at) VALUES ('synthetic','synthetic','english',1,'synthetic','x','x','discussion',1,'synthetic',1,1)")
    with pytest.raises(RuntimeError,match='unexpectedly created'):
        verify_preserved(db,saved)
    existing=create_verified_backup(db,tmp_path/'backups')
    verify_preserved(db,existing)
    with sqlite3.connect(db) as con:con.execute("UPDATE ai_requests SET cost_nano=2")
    with pytest.raises(RuntimeError,match='Private data changed'):
        verify_preserved(db,existing)
