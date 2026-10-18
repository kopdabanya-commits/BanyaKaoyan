"""Versioned owner-managed baseline/rules, never learning-record writes."""
from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from typing import Literal

from fastapi import Header, Request
from pydantic import Field, model_validator

from agent_api import StrictModel, fail, read_model
from private_plan import valid_date

SECRET_TEXT = re.compile(r'-----BEGIN .*PRIVATE KEY|(?:sk-|banya_plan_|github_pat_|ghp_)[A-Za-z0-9_-]{20,}')
SCHEMA = 1
MAX_ENTRIES = 80
CATEGORIES = Literal['goal','history','material','budget','preference','constraint','progress']


def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


class Value(StrictModel):
    text: str = Field(min_length=1, max_length=1200)
    minutes: int | None = Field(default=None, ge=0, le=1440)
    targetMin: int | None = Field(default=None, ge=0, le=150)
    targetMax: int | None = Field(default=None, ge=0, le=150)
    examYear: int | None = Field(default=None, ge=2020, le=2100)
    materialState: Literal['owned','not_owned','unknown'] | None = None
    count: int | None = Field(default=None, ge=0, le=100000)
    total: int | None = Field(default=None, ge=1, le=100000)

    @model_validator(mode='after')
    def ranges(self):
        if self.targetMin is not None and self.targetMax is not None and self.targetMin > self.targetMax:
            raise ValueError('invalid range')
        if self.count is not None and self.total is not None and self.count > self.total:
            raise ValueError('invalid count')
        return self


class Source(StrictModel):
    kind: Literal['user_confirmation','user_report','private_import','device_reference']
    reference: str = Field(min_length=1, max_length=200)


class Entry(StrictModel):
    key: str = Field(min_length=1, max_length=80, pattern=r'^[a-zA-Z0-9_.-]+$')
    category: CATEGORIES
    value: Value
    source: Source
    certainty: Literal['confirmed','reported','estimate','unknown']
    temporal: Literal['current','historical']
    observedOn: str | None = None
    validUntil: str | None = None
    active: bool = True
    sensitivity: Literal['standard','review'] = 'standard'
    topics: list[Literal['general','reading','writing','translation','cloze','new_type','course','questions','recitation']] = Field(default_factory=lambda:['general'],min_length=1,max_length=8)

    @model_validator(mode='after')
    def dates(self):
        for d in (self.observedOn, self.validUntil):
            if d is not None and not valid_date(d):
                raise ValueError('invalid date')
        if self.category == 'history' and self.temporal != 'historical':
            raise ValueError('history must remain historical')
        if self.category == 'progress' and self.temporal == 'current' and self.certainty != 'unknown' and (not self.observedOn or not self.validUntil):
            raise ValueError('current progress needs explicit observation and expiry')
        if self.temporal == 'historical' and self.observedOn is None:
            raise ValueError('historical baseline needs observation date')
        if self.category == 'constraint' and self.sensitivity != 'standard':
            raise ValueError('hard constraints must be shareable without review details')
        if self.category == 'constraint' and self.certainty != 'confirmed':
            raise ValueError('hard constraints require confirmation')
        return self


class Mutation(StrictModel):
    schemaVersion: int = Field(ge=1,le=1)
    requestId: str = Field(min_length=8, max_length=80, pattern=r'^[A-Za-z0-9_-]+$')
    expectedRevision: int = Field(ge=0)
    entries: list[Entry] = Field(min_length=1, max_length=MAX_ENTRIES)
    confirmation: Literal['save_profile']


def initialize_memory(db):
    # Additive, idempotent initialization. No default profile or grant is created.
    with closing(sqlite3.connect(db)) as con:
        con.executescript('''
        CREATE TABLE IF NOT EXISTS learning_profiles (
          subject TEXT PRIMARY KEY, schema_version INTEGER NOT NULL,
          revision INTEGER NOT NULL, document_json TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS learning_profile_history (
          subject TEXT NOT NULL, revision INTEGER NOT NULL,
          schema_version INTEGER NOT NULL, document_json TEXT NOT NULL,
          updated_at TEXT NOT NULL, PRIMARY KEY(subject,revision));
        CREATE TABLE IF NOT EXISTS learning_profile_requests (
          subject TEXT NOT NULL, request_id TEXT NOT NULL, body_hash TEXT NOT NULL,
          result_json TEXT NOT NULL, PRIMARY KEY(subject,request_id));
        CREATE TABLE IF NOT EXISTS learning_summaries (
          id TEXT PRIMARY KEY, subject TEXT NOT NULL, schema_version INTEGER NOT NULL,
          profile_revision INTEGER NOT NULL, snapshot_revision INTEGER NOT NULL,
          source_refs_json TEXT NOT NULL, summary_json TEXT NOT NULL,
          created_at TEXT NOT NULL, valid_until TEXT NOT NULL);
        ''')


def profile(con, subject):
    row = con.execute('SELECT * FROM learning_profiles WHERE subject=?', (subject,)).fetchone()
    if row is None:
        return {'schemaVersion':SCHEMA,'subject':subject,'revision':0,'entries':[], 'updatedAt':None}
    if row['schema_version'] != SCHEMA:
        fail('profile_schema_incompatible', 409)
    document = json.loads(row['document_json'])
    if document.get('schemaVersion') != SCHEMA:
        fail('profile_schema_incompatible',409)
    return {**document,'revision':row['revision'],'updatedAt':row['updated_at']}


def install_memory_routes(app, db, connect, authorize):
    def subject_ok(subject):
        if subject not in ('english','politics'):
            fail('unknown_subject',404)

    @app.get('/v1/ai/profiles/{subject}')
    def get_profile(subject: str, authorization: str | None = Header(default=None)):
        authorize(authorization); subject_ok(subject)
        with closing(connect(db)) as con:
            return profile(con,subject)

    @app.get('/v1/ai/profiles/{subject}/history')
    def get_history(subject: str, before: int = 2147483647, authorization: str | None = Header(default=None)):
        authorize(authorization); subject_ok(subject)
        with closing(connect(db)) as con:
            profile(con,subject)  # Fail closed for unsupported migrations.
            rows=con.execute('SELECT * FROM learning_profile_history WHERE subject=? AND revision<? ORDER BY revision DESC LIMIT 10',(subject,before)).fetchall()
            return {'subject':subject,'versions':[{'revision':r['revision'],'schemaVersion':r['schema_version'],'document':json.loads(r['document_json']),'updatedAt':r['updated_at']} for r in rows],
                    'nextBefore':rows[-1]['revision'] if len(rows)==10 else None}

    @app.post('/v1/ai/profiles/{subject}')
    async def save_profile(subject: str, request: Request, authorization: str | None = Header(default=None)):
        authorize(authorization); subject_ok(subject)
        body=await read_model(request,Mutation)
        if len({e.key for e in body.entries}) != len(body.entries):
            fail('duplicate_profile_key')
        raw=json.dumps(body.model_dump(),sort_keys=True,ensure_ascii=False)
        if SECRET_TEXT.search(raw) or (authorization and authorization[7:] in raw):
            fail('profile_remove_credentials')
        digest=hashlib.sha256(raw.encode()).hexdigest()
        with closing(connect(db)) as con:
            con.execute('BEGIN IMMEDIATE')
            old=con.execute('SELECT * FROM learning_profile_requests WHERE subject=? AND request_id=?',(subject,body.requestId)).fetchone()
            if old:
                if old['body_hash'] != digest:
                    fail('profile_request_id_reused',409)
                return json.loads(old['result_json'])
            current=profile(con,subject)
            if current['revision'] != body.expectedRevision:
                fail('profile_revision_conflict',409)
            entries={e['key']:e for e in current['entries']}
            stamp=now(); revision=current['revision']+1
            for e in body.entries:
                entries[e.key]={**e.model_dump(), 'confirmedAt':stamp, 'entryRevision':revision}
            if len(entries)>MAX_ENTRIES:
                fail('profile_entry_limit',413)
            document={'schemaVersion':SCHEMA,'subject':subject,'entries':list(entries.values())}
            encoded=json.dumps(document,ensure_ascii=False,separators=(',',':'))
            if len(encoded.encode())>60000:
                fail('profile_too_large',413)
            # Exact preimage, even first empty profile. Insert failure rolls back everything.
            con.execute('INSERT INTO learning_profile_history VALUES (?,?,?,?,?)',
                (subject,current['revision'],SCHEMA,json.dumps(current,ensure_ascii=False),current['updatedAt'] or stamp))
            con.execute('INSERT INTO learning_profiles VALUES (?,?,?,?,?) ON CONFLICT(subject) DO UPDATE SET schema_version=excluded.schema_version,revision=excluded.revision,document_json=excluded.document_json,updated_at=excluded.updated_at',
                (subject,SCHEMA,revision,encoded,stamp))
            result={'status':'profile_saved','subject':subject,'revision':revision,'backupRevision':current['revision'],'requestId':body.requestId}
            con.execute('INSERT INTO learning_profile_requests VALUES (?,?,?,?)',(subject,body.requestId,digest,json.dumps(result)))
            con.execute('COMMIT')
            return result
