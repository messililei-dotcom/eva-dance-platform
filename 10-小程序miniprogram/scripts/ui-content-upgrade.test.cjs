const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createRequire}=require('node:module');
const {eventState}=require('../shared/event-state');
const now=Date.parse('2026-10-16T12:00:00+08:00');
test('unopened, upcoming and expired registrations are distinct from a finished event',()=>{
 assert.equal(eventState({registrationStatus:'closed'},now).statusText,'报名未开放');
 assert.equal(eventState({registrationStatus:'open',registrationStart:'2026-11-01'},now).statusText,'报名未开始');
 assert.equal(eventState({registrationStatus:'open',registrationEnd:'2026-10-01'},now).statusText,'报名已截止');
 assert.equal(eventState({status:'finished',registrationStatus:'open'},now).statusText,'已结束');
 assert.equal(eventState({status:'cancelled',registrationStatus:'open'},now).registrationOpen,false);
 assert.equal(eventState({registrationStatus:'open',registrationStart:'invalid'},now).registrationOpen,false);
 assert.equal(eventState({registrationStatus:'open',registrationStart:'2026-10-01',registrationEnd:'2026-11-01'},now).registrationOpen,true);
});
function page(name,api){let p;const file=path.join(__dirname,'../pages',name,name+'.js');vm.runInNewContext(fs.readFileSync(file,'utf8'),{require:n=>n.includes('utils/api')?api:createRequire(file)(n),Page:x=>p=x,wx:{},console});p.setData=d=>Object.assign(p.data,d);return p;}
test('academy failure remains retryable and reload refreshes active search counts',async()=>{
 let fails=true;const p=page('home',{getSeriesList:async()=>{if(fails)throw Error('网络中断');return [{id:1,name:'基础课程',total_courses:3},{id:2,name:'进阶课程'}]}});
 await p.loadHomeSections();assert.equal(p.data.error,'网络中断');assert.equal(p.data.loading,false);
 fails=false;p.data.searchKeyword='基础';await p.loadHomeSections();assert.equal(p.data.error,'');assert.equal(p.data.courseRows.length,1);assert.equal(p.data.searchCountText,'找到 1 门课程');
 p.data.searchKeyword='  ';await p.loadHomeSections();assert.equal(p.data.courseRows.length,2);assert.equal(p.data.searchCountText,'');
});
test('event network error does not impersonate an empty catalog',async()=>{
 const p=page('events',{getEvents:async()=>{throw Error('网络中断')}});await p.loadEvents();assert.equal(p.data.error,'网络中断');assert.equal(p.data.loading,false);
});
