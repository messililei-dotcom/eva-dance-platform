const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),NativeDB=require('node:sqlite').DatabaseSync;
class Database extends NativeDB {transaction(fn){return (...args)=>{this.exec('BEGIN');try{const result=fn(...args);this.exec('COMMIT');return result}catch(error){this.exec('ROLLBACK');throw error}}}}
function load(file,req=require){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(req,m,m.exports);return m.exports;}
const api=load('src/lib/server/app-session.ts');
function fixture(){const db=new Database(':memory:');db.exec("CREATE TABLE Member(id INTEGER PRIMARY KEY,name TEXT,phone TEXT,status TEXT,merged_to_member_id INTEGER);INSERT INTO Member VALUES(1,'测试学员','13800000000','active',NULL),(2,'其他学员','13900000000','active',NULL);CREATE TABLE MiniSmsCode(id INTEGER PRIMARY KEY,phone TEXT,code TEXT,used INTEGER,expires_at TEXT)");api.ensureAppSchema(db);return db;}
function dbtest(name,fn){test(name,async()=>{const db=fixture();try{await fn(db)}finally{db.close()}})}
dbtest('opaque tokens hashed, expiry and refresh rotation',db=>{const a=api.createAppSession(db,1,'测试',1000);const row=db.prepare('SELECT * FROM AppSession').get();assert.notEqual(row.access_hash,a.token);assert.notEqual(row.refresh_hash,a.refreshToken);assert.equal(api.authenticateApp(db,a.token,1001).member_id,1);assert.throws(()=>api.authenticateApp(db,a.token,901000),e=>e.status===401);const b=api.rotateAppSession(db,a.refreshToken,5000);assert.equal(api.authenticateApp(db,b.token,5001).member_id,1);assert.throws(()=>api.authenticateApp(db,a.token,5001));});
dbtest('refresh replay commits revocation instead of rolling it back',db=>{const a=api.createAppSession(db,1,'a'),b=api.rotateAppSession(db,a.refreshToken);assert.throws(()=>api.rotateAppSession(db,a.refreshToken),e=>e.status===401);assert.throws(()=>api.authenticateApp(db,b.token),e=>e.status===401);assert.ok(db.prepare('SELECT revoked_at FROM AppSession').get().revoked_at);});
dbtest('device ownership enforced',db=>{const a=api.createAppSession(db,1,'a');assert.throws(()=>api.revokeAppSession(db,2,a.sessionId),e=>e.status===404);assert.equal(api.authenticateApp(db,a.token).member_id,1);api.revokeAppSession(db,1,a.sessionId);assert.throws(()=>api.authenticateApp(db,a.token));});
dbtest('disabled and merge-cycle accounts rejected',db=>{db.prepare("UPDATE Member SET status='disabled' WHERE id=1").run();assert.throws(()=>api.createAppSession(db,1,'a'),e=>e.status===403);db.exec("UPDATE Member SET status='active',merged_to_member_id=2 WHERE id=1;UPDATE Member SET merged_to_member_id=1 WHERE id=2");assert.throws(()=>api.createAppSession(db,1,'a'),e=>e.status===403);});
dbtest('SMS failures persist; five failures throttle and valid codes are one use',db=>{for(let i=0;i<5;i++)assert.throws(()=>api.verifyAppSMS(db,'13800000000','000000',1000));assert.throws(()=>api.verifyAppSMS(db,'13800000000','000000',1001),e=>e.status===429);db.prepare("INSERT INTO MiniSmsCode VALUES(1,?,'123456',0,datetime('now','localtime','+1 minute'))").run('13800000000');api.verifyAppSMS(db,'13800000000','123456',601001);assert.equal(db.prepare('SELECT used FROM MiniSmsCode').get().used,1);assert.throws(()=>api.verifyAppSMS(db,'13800000000','123456',601002));});
dbtest('deletion request is pending, idempotent and revokes all App sessions',db=>{const a=api.createAppSession(db,1,'a'),b=api.createAppSession(db,1,'b');const first=api.requestAccountDeletion(db,1);assert.equal(first.status,'pending');assert.equal(api.requestAccountDeletion(db,1).id,first.id);assert.throws(()=>api.authenticateApp(db,a.token));assert.throws(()=>api.authenticateApp(db,b.token));assert.throws(()=>api.createAppSession(db,1,'c'),e=>e.status===403);assert.equal(db.prepare('SELECT count(*) n FROM Member').get().n,2);});
test('student route allowlist rejects admin, traversal and wrong verbs',()=>{const r=load('src/lib/server/app-route-map.ts',()=>{throw Error('not loading')});assert.equal(r.findAppRoute('series','POST'),null);assert.equal(r.findAppRoute('../member/profile','GET'),null);assert.equal(r.findAppRoute('member/profile','DELETE'),null);assert.equal(r.findAppRoute('events/1','GET').public,true);assert.equal(r.findAppRoute('events/1/register','POST').public,false);assert.deepEqual(r.findAppRoute('video/27/play','GET').params,{id:'27'});});
dbtest('App handler validates sessions, strips self-reported identity and blocks unconfigured checkout',async db=>{
 const cred=api.createAppSession(db,1,'a');let forwarded;
 const route=load('src/app/api/app/v1/[...path]/route.ts',name=>{
 if(name==='@/lib/event-phone')return load('src/lib/event-phone.ts');
 if(name.endsWith('event-music-upload'))return load('src/lib/server/event-music-upload.ts');
 if(name.endsWith('app-push'))return {pushCapability:()=>({enabled:false})};
 if(name.endsWith('app-session'))return api;
 if(name.endsWith('app-platform'))return load('src/lib/server/app-platform.ts',name=>name==='./app-session'?api:require(name));
 if(name.endsWith('app-profile'))return load('src/lib/server/app-profile.ts',()=>api);
 if(name.endsWith('app-shop'))return {appShopPayment:()=>({alipay:false,wechat:false})};
 if(name.endsWith('app-video-cache'))return {videoCacheCapability:()=>({enabled:false})};
 if(name.endsWith('app-carrier-auth'))return {carrierLoginEnabled:()=>false};
 if(name.endsWith('mini/_helpers'))return{withDb:f=>f(db),memberToken:({id})=>'internal-'+id};
 if(name.endsWith('mini/_auth'))return{upsertPhoneMember:()=>({id:1})};
 if(name.endsWith('app-route-map'))return{findAppRoute:(path,method)=>path==='member/authorized-series'&&method==='GET'?{public:false,params:{},load:async()=>({GET:r=>{forwarded=r;return Response.json({success:true,data:[]})}})}:null};throw Error(name);
 });
 const call=(path,method='GET',body,token=cred.token)=>route[method](new Request('https://admin.test/api/app/v1/'+path+'?member_id=2',{method,headers:{authorization:'Bearer '+token},...(body?{body:JSON.stringify(body)}:{})}),{params:Promise.resolve({path:path.split('/')})});
 assert.equal((await call('member/authorized-series','GET',null,'invalid')).status,401);assert.equal((await call('member/authorized-series')).status,200);assert.equal(forwarded.headers.get('authorization'),'Bearer internal-1');assert.equal(new URL(forwarded.url).searchParams.has('member_id'),false);assert.equal((await call('shop/orders','POST',{})).status,409);assert.equal((await call('devices/other','DELETE')).status,404);assert.equal((await(await call('config')).json()).data.physicalCheckout,false);assert.equal((await call('account-deletion-requests','POST',{confirmation:'wrong'})).status,400);
});
dbtest('resume position can move backwards while stale writes cannot overwrite it',db=>{
 assert.deepEqual(api.saveAppCheckpoint(db,1,10,{progress:80,duration:100,revision:0}),{progress:80,duration:100,revision:1});
 assert.deepEqual(api.saveAppCheckpoint(db,1,10,{progress:20,duration:100,revision:1}),{progress:20,duration:100,revision:2});
 assert.throws(()=>api.saveAppCheckpoint(db,1,10,{progress:90,duration:100,revision:1}),e=>e.status===409);
 assert.equal(db.prepare('SELECT position FROM AppLearningCheckpoint').get().position,20);
 assert.throws(()=>api.saveAppCheckpoint(db,1,10,{progress:NaN,duration:100,revision:2}));
});

dbtest('carrier requests persist replay and burst limits without saving raw tokens',db=>{
 api.reserveCarrierAttempt(db,'private-provider-token','127.0.0.1',100000);
 assert.throws(()=>api.reserveCarrierAttempt(db,'private-provider-token','other-ip',100001),e=>e.status===409);
 for(let i=0;i<9;i++)api.reserveCarrierAttempt(db,'other-token-'+i,'127.0.0.1',100002);
 assert.throws(()=>api.reserveCarrierAttempt(db,'another-token','127.0.0.1',100003),e=>e.status===429);
 assert.equal(JSON.stringify(db.prepare('SELECT * FROM AppCarrierAttempt').all()).includes('private-provider-token'),false);
 api.reserveCarrierAttempt(db,'after-window-token','127.0.0.1',161000);
});
test('carrier API rejects errors and malformed phones; posts signed tokens only to Aliyun',async()=>{
 const carrier=load('src/lib/server/app-carrier-auth.ts',name=>name==='./app-session'?api:require(name));
 const old={...process.env};
 try{
 process.env.APP_ONE_TAP_ENABLED='true';process.env.ALIYUN_ACCESS_KEY_ID='test-id';process.env.ALIYUN_ACCESS_KEY_SECRET='test-secret';
 const fake=async(url,init)=>{assert.equal(url,'https://dypnsapi.aliyuncs.com/');assert.equal(init.method,'POST');const p=new URLSearchParams(init.body);assert.equal(p.get('Action'),'GetMobile');assert.equal(p.get('AccessToken'),'test-provider-token');assert.ok(p.get('Signature'));return Response.json({Code:'OK',GetMobileResultDTO:{Mobile:'13800000001'}})};
 assert.equal(await carrier.getCarrierPhone('test-provider-token',fake),'13800000001');
 await assert.rejects(carrier.getCarrierPhone('test-provider-token',async()=>Response.json({Code:'OK',GetMobileResultDTO:{Mobile:'138****0001'}})),e=>e.status===401);
 await assert.rejects(carrier.getCarrierPhone('test-provider-token',async()=>Response.json({Code:'InvalidToken'})),e=>e.status===401);
 process.env.APP_ONE_TAP_ENABLED='false';await assert.rejects(carrier.getCarrierPhone('test-provider-token',fake),e=>e.status===503);
 }finally{for(const k of ['APP_ONE_TAP_ENABLED','ALIYUN_ACCESS_KEY_ID','ALIYUN_ACCESS_KEY_SECRET']){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k]}}
});

test('three platform header values are explicit and never serve as authentication',()=>{
 const p=load('src/lib/server/app-platform.ts',name=>name==='./app-session'?api:require(name));
 assert.equal(p.appPlatform(new Headers()),'ios');
 for(const value of ['ios','android','harmony']){assert.equal(p.appPlatform(new Headers({'x-client-platform':value})),value);assert.equal(p.appMemberSource(value),value+'_app');}
 for(const value of ['admin','web','harmonyos',''])assert.throws(()=>p.appPlatform(new Headers({'x-client-platform':value})),e=>e.status===400);
});
dbtest('Android and Harmony login keep shared accounts with their own source and device labels',async db=>{
 let sources=[];
 const platform=load('src/lib/server/app-platform.ts',name=>name==='./app-session'?api:require(name));
 const route=load('src/app/api/app/v1/[...path]/route.ts',name=>{
 if(name==='@/lib/event-phone')return load('src/lib/event-phone.ts');
 if(name.endsWith('event-music-upload'))return load('src/lib/server/event-music-upload.ts');
 if(name.endsWith('app-push'))return {pushCapability:()=>({enabled:false})};
 if(name.endsWith('app-session'))return api;
 if(name.endsWith('app-platform'))return platform;
 if(name.endsWith('app-profile'))return load('src/lib/server/app-profile.ts',()=>api);
 if(name.endsWith('app-shop'))return {appShopPayment:()=>({alipay:false,wechat:false})};
 if(name.endsWith('app-video-cache'))return {videoCacheCapability:()=>({enabled:false})};
 if(name.endsWith('app-carrier-auth'))return {carrierLoginEnabled:()=>false};
 if(name.endsWith('mini/_helpers'))return {withDb:f=>f(db)};
 if(name.endsWith('mini/_auth'))return {upsertPhoneMember:(db,phone,options)=>{sources.push(options.source);return {id:1}}};
 if(name.endsWith('app-route-map'))return {findAppRoute:()=>null};throw Error(name);
 });
 for(const value of ['android','harmony']){
 db.prepare("INSERT INTO MiniSmsCode(phone,code,used,expires_at) VALUES(?,'123456',0,datetime('now','localtime','+5 minute'))").run('13800000000');
 const res=await route.POST(new Request('https://admin.test/api/app/v1/auth/login',{method:'POST',headers:{'x-client-platform':value},body:JSON.stringify({phone:'13800000000',code:'123456',memberId:2})}),{params:Promise.resolve({path:['auth','login']})});
 assert.equal(res.status,200);const data=(await res.json()).data;assert.equal(data.memberId,1);
 assert.equal(db.prepare('SELECT device_name FROM AppSession WHERE id=?').get(data.sessionId).device_name,platform.appDeviceName(value));
 }
 assert.deepEqual(sources,['android_app','harmony_app']);
});
dbtest('provisioned password authenticates only its member, stores a salted digest and rotates sessions',db=>{
 const password='test-only-strong-password-123!'; const old=api.createAppSession(db,1,'old',1000);
 api.setAppPassword(db,1,password,1000000,1001);
 const row=db.prepare('SELECT * FROM AppPasswordCredential').get();assert.notEqual(row.digest,password);assert.equal(row.digest.length,64);assert.equal(row.salt.length,32);
 assert.throws(()=>api.authenticateApp(db,old.token,1002));
 assert.equal(api.verifyAppPassword(db,'13800000000',password,'ip1',1002),1);
 assert.throws(()=>api.verifyAppPassword(db,'13900000000',password,'ip1',1003),e=>e.status===401);
 assert.throws(()=>api.verifyAppPassword(db,'13800000000',password,'ip1',1000000),e=>e.status===401);
});
dbtest('password failures persist and throttle across IPs without enrolling unknown accounts',db=>{
 api.setAppPassword(db,1,'test-only-strong-password-123!',1000000,1000);
 for(let i=0;i<5;i++)assert.throws(()=>api.verifyAppPassword(db,'13800000000','wrong','ip'+i,1001),e=>e.status===401);
 assert.throws(()=>api.verifyAppPassword(db,'13800000000','test-only-strong-password-123!','another-ip',1002),e=>e.status===429);
 assert.equal(api.verifyAppPassword(db,'13800000000','test-only-strong-password-123!','another-ip',601002),1);
 assert.throws(()=>api.verifyAppPassword(db,'13700000000','wrong','ip',601003),e=>e.status===401);
 assert.equal(db.prepare('SELECT count(*) n FROM Member').get().n,2);
});
dbtest('password refuses revocation, disabled, merged, deletion-pending and ambiguous phone accounts',db=>{
 const password='test-only-strong-password-123!';api.setAppPassword(db,1,password,1000000,1000);
 db.exec('UPDATE AppPasswordCredential SET revoked_at=1001');assert.throws(()=>api.verifyAppPassword(db,'13800000000',password,'ip',1002));
 db.exec("UPDATE AppPasswordCredential SET revoked_at=NULL;UPDATE Member SET status='disabled' WHERE id=1");assert.throws(()=>api.verifyAppPassword(db,'13800000000',password,'ip',1003));
 db.exec("UPDATE Member SET status='active',merged_to_member_id=2 WHERE id=1");assert.throws(()=>api.verifyAppPassword(db,'13800000000',password,'ip',1004));
 db.exec('UPDATE Member SET merged_to_member_id=NULL WHERE id=1');api.requestAccountDeletion(db,1,1005);assert.throws(()=>api.verifyAppPassword(db,'13800000000',password,'ip',1006));
 db.exec("DELETE FROM AppDeletionRequest;INSERT INTO Member VALUES(3,'duplicate','13800000000','active',NULL)");assert.throws(()=>api.verifyAppPassword(db,'13800000000',password,'ip',601007));
});
dbtest('password HTTP login ignores client identity and returns a normal revocable AppSession',async db=>{
 const password='test-only-strong-password-123!';api.setAppPassword(db,1,password,Date.now()+86400000);
 const route=load('src/app/api/app/v1/[...path]/route.ts',n=>{
  if(n==='@/lib/event-phone')return load('src/lib/event-phone.ts');
  if(n.endsWith('app-push'))return {pushCapability:()=>({enabled:false})};
  if(n.endsWith('app-session'))return api;
  if(n.endsWith('mini/_helpers'))return {withDb:f=>f(db)};
  if(n.endsWith('app-platform'))return load('src/lib/server/app-platform.ts',()=>api);
  if(/event-music-upload|app-shop|app-profile|app-carrier-auth|app-video-cache|mini\/_auth|app-route-map/.test(n))return {};
  throw Error(n);
 });
 const call=body=>route.POST(new Request('https://admin.test/api/app/v1/auth/password-login',{method:'POST',headers:{'x-real-ip':'test-ip'},body:JSON.stringify(body)}),{params:Promise.resolve({path:['auth','password-login']})});
 assert.equal((await call({phone:'13800000000',password:{}})).status,401);
 assert.equal((await call({phone:'13800000000',password:'wrong'})).status,401);
 const response=await call({phone:'13800000000',password,memberId:2,role:'admin'});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
 const data=(await response.json()).data;assert.equal(data.memberId,1);assert.equal(api.authenticateApp(db,data.token).member_id,1);assert.equal(data.password,undefined);
 api.revokeAppSession(db,1,data.sessionId);assert.throws(()=>api.authenticateApp(db,data.token));
});
dbtest('revoking password immediately invalidates its login and all existing App sessions',db=>{
 const password='test-only-strong-password-123!';api.setAppPassword(db,1,password,1000000,1000);const session=api.createAppSession(db,1,'phone',1001);
 api.revokeAppPassword(db,1,1002);assert.throws(()=>api.verifyAppPassword(db,'13800000000',password,'ip',1003),e=>e.status===401);assert.throws(()=>api.authenticateApp(db,session.token,1003));
});

dbtest('international SMS uses the canonical phone, remains one-use and throttles failures',db=>{
 const phone='+60124627663';
 db.prepare("INSERT INTO MiniSmsCode VALUES(1,?,'123456',0,datetime('now','localtime','+5 minute'))").run(phone);
 assert.throws(()=>api.verifyAppSMS(db,'+600124627663','123456',1000));
 api.verifyAppSMS(db,phone,'123456',1000);
 assert.equal(db.prepare('SELECT used FROM MiniSmsCode').get().used,1);
 assert.throws(()=>api.verifyAppSMS(db,phone,'123456',1001));
 for(let i=0;i<4;i++)assert.throws(()=>api.verifyAppSMS(db,phone,'000000',1002+i));
 assert.throws(()=>api.verifyAppSMS(db,phone,'000000',1010),e=>e.status===429);
});

dbtest('App HTTP send and login preserve country code and use one canonical Malaysian identity',async db=>{
 let forwarded,identity;
 const route=load('src/app/api/app/v1/[...path]/route.ts',n=>{
  if(n==='@/lib/event-phone')return load('src/lib/event-phone.ts');
  if(n.endsWith('mini/send-code/route'))return {POST:async r=>{forwarded=await r.json();return Response.json({success:true})}};
  if(n.endsWith('app-session'))return api;
  if(n.endsWith('mini/_helpers'))return {withDb:f=>f(db)};
  if(n.endsWith('mini/_auth'))return {upsertPhoneMember:(_db,phone)=>{identity=phone;return {id:1}}};
  if(n.endsWith('app-platform'))return load('src/lib/server/app-platform.ts',()=>api);
  return {};
 });
 const call=(path,body)=>route.POST(new Request('https://test/api/app/v1/'+path,{method:'POST',body:JSON.stringify(body)}),{params:Promise.resolve({path:path.split('/')})});
 assert.equal((await call('send-code',{phone:'0124627663',countryCode:'+60'})).status,200);
 assert.deepEqual(forwarded,{phone:'0124627663',countryCode:'+60'});
 for(const phone of ['0124627663','60124627663','+60124627663']){
  db.prepare("INSERT INTO MiniSmsCode(phone,code,used,expires_at) VALUES(?,'123456',0,datetime('now','localtime','+5 minute'))").run('+60124627663');
  assert.equal((await call('auth/login',{phone,countryCode:'+60',code:'123456',memberId:2})).status,200);
  assert.equal(identity,'+60124627663');
  assert.equal((await call('auth/login',{phone,countryCode:'+60',code:'123456'})).status,400);
 }
});

dbtest('App password login resolves a mainland E.164 number from the legacy login key', db => {
 const password = 'test-only-strong-password-123!';
 api.setAppPassword(db, 1, password, 1000000, 1000);
 db.prepare('UPDATE Member SET phone=? WHERE id=1').run('+8613800000000');
 assert.equal(api.verifyAppPassword(db, '13800000000', password, 'fixture', 1001), 1);
 db.prepare("UPDATE Member SET phone='13800000000' WHERE id=2").run();
 assert.throws(() => api.verifyAppPassword(db, '13800000000', password, 'fixture', 1002), error => error.status === 401);
});
