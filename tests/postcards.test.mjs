import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import worker,{postcardNotification} from '../postcards-worker/worker.mjs';

function d1(file){
 const db=new DatabaseSync(file);
 return {close:()=>db.close(),exec:sql=>db.exec(sql),prepare(sql){let args=[];return {bind(...values){args=values;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}};}};
}
function request(path,body,extra={}){
 return new Request('https://postcards.example'+path,{method:body===undefined?'GET':'POST',headers:{Origin:'https://henrik.example','CF-Connecting-IP':'192.0.2.1',...(body===undefined?{}:{'Content-Type':'application/json'}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
const postcard=()=>({id:crypto.randomUUID(),name:'Ada',city:'Recife',message:'A hello from the coast.'});

test('durable guestbook, moderation, sessions, validation and abuse limits',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'henrik-postcard-test-')),file=join(directory,'cards.sqlite');
 let db=d1(file);db.exec(readFileSync(new URL('../postcards-worker/migrations/0001_postcards.sql',import.meta.url),'utf8'));
 const env={DB:db,ADMIN_PASSWORD:'test-only-secret-not-for-deployment',PUBLIC_ORIGINS:'https://henrik.example'};
 const call=(path,body,extra)=>worker.fetch(request(path,body,extra),env);
 try{
  const card=postcard();assert.equal((await call('/api/postcards',card)).status,202);
  assert.equal((await call('/api/postcards',card)).status,202,'A retried submission is idempotent.');
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM postcards').first()).n,1);
  assert.deepEqual((await (await call('/api/postcards')).json()).postcards,[],'Pending notes are not publicly visible.');
  assert.equal((await call('/api/admin/postcards')).status,401);
  assert.equal((await call('/api/admin/login',{password:env.ADMIN_PASSWORD})).status,403,'Owner login rejects a foreign origin.');
  assert.equal((await call('/api/admin/login',{password:'wrong'},{Origin:'https://postcards.example'})).status,401);
  const login=await call('/api/admin/login',{password:env.ADMIN_PASSWORD},{Origin:'https://postcards.example'});
  assert.equal(login.status,200);const setCookie=login.headers.get('Set-Cookie');
  assert(setCookie.includes('HttpOnly')&&setCookie.includes('Secure')&&setCookie.includes('SameSite=Strict'));
  const Cookie=setCookie.split(';')[0],owner={Origin:'https://postcards.example',Cookie};
  const queue=await (await call('/api/admin/postcards',undefined,owner)).json();assert.equal(queue.postcards.length,1);
  assert.equal((await call('/api/admin/postcards/'+card.id+'/approve',{},owner)).status,200);
  // A fresh database connection represents another device/request process: no JS memory or localStorage.
  db.close();db=d1(file);env.DB=db;
  const otherDevice=await call('/api/postcards',undefined,{'CF-Connecting-IP':'192.0.2.99'});
  const publicCards=(await otherDevice.json()).postcards;assert.equal(publicCards.length,1);assert.equal(publicCards[0].message,card.message);
  assert(!('status' in publicCards[0]));assert.equal(otherDevice.headers.get('Cache-Control'),'no-store');
  assert.equal((await call('/api/postcards',{...postcard(),name:''})).status,400);
  assert.equal((await call('/api/postcards',{...postcard(),message:'x'.repeat(501)})).status,400);
  assert.equal((await call('/api/postcards',{...postcard(),id:'../../bad'})).status,400);
  assert.equal((await call('/api/postcards',postcard(),{Origin:'https://unrelated.example'})).status,403);
  assert.equal((await call('/api/postcards',{...postcard(),website:'bot'})).status,202);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM postcards').first()).n,1,'Honeypot is discarded.');
  const injection={...postcard(),name:"Robert'); DROP TABLE postcards;--",message:'<img src=x onerror=alert(1)>'};
  assert.equal((await call('/api/postcards',injection)).status,202);
  assert.equal((await db.prepare('SELECT message FROM postcards WHERE id=?').bind(injection.id).first()).message,injection.message,'Input remains data.');
  assert.equal((await call('/api/postcards',postcard())).status,202);
  assert.equal((await call('/api/postcards',postcard())).status,429,'Rate cap is enforced in shared SQL.');
  assert.equal((await call('/api/admin/postcards/'+card.id+'/delete',{},owner)).status,200);
  assert.equal((await (await call('/api/postcards')).json()).postcards.length,0);
  const altered={...owner,Cookie:Cookie+'x'};assert.equal((await call('/api/admin/postcards',undefined,altered)).status,401);
  const form=new Request('https://postcards.example/api/postcards',{method:'POST',headers:{Origin:'https://postcards.example','CF-Connecting-IP':'192.0.2.55','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({name:'No JS',message:'A plain HTML form works.'})});
  const formResult=await worker.fetch(form,env);assert.equal(formResult.status,303);assert.equal(formResult.headers.get('Location'),'/thanks');
  const tooBig=new Request('https://postcards.example/api/postcards',{method:'POST',headers:{Origin:'https://postcards.example','Content-Type':'application/json'},body:'x'.repeat(9000)});
  assert.equal((await worker.fetch(tooBig,env)).status,400);
  assert.equal((await worker.fetch(request('/api/postcards'),{})).status,503,'Unconfigured storage never pretends to save.');
 }finally{db.close();rmSync(directory,{recursive:true,force:true});}
});

test('owner is emailed once per new postcard, with header-safe content',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'henrik-postcard-mail-')),file=join(directory,'cards.sqlite');
 const db=d1(file);db.exec(readFileSync(new URL('../postcards-worker/migrations/0001_postcards.sql',import.meta.url),'utf8'));
 const sent=[];
 const env={DB:db,ADMIN_PASSWORD:'test-only-secret-not-for-deployment',PUBLIC_ORIGINS:'https://henrik.example',NOTIFY:{send:async m=>{sent.push(m);}},NOTIFY_FROM:'postcards@henrik.example',NOTIFY_TO:'owner@henrik.example'};
 const call=(path,body,extra)=>worker.fetch(request(path,body,extra),env);
 try{
  const card={...postcard(),name:'Eve\r\nBcc: victim@example.com',city:'São Paulo',message:'Olá!\nLine two.'};
  assert.equal((await call('/api/postcards',card)).status,202);
  assert.equal((await call('/api/postcards',card)).status,202);
  assert.equal(sent.length,1,'A retried submission does not send a second email.');
  const raw=sent[0].raw;
  assert.equal(sent[0].to,'owner@henrik.example');
  assert.match(raw,/^Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=\r\n/m,'Non-ASCII subject is RFC 2047 encoded.');
  assert.ok(!/^Bcc:/m.test(raw),'Newlines in the name cannot inject headers.');
  const body=Buffer.from(raw.split('\r\n\r\n')[1].replace(/\r\n/g,''),'base64').toString('utf8');
  assert.match(body,/Olá!\nLine two\./);assert.match(body,/São Paulo/);assert.match(body,/https:\/\/postcards\.example\/admin/);
  assert.ok(!body.includes('Bcc:'+'\n'),'Body carries the name as plain text only.');
  const quiet={...env};delete quiet.NOTIFY;
  assert.equal((await worker.fetch(request('/api/postcards',postcard()),quiet)).status,202,'Missing binding never blocks a postcard.');
  assert.equal(sent.length,1);
  assert.match(postcardNotification({id:'abc',name:'Ada',city:'',message:'hi',created_at:0},'a@b.example','c@d.example','https://x/admin'),/^Subject: New postcard from Ada\r\n/m);
 }finally{db.close();rmSync(directory,{recursive:true,force:true});}
});
