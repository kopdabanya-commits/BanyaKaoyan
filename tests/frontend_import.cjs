'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const src = fs.readFileSync('assets/app.js', 'utf8');
const start = src.indexOf('function parsePlan(text) {');
const end = src.indexOf('\nfunction openImport(preset) {', start);
assert.ok(start >= 0 && end > start, 'import helpers must exist');

let i = 0;
const ctx = {
  TYPES: ['阅读','翻译','写作','完形','新题型','单词','背诵','刷题','复盘','课程','其他'],
  DATE_RE: /(\d{4})-(\d{2})-(\d{2})/,
  subject: 'english',
  uid: () => 'test-' + (++i),
  today: () => '2026-10-30',
  normalizeDate: (d) => d === '' ? '' : String(d || '2026-10-30'),
  subjectFor: (_cells, title) => /政治/.test(title) ? 'politics' : 'english',
  state: { tasks: [] },
  kindOf: (t) => t.type === '阅读' ? '阅' : t.type === '写作' ? /小作文/.test(t.title) ? '小' : '大'
    : ({'完形':'完','新题型':'新','翻译':'译'}[t.type] || ''),
  roundOf: (t) => t.round === 2 || /二刷/.test(t.title) ? 2 : 1,
  touch: (t) => { t.updatedAt = 123456789; },
};
ctx.live = () => ctx.state.tasks.filter(t => !t.deleted);
const { parsePlan, mergeProgress, progressKey } = vm.runInNewContext(
  src.slice(start, end) + '\n({ parsePlan, mergeProgress, progressKey })', ctx
);

const rows = parsePlan(JSON.stringify([
  {title:'阅读二刷 2013 Text 2',date:'2026-10-30',subject:'english',type:'阅读',minutes:25,done:true,score:6,scoreMax:10,round:2},
  {title:'完形 2015',date:'2026-10-22',subject:'english',type:'完形',minutes:20,done:true,score:7,scoreMax:10},
  {title:'旧题 2014',date:'',type:'完形',done:true,minutes:20}
]));
assert.equal(rows.length,3);
assert.equal(rows[0].score,6,'JSON score must not be lost');
assert.equal(rows[0].done,true);
assert.equal(rows[0].round,2);
assert.equal(rows[2].date,'','historical date must stay empty');
assert.throws(()=>parsePlan('[{"title":"阅读 2013 Text 2","score":15,"scoreMax":10}]'));

ctx.state.tasks.push({id:'existing',subject:'english',date:'2026-10-27',
  title:'英语二·阅读二刷 2013 Text 2',type:'阅读',minutes:25,done:false,notDone:false,score:null,updatedAt:1});
const first = mergeProgress(rows.slice(0,2));
assert.equal(first.updated,1);
assert.equal(first.added,1);
assert.equal(ctx.state.tasks.length,2);
assert.equal(ctx.state.tasks[0].id,'existing','must reuse existing id');
assert.equal(ctx.state.tasks[0].score,6);
assert.equal(ctx.state.tasks[0].done,true);
assert.equal(ctx.state.tasks[0].date,'2026-10-30','completion date replaces not-yet-done planned date');

const second = mergeProgress(rows.slice(0,2));
assert.equal(second.updated,0);
assert.equal(second.added,0,'reimport must be idempotent');
assert.equal(second.unchanged,2);
assert.equal(progressKey(rows[0]),progressKey(ctx.state.tasks[0]));

const withoutScore = parsePlan('[{"title":"阅读二刷 2013 Text 2","subject":"english","date":"2026-10-30","type":"阅读","done":true,"round":2}]');
mergeProgress(withoutScore);
assert.equal(ctx.state.tasks[0].score,6,'missing score must not erase known score');
console.log('frontend import and progress tests passed');
