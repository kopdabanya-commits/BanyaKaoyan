import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const index=read('index.html');
const update=read('update.html');
const script=read('refresh.js');

test('direct update loads the same app shell with fresh CSS and every script',()=>{
 const fresh=update.replace('<title>板牙考研 · 更新入口</title>','<title>板牙考研 · 英语二与政治</title>').replaceAll('?reauth=1','');
 assert.equal(fresh.split('\n').map(line=>line.trimEnd()).join('\n'),index.split('\n').map(line=>line.trimEnd()).join('\n'));
 const scripts=[...index.matchAll(/<script src="([^"]+)"/g)].map(match=>match[1]);
 assert.equal(scripts.length,10);
 for(const asset of scripts)assert.ok(update.includes(`src="${asset}?reauth=1"`),asset);
 assert.ok(update.includes('href="./styles.css?reauth=1"'));
 assert.ok(!read('sw.js').includes("'./update.html'"),'recovery page must bypass old Service Worker cache');
});
test('old recovery URL redirects without touching learning data or browser caches',()=>{
 const redirects=[];
 vm.runInNewContext(script,{location:{replace:url=>redirects.push(url)}});
 assert.deepEqual(redirects,['./update.html?reauth=1']);
 assert.doesNotMatch(script,/localStorage|indexedDB|sessionStorage|caches|serviceWorker/);
});
