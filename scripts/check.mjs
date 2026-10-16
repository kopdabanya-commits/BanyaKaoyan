import fs from 'node:fs';
import assert from 'node:assert/strict';
const p=JSON.parse(fs.readFileSync(new URL('../plan.json',import.meta.url),'utf8'));
assert.equal(p.meta.start,'2026-10-15');assert.equal(p.meta.end,'2026-12-18');assert.equal(p.days.length,65);
let d=new Date('2026-10-15T12:00:00+08:00');const seen=new Set();let count=0;
for(const day of p.days){const expected=[d.getUTCFullYear(),String(d.getUTCMonth()+1).padStart(2,'0'),String(d.getUTCDate()).padStart(2,'0')].join('-');assert.equal(day.date,expected);let minutes=0;for(const task of day.items){assert.ok(typeof task.title==='string'&&task.title.length>1);assert.ok(typeof task.id==='string'&&!seen.has(task.id));seen.add(task.id);assert.ok(Number.isInteger(task.minutes)&&task.minutes>0);minutes+=task.minutes;count++;}assert.ok(minutes+40<=135,day.date+' minutes overflow');d.setUTCDate(d.getUTCDate()+1);}
assert.ok(count>60);const fallback=fs.readFileSync(new URL('../plan-data.js',import.meta.url),'utf8');assert.ok(fallback.includes(p.meta.planVersion));console.log('检查通过：'+p.days.length+'天，'+count+'项计划任务，兜底版本一致');


const context={window:{}};const vm=await import('node:vm');vm.runInNewContext(fallback,context);assert.deepEqual(JSON.parse(JSON.stringify(context.window.STUDY_PLAN)),p);
for(const day of p.days)for(const vocab of [30,35,40]){const total=vocab+day.items.reduce((n,t)=>n+t.minutes,0);assert.ok(total>=(['2026-10-16','2026-12-18'].includes(day.date)?70:90)&&total<=135,day.date+' budget');}
assert.ok(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8').includes('./planner-core.js'));
const deploy=JSON.parse(fs.readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));assert.equal(deploy.name,'english-ii-plan');assert.equal(deploy.assets.directory,'.');assert.equal(typeof deploy.workers_dev,'boolean');assert.equal(deploy.preview_urls,false);assert.equal(deploy.workers_dev,true,'用户已开启免费的公开 workers.dev 地址；下次部署不能把它关闭');

// M2.2优化不得改变65天任务总数及唯一ID。
assert.equal(p.meta.revision,10);
assert.equal(p.meta.planVersion,'2026.10.16-english-r10');
assert.equal(p.days.flatMap(d=>d.items).length,191);
for(const day of p.days){const specialty=day.items.reduce((total,t)=>total+t.minutes,0);assert.ok(specialty>=(['2026-10-16','2026-12-18'].includes(day.date)?40:60) && specialty<=90,'专项训练总时长异常: '+day.date);}
const today=p.days.find(d=>d.date==='2026-10-15');assert.equal(today.items.reduce((s,t)=>s+t.minutes,0),65);assert(today.items.some(t=>t.title.includes('2014年新题型')));assert(!p.days.find(d=>d.date==='2026-10-17').items.some(t=>t.title.includes('2014年新题型：限时')));
assert.ok(p.days.every(d=>d.items.every(t=>typeof t.detail==='string'&&t.detail.trim().length>=8)), '每项任务都要提供可执行说明');

// M2.6：客观题题感训练不断档；综合模考第2分段原本已包含新题型、阅读和完形，无需重复加题。
const objective=new Set(['阅读','新题型','完形']);
for(const d of p.days){assert.ok(d.items.some(t=>objective.has(t.type)||(t.type==='综合'&&/阅读Text\s*4.*新题型.*完形/.test(t.title))),d.date+' 缺少客观题训练');}
assert.equal(p.days.flatMap(d=>d.items).filter(t=>t.id.startsWith('daily-feel-')).length,42);
assert.ok(p.days.flatMap(d=>d.items).filter(t=>t.id.startsWith('daily-feel-')).every(t=>t.minutes===25||(['daily-feel-2026-10-16','daily-feel-2026-12-18'].includes(t.id)&&t.minutes===20)));
assert.ok(!p.days.flatMap(d=>d.items).filter(t=>t.id.startsWith('daily-feel-')).some(t=>/202[456]年/.test(t.title)),'新增题感不得提前消耗模拟保留卷');

// M2.7：10月15日确认为未学，但不得改写真实打卡；10月16日重启，不叠加昨日整天任务。
assert.ok(p.meta.missedStart.includes('2026-10-15'));
const reset=p.days.find(d=>d.date==='2026-10-16');
assert.equal(reset.items.reduce((n,t)=>n+t.minutes,0),55);
assert(reset.items.some(t=>t.id==='restart-2026-10-16-writing'&&t.type==='写作'&&t.title.includes('2011年小作文')&&t.minutes===20));
assert(reset.items.some(t=>t.type==='新题型'&&t.title.includes('2014年')));
assert(reset.items.some(t=>t.type==='阅读'&&t.title.includes('Text 4')));
const next=p.days.find(d=>d.date==='2026-10-17');
assert.equal(next.items.reduce((n,t)=>n+t.minutes,0),80);
assert(next.items.some(t=>t.id==='2026-10-16-1'&&t.type==='写作'&&t.minutes===15));
assert(next.items.some(t=>t.type==='完形'&&t.title.includes('2013年')));
assert.deepEqual(p.meta.retest,[[2024,'2026-11-21'],[2025,'2026-12-05'],[2026,'2026-12-12']]);

// M2.7.1: 用户不要10月18日2011年小作文，改为邀请信训练，不修改客观题和未来安排。
const writingSwap=p.days.find(d=>d.date==='2026-10-18');
const invitation=writingSwap.items.find(t=>t.id==='2026-10-18-1');
assert.equal(invitation.minutes,25);
assert.equal(invitation.type,'写作');
assert(invitation.title.includes('邀请信')&&!invitation.title.includes('2011年小作文'));
assert(!writingSwap.items.some(t=>t.title.includes('2011年小作文')));
assert(writingSwap.items.some(t=>t.type==='新题型'&&t.title.includes('2011年')));
assert.equal(writingSwap.items.reduce((n,t)=>n+t.minutes,0),80);

// 英语revision9：新增澄清只改10月16日的写作，不覆盖上一个PR已改的10月18日邀请信。
const revisedWriting=reset.items.find(t=>t.id==='restart-2026-10-16-writing');
assert(revisedWriting.detail.includes('2011年英语二小作文'));
assert(reset.items.some(t=>t.id==='restart-2026-10-16-newtype'&&t.minutes===15));
assert(reset.items.some(t=>t.id==='daily-feel-2026-10-16'&&t.minutes===20));
const preservedInvitation=p.days.find(d=>d.date==='2026-10-18').items.find(t=>t.id==='2026-10-18-1');
assert(preservedInvitation.title.includes('邀请信')&&preservedInvitation.minutes===25);

// revision10: user-reported reality, fast marking, and practice-first schedule must not reassign completed years.
assert(reset.items.find(t=>t.id==='restart-2026-10-16-writing').title.includes('2011年小作文'));
assert(!reset.items.some(t=>t.type==='写作'&&t.title.includes('2010年小作文')));
assert(reset.items.find(t=>t.id==='restart-2026-10-16-newtype').title.includes('2014年'));
assert(reset.items.find(t=>t.id==='daily-feel-2026-10-16').title.includes('2011年阅读'));
assert(p.days.find(d=>d.date==='2026-10-15').items[0].title.includes('历史旧任务'));
const newPractices=p.days.flatMap(d=>d.items).filter(t=>t.id.startsWith('practice-'));
assert.equal(newPractices.length,48);
assert(newPractices.every(t=>['阅读','新题型','完形'].includes(t.type)));
assert(p.days.filter(d=>d.date>='2026-10-17'&&d.date<='2026-12-17').every(d=>d.items.every(t=>t.type!=='复盘')));
for(const [y,start,end] of [[2024,'2026-11-21','2026-11-24'],[2025,'2026-12-05','2026-12-08'],[2026,'2026-12-12','2026-12-15']]){
 const relevant=p.days.filter(d=>d.date>=start&&d.date<=end);
 assert.equal(relevant.length,4);
 assert(relevant.every(d=>d.items.some(t=>t.title.includes(y+'年模考'))));
 assert(relevant.every(d=>!d.items.some(t=>t.id.startsWith('practice-'))));
}
