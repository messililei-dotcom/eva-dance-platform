const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function setup(value, fails = false) {
 const calls = []; const module = { exports: {} };
 vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../shared/video-feature.js'), 'utf8'), {
  module, require: () => ({ getFeatures: async () => { if(fails) throw Error('offline'); return value; } }),
  wx: { navigateTo: v => calls.push(v.url), showToast: v => calls.push(v.title) }
 });
 return { feature: module.exports, calls };
}
test('disabled, absent, malformed and unavailable config fail closed', async () => {
 for (const value of [undefined, {}, {videoPlaybackEnabled:false}, {videoPlaybackEnabled:'true'}]) {
  const {feature,calls}=setup(value);
  assert.equal(await feature.enabled(),false);
  await feature.navigateTo({url:'/pages/player/player?videoId=2&seriesId=9'});
  assert.deepEqual(calls,['/pages/detail/detail?id=9']);
 }
 assert.equal(await setup({},true).feature.enabled(),false);
});
test('explicit enabled flag restores player navigation', async () => {
 const {feature,calls}=setup({videoPlaybackEnabled:true});
 await feature.navigateTo({url:'/pages/player/player?videoId=2&seriesId=9'});
 assert.deepEqual(calls,['/pages/player/player?videoId=2&seriesId=9']);
});
test('closing flag on return clears playback and preserves page lifecycle', async () => {
 const {feature}=setup({videoPlaybackEnabled:false}); let stopped=0, shown=0;
 const page=feature.withVideoFeature({data:{playUrl:'old'},onShow(){shown++;}});
 page.setData=v=>Object.assign(page.data,v);page.videoContext={stop(){stopped++;}};
 await page.onShow();assert.equal(stopped,1);assert.equal(shown,1);assert.equal(page.data.playUrl,'');
 assert.equal(page.data.videoPlaybackEnabled,false);
});
test('a disabled shared player link never requests course or playback data',async()=>{
 let page,requests=0;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../pages/player/player.js'),'utf8'), {
  require: name=>name.includes('shared/share')?require('../shared/share'):name.includes('video-feature')?setup({}).feature:new Proxy({}, {get(){return ()=>{requests++;}}}),
  Page:value=>page=value,wx:{createVideoContext(){throw Error('must not create player');}},console
 });
 page.setData=v=>Object.assign(page.data,v);
 await page.onLoad({seriesId:9,videoId:2});assert.equal(requests,0);assert.equal(page.data.loading,false);
});
