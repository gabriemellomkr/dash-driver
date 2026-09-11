const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function handler(poolOverride) {
 const context = {module:{exports:{}}, process:{env:{LASTLINK_WEBHOOK_TOKEN:'local-test-token',LASTLINK_PRODUCT_IDS:'product-1'}}, console, Buffer, URL, Date, setTimeout,
 require(name){
  if(name==='./admin/_db') return poolOverride || {connectWithRetry(){throw Error('Unexpected database access');}};
  if(name==='./_mailer') return {sendMail(){throw Error('Unexpected mail');}};
  return require(name.startsWith('./')?path.resolve(__dirname,'../api',name):name);
 }};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../api/lastlink-webhook.js'),'utf8'),context);
 return context.module.exports;
}
async function request(Event,extra={}) {
 const res={code:200,status(c){this.code=c;return this;},json(b){this.body=b;return this;},end(){return this;}};
 await handler()({method:'POST',headers:{},query:{token:'local-test-token'},body:{Id:'event-1',CreatedAt:new Date().toISOString(),Event,Data:{Buyer:{Email:'test@example.com'},Products:[{Id:'product-1'}]},...extra}},res);
 return res;
}
test('an invoice does not grant access',async()=>assert.equal((await request('Purchase_Request_Confirmed')).code,200));
test('test events never mutate live accounts',async()=>assert.equal((await request('Purchase_Order_Confirmed',{IsTest:true})).body.ignored,'test event'));
test('cancelling recurrence waits for access-ended rather than cutting paid access',async()=>assert.equal((await request('Subscription_Canceled')).code,200));
test('irrelevant product is ignored',async()=>assert.equal((await request('Purchase_Order_Confirmed',{Data:{Buyer:{Email:'test@example.com'},Products:[{Id:'other'}]}})).body.ignored,'product not whitelisted'));

function memoryPool({duplicate=false,plan=null,mailFailure=false}={}) {
 const queries=[];
 const client={release(){},async query(sql,params){
   queries.push({sql,params});
   if(sql.startsWith('SELECT event_id'))return {rows:duplicate?[{event_id:'e'}]:[]};
   if(sql.startsWith('SELECT id FROM auth.users'))return {rows:[{id:'user-a'}]};
   if(sql.startsWith('SELECT lastlink_event_at'))return {rows:plan?[plan]:[]};
   return {rows:[]};
 }};
 return {queries,connectWithRetry:async()=>client};
}
async function accessEvent(pool,overrides={}) {
 const res={code:200,status(c){this.code=c;return this;},json(b){this.body=b;return this;},end(){return this;}};
 await handler(pool)({method:'POST',headers:{},query:{token:'local-test-token'},body:{Id:'member-event',CreatedAt:'2026-09-10T10:00:00Z',Event:'Product_Access_Started',Data:{Member:{Email:'member@example.com'},Product:{Id:'product-1'},SubscriptionId:'sub-a'},...overrides}},res);
 return res;
}
test('access events use Member, Product and SubscriptionId',async()=>{
 const pool=memoryPool();const res=await accessEvent(pool);assert.equal(res.body.action,'granted');
 const lookup=pool.queries.find(q=>q.sql.startsWith('SELECT id FROM auth.users'));assert.equal(lookup.params[0],'member@example.com');
 const activation=pool.queries.find(q=>q.sql.startsWith('INSERT INTO public.dashdriver_plans'));assert.equal(activation.params[1],'sub-a');assert.ok(activation.sql.includes('expires_at=NULL'));
});
test('duplicate event does not update the subscription',async()=>{
 const pool=memoryPool({duplicate:true});const res=await accessEvent(pool);assert.equal(res.body.duplicate,true);assert.equal(pool.queries.some(q=>q.sql.startsWith('INSERT INTO public.dashdriver_plans')),false);
});
test('old activation cannot revive a more recently revoked subscription',async()=>{
 const pool=memoryPool({plan:{lastlink_event_at:'2026-09-11T10:00:00Z',lastlink_subscription_id:'sub-a'}});const res=await accessEvent(pool);assert.equal(res.body.ignored,'stale event');
});
test('revocation for a different subscription cannot cancel the current one',async()=>{
 const pool=memoryPool({plan:{lastlink_subscription_id:'sub-new'}});const res=await accessEvent(pool,{Event:'Product_Access_Ended'});assert.equal(res.body.ignored,'different subscription');
});
