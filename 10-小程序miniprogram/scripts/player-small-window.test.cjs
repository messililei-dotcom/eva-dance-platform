const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function setup() {
 let page; const calls=[];
 const api={saveVideoProgress:(...args)=>{calls.push(['save',...args]);return Promise.resolve();}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../pages/player/player.js'),'utf8'),{
 require: name=>name==='../../utils/api'?api:name==='../../shared/video-feature'?require('../shared/video-feature'):name==='../../shared/share'?require('../shared/share'):{}, Page: value=>{page=value;},
 wx:{showModal:value=>calls.push(['modal',value]),showToast:value=>calls.push(['toast',value])},console,setTimeout,clearTimeout
 });
 page.data={videoId:101,playUrl:'test',currentSeconds:20,currentDuration:40,video:{},resumeSeconds:8};
 page.setData=value=>Object.assign(page.data,value);
 return {page,calls};
}
test('saves current progress and requests native background playback',()=>{
 const {page,calls}=setup();page.videoContext={requestBackgroundPlayback:()=>calls.push(['open'])};
 page.requestSmallWindow();assert.deepEqual(calls[0],['save',101,20,40]);assert.equal(calls[1][0],'open');
});
test('unsupported client gives a short availability message',()=>{
 const {page,calls}=setup();page.videoContext={};page.requestSmallWindow();assert.equal(calls[0][0],'save');assert.equal(calls[1][0],'toast');
});
test('native API rejection does not add a dialog',()=>{
 const {page,calls}=setup();page.videoContext={requestBackgroundPlayback:()=>{throw new Error('blocked')}};page.requestSmallWindow();assert.deepEqual(calls,[['save',101,20,40]]);
});
test('resume uses current position rather than stale loaded progress',()=>{
 const {page,calls}=setup();page.videoContext={seek:t=>calls.push(['seek',t]),play:()=>calls.push(['play'])};page.resumePlayback();assert.deepEqual(calls,[['seek',20],['play']]);
});
test('resume from zero never seeks back to old saved progress',()=>{
 const {page,calls}=setup();page.data.currentSeconds=0;page.videoContext={seek:t=>calls.push(['seek',t]),play:()=>calls.push(['play'])};page.resumePlayback();assert.deepEqual(calls,[['play']]);
});
test('backgrounding saves without stopping the video',()=>{
 const {page,calls}=setup();page.videoContext={pause:()=>calls.push(['pause'])};page.onHide();assert.deepEqual(calls,[['save',101,20,40]]);
});
test('switching lesson saves the previous lesson first',()=>{
 const {page,calls}=setup();page.loadVideo=id=>calls.push(['load',id]);page.switchVideo({currentTarget:{dataset:{id:102}}});assert.deepEqual(calls,[['save',101,20,40],['load',102]]);
});

test('enlarging keeps the existing video and toggles back',()=>{ const {page}=setup();page.schedulePlayerControlsHide=()=>{};page.videoContext={requestFullScreen:()=>{throw new Error('native fullscreen must not be used')}};page.requestPlayerFullScreen();assert.equal(page.data.isPlayerFullscreen,true);page.requestPlayerFullScreen();assert.equal(page.data.isPlayerFullscreen,false); });
