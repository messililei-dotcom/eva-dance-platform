const a=require('miniprogram-automator'),fs=require('fs'),assert=require('assert/strict');
async function until(fn){const deadline=Date.now()+20000;while(Date.now()<deadline){if(await fn())return;await new Promise(r=>setTimeout(r,150));}throw Error('Runtime state did not settle');}
const dir='/Volumes/Eva U disk/伊娃东方舞-开发工程/app开发/共享资料/UI升级/20261016-my-events';
(async()=>{const m=await a.connect({wsEndpoint:'ws://127.0.0.1:9420'});try{
 const p=await m.switchTab('/pages/profile/profile');await p.waitFor(1600);await p.setData({myEventsOpen:false});await m.pageScrollTo(0);const toggle=await p.$('.my-events-toggle');assert.ok(toggle);await toggle.tap();await until(async()=>{const d=await p.data();return d.myEventsOpen&&!d.eventsLoading});let d=await p.data();assert.equal((await m.currentPage()).path,'pages/profile/profile');assert.equal(d.myEventsOpen,true);assert.equal(d.eventsLoading,false);assert.equal(d.eventsError,'');assert.ok(d.eventRegistrations.length>0);assert.equal((await p.$$('.my-events-panel .record-card')).length,d.eventRegistrations.length);
 for(const title of await p.$$('.content-title'))assert.notEqual(await title.text(),'比赛报名');
 const checks={runtime:'WeChat DevTools',remainsOnProfile:true,ownRecordsLoaded:true,recordCount:d.eventRegistrations.length,duplicateSectionRemoved:true,productionBusinessWrites:false};
 await p.setData({memberName:'学员（已脱敏）',wechatName:'学员（已脱敏）',displayInitial:'学',memberPhone:'138****0000',avatarUrl:'',profileOpen:false,eventRegistrations:d.eventRegistrations.map(r=>({...r,entrantName:r.entrantName?'本人（已脱敏）':'',performanceTitle:r.performanceTitle?'节目名称（已脱敏）':''}))});await m.pageScrollTo(150);await p.waitFor(200);await m.screenshot({path:dir+'/我的比赛-展开.png'});
 await m.pageScrollTo(0);await (await p.$('.my-events-toggle')).tap();await until(async()=>!(await p.data()).myEventsOpen);assert.equal((await p.data()).myEventsOpen,false);checks.collapseWorks=true;
 await (await p.$('.my-events-toggle')).tap();await until(async()=>{const d=await p.data();return d.myEventsOpen&&!d.eventsLoading});assert.equal((await p.data()).myEventsOpen,true);checks.reopenWorks=true;
 fs.writeFileSync(dir+'/runtime-check.json',JSON.stringify(checks,null,2));console.log(checks);
 // Leave the current preview anonymized; no storage or account details are changed.
 d=await p.data();await p.setData({memberName:'学员（已脱敏）',wechatName:'学员（已脱敏）',memberPhone:'138****0000',avatarUrl:'',eventRegistrations:d.eventRegistrations.map(r=>({...r,entrantName:r.entrantName?'本人（已脱敏）':'',performanceTitle:r.performanceTitle?'节目名称（已脱敏）':''}))});
 }finally{m.disconnect()}})().catch(e=>{console.error(e);process.exit(1)});
