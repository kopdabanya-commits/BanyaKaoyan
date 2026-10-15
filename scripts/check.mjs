import fs from 'node:fs';
import assert from 'node:assert/strict';
const p=JSON.parse(fs.readFileSync(new URL('../plan.json',import.meta.url),'utf8'));
assert.equal(p.meta.start,'2026-10-15');assert.equal(p.meta.end,'2026-12-18');assert.equal(p.days.length,65);
let d=new Date('2026-10-15T12:00:00+08:00');const seen=new Set();let count=0;
for(const day of p.days){const expected=[d.getUTCFullYear(),String(d.getUTCMonth()+1).padStart(2,'0'),String(d.getUTCDate()).padStart(2,'0')].join('-');assert.equal(day.date,expected);let minutes=0;for(const task of day.items){assert.ok(typeof task.title==='string'&&task.title.length>1);assert.ok(typeof task.id==='string'&&!seen.has(task.id));seen.add(task.id);assert.ok(Number.isInteger(task.minutes)&&task.minutes>0);minutes+=task.minutes;count++;}assert.ok(minutes+35<=120,day.date+' minutes overflow');d.setUTCDate(d.getUTCDate()+1);}
assert.ok(count>60);const fallback=fs.readFileSync(new URL('../plan-data.js',import.meta.url),'utf8');assert.ok(fallback.includes(p.meta.planVersion));console.log('检查通过：'+p.days.length+'天，'+count+'项计划任务，兜底版本一致');


const context={window:{}};const vm=await import('node:vm');vm.runInNewContext(fallback,context);assert.deepEqual(JSON.parse(JSON.stringify(context.window.STUDY_PLAN)),p);
for(const day of p.days)for(const vocab of [30,35,40]){const total=vocab+day.items.reduce((n,t)=>n+t.minutes,0);assert.ok(total>=90&&total<=120,day.date+' budget');}
assert.ok(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8').includes('./planner-core.js'));
const deploy=JSON.parse(fs.readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));assert.equal(deploy.name,'english-ii-plan');assert.equal(deploy.assets.directory,'.');assert.equal(deploy.workers_dev,false);assert.equal(deploy.preview_urls,false);
