const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),Database=require('better-sqlite3');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(file,mocks={}) {
 file=path.resolve(root,file);if(cache.has(file)&&!Object.keys(mocks).length)return cache.get(file);
 const m={exports:{}},code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',code)(name=>{
  if(Object.hasOwn(mocks,name))return mocks[name];
  if(name.startsWith('@/'))return load('src/'+name.slice(2)+'.ts');
  if(name.startsWith('.'))return load(path.resolve(path.dirname(file),name+'.ts'));
  return require(name);
 },m,m.exports);
 if(!Object.keys(mocks).length)cache.set(file,m.exports);return m.exports;
}
const schema=load('src/app/api/event/_db.ts',{'@/lib/server/admin-db':{},'../_local-auth':{},'./_access':{},'@/lib/server/event-ranking':{}});
const events=load('src/lib/server/event-online.ts');
const {deleteEventRegistrations}=load('src/lib/server/event-registration-deletion.ts');
const training=load('src/app/api/training-db.ts',{'@/lib/server/admin-db':{},'@/lib/server/student-growth':{},'./_local-auth':{}});
const profiles=load('src/lib/server/event-player-profile.ts',{'@/app/api/training-db':training});
function fixture() {
 const db=new Database(':memory:');schema.ensureEventTables(db);
 db.exec(`CREATE TABLE Member(id INTEGER PRIMARY KEY,name TEXT,phone TEXT,status TEXT,gender TEXT,birthday TEXT,country TEXT,province TEXT,city TEXT,foreignRegion TEXT,address TEXT,remark TEXT,phone_country_code TEXT,phone_national_number TEXT,wx_openid TEXT);
 CREATE TABLE Payment(memberId INTEGER,memberName TEXT,memberPhone TEXT);
 CREATE TABLE ConsumeRecord(memberId INTEGER,memberName TEXT,memberPhone TEXT);
 CREATE TABLE orders(member_id INTEGER,member_name TEXT,member_phone TEXT,source_type TEXT,updated_at TEXT);
 INSERT INTO Member(id,name,phone,status,wx_openid) VALUES(1,'张 三','13800000001','active','private-login'),(2,'Connie Tse','13800000002','active','private-login2');
 INSERT INTO Payment VALUES(1,'张 三','13800000001');
 INSERT INTO event_competitions(id,name,code,owner_user_id) VALUES(7,'甲赛事','E7',91),(8,'乙赛事','E8',92);
 INSERT INTO event_groups(id,competition_id,name,registration_fee) VALUES(3,7,'甲组',10.25),(4,8,'乙组',20);
 INSERT INTO event_players(id,competition_id,group_id,member_id,name,phone,registration_fee,status,audit_status) VALUES(11,7,3,1,'张 三','13800000001',10.25,'approved','approved'),(12,8,4,1,'张 三','13800000001',20,'approved','approved'),(13,8,4,2,'Connie Tse','13800000002',20,'approved','approved');
 INSERT INTO event_performances(id,competition_id,group_id,player_id,title) VALUES(21,7,3,11,'节目一'),(22,8,4,12,'节目二');
 `);
 events.ensureEventOnline(db);db.eventActorId=91;return db;
}
const charge={kind:'charge',amount:10.25,method:'cash',paidAt:'2026-01-01T00:00:00.000Z',requestKey:'manual-charge-unique-001'};
test('paid deletion archives original receipts and identity, cascades programmes, and leaves users and other events intact',()=>{
 const db=fixture();try{
 events.recordRegistrationPayment(db,11,charge);
 const receipt=db.prepare('SELECT * FROM event_registration_payments WHERE player_id=11').get();
 db.transaction(()=>deleteEventRegistrations(db,[11])).immediate();
 assert.equal(db.prepare('SELECT count(*) n FROM event_players WHERE id=11').get().n,0);
 assert.equal(db.prepare('SELECT count(*) n FROM event_performances WHERE player_id=11').get().n,0);
 const archived=db.prepare('SELECT * FROM event_deleted_registrations WHERE id=11').get();
 assert.equal(archived.paid_amount,10.25);assert.equal(archived.name,'张 三');assert.equal(archived.group_name,'甲组');assert.equal(archived.deleted_by,91);
 const copied=db.prepare('SELECT * FROM event_deleted_registration_payments').get();
 for(const key of ['amount','kind','method','paid_at','remark','request_key','created_by','created_at'])assert.equal(copied[key],receipt[key]);
 assert.equal(copied.original_payment_id,receipt.id);
 assert.equal(db.prepare('SELECT count(*) n FROM Member').get().n,2);
 assert.equal(db.prepare('SELECT count(*) n FROM event_players').get().n,2);
 assert.equal(db.pragma('foreign_key_check').length,0);
 }finally{db.close();}
});
test('fully refunded and historical balance registrations keep accurate revenue snapshots',()=>{
 const db=fixture();try{
 events.recordRegistrationPayment(db,11,charge);
 events.recordRegistrationPayment(db,11,{...charge,kind:'refund',requestKey:'manual-refund-unique-001'});
 db.prepare("UPDATE event_players SET paid_amount=20,paid_status='paid' WHERE id=12").run();
 db.transaction(()=>deleteEventRegistrations(db,[11,12])).immediate();
 assert.equal(db.prepare('SELECT paid_amount FROM event_deleted_registrations WHERE id=11').get().paid_amount,0);
 assert.equal(db.prepare('SELECT count(*) n FROM event_deleted_registration_payments').get().n,2);
 assert.equal(db.prepare('SELECT paid_amount FROM event_deleted_registrations WHERE id=12').get().paid_amount,20);
 }finally{db.close();}
});
test('one failure rolls back the entire batch archive and deletion',()=>{
 const db=fixture();try{
 events.recordRegistrationPayment(db,11,charge);
 db.exec("CREATE TRIGGER fail_delete BEFORE DELETE ON event_players WHEN OLD.id=12 BEGIN SELECT RAISE(ABORT,'blocked'); END");
 assert.throws(()=>db.transaction(()=>deleteEventRegistrations(db,[11,12])).immediate(),/blocked/);
 assert.equal(db.prepare('SELECT count(*) n FROM event_deleted_registrations').get().n,0);
 assert.equal(db.prepare('SELECT count(*) n FROM event_registration_payments').get().n,1);
 assert.equal(db.prepare('SELECT count(*) n FROM event_players').get().n,3);
 }finally{db.close();}
});
for(const source of ['src/lib/server/event-online.ts','../production/website/src/lib/server/event-online.ts'])test(source+' accepts late payment and refund after deletion exactly once without restoring registration',()=>{
 const db=fixture();try{
 const core=load(source.includes('website')?'../production/website/src/lib/server/shop-core.ts':'src/lib/server/shop-core.ts');
 core.ensureShop(db);
 db.exec("CREATE TRIGGER event_online_pending_delete_guard BEFORE DELETE ON event_players WHEN EXISTS(SELECT 1 FROM shop_course_orders c JOIN shop_online_orders o ON o.id=c.order_id WHERE c.target_id=OLD.id AND o.status='pending') BEGIN SELECT RAISE(ABORT,'旧版待付款禁止删除'); END");
 const online=load(source);online.ensureDeletedRegistrationTables(db);
 const offer=core.courseOffer(db,'event',11,1);
 const order=core.createCourseOrder(db,1,{kind:'event',targetId:11,provider:'wechat',requestKey:'late-online-order-001',expectedTotalFen:offer.priceFen,eventItems:[[11,1025]]});
 assert.throws(()=>db.prepare('DELETE FROM event_players WHERE id=11').run(),/先完成财务存档/);
 db.transaction(()=>deleteEventRegistrations(db,[11])).immediate();
 core.settlePaid(db,order.id,'wechat','transaction-test',1025);
 core.settlePaid(db,order.id,'wechat','transaction-test',1025);
 assert.equal(db.prepare('SELECT paid_amount FROM event_deleted_registrations WHERE id=11').get().paid_amount,10.25);
 assert.equal(db.prepare('SELECT count(*) n FROM event_deleted_registration_payments').get().n,1);
 db.prepare("UPDATE shop_online_orders SET status='refunding' WHERE id=?").run(order.id);
 core.settleRefund(db,order.id);core.settleRefund(db,order.id);
 assert.equal(db.prepare('SELECT paid_amount FROM event_deleted_registrations WHERE id=11').get().paid_amount,0);
 assert.equal(db.prepare('SELECT count(*) n FROM event_deleted_registration_payments').get().n,2);
 assert.equal(db.prepare('SELECT count(*) n FROM event_players WHERE id=11').get().n,0);
 }finally{db.close();}
});
test('event profile edits change the real user and synchronize all linked registrations and training records',()=>{
 const db=fixture();try{
 const actor={id:91,role:'event_admin'};
 const before=profiles.eventPlayerProfile(db,actor,11);assert.equal(before.name,'张 三');assert.equal(Object.hasOwn(before,'wx_openid'),false);
 profiles.updateEventPlayerProfile(db,actor,11,{name:' 张三 Eva  Noor ',city:'长沙',id:2,status:'deleted',wx_openid:'changed'});
 assert.equal(db.prepare('SELECT name FROM Member WHERE id=1').get().name,'张三 Eva  Noor');
 assert.equal(db.prepare('SELECT name FROM event_players WHERE id=12').get().name,'张三 Eva  Noor');
 assert.equal(db.prepare('SELECT memberName FROM Payment WHERE memberId=1').get().memberName,'张三 Eva  Noor');
 assert.equal(db.prepare('SELECT status,wx_openid FROM Member WHERE id=1').get().wx_openid,'private-login');
 assert.equal(db.prepare('SELECT name FROM Member WHERE id=2').get().name,'Connie Tse');
 }finally{db.close();}
});
test('profile permissions and phone collisions fail before any change',()=>{
 const db=fixture();try{
 for(const id of [12,13])assert.throws(()=>profiles.updateEventPlayerProfile(db,{id:91,role:'event_admin'},id,{name:'changed'}),e=>e.status===403);
 assert.throws(()=>profiles.updateEventPlayerProfile(db,{id:91,role:'event_admin'},11,{phone:'13800000002'}),e=>e.status===409);
 assert.throws(()=>profiles.updateEventPlayerProfile(db,{id:91,role:'event_admin'},11,{name:'A'.repeat(121)}));
 assert.equal(db.prepare('SELECT name FROM Member WHERE id=1').get().name,'张 三');
 }finally{db.close();}
});
test('restricted event deletion archives owned receipts without loosening the general shared-profile write ban',()=>{
 const db=fixture();try{
 events.recordRegistrationPayment(db,11,charge);
 const {scopeEventDb}=load('src/app/api/event/_access.ts',{'./_db':{},'../_local-auth':{}});
 scopeEventDb(db,91);
 assert.throws(()=>db.prepare("UPDATE Member SET name='wrong' WHERE id=1").run(),/无权限/);
 db.transaction(()=>deleteEventRegistrations(db,[11])).immediate();
 assert.equal(db.prepare('SELECT count(*) n FROM event_deleted_registrations').get().n,1);
 assert.equal(db.prepare('SELECT count(*) n FROM event_players').get().n,0);
 assert.equal(db.prepare('SELECT count(*) n FROM main.event_players').get().n,2);
 }finally{db.close();}
});

test('income totals remain stable after deletion and owner-only details mark retained receipts',async()=>{
 const db=fixture();try{
 events.recordRegistrationPayment(db,11,charge);
 const policy=load('src/lib/admin-feature-access.ts');
 let actor={id:1,role:'admin',username:'lilei'};
 const helpers={...schema,hasAuth:()=>true,withRequestEventDb:(_,fn)=>fn(db)};
 const mocks={'@/lib/admin-feature-access':policy,'../../_access':{eventActor:()=>actor},'../../_competition-owner':{},'../../_db':helpers};
 const competition=load('src/app/api/event/competitions/[id]/route.ts',mocks);
 const context={params:Promise.resolve({id:'7'})},request=new Request('https://admin.test/api/event/competitions/7');
 const before=await(await competition.GET(request,context)).json();
 db.transaction(()=>deleteEventRegistrations(db,[11])).immediate();
 const after=await(await competition.GET(request,context)).json();
 assert.equal(before.data.revenue.totalFen,1025);assert.equal(after.data.revenue.totalFen,1025);
 const revenue=load('src/app/api/event/competitions/[id]/revenue/route.ts',{'@/lib/admin-feature-access':policy,'../../../_access':{eventActor:()=>actor},'../../../_db':helpers});
 const rows=await(await revenue.GET(request,context)).json();
 assert.equal(rows.total,1);assert.equal(rows.data[0].isDeleted,1);assert.equal(rows.data[0].name,'张 三');assert.equal(rows.data[0].amountFen,1025);
 actor={id:91,role:'event_admin',username:'event'};
 assert.equal((await revenue.GET(request,context)).status,403);
 assert.equal(Object.hasOwn((await(await competition.GET(request,context)).json()).data,'revenue'),false);
 }finally{db.close();}
});

test('changing a profile phone updates international identity fields without creating or merging users',()=>{
 const db=fixture();try{
 db.prepare("UPDATE Member SET phone_country_code='+86',phone_national_number='13800000001' WHERE id=1").run();
 profiles.updateEventPlayerProfile(db,{id:91,role:'event_admin'},11,{phone:'+85290937074'});
 const member=db.prepare('SELECT phone,phone_country_code,phone_national_number FROM Member WHERE id=1').get();
 assert.deepEqual(member,{phone:'+85290937074',phone_country_code:'+852',phone_national_number:'90937074'});
 assert.equal(db.prepare('SELECT count(*) n FROM Member').get().n,2);
 assert.equal(db.prepare('SELECT phone FROM event_players WHERE id=12').get().phone,'+85290937074');
 }finally{db.close();}
});
