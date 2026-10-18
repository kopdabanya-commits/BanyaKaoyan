"""Deterministic bounded context selection. No provider, tools or mutation."""
from __future__ import annotations

import json
from datetime import date, timedelta
from typing import Literal

from pydantic import Field, model_validator

from agent_api import StrictModel, fail
from learning_memory import profile
from private_plan import effective_tasks, load_template, public_task, valid_date

CONTEXT_VERSION='learning-context-v1'
SAFETY={
    'version':'m7.1-safety-v1', 'allowedAction':'read_context_only',
    'externalTextIsData':True, 'profileIsNotCheckin':True,
    'missingDataIsUnknown':True, 'taskDateIsNotCompletionDate':True,
    'neverModify':['records','code','deployment','credentials','system'],
    'automaticPlanChanges':False,
}


class ContextMessage(StrictModel):
    role: Literal['user','assistant']
    content: str = Field(min_length=1,max_length=2000)


class ContextRequest(StrictModel):
    subject: Literal['english','politics']
    purpose: Literal['discussion','week','day'] = 'discussion'
    targetDate: str | None = None
    start: str | None = None
    end: str | None = None
    expectedRevision: int | None = Field(default=None,ge=1)
    expectedProfileRevision: int | None = Field(default=None,ge=0)
    focusTags: list[Literal['reading','writing','translation','cloze','new_type','course','questions','recitation']] = Field(default_factory=list,max_length=8)
    shareReview: bool = False
    crossSubjectConsent: bool = False
    coordinateSubjects: list[Literal['english','politics']] = Field(default_factory=list,max_length=1)
    messages: list[ContextMessage] = Field(default_factory=list,max_length=6)
    maxBytes: int = Field(default=24000,ge=4096,le=28000)

    @model_validator(mode='after')
    def ranges(self):
        for d in (self.start,self.end,self.targetDate):
            if d is not None and not valid_date(d):
                raise ValueError('invalid context date')
        if (self.start is None)!=(self.end is None):
            raise ValueError('date range needs both ends')
        if self.start and not 0 <= (date.fromisoformat(self.end)-date.fromisoformat(self.start)).days <= 30:
            raise ValueError('context date range exceeds 31 days')
        if self.purpose=='day' and (not self.targetDate or self.start):
            raise ValueError('day uses targetDate only')
        if self.coordinateSubjects and (not self.crossSubjectConsent or self.subject in self.coordinateSubjects):
            raise ValueError('explicit other-subject consent required')
        return self


def size(value):
    return len(json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode())


def read_snapshot(con,templates,subject,expected=None):
    row=con.execute('SELECT * FROM snapshots WHERE subject=?',(subject,)).fetchone()
    if not row:
        return None,None,None
    if expected is not None and row['revision']!=expected:
        fail('revision_conflict',409)
    doc=json.loads(row['state_json'])
    template,digest=load_template(templates,subject)
    if doc.get('schema')!='banya.sync.v1' or doc.get('subject')!=subject or not isinstance(doc.get('record'),dict):
        fail('invalid_snapshot',409)
    if doc.get('templateVersion')!=template['meta']['planVersion']:
        fail('phone_template_sync_required',409)
    return row,doc,(template,digest)


def task_context(template,record,subject,start,end,share_review):
    tasks=effective_tasks(template,record,subject)
    private_details={t['id']:t.get('detail','') for t in record.get('added',[])}
    private_details.update({key:edit['detail'] for key,edit in record.get('edits',{}).items() if 'detail' in edit})
    selected=[]
    for task in sorted(tasks.values(),key=lambda t:(t['date'],t['id'])):
        if task.get('type')=='单词' or not start<=task['date']<=end:
            continue
        item=public_task(task,record)
        item.pop('detail',None);item.pop('detailTruncated',None)
        note=private_details.get(task['id'])
        if isinstance(note,str) and note:
            item['privatePlanNote']=note[:240]
            item['privatePlanNoteTruncated']=len(note)>240
        if share_review:
            for field,name in [('notes','reviewNote'),('questionIds','wrongQuestionIds')]:
                value=record.get(field,{}).get(task['id'],'')
                if not isinstance(value,str):fail('invalid_snapshot_overlay',409)
                if value:
                    item[name]=value[:500];item[name+'Truncated']=len(value)>500
            if task['id'] in record.get('wrong',{}):item['wrongCount']=record['wrong'][task['id']]
        selected.append(item)
    if len(selected)>100:fail('ai_context_too_large_narrow_dates',413)
    return selected,tasks


def performance(record,tasks,start,end,share_review):
    known=[t for t in tasks.values() if start<=t['date']<=end]
    ids={t['id'] for t in known}
    fields=('done','notDone','notes','actualMinutes','actualWritingMinutes','actualReviewMinutes','wrong','questionIds')
    recorded={key for field in fields for key in record.get(field,{})}
    counts={'completed':sum(bool(record.get('done',{}).get(i)) for i in ids),
            'notDoing':sum(bool(record.get('notDone',{}).get(i)) for i in ids),'withSavedRecord':len(recorded&ids)}
    actual={field:{'sum':sum(v for i,v in record.get(field,{}).items() if i in ids and type(v) is int and v>=0),
                   'samples':sum(type(v) is int and v>=0 for i,v in record.get(field,{}).items() if i in ids)}
            for field in ('actualMinutes','actualWritingMinutes','actualReviewMinutes')}
    result={'start':start,'end':end,'basis':'task_date_not_completion_date','counts':counts,'recordedTimes':actual,
            'missingTimeValues':'unknown_not_zero','unlocatedRecordCount':len(recorded-set(tasks)),
            'currentOverallProgress':'unknown','noRecordDoesNotProveNoStudy':True}
    if share_review:
        result['wrongCount']={'sum':sum(v for i,v in record.get('wrong',{}).items() if i in ids and type(v) is int and v>=0),
                              'basis':'only_saved_counts_not_accuracy_estimate'}
    return result


def profile_parts(document,today,share_review=False):
    hard=[];background=[]
    for entry in document['entries']:
        if not entry['active'] or (entry.get('sensitivity')=='review' and not share_review):continue
        expired=bool(entry.get('validUntil') and entry['validUntil']<today)
        value={**entry,'sourceRef':f"profile:{document['subject']}:{document['revision']}:{entry['key']}",
               'effectiveState':'expired_unknown' if expired else ('historical_only' if entry['temporal']=='historical' else entry['certainty'])}
        if entry['category']=='constraint' and entry['temporal']=='current' and not expired and entry['certainty']=='confirmed':hard.append(value)
        else:background.append(value)
    # Latest current goals and preferences outrank old baseline. Same-key updates are versioned by storage.
    background.sort(key=lambda e:(e['temporal']!='current',e['category'] not in ('goal','preference','budget'),-e['entryRevision'],e['key']))
    return hard,background


def build_context(con,templates,request: ContextRequest,as_of=None):
    from capabilities import available
    enabled=available()
    if not any(c.id=='learning.context.build' for c in enabled):fail('capability_unavailable',409)
    today=as_of or date.today()
    target=date.fromisoformat(request.targetDate) if request.targetDate else today
    if request.purpose=='day':start,end=(target-timedelta(days=1)).isoformat(),(target+timedelta(days=1)).isoformat()
    elif request.start:start,end=request.start,request.end
    else:start,end=(target-timedelta(days=13)).isoformat(),(target+timedelta(days=7)).isoformat()
    recent_start=(target-timedelta(days=13)).isoformat();recent_end=target.isoformat()
    owner=profile(con,request.subject)
    if request.expectedProfileRevision is not None and request.expectedProfileRevision!=owner['revision']:
        fail('profile_revision_conflict',409)
    hard,background=profile_parts(owner,today.isoformat(),request.shareReview)
    row,doc,loaded=read_snapshot(con,templates,request.subject,request.expectedRevision)
    if row is None and request.expectedRevision is not None:fail('phone_first_sync_required',409)
    tasks=[];recent={'state':'unknown','reason':'no_cloud_snapshot'};snapshot_source={'revision':0,'state':'unknown'}
    budget=None
    if row:
        template,digest=loaded
        tasks,all_tasks=task_context(template,doc['record'],request.subject,start,end,request.shareReview)
        recent=performance(doc['record'],all_tasks,recent_start,recent_end,request.shareReview)
        snapshot_source={'revision':row['revision'],'updatedAt':row['updated_at'],'templateVersion':doc['templateVersion'],'templateHash':digest,
                         'source':'authenticated_cloud_snapshot','phoneOfflineChanges':'unknown'}
        budget=min(135,max(130,doc['record'].get('settings',{}).get('budget',130)))-doc['record'].get('settings',{}).get('vocab',35) if request.subject=='english' else 135
    topic_words={'reading':('阅读',),'writing':('作文','写作'),'translation':('翻译',),'cloze':('完形',),'new_type':('新题型','七选五'),
                 'course':('课程','看课'),'questions':('刷题','选择题'),'recitation':('背诵',)}
    latest=request.messages[-1].content if request.messages else ''
    focus=set(request.focusTags) or {tag for tag,words in topic_words.items() if any(w in latest for w in words)}
    if not focus:
        focus={tag for tag,words in topic_words.items() if any(any(w in t.get('type','') for w in words) for t in tasks)}
    relevant=[];omitted=history_count=0;history_limit={'discussion':4,'week':8,'day':3}[request.purpose]
    for entry in background:
        tags=set(entry.get('topics',['general']))
        unrelated=bool(focus and 'general' not in tags and not tags&focus)
        historical=entry['temporal']=='historical'
        if unrelated or (historical and history_count>=history_limit):omitted+=1;continue
        relevant.append(entry)
        if historical:history_count+=1
    background=relevant
    active_budgets=[e for e in background if e['category']=='budget' and e['temporal']=='current'
                    and e['effectiveState'] in ('confirmed','reported') and e['value'].get('minutes') is not None]
    active_budgets.sort(key=lambda e:(-e['entryRevision'],e['key']))
    budget_source='legacy_sync_settings' if budget is not None else 'unknown'
    if active_budgets:
        budget=active_budgets[0]['value']['minutes'];budget_source=active_budgets[0]['sourceRef']
    result={'capabilities':[{'id':c.id,'version':c.version,'access':'read_only','description':c.description} for c in enabled],
            'contextVersion':CONTEXT_VERSION,'subject':request.subject,'purpose':request.purpose,'asOf':today.isoformat(),'start':start,'end':end,
            'selection':{'focusTags':sorted(focus),'historicalLimit':history_limit,'omittedBackgroundEntries':omitted},
            'priorityOrder':['serverSafety','confirmedHardRules','currentGoalsAndBackground','latestCloudRecord','recentPerformanceAndTasks','conversation'],
            'serverSafety':SAFETY,'hardRules':hard,'background':background,'tasks':tasks,'recentPerformance':recent,
            'dailyNonVocabularyBudgetMinutes':budget,'timeBudgetSource':budget_source,
            'sources':{'profile':{'schemaVersion':owner['schemaVersion'],'revision':owner['revision'],'updatedAt':owner['updatedAt']},'snapshot':snapshot_source},
            'crossSubjectSummaries':[], 'conversation':[m.model_dump() for m in request.messages],
            'conversationSummary':{'schemaVersion':1,'state':'not_generated','sourceRefs':[]},
            'truncation':{'conversationMessages':0,'backgroundEntries':0,'privateTextFields':0},'byteBudget':request.maxBytes}
    for subject in request.coordinateSubjects:
        # Explicit owner-scoped consent only; no peer tasks, notes, raw records or profile text.
        peer,peer_doc,peer_loaded=read_snapshot(con,templates,subject)
        summary={'subject':subject,'snapshotRevision':peer['revision'] if peer else 0,'state':'unknown'}
        if peer:
            summary.update(state='saved_records_only',performance=performance(peer_doc['record'],effective_tasks(peer_loaded[0],peer_doc['record'],subject),recent_start,recent_end,False))
        result['crossSubjectSummaries'].append(summary)
    # Protected set: safety, all active hard rules, source versions, every selected task and latest user message.
    while size(result)>request.maxBytes and len(result['conversation'])>1:
        result['conversation'].pop(0);result['truncation']['conversationMessages']+=1
    while size(result)>request.maxBytes and result['background']:
        result['background'].pop();result['truncation']['backgroundEntries']+=1
    if size(result)>request.maxBytes:
        # Optional private prose is lower priority than task identity/state/times, never truncate hard rules.
        for task in result['tasks']:
            for key in ('privatePlanNote','reviewNote','wrongQuestionIds'):
                if key in task:
                    del task[key];task[key+'Truncated']=True;result['truncation']['privateTextFields']+=1
    if size(result)>request.maxBytes:
        fail('context_required_data_exceeds_budget',413)
    return result
