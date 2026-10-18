const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const view=require('../shared/event-view');
const eventState=require('../shared/event-state');
function page(route,api={},wx={},timers={}) {
 let p;const jobs=new Map();let seq=0;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../pages',route,route+'.js'),'utf8'),{Page:x=>p=x,require:n=>n.includes('shared/share')?{withShare:(_,x)=>x}:n.includes('video-feature')?{withVideoFeature:x=>x}:n.includes('event-view')?view:n.includes('event-state')?eventState:n.includes('course-video-selection')?{}:api,wx:{showToast(){},...wx},console,setTimeout:(fn,ms)=>{const id=++seq;jobs.set(id,{fn:()=>{jobs.delete(id);fn()},ms});return id},clearTimeout:id=>jobs.delete(id),...timers});
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
test('filtered registration groups submit the selected ID and the exact server fee',async()=>{
 let payload,redirect;const storage={memberId:5};const api={registerEventWithMusic:async(id,file,body)=>{payload=body;return{id:93,registrationFee:100}}};const{p}=page('event-register',api,{getStorageSync:k=>storage[k],setStorageSync:(k,v)=>storage[k]=v,removeStorageSync:k=>delete storage[k],removeSavedFile(){},redirectTo:o=>redirect=o.url});p.data={...p.data,id:1,competition:{registrationStatus:'open'},groups:[{id:1,name:'A',registrationFee:10},{id:2,name:'B',registrationFee:100}],name:'学员',phone:'13800000001',performanceTitle:'节目',musicFilePath:'/saved/music',musicFileName:'课堂音乐.wav'};p.draftLoaded=true;p.onGroupSearch({detail:{value:'B'}});p.onGroupChange({detail:{value:0}});assert.equal(p.data.groupId,'2');assert.equal(p.data.feeText,'¥100.00');await p.submit();assert.equal(payload.groupId,2);assert.equal(payload.musicFileName,'课堂音乐.wav');assert.equal(redirect,'/pages/course-checkout/course-checkout?kind=event&id=93');
});
test('registration restores only the current member draft and a usable music file',async()=>{
 const storage={memberId:6,'eva-event-registration:6:1':{savedAt:Date.now(),form:{name:'草稿学员'},groupId:2,musicFilePath:'/saved/music.wav',musicFileName:'音乐.wav'},'eva-event-registration:5:1':{savedAt:Date.now(),form:{name:'其他账号'}}};const{p}=page('event-register',{getEventDetail:async()=>({groups:[{id:2,name:'组别',registrationFee:88}],competition:{}}),getMemberProfile:async()=>({member:{name:'本人',phone:'13800000001'}})},{getStorageSync:k=>storage[k],getFileSystemManager:()=>({accessSync(){}})});p.data.id=1;await p.loadForm();assert.equal(p.data.name,'草稿学员');assert.equal(p.data.musicFilePath,'/saved/music.wav');assert.equal(p.data.groupId,2);
});
test('public judges keep zero scores and mask only scores that are not public',()=>{assert.equal(view.score(0),'0');assert.equal(view.score(null),'—');assert.equal(view.player({rankNo:1,publishedTotal:100}).rankLabel,'冠军');});
