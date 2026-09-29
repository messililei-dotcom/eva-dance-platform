const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const id='12345678-1234-1234-1234-123456789abc';
function setup(complete=async()=>({success:true})) {
 let app;const storage=new Map();const calls=[];
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'),{
  require:name=>name.includes('runtime-config')?{}:{completePwaLoginHandoff:async key=>{calls.push(['handoff',key]);return complete();}},
  App:value=>app=value,
  wx:{getStorageSync:k=>storage.get(k),setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k),
   showToast:v=>calls.push(['toast',v.title]),exitMiniProgram:()=>calls.push(['exit']),reLaunch:()=>calls.push(['redirect'])}
 });
 app.ensureSilentLogin=()=>Promise.resolve({token:'test'});
 return {app,storage,calls};
}
test('ordinary WeChat launch discards stale handoff without redirecting course learning',async()=>{
 const {app,storage,calls}=setup();storage.set('pwaLoginHandoff',{id,capturedAt:Date.now()});
 app.onLaunch({path:'pages/home/home',query:{}});app.onShow({path:'pages/home/home',query:{}});
 await new Promise(r=>setImmediate(r));assert.equal(storage.has('pwaLoginHandoff'),false);assert.deepEqual(calls,[]);
});
test('explicit external login completes once and never exits or redirects the mini-program',async()=>{
 const {app,storage,calls}=setup();const entry={query:{pwa_handoff:id}};
 app.onLaunch(entry);app.onShow(entry);await app.globalData.pwaHandoffPromise;
 assert.equal(calls.filter(c=>c[0]==='handoff').length,1);
 assert.equal(storage.get('completedPwaLoginHandoff'),id);
 app.onShow(entry);await new Promise(r=>setImmediate(r));
 assert.equal(calls.filter(c=>c[0]==='handoff').length,1);
 assert.equal(calls.some(c=>['exit','redirect'].includes(c[0])),false);
});
test('late external callback cannot interrupt a normal mini-program return',async()=>{
 let finish;const {app,storage,calls}=setup(()=>new Promise(r=>finish=r));
 app.onShow({query:{pwa_handoff:id}});const pending=app.globalData.pwaHandoffPromise;
 await new Promise(r=>setImmediate(r));app.onShow({query:{}});finish({success:true});await pending;
 assert.deepEqual(calls,[['handoff',id]]);assert.equal(storage.has('pwaLoginHandoff'),false);
});
