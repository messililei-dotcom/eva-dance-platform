import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
function load(file,mocks={}) { const m={exports:{}}; new Function('require','module','exports',ts.transpileModule(fs.readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>mocks[n],m,m.exports);return m.exports; }
function fixture(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec(`PRAGMA foreign_keys=ON; CREATE TABLE User(id INTEGER PRIMARY KEY,username TEXT,role TEXT,status TEXT);
 INSERT INTO User VALUES(1,'lilei','admin','active'),(7,'sun_saishi','event_admin','active'),(8,'second','event_admin','active'),(9,'other','event_admin','active'),(10,'disabled','event_admin','inactive');
 CREATE TABLE event_competitions(id INTEGER PRIMARY KEY,owner_user_id INTEGER,name TEXT);
 INSERT INTO event_competitions VALUES(100,1,'K5'),(200,9,'other');
 CREATE TABLE event_competition_admins(id INTEGER PRIMARY KEY,competition_id INTEGER REFERENCES event_competitions(id) ON DELETE CASCADE,user_id INTEGER,UNIQUE(competition_id,user_id));
 INSERT INTO event_competition_admins VALUES(1,100,1),(2,100,7),(3,100,8),(4,200,9);
 CREATE TABLE event_groups(id INTEGER PRIMARY KEY,competition_id INTEGER,name TEXT);
 INSERT INTO event_groups VALUES(11,100,'group'),(22,200,'secret');
 CREATE TABLE event_players(id INTEGER PRIMARY KEY,competition_id INTEGER,member_id INTEGER);
 CREATE TABLE event_judges(id INTEGER PRIMARY KEY,owner_user_id INTEGER,member_id INTEGER);
 INSERT INTO event_judges VALUES(55,1,0),(66,9,0);
 CREATE TABLE event_group_judges(id INTEGER PRIMARY KEY,competition_id INTEGER,judge_id INTEGER);
 INSERT INTO event_group_judges VALUES(1,100,55),(2,200,66);
 CREATE TABLE Member(id INTEGER PRIMARY KEY);`);
 const db={prepare:sql=>sqlite.prepare(sql),exec:sql=>sqlite.exec(sql),transaction:fn=>(...args)=>{sqlite.exec('BEGIN');try{const r=fn(...args);sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}},close(){}};
 return {sqlite,db};
}
const policy=load('../src/lib/admin-feature-access.ts');
test('multiple administrators can manage their assigned event, while other events and grant writes are blocked',()=>{
 for(const userId of [7,8]){
 const {sqlite,db}=fixture();
 const {scopeEventDb}=load('../src/app/api/event/_access.ts',{'./_db':{},'../_local-auth':{}});
 scopeEventDb(db,userId);
 assert.deepEqual(db.prepare('SELECT id FROM event_competitions').all().map(r=>r.id),[100]);
 assert.deepEqual(db.prepare('SELECT id FROM event_groups').all().map(r=>r.id),[11]);
 assert.deepEqual(db.prepare('SELECT id FROM event_judges').all().map(r=>r.id),[55]);
 db.prepare('UPDATE event_competitions SET name=? WHERE id=?').run('allowed',100);
 assert.throws(()=>db.prepare('UPDATE event_competitions SET name=? WHERE id=?').run('forbidden',200),/无权限/);
 assert.throws(()=>db.prepare('UPDATE event_competitions SET owner_user_id=7 WHERE id=100').run(),/无权限/);
 assert.throws(()=>db.prepare('UPDATE event_groups SET competition_id=200 WHERE id=11').run(),/无权限/);
 assert.throws(()=>db.prepare('INSERT INTO event_competition_admins(competition_id,user_id) VALUES(100,9)').run(),/无权限/);
 assert.throws(()=>db.prepare('DELETE FROM event_competition_admins WHERE competition_id=100').run(),/无权限/);
 assert.equal(db.prepare('SELECT name FROM main.event_competitions WHERE id=200').get().name,'other');
 sqlite.close();
 }
});
test('removing a secondary administrator revokes access on the next request',()=>{
 const {sqlite,db}=fixture();db.prepare('DELETE FROM event_competition_admins WHERE user_id=7').run();
 load('../src/app/api/event/_access.ts',{'./_db':{},'../_local-auth':{}}).scopeEventDb(db,7);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM event_competitions').get().n,0);sqlite.close();
});
test('multi-select validates all users and replaces membership atomically',()=>{
 const {sqlite,db}=fixture();let actor={id:1,username:'lilei',role:'admin'};
 const {competitionOwner,saveCompetitionAdmins}=load('../src/app/api/event/_competition-owner.ts',{'@/lib/admin-feature-access':policy,'./_access':{eventActor:()=>actor}});
 const body={adminUserIds:[1,7,8,7]};const owner=competitionOwner({},db,body,1);
 assert.deepEqual(owner.adminIds,[1,7,8]);
 db.transaction(()=>saveCompetitionAdmins(db,100,body,owner))();
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM event_competition_admins WHERE competition_id=100').get().n,3);
 for(const ids of [[7,10],[7,99],['7'],null,{},[1.5]]) assert.equal(competitionOwner({},db,{adminUserIds:ids},1).status,400);
 actor={id:7,username:'sun_saishi',role:'event_admin'};assert.equal(competitionOwner({},db,body,1).status,403);
 sqlite.close();
});
test('restricted administrators cannot create or import additional events',()=>{
 for(const path of ['/api/event/competitions','/api/event/data-transfer','/legacy-student-api/event/competitions']){
 const {db,sqlite}=fixture();const access=load('../src/app/api/event/_access.ts',{'./_db':{openEventDb:()=>db},'../_local-auth':{verifyLocalToken:()=>({id:7,role:'event_admin',username:'sun_saishi'})}});
 const r=access.withRequestEventDb(new Request('http://test'+path,{method:'POST',headers:{authorization:'Bearer test'}}),()=>{throw new Error('must not execute');});
 assert.equal(r.status,403);sqlite.close();
 }
});

test('deleting an assigned event permits only the foreign-key membership cleanup',()=>{
 const {sqlite,db}=fixture();load('../src/app/api/event/_access.ts',{'./_db':{},'../_local-auth':{}}).scopeEventDb(db,7);
 db.prepare('DELETE FROM event_competitions WHERE id=100').run();
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM main.event_competition_admins WHERE competition_id=100').get().n,0);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM main.event_competitions WHERE id=200').get().n,1);sqlite.close();
});
