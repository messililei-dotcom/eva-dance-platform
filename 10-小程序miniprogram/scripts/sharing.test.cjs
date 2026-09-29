const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {resolveShare}=require('../shared/share');
const root=path.resolve(__dirname,'..');
test('all registered pages install friend and timeline sharing while preserving load arguments',()=>{
 for(const route of JSON.parse(fs.readFileSync(root+'/app.json')).pages){
  let page;const source=fs.readFileSync(root+'/'+route+'.js','utf8');
  vm.runInNewContext(source,{Page:p=>page=p,require:name=>name.includes('shared/share')?require('../shared/share'):name.includes('video-feature')?{withVideoFeature:v=>v}:{},getApp:()=>({}),wx:{},console});
  assert.equal(typeof page.onShareAppMessage,'function',route);assert.equal(typeof page.onShareTimeline,'function',route);assert.equal(typeof page.onReady,'function',route);
 }
});
test('native menu shares the currently selected lesson and its course cover',()=>{
 const result=resolveShare({data:{seriesId:6,videoId:20,courseId:30,course:{name:'课程A',cover_image:'https://www.swod.com.cn/course.png'},video:{name:'第二节'}}},'player');
 assert.equal(result.path,'/pages/player/player?seriesId=6&videoId=20&courseId=30');assert.equal(result.title,'课程A · 第二节');assert.equal(result.imageUrl,'https://www.swod.com.cn/course.png');assert.ok(!result.path.includes('token'));
});
test('offline period sharing preserves selected period ID and normalized cover',()=>{
 const result=resolveShare({data:{courseId:'900123',course:{id:900456,name:'课程A',teacherText:'老师',coverImage:'/api/courses/cover-image?src=a'}}},'offline-detail');
 assert.equal(result.path,'/pages/offline-detail/offline-detail?id=900123');assert.match(result.imageUrl,/^https:\/\/admin\.swod\.com\.cn\/api\/courses\/cover-image/);
});
test('account entries never include private account fields or login handoffs',()=>{
 for(const route of ['profile','profile-edit','commerce-orders','admin','login']){
  const result=resolveShare({data:{memberName:'PRIVATE_NAME',phone:'PRIVATE_PHONE',orders:[{id:'SECRET_ORDER'}]},shareOptions:{token:'SECRET_TOKEN',pwa_handoff:'SECRET_HANDOFF',memberId:9}},route);
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE|SECRET|memberId/);assert.equal(result.imageUrl,'/images/logo.png');
 }
});
test('timeline carries only public identifiers from the current lesson',()=>{
 const module={exports:{}};let menus;
 vm.runInNewContext(fs.readFileSync(root+'/shared/share.js','utf8'),{module,require:()=>({apiBase:'https://admin.swod.com.cn/api/mini'}),wx:{showShareMenu:o=>menus=o.menus}});
 const p=module.exports.withShare('player',{data:{seriesId:6,videoId:20,courseId:30,course:{name:'A',cover_image:'https://example.com/a.jpg'},video:{name:'B'}}});p.onReady();assert.equal(menus.join(','),'shareAppMessage,shareTimeline');assert.equal(p.onShareTimeline().query,'seriesId=6&videoId=20&courseId=30');
});
test('sharing is available through the native menu without adding page buttons',()=>{
 for(const route of JSON.parse(fs.readFileSync(root+'/app.json')).pages){assert.doesNotMatch(fs.readFileSync(root+'/'+route+'.wxml','utf8'),/open-type=["']share["']|share-button/);}
});
