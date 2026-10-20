"""Deterministic learning signals from saved data, never exam-score guesses."""
from __future__ import annotations

import hashlib
import json
from collections import Counter,defaultdict
from datetime import date,timedelta
from typing import Literal

from pydantic import Field,model_validator
from agent_api import StrictModel,fail
from context_engine import read_snapshot
from learning_memory import profile
from learning_policy import resolve_policy,day_load,is_vocabulary
from private_plan import effective_tasks,valid_date

ANALYSIS_VERSION='learning-analysis-v1'
FIELDS=('done','notDone','notes','wrong','questionIds','actualMinutes','actualWritingMinutes','actualReviewMinutes')


class AnalysisRequest(StrictModel):
    subject: Literal['english','politics']
    asOf: str | None = None
    expectedRevision: int | None = Field(default=None,ge=1)
    expectedProfileRevision: int | None = Field(default=None,ge=0)

    @model_validator(mode='after')
    def valid(self):
        if self.asOf is not None and not valid_date(self.asOf):raise ValueError('invalid analysis date')
        return self


def fingerprint(sources):
    return hashlib.sha256(json.dumps(sources,sort_keys=True).encode()).hexdigest()


def category(task):
    if task.get('type')=='阅读' and any(s in task.get('title','') for s in ('二刷','第二轮','二轮')):return '阅读二刷'
    return task.get('type','未分类')


def saved(record,key):
    return any(key in record.get(field,{}) for field in FIELDS)


def numeric(mapping,key):
    value=mapping.get(key)
    return value if type(value) is int and value>=0 else None


def aggregate(tasks,record,start,end):
    chosen=[t for t in tasks.values() if start<=t['date']<=end and not is_vocabulary(t)]
    groups=defaultdict(list)
    for t in chosen:groups[category(t)].append(t)
    distribution={}
    for kind,items in sorted(groups.items()):
        ids=[t['id'] for t in items];actual=[numeric(record.get('actualMinutes',{}),i) for i in ids]
        actual=[n for n in actual if n is not None]
        pairs=[(t['minutes'],numeric(record.get('actualMinutes',{}),t['id'])) for t in items if numeric(record.get('actualMinutes',{}),t['id']) is not None]
        wrong=[numeric(record.get('wrong',{}),i) for i in ids];wrong=[n for n in wrong if n is not None]
        # Denominators only from explicit task metadata, never inferred from type/title.
        rate=[]
        for t in items:
            denominator=t.get('questionCount');errors=numeric(record.get('wrong',{}),t['id'])
            if type(denominator) is int and denominator>0 and errors is not None and errors<=denominator:
                rate.append((errors,denominator))
        distribution[kind]={'plannedTasks':len(items),'completed':sum(bool(record.get('done',{}).get(i)) for i in ids),
            'notDoing':sum(bool(record.get('notDone',{}).get(i)) for i in ids),'withRecord':sum(saved(record,i) for i in ids),
            'unrecorded':sum(not saved(record,i) for i in ids),
            'actualMinutes':sum(actual) if actual else None,'actualSamples':len(actual),
            'pairedExpectedMinutes':sum(p for p,a in pairs) if pairs else None,
            'pairedActualMinutes':sum(a for p,a in pairs) if pairs else None,
            'wrongCount':sum(wrong) if wrong else None,'wrongSamples':len(wrong),
            'rateSamples':len(rate),'questionTotal':sum(n for e,n in rate) if rate else None,
            'errorRate':sum(e for e,n in rate)/sum(n for e,n in rate) if len(rate)>=3 and sum(n for e,n in rate)>=15 else None,
            'sourceTaskIds':ids[:100]}
    return {'dateRange':{'start':start,'end':end},'basis':'task_date_not_completion_date','distribution':distribution,
            'recordedTasks':sum(saved(record,t['id']) for t in chosen),'completed':sum(bool(record.get('done',{}).get(t['id'])) for t in chosen),
            'completionDates':'unknown','examScoreEstimate':None}


def analyze(con,templates,args:AnalysisRequest):
    today=date.fromisoformat(args.asOf) if args.asOf else date.today();stamp=today.isoformat()
    owner=profile(con,args.subject)
    if args.expectedProfileRevision is not None and owner['revision']!=args.expectedProfileRevision:fail('profile_revision_conflict',409)
    row,doc,loaded=read_snapshot(con,templates,args.subject,args.expectedRevision)
    if row is None and args.expectedRevision is not None:fail('phone_first_sync_required',409)
    tasks=effective_tasks(loaded[0],doc['record'],args.subject) if row else {};record=doc['record'] if row else {}
    policy=resolve_policy(owner,args.subject,today)
    sources={'analysisVersion':ANALYSIS_VERSION,'subject':args.subject,'asOf':stamp,'profileRevision':owner['revision'],
             'snapshotRevision':row['revision'] if row else 0,'snapshotUpdatedAt':row['updated_at'] if row else None,
             'templateHash':loaded[1] if row else None,'policyVersion':policy['policyVersion']}
    ref=f"snapshot:{args.subject}:{sources['snapshotRevision']}";issues=[]
    def issue(code,severity,evidence,samples=0,confidence='limited',action='请补充或核对记录后再决定。',ai=False,start=None,end=None,refs=None):
        issues.append({'issueCode':code,'subject':args.subject,'severity':severity,'dateRange':{'start':start or (today-timedelta(days=13)).isoformat(),'end':end or stamp},
            'evidence':evidence,'sourceRefs':refs or [ref],'sampleSize':samples,'confidence':confidence,'recommendedAction':action,'requiresAI':ai})
    windows={str(n):aggregate(tasks,record,(today-timedelta(days=n-1)).isoformat(),stamp) for n in (7,14)}
    previous=aggregate(tasks,record,(today-timedelta(days=13)).isoformat(),(today-timedelta(days=7)).isoformat())
    recent=windows['7']['distribution'];prior=previous['distribution']
    for kind,info in windows['14']['distribution'].items():
        if info['actualSamples'] and info['pairedActualMinutes']>info['pairedExpectedMinutes']*1.25:
            issue('actual_time_over_plan','warning',{'category':kind,'expected':info['pairedExpectedMinutes'],'actual':info['pairedActualMinutes']},info['actualSamples'],'observed','优先调整少数耗时任务的预计时间。',True)
        a,b=prior.get(kind,{}),recent.get(kind,{})
        if a.get('errorRate') is not None and b.get('errorRate') is not None and b['errorRate']-a['errorRate']>=0.1:
            issue('error_rate_increase','warning',{'category':kind,'previousErrorRate':a['errorRate'],'recentErrorRate':b['errorRate']},a['rateSamples']+b['rateSamples'],'sample_supported','先针对反复出错的内容做少量训练，不能据此估分。',True)
        if info['wrongSamples'] and info['errorRate'] is None:
            issue('accuracy_unknown','info',{'category':kind,'wrongSamples':info['wrongSamples'],'reason':'missing_denominators_or_insufficient_samples'},info['wrongSamples'],action='保留错题数量；题目总数或样本不足时不计算错误率。')
    if args.subject=='politics' and policy['courseMax'] is not None:
        for t in tasks.values():
            minutes=numeric(record.get('actualMinutes',{}),t['id'])
            if t.get('type')=='课程' and (today-timedelta(days=13)).isoformat()<=t['date']<=stamp and minutes is not None and minutes>policy['courseMax']:
                issue('recorded_course_time_over_limit','warning',{'taskId':t['id'],'recordedMinutes':minutes,'courseMax':policy['courseMax'],'basis':'saved_course_task_total_not_inferred_video_time'},1,'observed','先核对课程记录是否含练习时间，再调整看课安排。')
    future=[]
    for offset in range(1,8):
        day=(today+timedelta(days=offset)).isoformat();load=day_load(tasks,record,day,args.subject);load['date']=day
        load['budgetMinutes']=policy['advisoryMinutes'];load['unrecordedTaskCount']=sum(not saved(record,t['id']) for t in tasks.values() if t['date']==day and not is_vocabulary(t))
        known=bool(row and loaded[0]['meta']['start']<=day<=loaded[0]['meta']['end'])
        load['scheduleState']='known_template' if known else 'unknown'
        if not known:
            load.update(plannedMinutes=None,vocabularyMinutes=None,courseMinutes=None,practiceCount=None,unrecordedTaskCount=None)
            future.append(load)
            issue('future_plan_unavailable','info',{'date':day,'scheduleState':'unknown'},action='当前模板未覆盖该日；先确认计划范围，不把缺失当成空闲。',start=day,end=day)
            continue
        future.append(load)
        if policy['advisoryMinutes'] is not None and load['plannedMinutes']>policy['advisoryMinutes']:
            issue('future_load_over_budget','warning',load,load['unrecordedTaskCount'],'observed','减少或局部调整当天任务，不整批堆到次日。',True,day,day,policy['sourceRefs']+[ref])
        hard_minutes=load['plannedMinutes']
        if args.subject=='english' and policy['hardDailyScope']=='total':hard_minutes+=load['vocabularyMinutes']
        elif policy['hardDailyScope']=='vocabulary':hard_minutes=load['vocabularyMinutes']
        elif policy['hardDailyScope']=='course':hard_minutes=load['courseMinutes']
        if policy['hardDailyMax'] is not None and hard_minutes>policy['hardDailyMax']:
            issue('hard_daily_limit_exceeded','warning',load,confidence='observed',action='调整到本人已确认的硬性上限内。',start=day,end=day)
        if policy['courseMax'] is not None and load['courseMinutes']>policy['courseMax']:
            issue('course_limit_exceeded','warning',{'date':day,'plannedCourseMinutes':load['courseMinutes'],'courseMax':policy['courseMax'],'actualWatchTime':'unknown'},confidence='observed',action='课程计划过长；实际观看时间只按已填写记录判断。',start=day,end=day)
        if args.subject=='english' and policy['requireDailyPractice'] and not load['practiceCount']:
            issue('daily_practice_missing','info',{'date':day,'plannedPracticeCount':0},action='如当天有时间，保留一组短练习；这不是未学习的结论。',start=day,end=day)
    backlog=[t for t in tasks.values() if t['date']<stamp and not is_vocabulary(t) and not record.get('done',{}).get(t['id']) and not record.get('notDone',{}).get(t['id'])]
    if len(backlog)>=3:issue('unresolved_plan_backlog','warning',{'count':len(backlog),'meaning':'unresolved_schedule_not_proof_of_no_study','taskIds':[t['id'] for t in backlog[:20]]},len(backlog),action='先核对状态，再择要处理；不自动补到明天。',ai=True)
    expected=('阅读','新题型','完形','翻译','写作') if args.subject=='english' else ('课程','刷题','背诵')
    for kind in expected:
        matching=[v for k,v in windows['14']['distribution'].items() if k==kind or (kind=='阅读' and k=='阅读二刷')]
        count=sum(v['withRecord'] for v in matching)
        if count==0:issue('training_evidence_missing','info',{'category':kind,'meaning':'no_saved_training_evidence_not_no_training'},action='核对是否练过；需要时再考虑少量补练。')
    if policy['advisoryMinutes'] is None:issue('budget_unknown','warning',{'budget':'unknown','fallbackUsed':False},action='先确认可用时间，才能给出精确时间规划。')
    if any(e['active'] and e.get('validUntil') and e['validUntil']<stamp for e in owner['entries']):
        issue('profile_information_expired','info',{'profileRevision':owner['revision']},action='确认已过期的档案规则，不沿用旧进度。')
    if not windows['14']['recordedTasks']:issue('insufficient_recent_records','info',{'recordedTasks':0},action='当前没有足够近期记录；可以先继续正常打卡。')
    elif row and row['updated_at'][:10]<(today-timedelta(days=7)).isoformat():
        issue('cloud_snapshot_stale','info',{'updatedAt':row['updated_at'],'phoneLocalState':'unknown'},action='先联网同步手机，避免分析旧云端快照。')
    goals=[e for e in owner['entries'] if e['active'] and e['category']=='goal' and e['temporal']=='current' and (not e.get('validUntil') or e['validUntil']>=stamp)]
    if goals and any(i['issueCode']=='future_load_over_budget' for i in issues):
        issue('goal_time_feasibility_review','info',{'goalsPresent':True,'scoreFeasibility':'unknown','overloadedDays':sum(i['issueCode']=='future_load_over_budget' for i in issues)},action='目标与当前负荷需要协调；现有数据不足以判断能否达到具体分数。',ai=True)
    if sum(v['actualSamples'] for v in windows['14']['distribution'].values())<3:
        issue('time_samples_insufficient','info',{'requiredSamples':3},action='实际用时样本不足，不能精确预测训练耗时。')
    issues.sort(key=lambda i:({'warning':0,'info':1}[i['severity']],i['issueCode'],i['dateRange']['start']))
    return {'analysisVersion':ANALYSIS_VERSION,'subject':args.subject,'sources':sources,'fingerprint':fingerprint(sources),
            'windows':windows,'future7Days':future,'policy':policy,'issues':issues[:50],
            'uncertainties':['未打卡不等于没学习。','任务日期不是实际完成日期。','历史档案不计入真实打卡。','没有题目总数和足够样本不算错误率，不估考试分数。'],
            'automaticExecution':False}
