const fs=require('fs'),crypto=require('crypto'),assert=require('node:assert/strict'),Database=require('better-sqlite3');
const root='/www/wwwroot/dongfangwuquan/admin-platform';
const environment=require(root+'/ecosystem.config.js').apps[0].env;
const live=process.argv.includes('--live');
const base=live?'http://127.0.0.1:3003':'http://127.0.0.1:3005';
const database=live?root+'/admin.db':process.cwd()+'/acceptance.db';
const db=new Database(database,{readonly:true});
function token(username){const user=db.prepare('SELECT id,username,role,status FROM User WHERE username=?').get(username);assert.equal(user.status,'active');const p=Buffer.from(JSON.stringify({id:user.id,username:user.username,role:user.role,exp:Date.now()+120000})).toString('base64url');return `local.${p}.${crypto.createHmac('sha256',environment.ADMIN_SESSION_SECRET).update(p).digest('base64url')}`;}
const admin=token('lilei'),restricted=token('sun_saishi');
async function request(path,t=restricted,method='GET',body){const r=await fetch(base+path,{method,headers:{authorization:'Bearer '+t,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});let data;try{data=await r.json()}catch{}return {status:r.status,data};}
(async()=>{
const original=(await request('/api/event/competitions/100061',admin)).data.data;assert.equal(original.name,'K5-GBA湾区舞蹈节');
const target=db.prepare('SELECT id,role FROM User WHERE username=?').get('sun_saishi');assert.equal(target.role,'event_admin');
const adminUserIds=[...new Set([...(original.adminUserIds||[]),original.ownerUserId,target.id].filter(Boolean))];
if(live)fs.writeFileSync('/www/backups/dongfangwuquan/event-multi-20261018/binding-before.json',JSON.stringify({id:original.id,ownerUserId:original.ownerUserId,adminUserIds:original.adminUserIds||[]}));
const saved=await request('/api/event/competitions/100061',admin,'PUT',{...original,adminUserIds});assert.equal(saved.status,200);assert.equal(saved.data.success,true);
const persisted=await request('/api/event/competitions/100061',admin);assert.deepEqual(new Set(persisted.data.data.adminUserIds),new Set(adminUserIds));
const listing=await request('/api/event/competitions');assert.equal(listing.status,200);assert.deepEqual(listing.data.data.map(r=>r.id),[100061]);
assert.equal((await request('/api/event/competitions/100061')).status,200);
const checks={};
for(const path of ['/api/event/competitions/100060','/api/users','/api/finance/income-details','/api/course/authorizations']){checks[path]=(await request(path)).status;assert.equal(checks[path],403,path);}
const forbidden=await request('/api/event/competitions/100060',restricted,'PATCH',{action:'openRegistration'});assert.equal(forbidden.status,403);
const cannotGrant=await request('/api/event/competitions/100061',restricted,'PUT',{...persisted.data.data,adminUserIds:[target.id]});assert.equal(cannotGrant.status,403);
assert.equal((await request('/api/event/competitions',restricted,'POST',{name:'must not create'})).status,403);
assert.equal((await request('/api/event/data-transfer',restricted,'POST',{format:'eva-event-data',version:1,tables:{}})).status,403);
const groups=await request('/api/event/groups?competitionId=100061');assert.equal(groups.status,200);
const result={live,assignedEvent:100061,adminUserIds,restrictedVisibleEvents:listing.data.data.map(r=>r.id),deniedEndpoints:checks,otherEventWrite:403,grantChange:403,createAdditionalEvent:403,importAdditionalEvents:403,persistence:'passed',groupAccess:200};
console.log(JSON.stringify(result));if(live)fs.writeFileSync('/www/backups/dongfangwuquan/event-multi-20261018/acceptance.json',JSON.stringify(result,null,2));db.close();
})().catch(e=>{console.error(e.message);db.close();process.exitCode=1});
