const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require(path.resolve(__dirname,'../../../../10-统一平台admin-platform/node_modules/typescript'));
function load(){const src=fs.readFileSync(path.resolve(__dirname,'../entry/src/main/ets/services/CoursePresentation.ets'),'utf8');const m={exports:{}};new Function('require','module','exports',ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(()=>({offlineAliases:[],offlineCopies:[]}),m,m.exports);return m.exports;}
test('first audio lesson keeps its source title and media kind instead of masquerading as a video',()=>{const [lesson]=load().catalogLessons([{name:'第1课｜东方舞的前世今生',videos:[{id:2543,name:'音频-东方舞的历史发展.m4a',duration:350}]}],[]);assert.equal(lesson.mediaKind,'audio');assert.equal(lesson.name,'音频-东方舞的历史发展.m4a');assert.equal(lesson.subtitle,'第1课｜东方舞的前世今生');});
test('video lessons and resume data remain associated with the real video ID',()=>{const [lesson]=load().catalogLessons([{name:'第2课',videos:[{id:9,name:'动作示范.mp4'}]}],[{video_id:9,duration:100,progress:40}]);assert.equal(lesson.mediaKind,'video');assert.equal(lesson.percent,40);assert.equal(lesson.id,9);});
test('new learner enters first lesson directly',()=>{assert.equal(load().startingLesson([{id:11},{id:22}],[]).id,11);});
test('resume chooses latest server history rather than catalog order',()=>{assert.equal(load().startingLesson([{id:11},{id:22}],[{video_id:22,last_play_at:'2026-10-30 09:30:00'},{video_id:11,last_play_at:'2026-10-29 10:00:00'}]).id,22);});
test('foreign and unwatched rows cannot choose a lesson, empty course stays empty',()=>{const api=load();const records=[{video_id:999,last_play_at:'2026-10-31 09:30:00'},{video_id:22}];assert.equal(api.startingLesson([{id:11},{id:22}],records).id,11);assert.equal(api.startingLesson([],records),undefined);});

test('offline course summary matches mini-program catalog and ordering fixtures',()=>{
  const fixturePath=process.env.SWOD_OFFLINE_FIXTURE;
  const mini=require(path.resolve(__dirname,'../../../../10-小程序miniprogram/shared/offline-catalog.js'));
  const fallback=[{id:9001,group_key:' Fixture   Course ',name:'课程',price:100.5,start_date:'2027-01-01',group_total_students:7,cover_image:'cover'},{id:9002,group_key:'fixture course',name:'课程',subtitle:'2028年',price:200,total_students:3,group_total_students:7}];
  const miniGroups=mini.groupOfflineCourses(fallback);
  const {rows,expected}=fixturePath?JSON.parse(fs.readFileSync(fixturePath,'utf8')):{rows:fallback,expected:miniGroups.map(group=>({id:group.id,offline_period_count:group.periodCount,offline_latest_period:group.latestPeriodText,offline_student_count:group.studentCount,offline_min_price:group.minPrice,cover_image:group.cover_image,priceText:'¥100.5起'}))}; const api=load(),groups=api.groupedCourses(rows);
  assert.equal(groups.length,expected.length);
  groups.forEach((group,index)=>{ const goal=expected[index]; for(const key of ['id','offline_period_count','offline_latest_period','offline_student_count','offline_min_price','cover_image'])assert.equal(group[key],goal[key],key+' for '+group.name); assert.equal(api.offlineGroupPrice(group),goal.priceText); });
  assert.equal(rows.find(row=>row.id===9002).offline_period_count,undefined,'Grouping must not mutate period purchase data');
});
