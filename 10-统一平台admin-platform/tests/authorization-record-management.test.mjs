import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { DatabaseSync } from 'node:sqlite';
function loadModule(path, mocks={}) {
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 new Function('require','module','exports',code)(name=>mocks[name],module,module.exports);
 return module.exports;
}
const financials=loadModule('../src/lib/authorization-record-financials.ts');
const revenue=loadModule('../src/lib/server/authorization-revenue.ts');
const commissions=loadModule('../src/lib/server/authorization-commission.ts',{'./authorization-revenue':revenue});
function setup(username = 'lilei') {
 const sqlite = new DatabaseSync(':memory:');
 sqlite.exec(`CREATE TABLE User(id INTEGER,username TEXT,status TEXT); INSERT INTO User VALUES(1,'lilei','active');
 CREATE TABLE CourseAuthorization(id INTEGER PRIMARY KEY,actual_amount REAL,sales TEXT,commission_amount REAL,commission_rate REAL,remark TEXT,granted_at TEXT,status TEXT);
 INSERT INTO CourseAuthorization VALUES(1,100,'顾问',10,10,'原备注','2026-09-27','active');
 CREATE TABLE FinanceIncome(incomeNo TEXT,amount REAL,remark TEXT); INSERT INTO FinanceIncome VALUES('AUTH-1',100,''); INSERT INTO FinanceIncome VALUES('AUTH-10',800,'AUTO_ONLINE_AUTH_INCOME|authorization_id=10');
 CREATE TABLE CommissionSettlement(periodType TEXT,period TEXT,advisor TEXT,status TEXT);`);
 sqlite.exec(`ALTER TABLE User ADD COLUMN name TEXT;
 CREATE TABLE Member(id INTEGER,name TEXT,phone TEXT,level TEXT,wx_openid TEXT,wx_unionid TEXT,source TEXT);
 CREATE TABLE CourseSeries(id INTEGER,name TEXT); INSERT INTO CourseSeries VALUES(1,'课程');
 CREATE TABLE CourseOrder(id INTEGER,status TEXT);
 ALTER TABLE CourseAuthorization ADD COLUMN series_id INTEGER DEFAULT 1;
 ALTER TABLE CourseAuthorization ADD COLUMN member_id INTEGER;
 ALTER TABLE CourseAuthorization ADD COLUMN phone TEXT;
 ALTER TABLE CourseAuthorization ADD COLUMN wx_openid TEXT;
 ALTER TABLE CourseAuthorization ADD COLUMN wx_unionid TEXT;
 ALTER TABLE CourseAuthorization ADD COLUMN type TEXT;
 ALTER TABLE CourseAuthorization ADD COLUMN revoked_at TEXT;
 ALTER TABLE CourseAuthorization ADD COLUMN revoked_by INTEGER;
 ALTER TABLE CourseAuthorization ADD COLUMN granted_by INTEGER;
 ALTER TABLE CourseAuthorization ADD COLUMN order_vouchers TEXT;
 ALTER TABLE CourseAuthorization ADD COLUMN order_id INTEGER;`);
 const db={prepare:s=>sqlite.prepare(s),exec:s=>sqlite.exec(s),transaction:fn=>()=>{sqlite.exec('BEGIN');try{const r=fn();sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 const module={exports:{}}; let authCalls = 0;
 const mocks={'@/lib/authorization-record-financials':financials,'@/lib/server/authorization-revenue':revenue,'@/lib/server/authorization-commission':commissions,'../_materials':{withDb:fn=>fn(db)},'../../training-db':{authPayloadFromRequest:()=>{authCalls++;return username?{username}:null;},requirePermission:()=>null},'../series/[id]/_authorization':{ensureAuthorizationAuditColumns(){}}};
 const code=ts.transpileModule(fs.readFileSync(new URL('../src/app/api/course/authorizations/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 new Function('require','module','exports',code)(name=>mocks[name],module,module.exports);
 const snapshot=()=>JSON.stringify(sqlite.prepare('SELECT * FROM CourseAuthorization WHERE id=1').get());
 const call=async(method,overrides={})=>{const request=new Request('https://admin.swod.com.cn/api/course/authorizations',{method,body:JSON.stringify({authorization_id:1,expected:snapshot(),actual_amount:200,commission_amount:30,sales:'新顾问',remark:'修正',...overrides})});return module.exports[method](request);};
 return {sqlite,call,snapshot, db, get:(params='')=>module.exports.GET(new Request('https://admin.swod.com.cn/api/course/authorizations'+params)), authCalls:()=>authCalls};
}
test('edit synchronizes financial values and audit; zero receipts and adjacent IDs',async()=>{
 const {sqlite,call}=setup();
 assert.equal((await call('PATCH')).status,200);
 const row=sqlite.prepare('SELECT * FROM CourseAuthorization').get();
 assert.equal(row.actual_amount,200);assert.equal(row.commission_rate,15);assert.equal(row.status,'active');
 assert.equal(sqlite.prepare("SELECT amount FROM FinanceIncome WHERE incomeNo='AUTH-1'").get().amount,200);
 assert.equal(sqlite.prepare("SELECT amount FROM FinanceIncome WHERE incomeNo='AUTH-10'").get().amount,800);
 const audit=sqlite.prepare('SELECT * FROM CourseAuthorizationRecordAudit').get();assert.equal(JSON.parse(audit.before_json).actual_amount,100);assert.equal(audit.actor_id,1);
 assert.equal((await call('PATCH',{actual_amount:0,commission_amount:0})).status,200);
 assert.equal(sqlite.prepare("SELECT amount FROM FinanceIncome WHERE incomeNo='AUTH-1'").get().amount,0);
 sqlite.close();
});
test('delete removes revenue and commissions while preserving access and audit; retries rejected',async()=>{
 const {sqlite,call}=setup();assert.equal((await call('DELETE')).status,200);
 assert.equal(sqlite.prepare('SELECT status FROM CourseAuthorization').get().status,'active');
 assert.equal(sqlite.prepare('SELECT amount FROM FinanceIncome WHERE incomeNo=\'AUTH-1\'').get().amount,0);
 assert.equal(sqlite.prepare(revenue.AUTHORIZATION_INCOME_SQL).all().length,0);
 assert.equal(sqlite.prepare(revenue.AUTHORIZATION_FINANCIAL_SQL).all().length,0);
 assert.equal(JSON.parse(sqlite.prepare('SELECT before_json FROM CourseAuthorizationRecordAudit').get().before_json).actual_amount,100);
 assert.equal(sqlite.prepare('SELECT authorization_id FROM CourseAuthorizationListHidden').get().authorization_id,1);
 assert.equal((await call('DELETE')).status,400);sqlite.close();
});
test('only named active account, settlement guards, validation and stale writes',async()=>{
 for(const name of ['other-admin',null]){const s=setup(name);assert.equal((await s.call('PATCH')).status,403);assert.equal((await s.call('DELETE')).status,403);s.sqlite.close();}
 const {sqlite,call}=setup();
 assert.equal((await call('PATCH',{commission_amount:300})).status,400);
 assert.equal((await call('PATCH',{expected:'old'})).status,400);
 sqlite.exec("INSERT INTO CommissionSettlement VALUES('month','2026-09','顾问','settled')");
 assert.equal((await call('PATCH')).status,400);assert.equal(sqlite.prepare('SELECT actual_amount FROM CourseAuthorization').get().actual_amount,100);
 sqlite.exec("UPDATE User SET status='disabled'");assert.equal((await call('DELETE')).status,403);sqlite.close();
});
test('audit failure rolls back financial edits',async()=>{
 const {sqlite,call}=setup();
 sqlite.exec(`CREATE TABLE CourseAuthorizationRecordAudit(id INTEGER PRIMARY KEY,authorization_id INTEGER,action TEXT,actor_id INTEGER,before_json TEXT,after_json TEXT,created_at TEXT)`);
 sqlite.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON CourseAuthorizationRecordAudit BEGIN SELECT RAISE(ABORT,'audit failed'); END;");
 assert.equal((await call('PATCH')).status,400);
 assert.equal(sqlite.prepare('SELECT actual_amount FROM CourseAuthorization').get().actual_amount,100);sqlite.close();
});

test('listing validates the session once rather than once per event', async()=>{
 const s=setup();
 s.sqlite.exec(` INSERT INTO CourseAuthorization(id,series_id,granted_at,revoked_at) VALUES(2,1,'2026-09-28','2026-09-29');`);
 const result=await s.get();assert.equal(result.status,200);
 const payload=await result.json();assert.equal(payload.data.length,3);
 assert.ok(payload.data.every(r=>r.record_snapshot));assert.equal(s.authCalls(),1);
 s.sqlite.close();
});

test('pagination and server course filtering keep total and events correct',async()=>{
 const s=setup();s.sqlite.exec(`INSERT INTO CourseAuthorization(id,series_id,granted_at,revoked_at) VALUES(2,1,'2026-09-28','2026-09-29');`);
 const first=await (await s.get('?page=1&pageSize=1')).json();
 const next=await (await s.get('?page=2&pageSize=1')).json();
 assert.equal(first.total,3);assert.equal(first.data.length,1);assert.equal(first.pageSize,1);
 assert.notEqual(first.data[0].auth_row_key,next.data[0].auth_row_key);
 const revoke=await (await s.get('?page=1&tab=unauthorized')).json();assert.equal(revoke.total,1);assert.equal(revoke.data[0].action_type,'revoke');
 const otherCourse=await (await s.get('?page=1&series_id=2')).json();assert.equal(otherCourse.total,0);assert.equal(otherCourse.data.length,0);
 s.sqlite.close();
});
test('financial reporting shares edited amounts and advisor; delete removes the receipt everywhere',async()=>{
 const s=setup();assert.equal(commissions.onlineAuthorizationCommissions(s.db)[0].commissionAmount,10);
 await s.call('PATCH');
 assert.equal(s.sqlite.prepare(revenue.AUTHORIZATION_INCOME_SQL).get().amount,200);
 assert.equal(commissions.onlineAuthorizationCommissions(s.db)[0].sales,'新顾问');
 assert.equal(commissions.onlineAuthorizationCommissions(s.db)[0].commissionAmount,30);
 await s.call('DELETE');assert.equal(commissions.onlineAuthorizationCommissions(s.db).length,0);
 assert.equal(s.sqlite.prepare(revenue.AUTHORIZATION_FINANCIAL_SQL).all().length,0);s.sqlite.close();
});
test('delete rejects settled commissions and paid linked orders without modifying data',async()=>{
 const s=setup();s.sqlite.exec("INSERT INTO CommissionSettlement VALUES('month','2026-09','顾问','settled')");
 assert.equal((await s.call('DELETE')).status,400);assert.equal(s.sqlite.prepare('SELECT actual_amount FROM CourseAuthorization').get().actual_amount,100);
 s.sqlite.exec("DELETE FROM CommissionSettlement; INSERT INTO CourseOrder VALUES(1,'paid'); UPDATE CourseAuthorization SET order_id=1");
 assert.equal((await s.call('DELETE')).status,400);assert.equal((await s.call('PATCH')).status,400);
 assert.equal(s.sqlite.prepare('SELECT actual_amount FROM CourseAuthorization').get().actual_amount,100);s.sqlite.close();
});

test('delete financial changes and hidden state roll back if audit cannot be saved',async()=>{
 const s=setup();s.sqlite.exec(`CREATE TABLE CourseAuthorizationRecordAudit(id INTEGER PRIMARY KEY,authorization_id INTEGER,action TEXT,actor_id INTEGER,before_json TEXT,after_json TEXT,created_at TEXT);
 CREATE TRIGGER fail_delete_audit BEFORE INSERT ON CourseAuthorizationRecordAudit BEGIN SELECT RAISE(ABORT,'audit failed'); END;`);
 assert.equal((await s.call('DELETE')).status,400);
 assert.equal(s.sqlite.prepare('SELECT actual_amount FROM CourseAuthorization').get().actual_amount,100);
 assert.equal(s.sqlite.prepare("SELECT amount FROM FinanceIncome WHERE incomeNo='AUTH-1'").get().amount,100);
 assert.equal(s.sqlite.prepare("SELECT 1 FROM sqlite_master WHERE name='CourseAuthorizationListHidden'").get(),undefined);
 assert.equal(commissions.onlineAuthorizationCommissions(s.db).length,1);s.sqlite.close();
});

test('edit rate mode persists ratio and rounded commission; inconsistent pairs roll back',async()=>{
 const s=setup();try {
 assert.equal((await s.call('PATCH',{actual_amount:200,commission_amount:40,commission_rate:20,commission_basis:'rate'})).status,200);
 assert.equal(s.sqlite.prepare('SELECT commission_rate FROM CourseAuthorization').get().commission_rate,20);
 assert.equal((await s.call('PATCH',{actual_amount:200,commission_amount:30,commission_rate:20,commission_basis:'rate'})).status,400);
 assert.equal((await s.call('PATCH',{actual_amount:200,commission_amount:40,commission_rate:101,commission_basis:'rate'})).status,400);
 assert.equal((await s.call('PATCH',{actual_amount:100,commission_amount:0.01,commission_rate:0.005,commission_basis:'rate'})).status,400);
 assert.equal((await s.call('PATCH',{actual_amount:100,commission_amount:0,commission_rate:'',commission_basis:'rate'})).status,400);
 assert.equal(s.sqlite.prepare('SELECT commission_amount FROM CourseAuthorization').get().commission_amount,40);
 assert.equal((await s.call('PATCH',{actual_amount:0.01,commission_amount:0,commission_rate:25,commission_basis:'rate'})).status,200);
 assert.equal(s.sqlite.prepare('SELECT commission_rate FROM CourseAuthorization').get().commission_rate,25);
 assert.equal(s.sqlite.prepare("SELECT amount FROM FinanceIncome WHERE incomeNo='AUTH-1'").get().amount,0.01);
 }finally{s.sqlite.close();}
});
test('manual amount mode retains the exact amount rather than recomputing rounded ratio',async()=>{
 const s=setup();try {
 assert.equal((await s.call('PATCH',{actual_amount:399,commission_amount:75,commission_rate:18.8,commission_basis:'amount'})).status,200);
 const row=s.sqlite.prepare('SELECT * FROM CourseAuthorization').get();assert.equal(row.commission_amount,75);assert.equal(row.commission_rate,18.8);assert.equal(row.status,'active');
 assert.equal((await s.call('PATCH',{actual_amount:399,commission_amount:75,commission_rate:25,commission_basis:'amount'})).status,400);
 }finally{s.sqlite.close();}
});
test('edit initialization and changes match original financial values and field precedence',()=>{
 const f=financials;
 assert.deepEqual(f.initialAuthorizationFinancials({actual_amount:null,commission_amount:null,commission_rate:0}),{actual_amount:null,commission_amount:null,commission_rate:0,commission_basis:'rate'});
 assert.equal(f.initialAuthorizationFinancials({actual_amount:0,commission_amount:0,commission_rate:0}).actual_amount,0);
 assert.deepEqual(f.initialAuthorizationFinancials({actual_amount:400,commission_amount:100,commission_rate:25}),{actual_amount:400,commission_amount:100,commission_rate:25,commission_basis:'rate'});
 const initial=f.initialAuthorizationFinancials({actual_amount:399,commission_amount:75,commission_rate:0});assert.equal(initial.commission_rate,18.8);assert.equal(initial.commission_amount,75);assert.equal(initial.commission_basis,'amount');
 assert.deepEqual(f.authorizationFinancialPatch({commission_rate:25},{actual_amount:400,commission_rate:25}),{commission_amount:100,commission_basis:'rate'});
 assert.deepEqual(f.authorizationFinancialPatch({actual_amount:800},{actual_amount:800,commission_rate:25}),{commission_amount:200,commission_basis:'rate'});
 assert.deepEqual(f.authorizationFinancialPatch({commission_amount:75},{actual_amount:399,commission_amount:75}),{commission_rate:18.8,commission_basis:'amount'});
 assert.deepEqual(f.authorizationFinancialPatch({commission_amount:0},{actual_amount:0,commission_amount:0}),{commission_rate:0,commission_basis:'amount'});
 assert.deepEqual(f.authorizationFinancialPatch({sales:'海艳'},{}),{});
});

 test('cancelled records cannot restore receipts or commissions; zero correction is audited',async()=>{
 const s=setup();s.sqlite.exec("UPDATE CourseAuthorization SET status='revoked',revoked_at='2026-09-28'");
 assert.equal((await s.call('PATCH')).status,400);
 assert.equal((await s.call('PATCH',{actual_amount:0,commission_amount:0,commission_rate:60,commission_basis:'rate'})).status,400);
 assert.equal((await s.call('PATCH',{actual_amount:0,commission_amount:0,commission_rate:0,commission_basis:'rate'})).status,200);
 const payload=await (await s.get()).json();assert.equal(payload.data.length,2);
 assert.ok(payload.data.every(r=>r.actual_amount===0 && r.commission_amount===0 && r.commission_rate===0));
 assert.equal(JSON.parse(s.sqlite.prepare('SELECT before_json FROM CourseAuthorizationRecordAudit').get().before_json).actual_amount,100);
 s.sqlite.close();
 });
