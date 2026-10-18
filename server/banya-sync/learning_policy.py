"""Structured owner rules. Never interprets prose as execution permission."""
from datetime import date
from private_plan import PlanError


def resolve_policy(document,subject,as_of=None):
    today=(as_of or date.today()).isoformat()
    active=[e for e in document['entries'] if e['active'] and e['temporal']=='current' and e['certainty'] in ('confirmed','reported')
            and (not e.get('validUntil') or e['validUntil']>=today)]
    active.sort(key=lambda e:(-e['entryRevision'],e['key']))
    def ref(e):return f"profile:{subject}:{document['revision']}:{e['key']}"
    budgets=[e for e in active if e['category']=='budget' and type(e['value'].get('minutes')) is int
             and e['value'].get('scope') in (None,'non_vocabulary' if subject=='english' else 'total')]
    constraints={}
    for e in active:
        if e['category']=='constraint' and e['certainty']=='confirmed' and e['value'].get('rule'):
            constraints.setdefault(e['value']['rule'],e)
    def minutes(rule):return constraints.get(rule,{}).get('value',{}).get('minutes')
    return {'policyVersion':'learning-policy-v1','subject':subject,'profileRevision':document['revision'],
            'advisoryMinutes':budgets[0]['value']['minutes'] if budgets else None,
            'budgetScope':'non_vocabulary' if subject=='english' else 'total',
            'hardDailyMax':minutes('daily_limit'),'hardDailyScope':constraints.get('daily_limit',{}).get('value',{}).get('scope') or ('non_vocabulary' if subject=='english' else 'total'),'courseMax':minutes('course_limit'),
            'requireDailyPractice':'daily_practice' in constraints,
            'sourceRefs':([ref(budgets[0])] if budgets else [])+[ref(e) for e in constraints.values()],
            'budgetState':'known' if budgets else 'unknown','hardRuleKeys':[e['key'] for e in constraints.values()]}


def is_vocabulary(task):
    return task.get('type')=='单词' or task['id'].endswith('-vocab')


def day_load(tasks,record,day,subject):
    selected=[t for t in tasks.values() if t['date']==day and not record.get('notDone',{}).get(t['id'])]
    return {'plannedMinutes':sum(t['minutes'] for t in selected if subject!='english' or not is_vocabulary(t)),
            'vocabularyMinutes':sum(t['minutes'] for t in selected if subject=='english' and is_vocabulary(t)),
            'courseMinutes':sum(t['minutes'] for t in selected if t.get('type')=='课程'),
            'practiceCount':sum(t.get('type') in ('阅读','新题型','完形','翻译','写作') for t in selected)}


def validate_limits(tasks,record,subject,days,policy,require_budget=False,available=None):
    if require_budget and policy['advisoryMinutes'] is None and available is None:
        raise PlanError('planning_budget_unknown',409)
    for day in days:
        load=day_load(tasks,record,day,subject)
        advisory=available if available is not None else policy['advisoryMinutes']
        if require_budget and advisory is not None and load['plannedMinutes']>advisory:
            raise PlanError('planning_budget_exceeded',409)
        hard_minutes=load['plannedMinutes']
        if subject=='english' and policy['hardDailyScope']=='total':hard_minutes+=load['vocabularyMinutes']
        elif policy['hardDailyScope']=='vocabulary':hard_minutes=load['vocabularyMinutes']
        elif policy['hardDailyScope']=='course':hard_minutes=load['courseMinutes']
        if policy['hardDailyMax'] is not None and hard_minutes>policy['hardDailyMax']:
            raise PlanError('hard_daily_limit_exceeded',409)
        if policy['courseMax'] is not None and load['courseMinutes']>policy['courseMax']:
            raise PlanError('course_limit_exceeded',409)
        if subject=='english' and policy['requireDailyPractice'] and not load['practiceCount']:
            raise PlanError('daily_practice_required',409)


def owner_policy(con,subject):
    from learning_memory import profile
    return resolve_policy(profile(con,subject),subject)
