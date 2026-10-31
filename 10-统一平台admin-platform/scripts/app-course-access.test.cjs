// Isolated SQLite regression of the same authorization functions used by playback and the App catalog.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),{DatabaseSync}=require('node:sqlite');
function load(file,req=require){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(req,m,m.exports);return m.exports;}
const commission=load('src/lib/server/authorization-commission.ts',name=>name==='./authorization-revenue'?load('src/lib/server/authorization-revenue.ts'):require(name));
const access=load('src/app/api/course/series/[id]/_authorization.ts',name=>{
 if(name.endsWith('authorization-commission'))return commission;
 // These services are used only by granting/revoking, never by the read authorization paths under test.
 if(['/authorization-revocation','/student-growth','/inbox','/authorization-vouchers'].some(s=>name.endsWith(s)))return new Proxy({},{get:()=>()=>{throw Error('Unexpected business side effect');}});
 throw Error(name);
});
function fixture(){const db=new DatabaseSync(':memory:');db.exec(`
 CREATE TABLE Member(id INTEGER PRIMARY KEY,phone TEXT,phone_national_number TEXT,status TEXT DEFAULT 'active',remark TEXT DEFAULT '');
 INSERT INTO Member(id,phone)VALUES(1,'13800000001'),(2,'13800000002');
 CREATE TABLE CourseSeries(id INTEGER PRIMARY KEY,name TEXT,status TEXT,is_free INTEGER DEFAULT 0);
 INSERT INTO CourseSeries(id,name,status)VALUES(7,'线上课','published'),(8,'未发布','draft');
 CREATE TABLE CourseAuthorization(id INTEGER PRIMARY KEY,series_id INTEGER,member_id INTEGER,phone TEXT DEFAULT '',status TEXT,expire_at TEXT,type TEXT,granted_at TEXT);
 INSERT INTO CourseAuthorization VALUES(999,7,1,'','active',NULL,'admin_grant','2026-01-01');
 CREATE TABLE OnlineCourse(id INTEGER PRIMARY KEY,series_id INTEGER);INSERT INTO OnlineCourse VALUES(70,7);
 CREATE TABLE CourseVideo(id INTEGER PRIMARY KEY,course_id INTEGER,is_free INTEGER DEFAULT 0);INSERT INTO CourseVideo VALUES(700,70,0);
 CREATE TABLE ShopOrder(id INTEGER PRIMARY KEY,member_id INTEGER,series_id INTEGER,status TEXT);
 INSERT INTO ShopOrder VALUES(7,2,7,'unpaid');
 `);return db;}
test('authorized catalog returns canonical series ID and excludes other members and draft series',()=>{
 const db=fixture();try{
  db.exec("INSERT INTO CourseAuthorization VALUES(1000,8,1,'','active',NULL,'admin_grant','2026-01-02')");
  assert.deepEqual(access.listAuthorizedSeriesForMember(db,1).map(r=>r.series_id),[7]);
  assert.deepEqual(access.listAuthorizedSeriesForMember(db,2),[]);
  assert.deepEqual(access.listAuthorizedSeriesForMember(db,0),[]);
 }finally{db.close();}
});
test('protected playback independently checks current valid rights; expiry and revocation deny playback',()=>{
 const db=fixture();try{
  assert.equal(access.getVideoAccessStatus(db,700,1).authorized,true);
  assert.equal(access.getVideoAccessStatus(db,700,2).authorized,false);
  assert.equal(access.getVideoAccessStatus(db,700,0).authorized,false);
  db.exec("UPDATE CourseAuthorization SET expire_at='2000-01-01'");
  assert.equal(access.getVideoAccessStatus(db,700,1).authorized,false);assert.deepEqual(access.listAuthorizedSeriesForMember(db,1),[]);
  db.exec("UPDATE CourseAuthorization SET expire_at=NULL,status='revoked'");
  assert.equal(access.getVideoAccessStatus(db,700,1).authorized,false);assert.deepEqual(access.listAuthorizedSeriesForMember(db,1),[]);
 }finally{db.close();}
});
test('an unpaid or unrelated order never grants learning rights; explicitly free lessons remain playable',()=>{
 const db=fixture();try{
  assert.equal(access.getVideoAccessStatus(db,700,2).authorized,false);
  db.exec("UPDATE ShopOrder SET status='paid'");
  assert.equal(access.getVideoAccessStatus(db,700,2).authorized,false);
  db.exec('UPDATE CourseVideo SET is_free=1');
  assert.equal(access.getVideoAccessStatus(db,700,2).reason,'free_video');
 }finally{db.close();}
});
