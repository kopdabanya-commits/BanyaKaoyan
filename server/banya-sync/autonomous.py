"""M7.3 owner-scoped automation. Defaults off; models only return suggestions."""
from __future__ import annotations
import asyncio
import hashlib
import json
import sqlite3
import re
import time
import uuid
from contextlib import closing,suppress
from datetime import date,datetime,timedelta,timezone
from typing import Literal

from fastapi import Header,Request,HTTPException
from pydantic import Field,ValidationError,model_validator
from agent_api import StrictModel,read_model,fail
from deepseek_ai import call_deepseek,MAX_INPUT_BYTES,MAX_OUTPUT_TOKENS,SECRET_PATTERN
from learning_memory import profile
from learning_analysis import AnalysisRequest,analyze
from learning_policy import resolve_policy
from learning_planner import PlanningRequest,PlanningSuggestion,PLANNING_SYSTEM,prepare,validate_suggestion
from private_plan import apply_patch,load_template,effective_tasks,valid_date,PlanError,SUBJECT_TYPES

RECORD_FIELDS=('done','notDone','wrong','notes','questionIds','actualMinutes','actualWritingMinutes','actualReviewMinutes')

class Permission(StrictModel):
    expectedRevision: int=Field(ge=0)
    enabled: bool=False
    start: str
    end: str
    fields: list[Literal['date','title','detail','minutes']]=Field(default_factory=lambda:['minutes'],min_length=1,max_length=4)
    types: list[str]=Field(min_length=1,max_length=9)
    allowAdd: bool=False
    maxChanges: int=Field(default=1,ge=1,le=3)
    dailyCalls: int=Field(default=1,ge=1,le=3)
    weeklyCalls: int=Field(default=3,ge=1,le=10)
    monthlyCalls: int=Field(default=10,ge=1,le=40)
    monthlyBudgetCents: int=Field(default=0,ge=0,le=10000)
    cooldownHours: int=Field(default=12,ge=6,le=168)
    periodic: bool=False
    shareReview: bool=False
    dataConsent: bool=False
    confirmation: Literal['save_auto_permission']

    @model_validator(mode='after')
    def valid(self):
        if not valid_date(self.start) or not valid_date(self.end) or not 0<=(date.fromisoformat(self.end)-date.fromisoformat(self.start)).days<=29:raise ValueError('invalid permission range')
        if self.enabled and (not self.dataConsent or not self.monthlyBudgetCents):raise ValueError('explicit consent and positive cost ceiling required')
        return self

class Control(StrictModel):
    expectedRevision: int=Field(ge=0)
    enabled: bool
    confirmation: Literal['set_auto_control']

class Enqueue(StrictModel):
    subject: Literal['english','politics']
    expectedRevision: int=Field(ge=1)

class Undo(StrictModel):
    expectedRevision: int=Field(ge=1)
    confirmation: Literal['undo_plan']


def initialize_auto(db):
    with closing(sqlite3.connect(db)) as con:
        con.executescript('''
        CREATE TABLE IF NOT EXISTS auto_control (id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,enabled INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS auto_permissions (subject TEXT PRIMARY KEY,revision INTEGER NOT NULL,enabled INTEGER NOT NULL,config_json TEXT NOT NULL,updated_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS auto_permission_history (id INTEGER PRIMARY KEY,subject TEXT NOT NULL,revision INTEGER NOT NULL,config_json TEXT NOT NULL,enabled INTEGER NOT NULL,updated_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS auto_events (id TEXT PRIMARY KEY,subject TEXT NOT NULL,revision INTEGER NOT NULL,reason TEXT NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS auto_runs (id TEXT PRIMARY KEY,event_id TEXT UNIQUE NOT NULL,subject TEXT NOT NULL,status TEXT NOT NULL,code TEXT NOT NULL,
          permission_revision INTEGER NOT NULL,control_revision INTEGER NOT NULL,base_revision INTEGER NOT NULL,profile_revision INTEGER NOT NULL,template_hash TEXT NOT NULL,
          created_at INTEGER NOT NULL,cost_nano INTEGER NOT NULL,month TEXT NOT NULL,result_json TEXT NOT NULL,applied_revision INTEGER,undo_revision INTEGER);
        ''')


def control(con):
    row=con.execute('SELECT * FROM auto_control WHERE id=1').fetchone()
    return {'revision':row['revision'],'enabled':bool(row['enabled'])} if row else {'revision':0,'enabled':False}


def permission(con,subject):
    return con.execute('SELECT * FROM auto_permissions WHERE subject=?',(subject,)).fetchone()


def enqueue_sync(con,subject,revision,old_record,new_record,now=None):
    # Only real learning-field changes enqueue. Auto overlays and metadata never create a loop.
    if not control(con)['enabled']:return
    grant=permission(con,subject)
    if not grant or not grant['enabled']:return
    if old_record is not None and all(old_record.get(k,{})==new_record.get(k,{}) for k in RECORD_FIELDS):return
    key=hashlib.sha256(f'phone:{subject}:{revision}'.encode()).hexdigest()
    con.execute('INSERT OR IGNORE INTO auto_events VALUES (?,?,?,?,?,?)',(key,subject,revision,'phone_sync','queued',int(time.time() if now is None else now)))


class AutoService:
    def __init__(self,db,connect,templates,config,enabled=False,provider=None,clock=time.time,owner_digest=None):
        self.db,self.connect,self.templates,self.config,self.enabled,self.clock=db,connect,templates,config,enabled,clock
        self.provider=provider or call_deepseek
        self.owner_digest=owner_digest

    def ready(self):return self.enabled and self.config.ready
    def month(self):return datetime.fromtimestamp(self.clock(),timezone.utc).strftime('%Y-%m')

    def recover(self):
        with closing(self.connect(self.db)) as con:
            con.execute('BEGIN IMMEDIATE')
            rows=con.execute("SELECT * FROM auto_runs WHERE status='pending'").fetchall()
            for row in rows:
                con.execute("UPDATE auto_runs SET status='unknown',code='restart_result_unknown' WHERE id=?",(row['id'],))
                con.execute("UPDATE ai_requests SET status='unknown' WHERE id=?",('auto-'+row['id'],))
                con.execute("UPDATE auto_events SET status='stopped' WHERE id=?",(row['event_id'],))
                self.pause(con,row['subject'])
            con.execute('COMMIT')

    def pause(self,con,subject):
        old=permission(con,subject)
        if old and old['enabled']:
            con.execute('INSERT INTO auto_permission_history(subject,revision,config_json,enabled,updated_at) VALUES (?,?,?,?,?)',(subject,old['revision'],old['config_json'],old['enabled'],old['updated_at']))
            con.execute('UPDATE auto_permissions SET enabled=0,revision=revision+1 WHERE subject=?',(subject,))

    def periodic(self):
        if not self.ready():return
        with closing(self.connect(self.db)) as con:
            con.execute('BEGIN IMMEDIATE')
            if control(con)['enabled']:
                for row in con.execute('SELECT * FROM auto_permissions WHERE enabled=1').fetchall():
                    cfg=json.loads(row['config_json'])
                    if cfg['periodic']:
                        snapshot=con.execute('SELECT revision FROM snapshots WHERE subject=?',(row['subject'],)).fetchone()
                        if snapshot:
                            key=hashlib.sha256(f"periodic:{row['subject']}:{self.month()}:{int(self.clock())//86400}".encode()).hexdigest()
                            con.execute('INSERT OR IGNORE INTO auto_events VALUES (?,?,?,?,?,?)',(key,row['subject'],snapshot['revision'],'periodic','queued',int(self.clock())))
            con.execute('COMMIT')

    def process_one(self):
        if not self.ready():return None
        run_id=None
        try:
            with closing(self.connect(self.db)) as con:
                con.execute('BEGIN IMMEDIATE')
                master=control(con)
                if not master['enabled']:return None
                if con.execute("SELECT 1 FROM auto_runs WHERE status='pending' LIMIT 1").fetchone():return None
                event=con.execute("SELECT * FROM auto_events WHERE status='queued' ORDER BY created_at,id LIMIT 1").fetchone()
                if not event:return None
                grant=permission(con,event['subject']);subject=event['subject'];now=int(self.clock())
                if not grant or not grant['enabled']:
                    con.execute("UPDATE auto_events SET status='skipped' WHERE id=?",(event['id'],));con.execute('COMMIT');return 'not_authorized'
                cfg=json.loads(grant['config_json']);tomorrow=(date.today()+timedelta(days=1)).isoformat()
                if cfg['end']<tomorrow:
                    self.pause(con,subject);con.execute("UPDATE auto_events SET status='expired' WHERE id=?",(event['id'],));con.execute('COMMIT');return 'permission_expired'
                recent=con.execute('SELECT max(created_at) FROM auto_runs WHERE subject=?',(subject,)).fetchone()[0]
                if recent is not None and now-recent<cfg['cooldownHours']*3600:return 'cooldown'
                count_day=con.execute('SELECT count(*) FROM auto_runs WHERE subject=? AND created_at>=?',(subject,now-now%86400)).fetchone()[0]
                count_week=con.execute('SELECT count(*) FROM auto_runs WHERE subject=? AND created_at>=?',(subject,now-7*86400)).fetchone()[0]
                count_month,cost_month=con.execute('SELECT count(*),COALESCE(sum(cost_nano),0) FROM auto_runs WHERE subject=? AND month=?',(subject,self.month())).fetchone()
                if count_day>=cfg['dailyCalls'] or count_week>=cfg['weeklyCalls'] or count_month>=cfg['monthlyCalls']:return 'call_limit'
                report=analyze(con,self.templates,AnalysisRequest(subject=subject))
                # No model for missing data alone, navigation, or an already examined same revision.
                worth=any(i['requiresAI'] for i in report['issues'])
                if not worth:
                    con.execute("UPDATE auto_events SET status='no_action' WHERE id=?",(event['id'],));con.execute('COMMIT');return 'no_action'
                if report['sources']['snapshotRevision']!=event['revision']:
                    con.execute("UPDATE auto_events SET status='superseded' WHERE id=?",(event['id'],));con.execute('COMMIT');return 'superseded'
                args=PlanningRequest(subject=subject,mode='week',targetDate=max(tomorrow,cfg['start']),expectedRevision=event['revision'],shareReview=cfg['shareReview'])
                prepared=prepare(con,self.templates,args)
                if prepared['context']['learningPolicy']['advisoryMinutes'] is None:raise PlanError('planning_budget_unknown',409)
                prepared['context']['autonomyPermission']={k:cfg[k] for k in ('start','end','fields','types','allowAdd','maxChanges')}
                payload={'model':'deepseek-flash','thinking':{'type':'enabled'},'reasoning_effort':'high','max_tokens':MAX_OUTPUT_TOKENS,'stream':False,
                         'response_format':{'type':'json_object'},'messages':[{'role':'system','content':PLANNING_SYSTEM},{'role':'user','content':json.dumps(prepared['context'],ensure_ascii=False)}]}
                encoded=json.dumps(payload,ensure_ascii=False).encode()
                if len(encoded)>MAX_INPUT_BYTES:raise PlanError('context_required_data_exceeds_budget',413)
                if SECRET_PATTERN.search(encoded.decode()) or self.config.api_key in encoded.decode() or (self.owner_digest and any(hashlib.sha256(t.encode()).hexdigest()==self.owner_digest for t in re.findall(r'[A-Za-z0-9_-]{32,}',encoded.decode()))):raise PlanError('context_contains_credentials')
                reserve=(len(encoded)+1024)*self.config.input_nano_per_token+MAX_OUTPUT_TOKENS*self.config.output_nano_per_token
                global_count,global_cost=con.execute('SELECT count(*),COALESCE(sum(cost_nano),0) FROM ai_requests WHERE month=?',(self.month(),)).fetchone()
                if cost_month+reserve>cfg['monthlyBudgetCents']*10_000_000 or global_cost+reserve>self.config.monthly_budget_nano:return 'budget_exhausted'
                if global_count>=self.config.monthly_calls:return 'call_limit'
                if con.execute("SELECT 1 FROM ai_requests WHERE status='pending' AND created_at>?",(now-180,)).fetchone():return 'busy'
                run_id=uuid.uuid4().hex;src=prepared['sources']
                con.execute('INSERT INTO auto_runs(id,event_id,subject,status,code,permission_revision,control_revision,base_revision,profile_revision,template_hash,created_at,cost_nano,month,result_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                    (run_id,event['id'],subject,'pending','thinking',grant['revision'],master['revision'],event['revision'],src['profileRevision'],src['templateHash'],now,reserve,self.month(),'{}'))
                con.execute('INSERT INTO ai_requests(id,body_hash,subject,base_revision,template_hash,date_start,date_end,status,cost_nano,month,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
                    ('auto-'+run_id,prepared['fingerprint'],subject,event['revision'],src['templateHash'],cfg['start'],cfg['end'],'pending',reserve,self.month(),now,now+180))
                con.execute("UPDATE auto_events SET status='claimed' WHERE id=?",(event['id'],));con.execute('COMMIT')
            # Network outside SQLite transaction. Never auto-retry an ambiguous model request.
            upstream=self.provider(self.config,payload)
            choice=upstream['choices'][0];content=choice['message']['content']
            if choice.get('finish_reason')!='stop' or not isinstance(content,str) or len(content.encode())>24000 or SECRET_PATTERN.search(content) or self.config.api_key in content:raise ValueError('invalid provider output')
            suggestion=PlanningSuggestion.model_validate(json.loads(content))
            with closing(self.connect(self.db)) as con:
                con.execute('BEGIN IMMEDIATE');current=permission(con,subject);current_master=control(con)
                if not current or not current['enabled'] or current['revision']!=grant['revision'] or not current_master['enabled'] or current_master['revision']!=master['revision']:raise PlanError('permission_changed',409)
                if int(self.clock())-now>180:raise PlanError('automatic_result_expired',409)
                # validate_suggestion pins profile, snapshot and template; then constrain fields/type/date.
                changes=validate_suggestion(con,self.templates,args,prepared,suggestion)
                if len(changes)>cfg['maxChanges']:raise PlanError('automatic_change_limit')
                patch=[p.model_dump(exclude_unset=True) for p in suggestion.proposedChanges]
                tasks=effective_tasks(load_template(self.templates,subject)[0],json.loads(con.execute('SELECT state_json FROM snapshots WHERE subject=?',(subject,)).fetchone()[0])['record'],subject)
                for operation,c in zip(patch,changes):
                    allowed=set(cfg['fields'])|{'operation','taskId'}
                    if operation['operation']=='add':
                        if not cfg['allowAdd']:raise PlanError('automatic_add_forbidden')
                        allowed|={'date','title','detail','minutes','type'}
                    if set(operation)-allowed:raise PlanError('automatic_field_forbidden')
                    for t in (c['before'],c['after']):
                        if t and (t['type'] not in cfg['types'] or not max(tomorrow,cfg['start'])<=t['date']<=cfg['end']):raise PlanError('automatic_scope_forbidden')
                row=con.execute('SELECT * FROM snapshots WHERE subject=?',(subject,)).fetchone();document=json.loads(row['state_json'])
                receipt={'summary':suggestion.summary,'reasons':[r.model_dump() for r in suggestion.reasons],'changes':changes,
                         'usage':{k:v for k,v in (upstream.get('usage') or {}).items() if k in ('prompt_tokens','completion_tokens','total_tokens') and type(v) is int and 0<=v<=1_000_000},
                         'providerRequestId':upstream.get('id','')[:100] if isinstance(upstream.get('id',''),str) and not SECRET_PATTERN.search(upstream.get('id','')) else '',
                         'sources':prepared['sources']}
                revision=None
                if changes:
                    updated,_=apply_patch(load_template(self.templates,subject)[0],document,subject,patch,cfg['start'],cfg['end'],policy=resolve_policy(profile(con,subject),subject),require_budget=True)
                    encoded=json.dumps(updated,ensure_ascii=False,separators=(',',':'),allow_nan=False)
                    if len(encoded.encode())>524288:raise PlanError('snapshot_too_large',413)
                    self.backup(con,'auto-'+run_id,subject,row)
                    revision=row['revision']+1
                    con.execute('UPDATE snapshots SET revision=?,state_json=?,updated_at=? WHERE subject=?',(revision,encoded,datetime.now(timezone.utc).isoformat(timespec='seconds'),subject))
                status='applied' if changes else 'no_change'
                con.execute('UPDATE auto_runs SET status=?,code=?,result_json=?,applied_revision=? WHERE id=?',(status,status,json.dumps(receipt,ensure_ascii=False),revision,run_id))
                con.execute('UPDATE ai_requests SET status=?,result_json=?,applied_revision=? WHERE id=?',(status,json.dumps({'automaticRunId':run_id}),revision,'auto-'+run_id))
                con.execute("UPDATE auto_events SET status='finished' WHERE id=?",(event['id'],));con.execute('COMMIT');return status
        except (Exception,) as error:
            code=error.code if isinstance(error,PlanError) else 'automatic_result_unknown'
            if isinstance(error,HTTPException):code=error.detail.get('code','version_conflict') if isinstance(error.detail,dict) else 'version_conflict'
            with closing(self.connect(self.db)) as con:
                con.execute('BEGIN IMMEDIATE')
                if run_id:
                    con.execute("UPDATE auto_runs SET status='stopped',code=? WHERE id=?",(code,run_id))
                    con.execute("UPDATE ai_requests SET status='unknown' WHERE id=?",('auto-'+run_id,))
                if 'subject' in locals():self.pause(con,subject)
                if 'event' in locals() and event:con.execute("UPDATE auto_events SET status='stopped' WHERE id=?",(event['id'],))
                con.execute('COMMIT')
            return code

    def backup(self,con,change_id,subject,row):
        con.execute('INSERT INTO agent_backups(change_id,subject,revision,state_json,updated_at) VALUES (?,?,?,?,?)',(change_id,subject,row['revision'],row['state_json'],row['updated_at']))
        con.execute('INSERT INTO history(subject,revision,state_json,updated_at) VALUES (?,?,?,?)',(subject,row['revision'],row['state_json'],row['updated_at']))
        con.execute('DELETE FROM history WHERE subject=? AND id NOT IN (SELECT id FROM history WHERE subject=? ORDER BY id DESC LIMIT 30)',(subject,subject))

    async def loop(self):
        while True:
            try:
                await asyncio.to_thread(self.periodic)
                await asyncio.to_thread(self.process_one)
            except Exception:
                # DB/service errors never cause model retries in a tight loop.
                await asyncio.sleep(30)
            await asyncio.sleep(15)


def install_auto_routes(app,service,authorize):
    db,connect=service.db,service.connect
    @app.get('/v1/ai/auto/status')
    def status(authorization: str|None=Header(default=None)):
        authorize(authorization)
        with closing(connect(db)) as con:
            return {'control':control(con),'serverReady':service.ready(),'grants':[{'subject':r['subject'],'revision':r['revision'],'enabled':bool(r['enabled']),'config':json.loads(r['config_json'])} for r in con.execute('SELECT * FROM auto_permissions')],
                    'runs':[{'id':r['id'],'subject':r['subject'],'status':r['status'],'code':r['code'],'createdAt':r['created_at'],'appliedRevision':r['applied_revision'],'undoRevision':r['undo_revision'],'result':json.loads(r['result_json'])} for r in con.execute('SELECT * FROM auto_runs ORDER BY created_at DESC,rowid DESC LIMIT 20')],
                    'billing':'conservative reservation, not provider bill'}
    @app.post('/v1/ai/auto/control')
    async def set_control(request: Request,authorization: str|None=Header(default=None)):
        authorize(authorization);body=await read_model(request,Control)
        with closing(connect(db)) as con:
            con.execute('BEGIN IMMEDIATE');old=control(con)
            if old['revision']!=body.expectedRevision:fail('automatic_control_conflict',409)
            con.execute('INSERT INTO auto_control VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,enabled=excluded.enabled',(old['revision']+1,int(body.enabled)))
            con.execute('COMMIT');return {'revision':old['revision']+1,'enabled':body.enabled}
    @app.post('/v1/ai/auto/grants/{subject}')
    async def save_grant(subject: str,request: Request,authorization: str|None=Header(default=None)):
        authorize(authorization)
        if subject not in SUBJECT_TYPES:fail('unknown_subject',404)
        body=await read_model(request,Permission)
        if set(body.types)-SUBJECT_TYPES[subject] or len(set(body.types))!=len(body.types):fail('automatic_invalid_types')
        if body.enabled and body.start<=(date.today()).isoformat():fail('automatic_future_only')
        with closing(connect(db)) as con:
            con.execute('BEGIN IMMEDIATE');old=permission(con,subject);revision=old['revision'] if old else 0
            if body.expectedRevision!=revision:fail('automatic_permission_conflict',409)
            if old:con.execute('INSERT INTO auto_permission_history(subject,revision,config_json,enabled,updated_at) VALUES (?,?,?,?,?)',(subject,revision,old['config_json'],old['enabled'],old['updated_at']))
            cfg=body.model_dump(exclude={'expectedRevision','confirmation','enabled'})
            con.execute('INSERT INTO auto_permissions VALUES (?,?,?,?,?) ON CONFLICT(subject) DO UPDATE SET revision=excluded.revision,enabled=excluded.enabled,config_json=excluded.config_json,updated_at=excluded.updated_at',(subject,revision+1,int(body.enabled),json.dumps(cfg),int(service.clock())))
            con.execute('COMMIT');return {'subject':subject,'revision':revision+1,'enabled':body.enabled}
    @app.post('/v1/ai/auto/enqueue')
    async def enqueue(request: Request,authorization: str|None=Header(default=None)):
        authorize(authorization);body=await read_model(request,Enqueue)
        with closing(connect(db)) as con:
            con.execute('BEGIN IMMEDIATE');row=con.execute('SELECT * FROM snapshots WHERE subject=?',(body.subject,)).fetchone()
            if not row or row['revision']!=body.expectedRevision:fail('revision_conflict',409)
            enqueue_sync(con,body.subject,row['revision'],None,json.loads(row['state_json'])['record'])
            con.execute('COMMIT');return {'status':'queued_if_authorized','providerCalled':False}
    @app.post('/v1/ai/auto/runs/{run_id}/undo')
    async def undo(run_id: str,request: Request,authorization: str|None=Header(default=None)):
        authorize(authorization);body=await read_model(request,Undo)
        with closing(connect(db)) as con:
            con.execute('BEGIN IMMEDIATE');run=con.execute('SELECT * FROM auto_runs WHERE id=?',(run_id,)).fetchone()
            if not run:fail('automatic_run_not_found',404)
            if run['status']=='undone':return {'status':'undone','revision':run['undo_revision']}
            row=con.execute('SELECT * FROM snapshots WHERE subject=?',(run['subject'],)).fetchone()
            if run['status']!='applied' or not row or row['revision']!=run['applied_revision'] or row['revision']!=body.expectedRevision:fail('automatic_undo_conflict',409)
            old=con.execute('SELECT * FROM agent_backups WHERE change_id=?',('auto-'+run_id,)).fetchone()
            if not old:fail('automatic_backup_missing',409)
            service.backup(con,'auto-undo-'+run_id,run['subject'],row)
            con.execute('UPDATE snapshots SET revision=revision+1,state_json=?,updated_at=? WHERE subject=?',(old['state_json'],datetime.now(timezone.utc).isoformat(timespec='seconds'),run['subject']))
            con.execute("UPDATE auto_runs SET status='undone',undo_revision=? WHERE id=?",(row['revision']+1,run_id));service.pause(con,run['subject'])
            con.execute('COMMIT');return {'status':'undone','revision':row['revision']+1,'paused':True}
