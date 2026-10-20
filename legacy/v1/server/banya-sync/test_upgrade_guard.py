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


def test_reviewed_release_installs_backup_and_preserves_fail_closed_controls():
    from pathlib import Path
    script=Path(__file__).with_name('upgrade-private-plan.sh').read_text()
    workflow=Path(__file__).parents[2]/'.github/workflows/private-plan-release.yml'
    assert 'app.py backup_db.py autonomous.py' in workflow.read_text()
    assert script.count('app.py backup_db.py autonomous.py') == 5
    from upgrade_guard import environment_for_upgrade
    for setting in ('BANYA_AI_ENABLED=0','BANYA_AUTO_ENABLED=0','DEEPSEEK_MONTHLY_BUDGET_USD=0','DEEPSEEK_MONTHLY_CALLS=0'):
        assert setting in environment_for_upgrade('', 'disable')
    assert 'ai_policy="${2:-disable}"' in script
    assert 'cmp "$previous/environment" /etc/banya-sync.env' in script
    assert script.index('verify "$backup_path"') < script.index('systemctl start banya-sync.service')
    assert script.index('cmp "$source_dir/$file"') < script.index('> /opt/banya-sync/RELEASE_SHA')
    assert '"$previous/RELEASE_SHA"' in script


def test_explicit_maintenance_preserves_approved_configuration_exactly():
    from upgrade_guard import environment_for_upgrade
    text='# synthetic protected configuration\nDEEPSEEK_API_KEY=configured\nBANYA_AI_CONFIG_REVISION=synthetic\nBANYA_AI_ENABLED=1\nBANYA_AUTO_ENABLED=1\nDEEPSEEK_BILLING_CURRENCY=CNY\nDEEPSEEK_MONTHLY_BUDGET_CNY=23\nDEEPSEEK_MONTHLY_CALLS=unlimited\n'
    assert environment_for_upgrade(text,'preserve-approved')==text
    assert 'BANYA_AI_ENABLED=0' in environment_for_upgrade(text,'disable')
    with pytest.raises(ValueError):environment_for_upgrade(text,'arbitrary')


@pytest.mark.parametrize('table',['ai_requests','auto_runs'])
def test_preserving_upgrade_refuses_pending_ai_requests_without_writing(tmp_path,table):
    from upgrade_guard import assert_quiescent
    db=tmp_path/'synthetic.sqlite3'
    with sqlite3.connect(db) as con:
        con.executescript('CREATE TABLE ai_requests(status); CREATE TABLE auto_runs(status);')
        con.execute(f"INSERT INTO {table} VALUES('pending')")
    before=db.read_bytes()
    with pytest.raises(RuntimeError,match='pending'):assert_quiescent(db)
    assert db.read_bytes()==before
