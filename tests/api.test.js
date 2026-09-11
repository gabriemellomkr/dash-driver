const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {supportContent,validOCRImage}=require('../api/_validation');
function load(file,deps={}){const box={module:{exports:{}},process:{env:{}},Buffer,URL,console,Date,require:(name)=>{if(name in deps)return deps[name];return require(name.startsWith('.')?path.resolve(__dirname,'../api',path.dirname(file),name):name);}};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../api',file),'utf8'),box);return box.module.exports;}
const response=()=>({code:200,body:null,status(code){this.code=code;return this;},json(body){this.body=body;return this;},end(){return this;},setHeader(){}});
test('support rejects arbitrary image URLs and HTML attribute payloads',()=>{
 for(const value of ['https://tracking.example/pixel','data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,abc" onerror="alert(1)'])assert.equal(supportContent(value,'image'),null);
 assert.equal(supportContent('a'.repeat(4001)),null);
 assert.equal(supportContent(' Olá '),'Olá');
});
test('OCR validates file bytes, MIME and maximum payload',()=>{
 assert.equal(validOCRImage(Buffer.from('<script>test</script>').toString('base64'),'image/png'),false);
 assert.equal(validOCRImage('a'.repeat(2800001),'image/jpeg'),false);
 assert.equal(validOCRImage(Buffer.from([255,216,255,224,0,16]).toString('base64'),'image/jpeg'),true);
});
test('retired WhatsApp endpoint cannot send any request',async()=>{
 const handler=load('notify.js',{'./admin/broadcast':()=>{throw Error('must not send');}});const res=response();await handler({method:'POST',query:{retired:'whatsapp'},body:{number:'test',text:'test'}},res);assert.equal(res.code,410);
});
test('broadcast refuses non-admin callers without loading recipients',async()=>{
 const handler=load('admin/broadcast.js',{'./_db':{query(){throw Error('must not query');}},'./_auth':{verifyAdmin:async()=>null},'../_mailer':{sendMail(){throw Error('must not send');}},'../_push':{sendPush(){throw Error('must not send');}}});
 const res=response();await handler({method:'POST',body:{message:'test'}},res);assert.equal(res.code,403);
});
test('broadcast refuses removed WhatsApp channel even for admin',async()=>{
 const handler=load('admin/broadcast.js',{'./_db':{query(){throw Error('must not query');}},'./_auth':{verifyAdmin:async()=>({sub:'admin'})},'../_mailer':{},'../_push':{}});
 const res=response();await handler({method:'POST',body:{message:'test',channel:'whatsapp'}},res);assert.equal(res.code,400);
});
test('broadcast preview never delivers messages',async()=>{
 const handler=load('admin/broadcast.js',{'./_db':{query:async()=>({rows:[{user_id:'a',email:'test@example.com'}]})},'./_auth':{verifyAdmin:async()=>({sub:'admin'})},'../_mailer':{sendMail(){throw Error('must not send');}},'../_push':{}});
 const res=response();await handler({method:'POST',body:{message:'test',channel:'email',dry_run:true}},res);assert.equal(res.code,200);assert.equal(res.body.total,1);
});
test('support caller cannot read a ticket belonging to someone else',async()=>{
 const handler=load('support.js',{'./admin/_db':{connect:async()=>({query:async(sql,params)=>{assert.equal(params[1],'owner-a');return {rows:[]};},release(){}})},'./_verify-user':{verifyUser:async()=>({sub:'owner-a'})}});
 const res=response();await handler({method:'GET',query:{ticket_id:'ticket-b',user_id:'owner-b'}},res);assert.equal(res.code,404);
});
test('privacy export binds every query to the signed-in owner',async()=>{
 let count=0;const handler=load('privacy.js',{'./admin/_db':{query:async(sql,params)=>{assert.equal(params[0],'owner-a');count++;return {rows:[]};}},'./_verify-user':{verifyUser:async()=>({sub:'owner-a',email:'test@example.com'})}});
 const res=response();await handler({method:'GET',query:{user_id:'owner-b'}},res);assert.equal(res.code,200);assert.ok(count>=9);assert.equal(res.body.account.id,'owner-a');
});
test('push registration rejects local-network endpoints',()=>{
 const {validSubscription}=load('_push.js',{'./admin/_db':{},'web-push':{}});
 const keys={p256dh:Buffer.alloc(65).toString('base64url'),auth:Buffer.alloc(16).toString('base64url')};
 for(const endpoint of ['http://127.0.0.1/','https://169.254.169.254/','https://evil.example/','https://fcm.googleapis.com.evil.example/push','https://fcm.googleapis.com:8443/push'])assert.equal(validSubscription({endpoint,keys}),false);
 assert.equal(validSubscription({endpoint:'https://fcm.googleapis.com/fcm/send/test',keys}),true);
});
