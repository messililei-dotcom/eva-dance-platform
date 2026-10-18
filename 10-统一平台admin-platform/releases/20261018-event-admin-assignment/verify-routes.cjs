const fs=require('fs'), ts=require('typescript'), assert=require('node:assert/strict');
const Database=require('better-sqlite3');
function load(file,mocks){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(n=>mocks[n],m,m.exports);return m.exports;}
const db=new Database(':memory:');
db.exec(`CREATE TABLE User(id INTEGER PRIMARY KEY,username TEXT,role TEXT,status TEXT);
INSERT INTO User VALUES(1,'lilei','admin','active'),(2,'event','event_admin','active'),(3,'disabled','event_admin','disabled');
CREATE TABLE event_competitions(id INTEGER PRIMARY KEY,name TEXT,code TEXT,status TEXT,registration_status TEXT,registration_public INTEGER,judge_scores_public INTEGER,start_date TEXT,end_date TEXT,registration_start TEXT,registration_end TEXT,location TEXT,organizer TEXT,description TEXT,cover_url TEXT,max_players INTEGER,registration_fee REAL,created_by TEXT,owner_user_id INTEGER,updated_at TEXT);`);
const policy=load('src/lib/admin-feature-access.ts',{});
const owner=load('src/app/api/event/_competition-owner.ts',{'@/lib/admin-feature-access':policy,'./_access':{eventActor:r=>r.actor}});
const mocks={cleanText:(v,f='')=>String(v??'').trim()||f,generateCode:()=> 'TEST',hasAuth:r=>!!r.actor,readEventBody:r=>r.json(),jsonError:(error,status=400)=>Response.json({success:false,error},{status}),nowIso:()=>new Date().toISOString(),withRequestEventDb:(r,fn)=>{db.eventActorId=r.actor.id;return fn(db);}};
const post=load('src/app/api/event/competitions/route.ts',{'../_db':mocks,'../_competition-owner':owner});
const put=load('src/app/api/event/competitions/[id]/route.ts',{'../../_db':mocks,'../../_competition-owner':owner});
function req(actor,body){const r=new Request('http://test/api/event/competitions',{method:'POST',body:JSON.stringify(body)});r.actor=actor;return r;}
(async()=>{const superAdmin={id:1,username:'lilei',role:'admin'}, eventAdmin={id:2,username:'event',role:'event_admin'};
let response=await post.POST(req(superAdmin,{name:'isolated test',ownerUserId:2}));assert.equal(response.status,200);const id=(await response.json()).data.id;
assert.equal(db.prepare('SELECT owner_user_id FROM event_competitions WHERE id=?').get(id).owner_user_id,2);
response=await put.PUT(req(superAdmin,{name:'updated',ownerUserId:1}),{params:Promise.resolve({id:String(id)})});assert.equal(response.status,200);
assert.equal(db.prepare('SELECT owner_user_id FROM event_competitions WHERE id=?').get(id).owner_user_id,1);
response=await put.PUT(req(eventAdmin,{name:'forbidden',ownerUserId:2}),{params:Promise.resolve({id:String(id)})});assert.equal(response.status,403);
response=await put.PUT(req(superAdmin,{name:'invalid',ownerUserId:3}),{params:Promise.resolve({id:String(id)})});assert.equal(response.status,400);
assert.equal(db.prepare('SELECT name FROM event_competitions WHERE id=?').get(id).name,'updated');
console.log(JSON.stringify({createAssignment:'passed',updateAssignment:'passed',unauthorizedAssignment:403,disabledAccount:400,rejectedWritesUnchanged:true,database:'memory only'}));db.close();})().catch(e=>{console.error(e);process.exit(1)});
