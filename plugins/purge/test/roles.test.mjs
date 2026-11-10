import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CLOUD_ROLE,LEGACY_SETTING,roleSettingKey} from '../prompt-controller.mjs';
import {fixture,secret,until} from './fixtures.mjs';

test('visiting an ordinary role does not inject or erase its existing contribution',async()=>{
 const f=fixture({role:'focus',text:'existing contribution'}),c=f.controller();
 await c.start();
 assert.equal(c.snapshot().phase,'inactive');
 assert.equal(c.snapshot().roleId,'focus');
 assert.equal(f.writes,0);
 assert.equal(f.text,'existing contribution');
 await c.apply();
 assert.equal(c.snapshot().phase,'verified');
 assert.equal(f.text,secret);
 assert.equal(await f.enabledFor('focus'),true);
});

test('roles keep separate enabled preferences and revoking one leaves the others intact',async()=>{
 const f=fixture({role:'focus'}),c=f.controller();
 await c.apply();
 f.role='editor';await c.contextChanged({roleId:f.role});
 assert.equal(c.snapshot().phase,'inactive');
 await c.apply();
 f.role='focus';await c.contextChanged({roleId:f.role});
 assert.equal(c.snapshot().phase,'verified');
 await c.revoke();
 assert.equal(f.texts.get('focus'),'');
 assert.equal(f.texts.get('editor'),secret);
 assert.equal(await f.enabledFor('focus'),false);
 assert.equal(await f.enabledFor('editor'),true);
 const reopened=f.controller();await reopened.start();
 assert.equal(reopened.snapshot().phase,'inactive');
 f.role='editor';await reopened.contextChanged({roleId:f.role});
 assert.equal(reopened.snapshot().phase,'verified');
});

test('the old disabled preference migrates only to 小云',async()=>{
 const f=fixture({enabled:false}),c=f.controller();
 await c.start();
 assert.equal(c.snapshot().phase,'inactive');
 assert.equal(await f.enabledFor(CLOUD_ROLE),false);
 f.role='editor';await c.contextChanged({roleId:f.role});await c.apply();
 assert.equal(c.snapshot().phase,'verified');
 assert.equal(await f.enabledFor('editor'),true);
 assert.equal(await f.enabledFor(CLOUD_ROLE),false);
 assert.equal(f.settings.get(LEGACY_SETTING),false);
});

test('a per-role revocation takes precedence over the old enabled preference',async()=>{
 const f=fixture({enabled:true}),c=f.controller();
 await c.start();await c.revoke();
 const reopened=f.controller();await reopened.start();
 assert.equal(reopened.snapshot().phase,'inactive');
 assert.equal(f.text,'');
 assert.equal(f.settings.get(LEGACY_SETTING),true);
});

test('an already matching contribution is verified without rewriting it',async()=>{
 const f=fixture({role:'editor',text:secret}),c=f.controller();
 await c.start();
 assert.equal(c.snapshot().phase,'verified');
 assert.equal(f.writes,0);
});

test('a missing or invalid role never receives a preference or prompt write',async()=>{
 for(const role of [null,'',123,'x'.repeat(201)]){
  const f=fixture({role}),c=f.controller();
  await c.start();await c.apply();
  assert.equal(c.snapshot().phase,'no_role');
  assert.equal(c.snapshot().roleId,null);
  assert.equal(f.writes,0);
  assert.equal(f.settings.size,0);
 }
});

test('role preference keys are bounded, stable, and distinct for long Unicode IDs',async()=>{
 const first='角色'.repeat(100),second='角'.repeat(199)+'色';
 const a=await roleSettingKey(first),b=await roleSettingKey(second);
 assert.equal(a,await roleSettingKey(first));
 assert.notEqual(a,b);
 assert.ok(a.length<=200&&b.length<=200);
 assert.notEqual(await roleSettingKey(CLOUD_ROLE),await roleSettingKey('focus'));
});

test('switching roles during readback refreshes the latest role and never claims old-role success',async()=>{
 const f=fixture({role:'focus'});let release,reads=0;
 const c=f.controller(async(method,p)=>{
  if(method==='prompt.get'&&++reads===2){
   const result=await f.call(method,p);
   return new Promise(resolve=>release=()=>resolve(result));
  }
  return f.call(method,p);
 });
 const pending=c.apply();await until(()=>release);
 f.role='editor';await c.contextChanged({roleId:'editor'});
 assert.equal(c.snapshot().phase,'checking');
 release();await pending;
 assert.equal(c.snapshot().roleId,'editor');
 assert.equal(c.snapshot().phase,'inactive');
 assert.equal(f.texts.get('focus'),secret);
 assert.equal(f.texts.has('editor'),false);
 assert.deepEqual(f.writtenRoles,['focus']);
});

test('rapid role changes during a pending request settle on the most recent selection',async()=>{
 const f=fixture({role:'focus'});let release;
 const c=f.controller(async(method,p)=>{
  if(method==='prompt.get'&&!release){
   const result=await f.call(method,p);
   return new Promise(resolve=>release=()=>resolve(result));
  }
  return f.call(method,p);
 });
 const pending=c.apply();await until(()=>release);
 f.role='editor';await c.contextChanged({roleId:'editor'});
 f.role='inspiration';await c.contextChanged({roleId:'inspiration'});
 release();await pending;
 assert.equal(c.snapshot().roleId,'inspiration');
 assert.equal(c.snapshot().phase,'inactive');
 assert.equal(f.writes,0);
});

test('role mismatch before write prevents mutation and a false verification',async()=>{
 const f=fixture({role:'focus'});
 const c=f.controller(async(method,p)=>method==='prompt.get'?{roleId:'editor',text:''}:f.call(method,p));
 await c.apply();
 assert.equal(c.snapshot().phase,'unconfirmed');
 assert.equal(f.writes,0);
});
