const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../../..');
const ts=require(path.join(root,'10-统一平台admin-platform/node_modules/typescript'));
const source=fs.readFileSync(path.join(root,'app开发/HarmonyOS/EvaDance/entry/src/main/ets/services/CarrierLogin.ets'),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(resource){
 const listeners=[];
 const sdk={getInstance(context,listener){listeners.push(listener);return {setAuthSDKInfo:async()=>{},setAuthConfig(){},getLoginToken:async()=>{},clearAuthListener(){},quitLoginPage:async()=>{}}}};
 const config={sdkSecret:'test-sdk-value',bundleName:'test.bundle',appIdentifier:'test.app',certificateSHA256:'aabb'};
 const context={resourceManager:{getRawFileContent:resource||(async()=>new TextEncoder().encode(JSON.stringify(config)))}};
 const req=name=>{
  if(name==='@kit.AbilityKit')return {bundleManager:{BundleFlag:{GET_BUNDLE_INFO_WITH_SIGNATURE_INFO:1},getBundleInfoForSelf:async()=>({name:'test.bundle',signatureInfo:{appIdentifier:'test.app',fingerprint:'AA:BB'}})}};
  if(name==='@kit.ArkTS')return {util:{TextDecoder:{create:()=>({decodeToString:bytes=>new TextDecoder().decode(bytes)})}}};
  if(name==='numberauth_standard')return {__esModule:true,default:sdk,AuthUiConfig:class{}};
  throw Error(name);
 };
 const module={exports:{}};
 new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(req,module,module.exports);
 return {login:new module.exports.CarrierLogin(),listeners,context,config};
}
test('cancel while configuration loads never launches the operator page',async()=>{
 let release;const s=setup(()=>new Promise(resolve=>{release=resolve}));
 const result=s.login.token(s.context).then(()=>assert.fail('cancel must reject'),e=>e.message);
 s.login.cancel();release(new TextEncoder().encode(JSON.stringify(s.config)));
 assert.equal(await result,'已取消本机号码登录');assert.equal(s.listeners.length,0);
});
test('old SDK callbacks and presentation events cannot finish a new login',async()=>{
 const s=setup();const first=s.login.token(s.context).catch(e=>e.message);await tick();
 const old=s.listeners[0];assert.ok(old);s.login.cancel();assert.equal(await first,'已取消本机号码登录');
 let complete=false;const second=s.login.token(s.context).then(token=>{complete=true;return token});await tick();
 old.onSuccess(JSON.stringify({_code:'600000',_token:'stale-test-token'}));await tick();assert.equal(complete,false);
 s.listeners[1].onSuccess(JSON.stringify({_code:'600001',_token:'page-event-not-token'}));await tick();assert.equal(complete,false);
 s.listeners[1].onSuccess(JSON.stringify({_code:'600000',_token:'current-test-token'}));assert.equal(await second,'current-test-token');
});
