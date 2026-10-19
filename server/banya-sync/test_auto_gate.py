import sqlite3
import pytest
from auto_gate import render, assert_inactive


def test_gate_preserves_credentials_budget_and_activation_stamp():
    before = 'DEEPSEEK_API_KEY=synthetic\nBANYA_AI_CONFIG_REVISION=synthetic\nDEEPSEEK_MONTHLY_BUDGET_CNY=17\nBANYA_AUTO_ENABLED=0\nBANYA_DB_PATH=synthetic\n'
    after = render(before, True)
    assert after == before.replace('BANYA_AUTO_ENABLED=0\n', '') + 'BANYA_AUTO_ENABLED=1\n'
    assert render(after, False).endswith('BANYA_AUTO_ENABLED=0\n')
    with pytest.raises(ValueError):
        render(before, '1')


@pytest.mark.parametrize('active', ['master', 'subject', 'pending', None])
def test_gate_never_resumes_existing_permissions_or_pending_call(tmp_path, active):
    db = tmp_path / 'synthetic.sqlite3'
    with sqlite3.connect(db) as con:
        con.executescript('CREATE TABLE auto_control(enabled); CREATE TABLE auto_permissions(enabled); CREATE TABLE ai_requests(status);')
        con.execute('INSERT INTO auto_control VALUES (?)', (int(active == 'master'),))
        con.execute('INSERT INTO auto_permissions VALUES (?)', (int(active == 'subject'),))
        con.execute('INSERT INTO ai_requests VALUES (?)', ('pending' if active == 'pending' else 'discussion',))
    before = db.read_bytes()
    if active:
        with pytest.raises(ValueError):
            assert_inactive(db)
    else:
        assert_inactive(db)
    assert db.read_bytes() == before
