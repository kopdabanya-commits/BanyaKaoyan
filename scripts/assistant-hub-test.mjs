import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const file=(path)=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=file('app.js');
const marker=app.indexOf('/* 板牙考研');
const context={window:{}};
assert.ok(marker>0,'assistant module should load before the main application');
vm.runInNewContext(app.slice(0,marker),context);
const hub=context.window.BanyaAssistantHub;

test('assistant hub is subject aware and uses existing protected actions',()=>{
 for(const [id,name] of [['english','英语二'],['politics','政治']]){
  const html=hub.render(id);
  assert.match(html,new RegExp(name));
  assert.match(html,new RegExp('data-diagnosis-subject="'+id+'"'));
  assert.match(html,new RegExp('data-ai-subject="'+id+'"'));
  assert.match(html,new RegExp('data-memory-subject="'+id+'"'));
  assert.match(html,/自动调整尚未开放/);
  assert.doesNotMatch(html,/data-action="toggle"|data-ai-action="commit"/);
 }
 assert.match(hub.render('invalid'),/data-ai-subject="english"/);
});

test('assistant tab, route and offline assets remain in one PWA',()=>{
 const index=file('index.html'),sw=file('sw.js');
 assert.match(index,/data-view="assistant"/);
 assert.match(index,/assistant-hub\.css/);
 assert.match(app,/view==='assistant'&&!dayDetail\?window\.BanyaAssistantHub\.render\(subject\)/);
 assert.match(sw,/assistant-hub\.css/);
 assert.match(sw,/m7-3-assistant-hub-review/);
 assert.doesNotMatch(index,/assistant-hub\.js/);
});
