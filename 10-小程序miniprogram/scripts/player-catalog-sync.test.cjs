const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function setup(courses) {
  let page;
  const api = { getSeriesMeta: async () => ({name:'最新课程'}), getSeriesCourses: async () => courses, getSeriesProgress: async () => [], getVideoPlay: async () => ({name:'旧文件.mp4',play_url:'url'}), getVideoProgress: async () => null, getNotes: async () => [] };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../pages/player/player.js'),'utf8'), {
    require: name => name === '../../utils/api' ? api : name === '../../shared/video-feature' ? {withVideoFeature:p=>p,enabled:async()=>true} : name === '../../shared/share' ? {withShare:(_,p)=>p} : require(path.join(__dirname, '..', name.replace('../../',''))),
    Page: p => {page=p;}, wx: {showLoading(){},hideLoading(){},showToast(){}}, setTimeout,clearTimeout,console
  });
  page.data = {...page.data,seriesId:10};
  page.setData = changes => {for(const [key,value] of Object.entries(changes)) {if(key==='video.name')page.data.video.name=value;else page.data[key]=value;}};
  return page;
}
const courses = [{id:2,name:'后台新课节名称',videos:[{id:12,name:'原始文件.mp4',duration:120}]},{id:1,name:'另一课节',videos:[{id:11,name:'old.mp4',duration:60}]}];
test('initial catalog and playback title use edited lesson name',async()=>{
 const page=setup(courses);await page.loadCourse(10,12);assert.equal(page.data.outline[0].name,'后台新课节名称');await page.loadVideo(12);assert.equal(page.data.video.name,'后台新课节名称');
});
test('return refreshes names and order without restarting playback or losing progress',async()=>{
 const page=setup(courses);page.catalogLoaded=true;page.data.videoId=11;page.data.video={name:'旧标题'};page.data.playUrl='playing';page.data.currentSeconds=35;page.data.outline=[{videoId:11,progressPercent:50,resumeSeconds:30}];
 await page.onShow();assert.equal(page.data.outline[0].videoId,12);assert.equal(page.data.video.name,'另一课节');assert.equal(page.data.currentSeconds,35);assert.equal(page.data.playUrl,'playing');assert.equal(page.data.outline[1].progressPercent,50);assert.equal(page.data.hasPrevious,true);assert.equal(page.data.hasNext,false);
});
test('removed lesson stops stale playback and keeps the updated catalog',async()=>{
 const page=setup(courses);page.data.videoId=99;let stopped=0;page.videoContext={stop(){stopped++;}};await page.refreshCourseCatalog();assert.equal(stopped,1);assert.equal(page.data.videoId,null);assert.equal(page.data.outline.length,2);
});
