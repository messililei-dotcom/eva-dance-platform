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
 wx:{showModal:value=>calls.push(['modal',value]),showToast:value=>calls.push(['toast',value]),showActionSheet:value=>calls.push(['sheet',value])},console,setTimeout,clearTimeout
 });
 page.data={isPlayerFullscreen:false,nativeFullscreenControls:false,videoId:101,playUrl:'test',currentSeconds:20,currentDuration:40,video:{},resumeSeconds:8};
 page.setData=(value,done)=>{Object.assign(page.data,value);done?.();};
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

test('landscape and portrait use native fullscreen without replacing playback',()=>{
 for(const [tapIndex, direction] of [[0,90],[1,0]]){
  const {page,calls}=setup();
  page.data.isPlaying=true;
  page.schedulePlayerControlsHide=()=>{};
  page.videoContext={
   requestFullScreen:options=>calls.push(['open',options.direction]),
   exitFullScreen:()=>calls.push(['exit']),
  };
  page.requestPlayerFullScreen();
  assert.equal(calls[0][0],'sheet');
  calls[0][1].success({tapIndex});
  assert.deepEqual(calls[1],['open',direction]);
  assert.equal(page.data.isPlayerFullscreen,false);
  page.onFullscreenChange({detail:{fullScreen:true,direction:direction===90?'horizontal':'vertical'}});
  assert.equal(page.data.isPlayerFullscreen,true);
  page.requestPlayerFullScreen();
  assert.deepEqual(calls[2],['exit']);
  page.onFullscreenChange({detail:{fullScreen:false}});
  assert.equal(page.data.isPlayerFullscreen,false);
  assert.equal(page.data.nativeFullscreenControls,false);
  assert.equal(page.data.currentSeconds,20);
  assert.equal(page.data.playUrl,'test');
  assert.equal(page.data.isPlaying,true);
 }
});

 test('fullscreen failure restores inline controls without changing media or position',()=>{
  const {page,calls}=setup();
  page.videoContext={requestFullScreen:options=>options.fail()};
  page.openNativeFullscreen(90);
  assert.equal(page.fullscreenTimer,null);
  assert.equal(page.data.nativeFullscreenControls,false);
  assert.equal(page.data.playUrl,'test');assert.equal(page.data.currentSeconds,20);
  assert.equal(calls.at(-1)[0],'toast');
 });
 test('backgrounding exits fullscreen and cancels a pending fullscreen request',()=>{
  const {page,calls}=setup();page.data.isPlayerFullscreen=true;
  page.videoContext={exitFullScreen:()=>calls.push(['exit'])};
  page.fullscreenTimer=setTimeout(()=>assert.fail('late fullscreen request'),1000);
  page.onHide();assert.equal(page.fullscreenTimer,null);assert.equal(calls[0][0],'exit');
 });

test('a late fullscreen callback after backgrounding exits instead of trapping the hidden page',()=>{
 const {page,calls}=setup();page.playerHidden=true;
 page.videoContext={exitFullScreen:()=>calls.push(['exit'])};
 page.onFullscreenChange({detail:{fullScreen:true}});
 assert.deepEqual(calls,[['exit']]);
 page.onFullscreenChange({detail:{fullScreen:false}});
 assert.equal(page.data.isPlayerFullscreen,false);
});
