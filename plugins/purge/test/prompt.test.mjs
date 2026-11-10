import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createPromptController,CLOUD_ROLE} from '../prompt-controller.mjs';
import {openSlot} from '../upstream/lib/table-read.js';
import {encoded,bytes,sha256} from '../dist/payload.mjs';

const secret='Offline original fixture α — never render this text.';
const tick=()=>new Promise(setImmediate);
function fixture(options={}){
 let text=options.text??'',enabled=options.enabled,role=options.role??CLOUD_ROLE,writes=0;
 const seen=[];
 const call=async(method,p)=>{
  if(method==='context.get')return {roleId:role};
  if(method==='storage.get')return enabled;
  if(method==='storage.set'){enabled=p.value;return true;}
  if(method==='prompt.get')return {roleId:role,text};
  if(method==='prompt.set'){writes++;text=p.text;return true;}
  throw Error('Unexpected method');
 };
 return {call,seen,get writes(){return writes;},get text(){return text;},get enabled(){return enabled;},set role(v){role=v;},controller(override=call){return createPromptController(override,secret,s=>seen.push(s));}};
}

test('payload is exactly the original decoded slot, without printing its body',()=>{
 const raw=Buffer.from(encoded,'base64');
 assert.equal(raw.length,bytes);assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),sha256);
 assert.equal(crypto.createHash('sha256').update(openSlot(),'utf8').digest('hex'),sha256);
});

test('first open injects and confirms the complete readback for 小云',async()=>{
 const f=fixture(),c=f.controller();await c.start();assert.equal(c.snapshot().phase,'verified');assert.equal(f.text,secret);assert.equal(f.writes,1);
 await c.start();assert.equal(f.writes,1);assert.equal(c.snapshot().phase,'verified');
});

test('an acknowledgement cannot show success before the final readback resolves',async()=>{
 const f=fixture();let release;let reads=0;
 const c=f.controller(async(m,p)=>{if(m==='prompt.get'&&++reads===2)return new Promise(r=>release=r);return f.call(m,p);});
 const pending=c.apply();await tick();assert.equal(f.writes,1);assert.equal(c.snapshot().busy,true);assert.equal(f.seen.some(s=>s.phase==='verified'),false);
 release({roleId:CLOUD_ROLE,text:secret});await pending;assert.equal(c.snapshot().phase,'verified');
});

test('failed acknowledgement and mismatched persisted data never show success',async()=>{
 for(const mode of ['write_failure','mismatched_readback']){
  const f=fixture();let reads=0;const c=f.controller(async(m,p)=>{
   if(m==='prompt.set'&&mode==='write_failure')return false;
   if(m==='prompt.get'&&++reads===2&&mode==='mismatched_readback')return {roleId:CLOUD_ROLE,text:'stale'};
   return f.call(m,p);
  });
  await c.apply();assert.equal(c.snapshot().phase,'unconfirmed');assert.equal(f.seen.some(s=>s.phase==='verified'),false);
 }
});

test('revoke is verified and remains disabled when the page is reopened',async()=>{
 const f=fixture(),c=f.controller();await c.start();await c.revoke();assert.equal(c.snapshot().phase,'inactive');assert.equal(f.enabled,false);assert.equal(f.text,'');
 const writes=f.writes;const reopened=f.controller();await reopened.start();assert.equal(reopened.snapshot().phase,'inactive');assert.equal(f.writes,writes);
});

test('another role cannot receive the prompt',async()=>{
 const f=fixture({role:'other-role'}),c=f.controller();await c.start();await c.apply();assert.equal(c.snapshot().phase,'wrong_role');assert.equal(f.writes,0);
});

test('context changes invalidate an in-flight verification and do not replay writes',async()=>{
 const f=fixture();let release;let reads=0;const c=f.controller(async(m,p)=>{if(m==='prompt.get'&&++reads===2)return new Promise(r=>release=r);return f.call(m,p);});
 const pending=c.apply();await tick();f.role='other-role';await c.contextChanged();release({roleId:CLOUD_ROLE,text:secret});await pending;
 assert.equal(c.snapshot().phase,'unconfirmed');assert.equal(f.writes,1);assert.equal(f.seen.some(s=>s.phase==='verified'),false);
});

test('same-role host refresh notifications do not invalidate a pending save',async()=>{
 const f=fixture();let c;c=f.controller(async(m,p)=>{const r=await f.call(m,p);if(m==='prompt.set')await c.contextChanged({roleId:CLOUD_ROLE});return r;});
 await c.start();assert.equal(c.snapshot().phase,'verified');assert.equal(f.writes,1);
});

test('double clicks cannot issue duplicate injection operations',async()=>{
 const f=fixture();let release;const c=f.controller(async(m,p)=>{if(m==='prompt.set'){await new Promise(r=>release=r);}return f.call(m,p);});
 const first=c.apply();await tick();await c.apply();release();await first;assert.equal(f.writes,1);
});

test('host error text and prompt body never enter returned UI state',async()=>{
 const f=fixture();const c=f.controller(async()=>{throw Error(secret);});await c.start();assert.equal(c.snapshot().phase,'unconfirmed');assert.equal(JSON.stringify(f.seen).includes(secret),false);
});

test('actual page initializes, injects, and renders only status and controls',async()=>{
 const elements=Object.fromEntries(['status','detail','apply','revoke'].map(id=>[id,{textContent:'',dataset:{},disabled:false}]));
 const f=fixture();const priorDocument=globalThis.document,priorSdk=globalThis.Skivu;
 globalThis.document={getElementById:id=>elements[id]};globalThis.Skivu={call:f.call,on:()=>{}};
 try{
  await import('../dist/app.mjs?ui-test');assert.equal(elements.status.textContent,'注入成功');
  const rendered=Object.values(elements).map(e=>e.textContent).join('\n');
  assert.equal(rendered.includes(Buffer.from(encoded,'base64').toString('utf8')),false);
  assert.equal(rendered.includes(encoded),false);
  assert.equal(crypto.createHash('sha256').update(f.text,'utf8').digest('hex'),sha256);
  await elements.revoke.onclick();assert.equal(elements.status.textContent,'未注入');
 }finally{globalThis.document=priorDocument;globalThis.Skivu=priorSdk;}
});

test('package excludes all prior modules, tools, file access and prompt editors',()=>{
 const p=JSON.parse(fs.readFileSync('dist/skivu-purge-1.1.0.skivu.json','utf8'));
 assert.deepEqual(p.manifest.permissions,['prompt','storage']);assert.deepEqual(p.manifest.contributes,{launcher:true,chatActions:[]});
 assert.deepEqual(Object.keys(p.files),['index.html','app.mjs','prompt-controller.mjs','payload.mjs']);
 const html=Buffer.from(p.files['index.html'].base64,'base64').toString('utf8');assert.doesNotMatch(html,/<textarea|<input|<pre|<nav/i);
 const app=Buffer.from(p.files['app.mjs'].base64,'base64').toString('utf8');assert.doesNotMatch(app,/console\.|innerHTML|files\.|lab\.call|ai\.generate/);
});
