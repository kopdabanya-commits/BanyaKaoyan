import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const Core=require('../politics-core.js');
const politics=JSON.parse(fs.readFileSync(new URL('../politics-plan.json',import.meta.url)));
const serialized=fs.readFileSync(new URL('../politics-plan-data.js',import.meta.url),'utf8');
const uiCode=fs.readFileSync(new URL('../politics-ui.js',import.meta.url),'utf8');
const deep=x=>JSON.parse(JSON.stringify(x));
function harness(){
 const handlers={},storage=new Map(),elements={};
 const doc={addEventListener:(event,fn)=>(handlers[event]??=[]).push(fn),getElementById:id=>elements[id]||(elements[id]={value:''}),createElement:()=>({click(){}})};
 const win={PoliticsCore:Core,POLITICS_PLAN:politics,addEventListener(){},POLITICS_NAV(v){lastNav=v}};let lastNav='';
 const ctx={window:win,document:doc,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},Date,Blob,URL:{createObjectURL:()=>'',revokeObjectURL(){}},setTimeout(){},console,confirm:()=>true,alert:()=>{}};
 vm.createContext(ctx);vm.runInContext(uiCode,ctx);
 const render=(view='today',day='2026-10-16')=>win.PoliticsUI.render(view,day,x=>x,()=>{});
 const click=(action,opts={})=>{const b={dataset:{action,...opts}};for(const f of handlers.click||[])f({target:{closest:()=>b},preventDefault(){},stopImmediatePropagation(){}})};
 const submit=(id,opts={})=>{for(const f of handlers.submit||[])f({target:{id,dataset:opts},preventDefault(){},stopImmediatePropagation(){}})};
 return {render,click,submit,storage,elements,win,get lastNav(){return lastNav}};
}
test('2027 politics 64 valid calendar days and unique task ids',()=>{
 assert(Core.validPlan(politics));assert.equal(politics.days.length,64);assert.equal(politics.days[0].date,'2026-10-16');assert.equal(politics.days.at(-1).date,'2026-12-18');
 assert.equal(new Set(politics.days.flatMap(d=>d.items.map(x=>x.id))).size,192);
 assert(politics.days.some(d=>d.items.some(t=>t.title.includes('肖八'))));
 assert(politics.days.some(d=>d.items.some(t=>t.title.includes('肖四'))));
});
test('politics fallback plan data exactly matches JSON',()=>{
 const ctx={window:{}};vm.runInNewContext(serialized,ctx);assert.deepEqual(deep(ctx.window.POLITICS_PLAN),politics);
});
test('initial Marx questions reflect screenshot but never imply tasks completed',()=>{
 const state=Core.defaults();assert.equal(state.questions.marx.done,93);assert.equal(state.questions.marx.total,396);assert.deepEqual(state.done,{});
 const h=harness();const html=h.render();assert(html.includes('93/396'));assert(html.includes('今日政治任务'));assert(!h.storage.has(Core.key));
});
test('subject renders today, calendar, stats and settings independently',()=>{
 const h=harness();for(const view of ['today','calendar','stats','settings'])assert(h.render(view).includes('考研政治'));assert(h.render('calendar').includes('p-calendar'));assert(h.render('settings').includes('p-import-file'));
});
test('politics completion writes only politics state, never English',()=>{
 const h=harness();h.render();h.click('p-toggle',{id:politics.days[0].items[0].id});const state=JSON.parse(h.storage.get(Core.key));assert.equal(state.done[politics.days[0].items[0].id],true);assert(!h.storage.has('yantu_english_2026_m1'));
 h.click('p-toggle',{id:politics.days[0].items[0].id});assert.equal(JSON.parse(h.storage.get(Core.key)).done[politics.days[0].items[0].id],false);
});
test('manual Cangdun updates enforce 0 <= completed <= total and preserve notes',()=>{
 const h=harness();h.render();h.elements['p-questions']={value:'100'};h.elements['p-total']={value:'396'};h.submit('p-progress-form');
 assert.equal(JSON.parse(h.storage.get(Core.key)).questions.marx.done,100);
 const id=politics.days[0].items[0].id;
 h.elements['p-wrong']={value:'3'};h.elements['p-note']={value:'多选题错因：概念不清'};h.submit('p-task-form',{id});
 const state=JSON.parse(h.storage.get(Core.key));assert.equal(state.wrong[id],3);assert.equal(state.notes[id],'多选题错因：概念不清');
 assert.throws(()=>Core.normalize({questions:{marx:{done:400,total:396,updated:'2026-10-15'}}}));
});
test('corrupt or malicious politics backup structure is rejected',()=>{
 assert.throws(()=>Core.normalize({done:null}));
 assert.throws(()=>Core.normalize(JSON.parse('{"notes":{"__proto__":"x"}}')));
 assert.throws(()=>Core.normalize({wrong:{id:-1}}));
});
