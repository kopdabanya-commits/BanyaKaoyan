import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const englishCore=require('../planner-core.js'),politicsCore=require('../politics-core.js');
const txt=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const js=p=>JSON.parse(txt(p));
const en=js('plan.json'),pol=js('politics-plan.json'),manifest=js('manifest.webmanifest');
function offlinePlan(file,rootKey){const win={window:{}};vm.runInNewContext(txt(file),win);return JSON.parse(JSON.stringify(win.window[rootKey]));}
test('single 板牙考研 PWA: one shell, two active subject modules, same origin',()=>{
 const html=txt('index.html'),script=txt('app.js'),intel=txt('study-intelligence.js'),sw=txt('sw.js');
 assert.equal(manifest.short_name,'板牙考研');
 assert(manifest.name.startsWith('板牙考研'));
 assert(html.includes('<title>板牙考研'));
 assert(html.includes('<span>板牙考研</span>'),'mobile header remains recognizable but compact');
 for(const src of ['./planner-core.js','./plan-data.js','./politics-core.js','./politics-plan-data.js','./politics-ui.js','./study-intelligence.js','./study-ui.js','./app.js'])assert(html.includes(src));
 assert(html.includes('id="app"')&&html.includes('class="bottom-nav"'));
 assert(script.includes('const subjectBar=renderSubjects()'),'same subject selector on all pages');
 assert(script.includes("subject==='politics'?renderPolitics()"),'politics is an internal route');
 assert(script.includes("SUBJECT_KEY='banya_active_subject_v1'"),'only selected tab is new metadata');
 assert(!script.includes('政治为下一阶段预留了独立入口'),'no false politics waiting state');
 assert(intel.includes("status:'active'")&&intel.includes("id:'english'")&&intel.includes("id:'politics'"));
 assert.match(sw,/yantu-english-ii-m7-4-/);
 assert(html.includes('./plan-import.js'));
 assert(html.includes('./cloud-sync.js'));
 assert(html.includes('./origin-transfer.js'));
 assert(sw.includes("'./plan-import.js'"));
 assert(sw.includes("'./cloud-sync.js'"));
 assert(sw.includes("'./origin-transfer.js'"));
 assert(script.includes('BanyaPlanImport.panel()'));
 assert(script.includes('BanyaCloudSync.panel()'));
 assert.equal(js('wrangler.jsonc').name,'english-ii-plan','keep original Worker and user data origin');
 assert.equal(manifest.start_url,'./index.html');assert.equal(manifest.id,'./');
});
test('English and politics retain separate plans and stable legacy backup/data identifiers',()=>{
 assert(englishCore.validPlan(en));assert(politicsCore.validPlan(pol));
 assert.equal(en.days.length,65);assert.equal(en.days.flatMap(d=>d.items).length,191);
 assert.equal(pol.days.length,64);assert.equal(pol.days.flatMap(d=>d.items).length,192);
 assert.deepEqual(offlinePlan('plan-data.js','STUDY_PLAN'),en);
 assert.deepEqual(offlinePlan('politics-plan-data.js','POLITICS_PLAN'),pol);
 const eng=txt('app.js'),pc=txt('politics-core.js'),pu=txt('politics-ui.js');
 assert(eng.includes("STORAGE_KEY = 'yantu_english_2026_m1'"));
 assert(eng.includes("PLAN_KEY='yantu_english_plan_v2'"));
 assert(eng.includes("app:'yantu-english-ii'"),'old English JSON backups must stay importable');
 assert(pc.includes("key='yantu_politics_2026_v1'"));
 assert(pu.includes("app:'yantu-politics'"),'old political backups must remain importable');
 assert(!pu.includes('yantu_english_2026_m1'),'politics never edits English records');
 assert(!eng.includes("localStorage.removeItem(STORAGE_KEY)"));
 assert(!pu.includes("localStorage.removeItem(Core.key)"));
});
test('both disciplines use one cache and neither plan JSON is intercepted',()=>{
 const sw=txt('sw.js');
 for(const resource of ['./plan-data.js','./politics-plan-data.js','./planner-core.js','./politics-core.js','./politics-ui.js','./study-ui.js'])assert(sw.includes("'"+resource+"'"));
 assert(sw.includes("url.pathname.endsWith('/plan.json')"));
 assert(sw.includes("url.pathname.endsWith('/politics-plan.json')"));
 assert(!sw.includes('skipWaiting(')||sw.includes('Do not skipWaiting:'),'must not force-update running PWA');
});
test('branding changes only UI; old backup format stays distinct and storage isolated',()=>{
 const html=txt('index.html'),manifestText=txt('manifest.webmanifest'),pu=txt('politics-ui.js'),enUi=txt('app.js');
 assert(html.includes('板牙考研')&&manifestText.includes('板牙考研'));
 assert(pu.includes('板牙考研_政治备份_'));
 assert(enUi.includes('板牙考研_英语二备份_'));
 assert.notEqual(politicsCore.key,'yantu_english_2026_m1');
 assert(!html.includes('研途')&&!manifestText.includes('研途'));
});

test('deployment never publishes backend source or secrets as static assets',()=>{
 const ignore=txt('.assetsignore'),headers=txt('_headers');
 const patterns=ignore.split(String.fromCharCode(10)).map(x=>x.trim());
 assert(patterns.includes('*'),'deny all undeclared public assets by default');
 for(const file of ['!index.html','!sw.js','!study-ui.js','!cloud-sync.js','!plan-import.js','!plan.json','!politics-plan.json','!_headers','!icons/']) assert(patterns.includes(file),'missing public allowlist entry: '+file);
 assert(patterns.includes('server/'),'never expose ECS backend through public Worker static assets');
 assert(headers.includes("connect-src 'self' https://124.70.128.201;"),'CSP must allow exactly the verified ECS HTTPS origin');
 assert(!headers.includes('https:;')&&!headers.includes('https://*'),'never allow wildcard API destinations');
 assert(txt('cloud-sync.js').includes("const API_ORIGIN = 'https://124.70.128.201'"),'client must pin the same origin');
});
test('ECS fallback serves only PWA allowlist while keeping the authenticated API',()=>{
 const nginx=txt('server/banya-sync/nginx-ip.conf'),installer=txt('server/banya-sync/install-pwa-fallback.sh');
 assert(nginx.includes('location = /health')&&nginx.includes('location ^~ /v1/'));
 assert(nginx.includes('location = /manifest.webmanifest'));
 assert(nginx.includes('plan-import\\.js'));
 assert(nginx.includes('origin-transfer\\.js')&&nginx.includes('icons/icon-'));
 assert(nginx.includes('location / { return 404; }'));
 assert(nginx.includes('X-Robots-Tag "noindex, nofollow"'));
 assert(!nginx.includes('docs/PROJECT_STATUS.md')&&!nginx.includes('server/banya-sync/app.py'));
 assert(installer.includes('rollback()')&&installer.includes('nginx -t'));
});

test('M4 shared task-first component is used by both subjects; stats are actual-record-only',()=>{
 const ui=txt('study-ui.js'),english=txt('app.js'),politics=txt('politics-ui.js');
 assert(ui.includes('dayHeading(')&&ui.includes('function task(')&&ui.includes('function stats('));
 assert(english.includes('UI.dayHeading(')&&english.includes('UI.task(')&&english.includes('BanyaStudyUI.trainingRecords('));
 assert(politics.includes('UI.dayHeading(')&&politics.includes('UI.task(')&&politics.includes('UI.trainingRecords('));
 assert(!english.includes('premium-hero')&&!english.includes('focus-panel'));
 assert(english.includes('BanyaCloudSync.panel()'),'cloud controls stay in settings');
 assert(!english.includes('BanyaCloudSync.quickPanel()'),'cloud sync must not obscure the daily tasks');
 const env={window:{}};vm.runInNewContext(ui,env);
 const sample={item:{id:'x',title:'训练例子',type:'阅读',minutes:20},day:'2026-10-16',done:true,wrong:1};
 const a=env.window.BanyaStudyUI.task({...sample,subject:'english'});
 const b=env.window.BanyaStudyUI.task({...sample,subject:'politics'});
 assert(a.includes('student-task')&&b.includes('student-task'));
 assert(a.includes('data-action="toggle"')&&b.includes('data-action="p-toggle"'));
 assert(!a.includes('训练说明文字'));
 const output=env.window.BanyaStudyUI.stats({today:'2026-10-16',days:[{date:'2026-10-16',done:2,total:3}],categories:[]});
 assert(output.includes('近7日已打卡')&&output.includes('>2<'));
 assert(!output.includes('计划总完成率'));
});
