"""M5-schema to M7.4 isolated rehearsal. Never opens production databases."""
import hashlib,json,sqlite3
from fastapi.testclient import TestClient
from app import create_app,initialize
from agent_api import initialize_agent
from deepseek_ai import AIConfig,initialize_ai,initialize_activation
from autonomous import initialize_auto
from learning_memory import initialize_memory
from upgrade_guard import create_verified_backup,verify_preserved
from test_agent_api import OWNER,OWNER_AUTH,PROTO,document,template
from test_learning_memory import entry,save,snapshot_rows


def test_legacy_upgrade_memory_capabilities_restart_and_backup_recovery(tmp_path):
    db=tmp_path/'legacy.sqlite3'
    # Production M5 table shape from public app.initialize + agent initializer;
    # insert synthetic snapshots only, with all protected record types represented.
    initialize(db);initialize_agent(db)
    with sqlite3.connect(db) as con:
        for subject in ('english','politics'):
            con.execute('INSERT INTO snapshots VALUES (?,?,?,?)',(subject,1,json.dumps(document(subject)),'synthetic-time'))
            con.execute('INSERT INTO history(subject,revision,state_json,updated_at) VALUES (?,?,?,?)',(subject,0,json.dumps(document(subject)),'synthetic-old-time'))
    baseline=snapshot_rows(db);backup=create_verified_backup(db,tmp_path/'backups')
    for _ in range(2):
        initialize(db);initialize_agent(db);initialize_memory(db);initialize_ai(db);initialize_activation(db);initialize_auto(db)
        verify_preserved(db,backup)
    assert snapshot_rows(db)==baseline
    for subject,name in [('english','plan.json'),('politics','politics-plan.json')]:
        (tmp_path/name).write_text(json.dumps(template(subject)))
    def forbidden(*_):raise AssertionError('No paid/model call is allowed in upgrade rehearsal')
    settings=dict(db_path=db,token_sha256=hashlib.sha256(OWNER.encode()).hexdigest(),template_dir=tmp_path,ai_config=AIConfig(),ai_provider=forbidden,auto_worker=False)
    with TestClient(create_app(**settings)) as c:
        assert c.get('/v1/ai/status').status_code==401
        assert not c.get('/v1/ai/status',headers=OWNER_AUTH).json()['ready']
        assert not c.get('/v1/ai/auto/status',headers=OWNER_AUTH).json()['control']['enabled']
        for subject in ('english','politics'):
            assert c.get('/v1/ai/profiles/'+subject,headers=OWNER_AUTH).json()['entries']==[]
            assert save(c,[entry('synthetic-rule',text='Synthetic preference, never a check-in')],subject=subject).status_code==200
            assert c.get('/v1/snapshot/'+subject,headers=PROTO).json()['state']==document(subject)
        capabilities=c.get('/v1/ai/capabilities',headers=OWNER_AUTH).json()['capabilities']
        assert capabilities and all(x['access']=='read_only' and x['permissions']==['owner:read'] for x in capabilities)
        assert not any(word in json.dumps(capabilities).lower() for word in ('ssh','shell','deploy','github','api_key'))
    checkpoint=create_verified_backup(db,tmp_path/'backups')
    with TestClient(create_app(**settings)) as restarted:
        assert restarted.get('/v1/ai/profiles/english',headers=OWNER_AUTH).json()['revision']==1
        assert restarted.get('/v1/ai/auto/status',headers=OWNER_AUTH).json()['runs']==[]
    verify_preserved(db,checkpoint);assert snapshot_rows(db)==baseline
    restored=tmp_path/'restored-copy.sqlite3'
    with sqlite3.connect(checkpoint) as src,sqlite3.connect(restored) as dst:src.backup(dst)
    assert snapshot_rows(restored)==baseline
    verify_preserved(restored,checkpoint)
