import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { DatabaseSync } from 'node:sqlite';
const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', output)(name => name in mocks ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}

test('提成客户端连接读取和保存接口，并向调用方报告失败', async () => {
  const { api, trainingApi } = load('../src/lib/api.ts', { '@/lib/logger': { devWarn() {} } });
  const calls = [];
  api.defaults.adapter = async config => {
    calls.push({ method: config.method, url: config.url, data: config.data });
    return { data: config.method === 'get' ? [{ period: '2026-09', advisor: '测试顾问', status: 'settled' }] : { success: true }, status: 200, headers: {}, config };
  };
  assert.equal((await trainingApi.getCommissionSettlements())[0].status, 'settled');
  const data = { advisor: '测试顾问', period: '2026-09', status: 'unsettled' };
  assert.equal((await trainingApi.updateCommissionSettlement(data)).success, true);
  assert.deepEqual(calls.map(({method,url}) => ({method,url})), [{method:'get',url:'/commission-settlements'},{method:'post',url:'/commission-settlements'}]);
  assert.deepEqual(JSON.parse(calls[1].data), data);
  api.defaults.adapter = async () => { throw new Error('connection failed'); };
  await assert.rejects(trainingApi.getCommissionSettlements(), /connection failed/);
});

test('原有月度结清流程在隔离数据库中读取、保存、避免重复记账并撤销', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE Payment (id INTEGER PRIMARY KEY, amount REAL, commissionRate REAL, commissionAmount REAL, sales TEXT, date TEXT, created_at TEXT);
    INSERT INTO Payment VALUES(1,1000,20,200,'测试顾问','2026-09-01','2026-09-01');
    CREATE TABLE Member(id INTEGER PRIMARY KEY,name TEXT,phone TEXT);
    CREATE TABLE CourseSeries(id INTEGER PRIMARY KEY,name TEXT);
    CREATE TABLE CourseAuthorization(id INTEGER PRIMARY KEY, member_id INTEGER,phone TEXT,series_id INTEGER,granted_at TEXT,remark TEXT,actual_amount REAL,sales TEXT,commission_rate REAL,commission_amount REAL);
    INSERT INTO Member VALUES(1,'线上学员','13800000000');
    INSERT INTO CourseSeries VALUES(1,'线上课程');
    INSERT INTO CourseAuthorization VALUES(1,1,'',1,'2026-09-05','','500','测试顾问',10,50);
    INSERT INTO CourseAuthorization VALUES(2,1,'',1,'2026-09-05','历史授权',NULL,'测试顾问',0,0);
    CREATE TABLE CommissionSettlement (id INTEGER PRIMARY KEY,periodType TEXT,period TEXT,advisor TEXT,status TEXT,settledAt TEXT,settledBy TEXT,updated_at TEXT,UNIQUE(periodType,period,advisor));`);
  const db = { prepare: sql => sqlite.prepare(sql), exec: sql => sqlite.exec(sql), close() {}, transaction: fn => () => { sqlite.exec('BEGIN'); try { const value=fn();sqlite.exec('COMMIT');return value; } catch(e) {sqlite.exec('ROLLBACK');throw e;} } };
  const helpers = { hasAuth: req => req.headers.get('authorization') === 'test', isSuperAdminRequest: req => req.headers.get('x-test-admin') === 'yes', openTrainingDb: () => db, cleanText: (v,f='') => String(v ?? '').trim() || f, toNumber: v => Number(v || 0), nowIso: () => new Date().toISOString(), unauthorized: () => Response.json({}, {status:401}), jsonError: (message,status) => Response.json({message},{status}) };
  const route = load('../src/app/api/commission-settlements/route.ts', { '../training-db': helpers, '@/lib/server/authorization-commission': load('../src/lib/server/authorization-commission.ts') });
  const request = (status, admin=true) => new Request('http://test/api/commission-settlements', { method:'POST',headers:{authorization:'test','x-test-admin':admin?'yes':'no','content-type':'application/json'},body:JSON.stringify({period:'2026-09',advisor:'测试顾问',status}) });
  try {
    assert.equal((await route.GET(new Request('http://test'))).status,401);
    assert.equal((await route.POST(request('settled',false))).status,403);
    assert.equal((await route.POST(request('settled'))).status,200);
    assert.equal((await route.POST(request('settled'))).status,200);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM FinanceExpense').get().n,1);
    assert.equal(sqlite.prepare('SELECT amount FROM FinanceExpense').get().amount,250);
    const read = await route.GET(new Request('http://test',{headers:{authorization:'test'}}));
    assert.equal((await read.json())[0].status,'settled');
    assert.equal((await route.POST(request('unsettled'))).status,200);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM FinanceExpense').get().n,0);
  } finally { sqlite.close(); }
});

test('缴费编辑保存提成比例和金额，已结清月份拒绝普通账号修改', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE Payment (id INTEGER PRIMARY KEY,memberId INTEGER,memberName TEXT,memberPhone TEXT,courseId INTEGER,courseName TEXT,amount REAL,date TEXT,payment TEXT,sales TEXT,remark TEXT,expireDate TEXT,remainingSessions INTEGER,paymentStatus TEXT,voucherPath TEXT,voucherFilename TEXT,voucherUploadedAt TEXT,commissionRate REAL,commissionAmount REAL,created_at TEXT);
    CREATE TABLE Member (id INTEGER PRIMARY KEY,name TEXT,phone TEXT);
    CREATE TABLE Course (id INTEGER PRIMARY KEY,name TEXT,sessions INTEGER,endDate TEXT);
    CREATE TABLE ConsumeRecord (paymentId INTEGER,memberId INTEGER,memberName TEXT,memberPhone TEXT,courseId INTEGER,courseName TEXT);
    INSERT INTO Member VALUES(1,'测试学员',''); INSERT INTO Course VALUES(1,'测试课程',10,'');
    INSERT INTO Payment(id,memberId,courseId,amount,date,sales,commissionRate,commissionAmount) VALUES(1,1,1,1000,'2026-09-01','测试顾问',20,200);`);
  let locked = false;
  const db = {prepare:sql=>sqlite.prepare(sql),close(){},transaction:fn=>()=>{sqlite.exec('BEGIN');try{const result=fn();sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
  const helpers = {requirePermission:()=>null,hasAuth:()=>true,openTrainingDb:()=>db,cleanText:(v,f='')=>String(v??'').trim()||f,toNumber:(v,f=0)=>Number.isFinite(Number(v))?Number(v):f,today:()=> '2026-09-05',syncPaymentOrder(){},isSuperAdminRequest:()=>false,isCommissionSettlementLocked:()=>locked,jsonError:(message,status)=>Response.json({message},{status})};
  const route=load('../src/app/api/payments/[id]/route.ts',{'../../training-db':helpers,'@/lib/server/admin-audit':{writeAdminAudit(){}},'@/lib/server/student-growth':{reconcileOfflinePayment(){},reverseDeletedSource(){},recalculateMemberGrowth(){}},'../_voucher-files':{deletePaymentVoucherFile:async()=>{}}});
  const request=()=>new Request('http://test/api/payments/1',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({amount:1000,commissionRate:15})});
  try {
    assert.equal((await route.PUT(request(),{params:Promise.resolve({id:'1'})})).status,200);
    assert.deepEqual({...sqlite.prepare('SELECT commissionRate,commissionAmount FROM Payment WHERE id=1').get()},{commissionRate:15,commissionAmount:150});
    locked=true;
    assert.equal((await route.PUT(request(),{params:Promise.resolve({id:'1'})})).status,400);
    assert.equal(sqlite.prepare('SELECT commissionAmount FROM Payment WHERE id=1').get().commissionAmount,150);
  } finally {sqlite.close();}
});


test('授权实收使用优惠价快照，零元、四舍五入、非法输入和结清锁定', () => {
  const sqlite = new DatabaseSync(':memory:');
  const db = {prepare: sql => sqlite.prepare(sql), exec: sql => sqlite.exec(sql)};
  const helper = load('../src/lib/server/authorization-commission.ts');
  sqlite.exec(`CREATE TABLE CourseSeries(id INTEGER,price REAL,promo_price REAL);
    INSERT INTO CourseSeries VALUES(1,1000,599),(2,500,0);
    CREATE TABLE CourseAuthorization(id INTEGER PRIMARY KEY);
    CREATE TABLE CommissionSettlement(periodType TEXT,period TEXT,advisor TEXT,status TEXT);`);
  try {
    helper.ensureAuthorizationCommissionColumns(db);
    helper.ensureAuthorizationCommissionColumns(db);
    assert.deepEqual(helper.authorizationFinancials(db,1,{sales:' 顾问 ',commission_rate:12.5}),{amount:599,sales:'顾问',rate:12.5,commission:74.88});
    assert.equal(helper.authorizationFinancials(db,2).amount,0);
    assert.equal(helper.authorizationFinancials(db,1,{actual_amount:0}).amount,0);
    assert.equal(helper.authorizationFinancials(db,1,{actual_amount:123.45,sales:'顾问',commission_rate:10,commission_amount:999}).commission,12.35);
    for (const value of [-1,'oops',null,'',Infinity]) assert.throws(()=>helper.authorizationFinancials(db,1,{actual_amount:value}),/实收/);
    for (const value of [-1,101,'oops',null]) assert.throws(()=>helper.authorizationFinancials(db,1,{commission_rate:value}),/比例/);
    assert.throws(()=>helper.authorizationFinancials(db,1,{commission_rate:10}),/顾问/);
    assert.throws(()=>helper.authorizationFinancials(db,99),/课程不存在/);
    sqlite.exec("INSERT INTO CommissionSettlement VALUES('month',strftime('%Y-%m','now','localtime'),'顾问','settled')");
    assert.throws(()=>helper.authorizationFinancials(db,1,{sales:'顾问'}),/已结清/);
  } finally {sqlite.close();}
});

test('授权财务收入使用实收金额，重复同步和课程调价不改变收款快照', () => {
  const sqlite = new DatabaseSync(':memory:');
  const db = {prepare: sql => sqlite.prepare(sql), exec: sql => sqlite.exec(sql)};
  const helper = load('../src/app/api/course/series/[id]/_authorization.ts', {
    '@/lib/server/authorization-commission': load('../src/lib/server/authorization-commission.ts'),
    '@/lib/server/student-growth': {}, '@/lib/server/inbox': {}, '@/lib/server/authorization-vouchers': {},
  });
  sqlite.exec(`CREATE TABLE Member(id INTEGER PRIMARY KEY,name TEXT,phone TEXT);
    CREATE TABLE CourseSeries(id INTEGER PRIMARY KEY,name TEXT,price REAL,promo_price REAL);
    CREATE TABLE CourseAuthorization(id INTEGER PRIMARY KEY,member_id INTEGER,phone TEXT,granted_at TEXT,granted_by INTEGER,series_id INTEGER,actual_amount REAL);
    INSERT INTO Member VALUES(1,'测试学员','13800000000');
    INSERT INTO CourseSeries VALUES(1,'测试课程',1000,599);
    INSERT INTO CourseAuthorization VALUES(1,1,'','2026-09-05',1,1,300),(2,1,'','2026-09-05',1,1,0);`);
  try {
    assert.equal(helper.recordAuthorizationIncome(db,1).amount,300);
    assert.equal(helper.recordAuthorizationIncome(db,2).amount,0);
    sqlite.exec('UPDATE CourseSeries SET promo_price=899');
    assert.equal(helper.recordAuthorizationIncome(db,1).amount,300);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM FinanceIncome').get().n,2);
  } finally {sqlite.close();}
});
