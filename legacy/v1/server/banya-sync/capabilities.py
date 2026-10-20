"""Server allowlist for M7.1 read-only capabilities, not arbitrary tool execution."""
from contextlib import closing
from dataclasses import dataclass
from typing import Literal

from fastapi import Header, Request
from pydantic import Field, ValidationError

from agent_api import StrictModel, fail, read_model
from context_engine import CONTEXT_VERSION, ContextRequest, build_context
from learning_memory import SCHEMA, profile
from learning_analysis import AnalysisRequest,analyze
from learning_planner import PlanningRequest,prepare


class ProfileInput(StrictModel):
    subject: Literal['english','politics']


class ReadCall(StrictModel):
    capability: str = Field(min_length=1,max_length=80)
    version: str = Field(min_length=1,max_length=20)
    profileSchema: int = Field(ge=1)
    contextVersion: str
    arguments: dict


@dataclass(frozen=True)
class Capability:
    id: str
    version: str
    description: str
    input_model: type
    output_fields: tuple
    enabled: bool = True
    profile_schema: int = SCHEMA
    context_version: str = CONTEXT_VERSION


REGISTRY=(
    Capability('learning.detect','1','只读检测已保存的学习证据，不估分，不调用模型。',AnalysisRequest,('analysisVersion','subject','sources','fingerprint','windows','future7Days','policy','issues','uncertainties','automaticExecution')),
    Capability('learning.planning.prepare','1','准备每日、每周或阶段诊断上下文；仅预览，不执行。',PlanningRequest,('planningVersion','subject','mode','context','analysis','sources','fingerprint','previewOnly')),
    Capability('learning.profile.read','1','读取当前科目的私人档案；历史资料不是打卡。',ProfileInput,
               ('schemaVersion','subject','revision','entries','updatedAt')),
    Capability('learning.context.build','1','构建有限、带来源的只读学习上下文；不调用模型。',ContextRequest,
               ('contextVersion','subject','serverSafety','hardRules','background','tasks','sources','truncation')),
)
IMPLEMENTATIONS={'learning.detect':lambda con,templates,args:analyze(con,templates,args),
                 'learning.planning.prepare':lambda con,templates,args:prepare(con,templates,args),
                 'learning.profile.read':lambda con,templates,args:profile(con,args.subject),
                 'learning.context.build':lambda con,templates,args:build_context(con,templates,args)}


def available():
    return [c for c in REGISTRY if c.enabled and c.id in IMPLEMENTATIONS and c.profile_schema==SCHEMA and c.context_version==CONTEXT_VERSION]


def manifest():
    return {'registryVersion':'m7.2-readonly-v1','capabilities':[
        {'id':c.id,'version':c.version,'description':c.description,'inputSchema':c.input_model.model_json_schema(),
         'outputSchema':{'type':'object','required':list(c.output_fields),'properties':{key:{'type':('integer' if key in ('schemaVersion','revision') else 'array' if key in ('entries','hardRules','background','tasks','future7Days','issues','uncertainties') else 'object' if key in ('serverSafety','sources','truncation','windows','policy','context','analysis') else 'boolean' if key in ('automaticExecution','previewOnly') else ['string','null'] if key=='updatedAt' else 'string')} for key in c.output_fields}},
         'access':'read_only','subjects':['english','politics'],'permissions':['owner:read'],
         'compatibility':{'profileSchema':c.profile_schema,'contextVersion':c.context_version},'enabled':True}
        for c in available()]}


def install_capability_routes(app,db,connect,authorize,templates):
    @app.get('/v1/ai/capabilities')
    def get_capabilities(authorization: str | None = Header(default=None)):
        authorize(authorization)
        # If a migration is incomplete, none of its capabilities are advertised.
        with closing(connect(db)) as con:
            for subject in ('english','politics'):profile(con,subject)
        return manifest()

    @app.post('/v1/ai/read')
    async def invoke(request: Request, authorization: str | None = Header(default=None)):
        authorize(authorization)
        body=await read_model(request,ReadCall)
        selected=next((c for c in available() if c.id==body.capability and c.version==body.version),None)
        if selected is None:fail('capability_unavailable',409)
        if body.profileSchema!=selected.profile_schema or body.contextVersion!=selected.context_version:
            fail('capability_incompatible',409)
        try:args=selected.input_model.model_validate(body.arguments)
        except ValidationError:fail('invalid_capability_arguments')
        with closing(connect(db)) as con:
            con.execute('BEGIN')  # One consistent SQLite read view for all subjects and versions.
            return {'capability':selected.id,'version':selected.version,'result':IMPLEMENTATIONS[selected.id](con,templates,args)}

    @app.post('/v1/ai/context')
    async def context(request: Request, authorization: str | None = Header(default=None)):
        authorize(authorization)
        args=await read_model(request,ContextRequest)
        selected=next((c for c in available() if c.id=='learning.context.build'),None)
        if selected is None:fail('capability_unavailable',409)
        with closing(connect(db)) as con:
            con.execute('BEGIN')
            return build_context(con,templates,args)

    for path,cap_id in (('/v1/ai/analysis','learning.detect'),('/v1/ai/planning/prepare','learning.planning.prepare')):
        def endpoint_factory(capability_id):
            async def endpoint(request: Request, authorization: str | None = Header(default=None)):
                authorize(authorization)
                selected=next((c for c in available() if c.id==capability_id),None)
                if selected is None:fail('capability_unavailable',409)
                args=await read_model(request,selected.input_model)
                with closing(connect(db)) as con:
                    con.execute('BEGIN')
                    return IMPLEMENTATIONS[capability_id](con,templates,args)
            return endpoint
        app.add_api_route(path,endpoint_factory(cap_id),methods=['POST'])
