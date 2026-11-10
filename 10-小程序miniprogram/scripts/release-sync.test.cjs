const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const view=require('../shared/event-view');
const eventState=require('../shared/event-state');
function page(route,api={},wx={},timers={}) {
 let p;const jobs=new Map();let seq=0;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../pages',route,route+'.js'),'utf8'),{Page:x=>p=x,require:n=>n.includes('shared/share')?{withShare:(_,x)=>x}:n.includes('video-feature')?{withVideoFeature:x=>x}:n.includes('event-view')?view:n.includes('event-state')?eventState:n.includes('event-phone')?require('../shared/event-phone'):n.includes('course-video-selection')?{}:n.includes('shared/shop')?require('../shared/shop'):n.includes('event-music-draft')?require('../shared/event-music-draft'):api,wx:{showToast(){},...wx},console,setTimeout:(fn,ms)=>{const id=++seq;jobs.set(id,{fn:()=>{jobs.delete(id);fn()},ms});return id},clearTimeout:id=>jobs.delete(id),...timers});
 p.data=JSON.parse(JSON.stringify(p.data));p.setData=d=>Object.assign(p.data,d);return{p,jobs};
}
test('playing starts clean, a tap reveals controls, interaction extends timeout, hidden pages clear timers',()=>{
 const {p,jobs}=page('player');p.videoContext={playbackRate(){}};p.saveCurrentProgress=()=>{};
 p.data.showVideoControls=true;p.onVideoPlay();assert.equal(p.data.showVideoControls,false);
 p.onPlayerTap();assert.equal(p.data.showVideoControls,true);assert.equal(jobs.size,1);
 p.toggleMirror();assert.equal(p.data.isMirrored,true);assert.equal(jobs.size,1);
 const timer=[...jobs.values()][0];assert.equal(timer.ms,3000);timer.fn();assert.equal(p.data.showVideoControls,false);
 p.onPlayerTap();p.togglePlayerMenu({currentTarget:{dataset:{menu:'speed'}}});assert.equal(jobs.size,0);
 p.closePlayerMenu();assert.equal(jobs.size,1);p.onHide();assert.equal(jobs.size,0);assert.equal(p.data.showVideoControls,false);
});
test('native tap only reveals tools; toolbar and transport cannot be permanently visible',()=>{
 const w=fs.readFileSync(path.join(__dirname,'../pages/player/player.wxml'),'utf8');
 assert.match(w,/enable-play-gesture="\{\{false\}\}"/);assert.match(w,/wx:if="\{\{showVideoControls \|\| showPlayerMenu\}\}" class="video-top-controls/);
});
test('group pagination follows backend order across pages and search',()=>{
 const {p}=page('event-detail');p.data.groups=Array.from({length:45},(_,i)=>({id:i+1,name:'组别'+(i+1),ordinal:i+1}));p.applyGroupPage(2);assert.equal(p.data.visibleGroups[0].id,21);assert.equal(p.data.groupPageCount,3);p.onGroupSearch({detail:{value:'组别45'}});assert.equal(p.data.visibleGroups[0].id,45);assert.equal(p.data.groupPage,1);
});
test('batch registration survives a lost response and music timeout, then opens combined checkout',async()=>{
 const storage={memberId:5};
 const submissions=[];
 const uploads=[];
 let redirect;
 const api={
   async registerEventBatch(id,entries,key) {
     submissions.push({id,entries,key});
     if (submissions.length === 1) throw new Error('网络超时');
     return {registrations:[{id:93},{id:94}],paymentRegistrationId:93};
   },
   async replaceEventMusic(id,path) {
     uploads.push({id,path});
     throw new Error('音乐上传未确认，报名记录已保留。');
   },
 };
 const {p}=page('event-register',api,{
   getStorageSync:k=>storage[k],setStorageSync:(k,v)=>storage[k]=v,removeStorageSync:k=>delete storage[k],
   redirectTo:o=>redirect=o.url,
 });
 p.data={...p.data,id:1,competition:{registrationStatus:'open'},groups:[{id:1,name:'A',registrationFee:10},{id:2,name:'B',registrationFee:100}],
   name:'学员',phone:'13800000001',performanceTitle:'节目一',musicFilePath:'/saved/music',musicFileName:'课堂音乐.wav'};
 p.accountId='5';
 p.draftLoaded=true;
 p.onGroupSearch({detail:{value:'B'}});
 p.onGroupChange({detail:{value:0}});
 assert.equal(p.data.groupId,'2');
 assert.equal(p.data.feeText,'¥100.00');
 p.queueEntry();
 p.onGroupChange({detail:{value:0}});
 p.data.performanceTitle='节目二';
 await p.submit();
 assert.equal(p.data.confirmed,null);
 assert.equal(storage['eva-event-registration:5:1'].submission.key,submissions[0].key);
 await p.submit();
 assert.equal(submissions[0].key,submissions[1].key);
 assert.deepEqual(Array.from(submissions[1].entries,entry=>entry.groupId),[2,1]);
 assert.equal(submissions[1].entries[0].musicFileName,undefined);
 assert.equal(p.data.confirmed.registrations.length,2);
 await p.uploadMusic({currentTarget:{dataset:{index:0}}});
 assert.deepEqual(uploads,[{id:93,path:'/saved/music'}]);
 assert.match(p.data.musicError,/报名记录已保留/);
 assert.equal(storage['eva-event-music:5:93'].name,'课堂音乐.wav');
 p.payRegistrations();
 assert.equal(redirect,'/pages/course-checkout/course-checkout?kind=event&id=93');
});
test('registration restores only the current member draft and a usable music file',async()=>{
 const storage={memberId:6,'eva-event-registration:6:1':{savedAt:Date.now(),form:{name:'草稿学员'},groupId:2,musicFilePath:'/saved/music.wav',musicFileName:'音乐.wav'},'eva-event-registration:5:1':{savedAt:Date.now(),form:{name:'其他账号'}}};const{p}=page('event-register',{getEventDetail:async()=>({groups:[{id:2,name:'组别',registrationFee:88}],competition:{}}),getMemberProfile:async()=>({member:{name:'本人',phone:'13800000001'}})},{getStorageSync:k=>storage[k],getFileSystemManager:()=>({accessSync(){}})});p.data.id=1;await p.loadForm();assert.equal(p.data.name,'草稿学员');assert.equal(p.data.musicFilePath,'/saved/music.wav');assert.equal(p.data.groupId,2);
});
test('public judges keep zero scores and mask only scores that are not public',()=>{assert.equal(view.score(0),'0');assert.equal(view.score(null),'—');assert.equal(view.player({rankNo:1,publishedTotal:100}).rankLabel,'冠军');});

test('WeChat upload timeout keeps the music retry scoped to the saved registration', async () => {
 const module={exports:{}};
 const calls=[];
 const statuses=[];
 let response='timeout';
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../utils/api.js'),'utf8'),{
   module,require:()=>({apiBase:'https://admin.example/api/mini'}),getApp:()=>null,
   wx:{getStorageSync:()=> 'fixture-token',uploadFile(options) {
     calls.push(options);
     queueMicrotask(() => response==='timeout' ? options.fail({errMsg:'uploadFile:fail fail:time out'}) :
       options.success({statusCode:200,data:response}));
     return {onProgressUpdate(listener){listener({progress:58});}};
   }},
 });
 const upload=()=>module.exports.replaceEventMusic(93,'/saved/music.wav',{musicFileName:'音乐.wav'},progress=>statuses.push(progress));
 await assert.rejects(upload(),/报名记录已保留/);
 assert.equal(calls.length,1);
 assert.match(calls[0].url,/\/member\/event-registrations\/93\/music$/);
 assert.equal(calls[0].timeout,120000);
 assert.deepEqual(statuses,[58]);
 response='<html>upstream unavailable</html>';
 await assert.rejects(upload(),/上传失败/);
 response=JSON.stringify({success:true,data:{fileName:'音乐.wav'}});
 assert.equal((await upload()).fileName,'音乐.wav');
});
