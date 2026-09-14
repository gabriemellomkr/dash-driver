const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
for(const file of ['history.js','financial.js']) test(`${file}: actions preserve UUID record IDs`,()=>{
 const source=fs.readFileSync(path.join(root,'src/js',file),'utf8');
 const id='39501388-3bde-4e55-8f69-aee52b372eec';
 const handlers=[...source.matchAll(/onclick="([^"]*(?:\$\{c.id\}|\$\{item.id\}|this.dataset.id)[^"]*)"/g)];
 assert.ok(handlers.length>=2);
 for(const [,template] of handlers){
  const code=template.replaceAll('${c.id}',id).replaceAll('${item.id}',id).replaceAll('${item.tipo}','despesa');
  let received; const capture=value=>received=value;
  const sandbox={confirmarDelete:capture,editarCorrida:capture,pedirConfirmDelete:capture,confirmarDeleteGasto:capture,pedirDeleteGasto:capture,dataset:{id,tipo:'despesa'}};
  vm.runInNewContext(code,sandbox); assert.equal(received,id);
 }
});
test('push permission registers the device with authenticated subscription API',async()=>{
 const calls=[]; const subscription={toJSON:()=>({endpoint:'https://fcm.googleapis.com/test',keys:{}})};
 const sandbox={console,Uint8Array,atob,Notification:{permission:'granted'},APP_STATE:{user:{id:'owner'}},
 navigator:{serviceWorker:{ready:Promise.resolve({pushManager:{getSubscription:async()=>null,subscribe:async options=>{assert.equal(options.userVisibleOnly,true);return subscription;}}})}},
 PushManager:function(){},document:{addEventListener(){}},ddAuthHeaders:async()=>({Authorization:'Bearer session'}),
 fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({publicKey:Buffer.alloc(65,1).toString('base64url')})};}};
 sandbox.window=sandbox;
 vm.runInNewContext(fs.readFileSync(path.join(root,'src/js/notifications.js'),'utf8'),sandbox);
 await sandbox.registerPushDevice();
 assert.equal(calls.length,2);assert.equal(calls[1].options.method,'POST');assert.equal(calls[1].options.headers.Authorization,'Bearer session');
 assert.equal(JSON.parse(calls[1].options.body).subscription.endpoint,subscription.toJSON().endpoint);
});
test('support refresh delivers incoming replies without reopening and ignores a closed chat',async()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const source=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('let _supportTicket'));
 let tick,rendered=0;const modal={style:{display:'flex'}};
 const box={console,APP_STATE:{user:{id:'owner'}},document:{hidden:false,getElementById:()=>modal},
 setInterval:fn=>{tick=fn;},ddAuthHeaders:async()=>({}),fetch:async url=>({ok:true,json:async()=>url.includes('?')?{messages:[{id:'reply',conteudo:'Olá'}]}:{tickets:[{id:'ticket',status:'in_progress'}]}})};
 box.window=box;vm.createContext(box);vm.runInContext(source,box);
 box.renderSupportChat=messages=>{assert.equal(messages[0].id,'reply');rendered++;};
 vm.runInContext("_supportTicket={id:'ticket'}",box);
 await tick();assert.equal(rendered,1);await tick();assert.equal(rendered,1);
 modal.style.display='none';await tick();assert.equal(rendered,1);
});
test('admin chat refresh preserves the composer and renders incoming replies',async()=>{
 const html=fs.readFileSync(path.join(root,'admin.html'),'utf8');
 const source=html.slice(html.indexOf('let _adminChatBusy'),html.indexOf('// Cache de imagens base64'));
 let tick,rendered=0;const nodes={'ticket-modal':{style:{display:'flex'}},'tkt-id':{value:'ticket'},'tkt-reply':{value:'meu rascunho'}};
 const box={adminToken:'session',document:{hidden:false,getElementById:id=>nodes[id]},setInterval:fn=>tick=fn,
 fetch:async()=>({ok:true,json:async()=>({messages:[{id:'reply'}]})}),renderTktMessages:()=>rendered++};
 vm.runInNewContext(source,box);await tick();assert.equal(rendered,1);assert.equal(nodes['tkt-reply'].value,'meu rascunho');await tick();assert.equal(rendered,1);
});
