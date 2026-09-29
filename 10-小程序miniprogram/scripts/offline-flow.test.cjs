const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'..');
function page(name,api={},wx={},extra={}){
 let value;const file=path.join(root,'pages',name,name+'.js');
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{require:n=>n==='../../utils/api'?api:createRequire(file)(n),Page:v=>value=v,getApp:()=>({globalData:{}}),wx:{getStorageSync:()=>'',setStorageSync:()=>{},showToast:()=>{},...wx},setTimeout,clearTimeout,console,...extra});
 value.setData=next=>Object.assign(value.data,next);return value;
}
test('public course catalog loads without waiting for personal course rights',async()=>{
 let release;const p=page('offline',{getOfflineCourses:async()=>[{id:900002,name:'A',cover_image:'https://test/a.png',group_total_students:2}],getOfflineOverview:()=>new Promise(r=>release=r)});
 const loading=p.loadAll();await new Promise(r=>setImmediate(r));assert.equal(p.data.loading,false);assert.equal(p.data.visibleCourses.length,1);assert.equal(p.data.visibleCourses[0].studentCount,2);assert.equal(p.data.overviewLoading,true);
 release({});await loading;
});
test('network errors are shown as retryable errors instead of false empty data',async()=>{
 const p=page('offline',{getOfflineCourses:async()=>{throw Error('network')},getOfflineOverview:async()=>{throw Error('auth')} });
 await p.loadAll();assert.equal(p.data.courseError,'network');assert.equal(p.data.overviewError,'auth');
});
test('course detail sends selected real course ID straight to filtered schedule',()=>{
 const calls=[];const p=page('offline-detail',{}, {setStorageSync:(k,v)=>calls.push([k,v]),switchTab:v=>calls.push(['route',v.url])});p.data.course={name:'A',periods:[{source_id:'2'},{source_id:'3'}]};
 p.openSchedule({currentTarget:{dataset:{courseId:'3'}}});assert.equal(calls[0][1].ids.join(','),'3');assert.equal(calls[2][1],'/pages/offline/offline');
});
test('login returns to originating page instead of sending learner to homepage',()=>{
 const calls=[];const p=page('login',{}, {navigateBack:v=>calls.push('back'),switchTab:v=>calls.push('home')},{getCurrentPages:()=>[{},{}]});
 p.finishLogin({member:{id:1,name:'test'},token:'test'});assert.deepEqual(calls,['back']);p.onLoad({});assert.deepEqual(calls,['back']);
});
test('offline cover proxies and camel-case document URLs survive API normalization',async()=>{
 const module={exports:{}};const payload=[{cover_image:'/api/courses/cover-image?src=abc'},{cover_image:'https://www.swod.com.cn/api/platform-offline-courses/cover/a.png',pdfUrl:'/api/certificates/1/render.svg'}];
 vm.runInNewContext(fs.readFileSync(path.join(root,'utils/api.js'),'utf8'),{module,require:()=>({apiBase:'https://admin.swod.com.cn/api/mini'}),getApp:()=>null,getCurrentPages:()=>[],wx:{getStorageSync:()=>'',request:o=>o.success({statusCode:200,data:{success:true,data:payload}})}});
 const data=await module.exports.getOfflineCourses();assert.equal(data[0].cover_image,'https://admin.swod.com.cn/api/courses/cover-image?src=abc');assert.equal(data[1].cover_image,payload[1].cover_image);assert.equal(data[1].pdfUrl,'https://admin.swod.com.cn/api/certificates/1/render.svg');
});
test('selected period is sent to the server before rendering its available sessions',async()=>{
 let ids;const p=page('offline',{getOfflineOverview:async value=>{ids=value;return {sessions:[{id:1,course_id:3,can_book:1,capacity:10,booked_count:0}]};}});p.data.sessionCourseIds=['3'];await p.loadOverview();assert.equal(ids.join(','),'3');assert.equal(p.data.sessions.length,1);
});
test('anonymous period and group student displays never use student names',async()=>{
 const p=page('offline-detail',{getOfflineCourses:async()=>[{id:900003,source_id:3,name:'A',group_key:'a',total_students:2,group_total_students:2,anonymous_students:[{label:'PRIVATE_NAME'}],teacher:'T'}]}, {setNavigationBarTitle:()=>{}});
 await p.loadCourse(900003);assert.equal(p.data.course.anonymousStudents[0].label,'匿名学员 1');assert.equal(p.data.course.periods[0].anonymous_students[0].label,'匿名学员 1');
});
test('hidden series cannot appear from a stale or mixed public response',async()=>{
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'utils/api.js'),'utf8'),{module,require:()=>({apiBase:'https://admin.swod.com.cn/api/mini'}),getApp:()=>null,getCurrentPages:()=>[],wx:{getStorageSync:()=>'',request:o=>o.success({statusCode:200,data:{success:true,data:[{id:1,status:'published'},{id:2,status:'offline'},{id:3,status:'draft'}]}})}});
 const rows=await module.exports.getSeriesList();assert.equal(rows.length,1);assert.equal(rows[0].id,1);
});
