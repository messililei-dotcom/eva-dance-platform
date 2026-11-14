const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {resolveShare}=require('../shared/share');
const root=path.resolve(__dirname,'..');
test('all registered pages install friend and timeline sharing while preserving load arguments',()=>{
 for(const route of JSON.parse(fs.readFileSync(root+'/app.json')).pages){
  let page;const source=fs.readFileSync(root+'/'+route+'.js','utf8');
  vm.runInNewContext(source,{Page:p=>page=p,require:name=>name.includes('shared/share')?require('../shared/share'):name.includes('video-feature')?{withVideoFeature:v=>v}:name.endsWith('/event-phone')?require('../shared/event-phone'):{},getApp:()=>({}),wx:{},console});
  assert.equal(typeof page.onShareAppMessage,'function',route);assert.equal(typeof page.onShareTimeline,'function',route);assert.equal(typeof page.onReady,'function',route);
 }
});
test('native menu shares the course and never a selected lesson',()=>{
 const result=resolveShare({data:{seriesId:6,videoId:20,courseId:30,course:{name:'课程A',cover_image:'https://www.swod.com.cn/course.png'},video:{name:'第二节'}}},'player');
 assert.equal(result.path,'/pages/detail/detail?id=6');assert.match(result.title,/内容A.*内容介绍/);assert.doesNotMatch(result.title,/第二节/);assert.equal(result.imageUrl,'https://www.swod.com.cn/course.png');assert.ok(!result.path.includes('token'));
});
test('offline period sharing preserves selected period ID and normalized cover',()=>{
 const result=resolveShare({data:{courseId:'900123',course:{id:900456,name:'课程A',teacherText:'老师',coverImage:'/api/courses/cover-image?src=a'}}},'offline-detail');
 assert.equal(result.path,'/pages/offline-detail/offline-detail?id=900123');assert.match(result.imageUrl,/^https:\/\/admin\.swod\.com\.cn\/api\/courses\/cover-image/);
});
test('account entries never include private account fields or login handoffs',()=>{
 for(const route of ['profile','profile-edit','commerce-orders','admin','login','learning-records','event-music']){
  const result=resolveShare({data:{memberName:'PRIVATE_NAME',phone:'PRIVATE_PHONE',orders:[{id:'SECRET_ORDER'}]},shareOptions:{token:'SECRET_TOKEN',pwa_handoff:'SECRET_HANDOFF',memberId:9}},route);
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE|SECRET|memberId/);assert.match(result.imageUrl,/^\/images\/logo(?:-\d{8})?\.png$/);
 }
});
test('timeline carries course landing without lesson identifiers',()=>{
 const module={exports:{}};let menus;
 vm.runInNewContext(fs.readFileSync(root+'/shared/share.js','utf8'),{module,require:n=>n.includes('review-text')?require('../shared/review-text'):({apiBase:'https://admin.swod.com.cn/api/mini'}),wx:{showShareMenu:o=>menus=o.menus}});
 const p=module.exports.withShare('player',{data:{seriesId:6,videoId:20,courseId:30,course:{name:'A',cover_image:'https://example.com/a.jpg'},video:{name:'B'}}});p.onReady();assert.equal(menus.join(','),'shareAppMessage,shareTimeline');assert.equal(p.onShareTimeline().query,'id=6&_sharePage=detail');
});
test('sharing is available through the native menu without adding page buttons',()=>{
 for(const route of JSON.parse(fs.readFileSync(root+'/app.json')).pages){assert.doesNotMatch(fs.readFileSync(root+'/'+route+'.wxml','utf8'),/open-type=["']share["']|share-button/);}
});

test('every page has a cover and description even before data arrives',()=>{for(const entry of JSON.parse(fs.readFileSync(root+'/app.json')).pages){const r=resolveShare({data:{}},entry.split('/')[1]);assert.ok(r.imageUrl);assert.match(r.title,/ · .+/);assert.ok(r.path.startsWith('/pages/'));}});
test('course and product descriptions are cleaned and not truncated away by long names',()=>{const r=resolveShare({data:{id:'sku',product:{name:'长'.repeat(100),description:'<p>精选&nbsp;舞服</p>',image:'/api/shop/images/sku/hash'}}},'shop-product');assert.match(r.title,/精选 舞服/);assert.equal(r.imageUrl,'https://www.swod.com.cn/api/shop/images/sku/hash');});
test('timeline landing strips private state and skips player lifecycle',()=>{let called=0,target;const m={exports:{}};vm.runInNewContext(fs.readFileSync(root+'/shared/share.js','utf8'),{module:m,require:n=>n.includes('review-text')?require('../shared/review-text'):({apiBase:'https://admin.swod.com.cn/api/mini'}),wx:{reLaunch:o=>target=o.url}});const p=m.exports.withShare('player',{onLoad:()=>called++,onShow:()=>called++});p.onLoad({_sharePage:'detail',id:'6',videoId:'99',token:'secret'});p.onShow();assert.equal(target,'/pages/detail/detail?id=6');assert.equal(called,0);});

test('timeline single-page mode renders course preview without navigation, auth or playback',async()=>{
 let loads=0,navigations=0,fetches=0;const m={exports:{}};
 vm.runInNewContext(fs.readFileSync(root+'/shared/share.js','utf8'),{module:m,require:n=>n.includes('review-text')?require('../shared/review-text'):n==='../utils/api'?{getSeriesMeta:async id=>{fetches++;assert.equal(id,'6');return {name:'课程',description:'系统训练',cover_image:'https://example.com/cover.jpg'};}}:{apiBase:'https://admin.swod.com.cn/api/mini'},wx:{getEnterOptionsSync:()=>({scene:1154}),reLaunch:()=>navigations++}});
 const p=m.exports.withShare('player',{onLoad:()=>loads++,onShow:()=>loads++});p.setData=d=>Object.assign(p.data,d);
 await p.onLoad({_sharePage:'detail',id:'6',videoId:'99'});p.onShow();assert.equal(loads,0);assert.equal(navigations,0);assert.equal(fetches,1);assert.equal(p.data.sharePreview.path,'/pages/detail/detail?id=6');assert.match(p.data.sharePreview.title,/系统训练/);
});

test('judge profile sharing targets the public event without judge, score or account fields', () => {
  const page={data:{competition:{name:'真实赛事'},judge:{id:9,name:'未公开评委',bio:'私有资料'},token:'private',scores:{total:8}},shareOptions:{id:'100060',judgeId:'9',groupId:'2'}};
  const result=resolveShare(page,'event-judge-profile');
  assert.equal(result.path,'/pages/event-detail/event-detail?id=100060');
  assert.doesNotMatch(JSON.stringify(result),/judgeId|groupId|未公开评委|私有资料|private|scores/);
});

function judgeProfilePage(api, wxHooks = {}) {
 let page;
 const wx={getEnterOptionsSync:()=>({scene:1001}),showShareMenu(){},navigateBack(){},...wxHooks};
 const shareModule={exports:{}};
 vm.runInNewContext(fs.readFileSync(root+'/shared/share.js','utf8'),{
  module:shareModule,wx,
  require:name=>name.endsWith('/api')?api:require(path.join(root,'shared',name))
 });
 vm.runInNewContext(fs.readFileSync(root+'/pages/event-judge-profile/event-judge-profile.js','utf8'), {
  Page:value=>page=value,
  require:name=>name.endsWith('/share')?shareModule.exports:api,
  wx
 });
 page.setData=value=>Object.assign(page.data,value);
 return page;
}
test('judge profile preserves public visibility and strips biography markup',async()=>{
 for(const publicFlag of [false,true]){
  const page=judgeProfilePage({getEventDetail:async()=>({competition:{name:'真实赛事',judgeScoresPublic:publicFlag},judges:[{id:9,name:'评委A',bio:'<p>介绍文字</p>'}]})});
  page.id='100060';page.judgeId='9';await page.load();
  assert.equal(page.data.loading,false);
  if(publicFlag){assert.equal(page.data.judge.name,'评委A');assert.equal(page.data.judge.bio,'介绍文字');}else assert.equal(page.data.judge,null);
 }
});
test('a timeline judge-profile link redirects to the public event before loading judge data',()=>{
 let requests=0,redirect;
 const page=judgeProfilePage({getEventDetail:()=>{requests++;}}, {reLaunch:options=>redirect=options.url});
 page.onLoad({_sharePage:'event-detail',id:'100060',judgeId:'9',token:'private'});
 assert.equal(requests,0);assert.equal(redirect,'/pages/event-detail/event-detail?id=100060');
});
test('timeline single-page preview shows the event without loading judge details',async()=>{
 const page=judgeProfilePage({getEventDetail:async()=>({competition:{name:'真实赛事'},judges:[{name:'不应显示的资料'}]})},{getEnterOptionsSync:()=>({scene:1154})});
 await page.onLoad({id:'100060',judgeId:'9'});
 assert.equal(page.sharePreviewMode,true);assert.equal(page.data.judge,null);
 assert.equal(page.data.sharePreview.path,'/pages/event-detail/event-detail?id=100060');
 assert.doesNotMatch(JSON.stringify(page.data.sharePreview),/不应显示的资料|judgeId/);
});
