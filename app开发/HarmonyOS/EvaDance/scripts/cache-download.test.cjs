const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ts=require(path.resolve(__dirname,'../../../../10-统一平台admin-platform/node_modules/typescript'));
function compile(name,requireMock,extra={}) {
  const mod={exports:{}};
  const source=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../entry/src/main/ets/services/'+name+'.ets'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  new Function('require','module','exports','setInterval','clearInterval',source)(requireMock,mod,mod.exports,()=>1,()=>{});
  return mod.exports;
}
const policy=compile('VideoCachePolicy',()=>{});
const clock=compile('CacheClock',()=>{});
async function harness({enabled=true,authorizeFails=false}={}) {
  const device='a'.repeat(64),files=new Set(); let callbacks,requests=0,changes=0,saves=[];
  class Vault {async read(){return JSON.stringify({device,items:[]});} async save(value){saves.push(JSON.parse(value));}}
  class Driver {
    static directoryBytes(){return 128;}
    async configured(){return true;}
    async start(_vod,_auth,_directory,_limit,_allowed,events){callbacks=events;}
    stop(){}
  }
  class Renewal {async refresh(){} stop(){}}
  const api={credentials:{memberId:1,sessionId:'session'},request:async route=>{
    requests++;
    if(route.endsWith('/cache-authorization')) {
      if(authorizeFails)throw Error('denied');
      return {mode:'aliyun-secure',member_id:1,session_id:'session',device_id:device,lesson_id:10,series_id:30,vod_video_id:'b'.repeat(32),material_version:'c'.repeat(64),issued_at:1000,expires_at:86401000,credential:{play_auth:'isolated-fixture'},max_bytes:10000};
    }
    return {progress:3,revision:1};
  }};
  const dependencies={
    '@kit.CoreFileKit':{fileIo:{statSync:file=>{if(files.has(file))return {isFile:()=>true};throw Error('missing');}},statfs:{getFreeSizeSync:()=>1000000000}},
    '@kit.BasicServicesKit':{systemDateTime:{getUptime:()=>1000,TimeType:{STARTUP:0}},deviceInfo:{bootCount:1}},
    '@kit.NetworkKit':{connection:{hasDefaultNetSync:()=>false},http:{RequestMethod:{GET:'GET',POST:'POST'}}},
    '@kit.ArkTS':{util:{generateRandomUUID:()=> 'fixture-nonce'}},
    './PlatformApi':{PlatformFailure:class extends Error{}},'./HuksVault':{HuksVault:Vault},'./CacheClock':clock,
    './VideoCachePolicy':{...policy,COURSE_CACHE_RELEASE_ENABLED:enabled},
    './AutomaticVideoCacheRenewal':{AutomaticVideoCacheRenewal:Renewal},'./AliyunSecureCacheDriver':{AliyunSecureCacheDriver:Driver}
  };
  const {CourseCacheStore}=compile('CourseCacheStore',key=>dependencies[key]||{});
  const store=new CourseCacheStore({filesDir:'/isolated'},api);
  store.changed=()=>changes++;
  await store.initialize();
  return {store,api,files,get callbacks(){return callbacks;},get requests(){return requests;},get changes(){return changes;},get saves(){return saves;}};
}
test('closed release gate never starts a download or invents a percentage',async()=>{
  const h=await harness({enabled:false});await h.store.download(10,'Lesson','Course');
  assert.equal(h.requests,0);assert.equal(h.callbacks,undefined);assert.equal(h.store.downloading,0);assert.deepEqual(h.store.visible(),[]);assert.match(h.store.message,/尚未开放/);
});
test('denied authorization never creates a progress or completed item',async()=>{
  const h=await harness({authorizeFails:true});await h.store.download(10,'Lesson','Course');
  assert.equal(h.callbacks,undefined);assert.equal(h.store.downloading,0);assert.deepEqual(h.store.visible(),[]);
});
test('real SDK callbacks notify the list and completion alone persists 100 percent',async()=>{
  const h=await harness();await h.store.download(10,'Lesson','Course');
  assert.equal(h.store.get(10).percent,0);assert.equal(h.store.get(10).state,'downloading');
  const before=h.changes;h.callbacks.progress(42);assert.equal(h.store.get(10).percent,42);assert.ok(h.changes>before);
  h.callbacks.progress(100);assert.equal(h.store.get(10).percent,99);assert.equal(h.store.usable(h.store.get(10)),false);
  h.files.add('/isolated/course-cache/10/encrypted-file');h.callbacks.complete('/isolated/course-cache/10/encrypted-file');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.store.get(10).percent,100);assert.equal(h.store.get(10).state,'ready');assert.equal(h.store.usable(h.store.get(10)),true);
  assert.ok(h.saves.some(value=>value.items.some(item=>item.state==='ready'&&item.percent===100)));
  assert.ok(h.saves.every(value=>!JSON.stringify(value).includes('isolated-fixture')),'PlayAuth must not persist in inventory');
});
test('late SDK callbacks cannot restore media after account purge',async()=>{
  const h=await harness();await h.store.download(10,'Lesson','Course');const callbacks=h.callbacks;
  h.store.purge();callbacks.progress(80);callbacks.complete('/isolated/course-cache/10/encrypted-file');
  await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(h.store.visible(),[]);assert.equal(h.store.downloading,0);
});
test('a switched account cannot receive download progress or a playable item',async()=>{
  const h=await harness();await h.store.download(10,'Lesson','Course');h.api.credentials={memberId:2,sessionId:'other'};
  h.callbacks.progress(80);h.callbacks.complete('/isolated/course-cache/10/encrypted-file');
  await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(h.store.visible(),[]);assert.equal(h.store.downloading,0);
});
