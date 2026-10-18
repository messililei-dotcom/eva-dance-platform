const test=require('node:test'),assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path'),{createRequire}=require('module');
const {offlineIntroduction,periodPurchase}=require('../shared/offline-course-info');
const today=Date.parse('2026-10-17T12:00:00+08:00');
const period={id:900302,source_id:'302',name:'课程A',group_key:'课程a',period_status:'planned',price:2580,capacity:1,remaining:1,start_date:'2099-11-01',end_date:'2099-11-30',total_courses:8};
function load(name,api,wx={}){let p;const file=path.join(__dirname,'../pages',name,name+'.js');vm.runInNewContext(fs.readFileSync(file,'utf8'),{require:n=>n.includes('utils/api')?api:createRequire(file)(n),Page:v=>p=v,wx:{setNavigationBarTitle(){},...wx},console});p.setData=v=>Object.assign(p.data,v);return p;}
test('official complete introduction, outline and exact-period overrides retain backend commercial data',()=>{
 const p={...period,name:'国际技巧超魔班',group_key:'国际技巧超魔班',description:'8字简介'};const intro=offlineIntroduction(p);assert.ok(intro.descriptionText.length>60);assert.ok(intro.outline.length>=5);assert.equal(p.price,2580);const tito=offlineIntroduction({...period,source_id:'266'});assert.ok(tito.descriptionText.includes('Mejance'));assert.equal(tito.outline.length,7);assert.ok(tito.descriptionText.includes('以所选期次安排为准'));assert.ok(!tito.descriptionText.includes('2026年12月23日'));
 const unknown=offlineIntroduction({...period,name:'未匹配新课程',group_key:'未匹配新课程',description:'后台新介绍',outline:['后台大纲']});assert.equal(unknown.descriptionText,'后台新介绍');assert.deepEqual(unknown.outline,['后台大纲']);
});
test('period purchase matches expiry, availability and priced-period rules in China timezone',()=>{
 assert.equal(periodPurchase(period,today).canPurchase,true);
 for(const [change,reason] of [[{period_status:'completed'},'开放'],[{end_date:'2026-10-16'},'结束'],[{remaining:0},'已满'],[{price:0},'价格'],[{source_id:''},'待完善']]){const p=periodPurchase({...period,...change},today);assert.equal(p.canPurchase,false);assert.ok(p.purchaseReason.includes(reason));}
 assert.equal(periodPurchase({...period,capacity:0,remaining:0},today).canPurchase,true);
 assert.equal(periodPurchase({...period,end_date:'2026-10-17'},Date.parse('2026-10-17T15:59:00Z')).canPurchase,true);assert.equal(periodPurchase({...period,end_date:'2026-10-17'},Date.parse('2026-10-17T16:01:00Z')).canPurchase,false);
});
test('selecting a different period passes its real ID and invalid periods cannot navigate',async()=>{const calls=[],p=load('offline-detail',{getOfflineCourses:async()=>[{...period,id:900301,source_id:'301',price:1800},period]},{navigateTo:o=>calls.push(o.url),showToast:o=>calls.push(o.title)});await p.loadCourse(900301);p.buyCourse({currentTarget:{dataset:{id:'302'}}});assert.equal(calls[0],'/pages/course-checkout/course-checkout?kind=offline&id=302');assert.equal(p.data.courseId,900302);p.data.course.periods[0].remaining=0;p.buyCourse({currentTarget:{dataset:{id:p.data.course.periods[0].source_id}}});assert.ok(calls[1].includes('已满'));});
