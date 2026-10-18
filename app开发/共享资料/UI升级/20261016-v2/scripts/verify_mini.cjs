const a=require('miniprogram-automator'),assert=require('node:assert/strict'),fs=require('fs');
const base='/Volumes/Eva U disk/伊娃东方舞-开发工程/app开发/共享资料/UI升级/20261016-v2';
(async()=>{const m=await a.connect({wsEndpoint:'ws://127.0.0.1:9420'}),result={engine:'WeChat DevTools',productionWrites:false,checks:[]};
try{
 let p=await m.switchTab('/pages/home/home');await p.waitFor(1500);let d=await p.data();assert.equal(d.loading,false);assert.equal(d.error,'');assert.ok(d.courseRows.length>0);result.checks.push('home loads actual published courses');
 await p.callMethod('onSearchInput',{detail:{value:'___no_matching_course___'}});assert.equal((await p.data()).courseRows.length,0);await m.screenshot({path:base+'/after/mini-search-empty.png'});await p.callMethod('onClearSearch');assert.ok((await p.data()).courseRows.length>0);result.checks.push('search empty and clear');
 await p.setData({loading:false,error:'网络连接中断，请重试'});await m.screenshot({path:base+'/after/mini-error-state.png'});await p.callMethod('loadHomeSections');assert.equal((await p.data()).error,'');result.checks.push('error rendering and retry read');
 const target=await p.$('.learning-links button');await target.tap();await p.waitFor(300);assert.equal((await m.currentPage()).path,'pages/profile/profile');result.checks.push('my courses shortcut opens real profile');
 p=await m.currentPage();await p.waitFor(1800);await p.setData({memberName:'学员（已脱敏）',wechatName:'学员（已脱敏）',displayInitial:'学',memberPhone:'138****0000',avatarUrl:'',profileOpen:false});await m.pageScrollTo(0);await m.screenshot({path:base+'/after/mini-profile.png'});
 p=await m.switchTab('/pages/offline/offline');await p.waitFor(1500);d=await p.data();assert.equal(d.tabs.some(t=>['bookings','sessions'].includes(t.key)),false);result.checks.push('offline tabs retain catalog rights and consumption without reservation');
 p=await m.switchTab('/pages/events/events');await p.waitFor(1500);d=await p.data();assert.equal(d.error,'');assert.ok(d.visibleEvents.every(e=>e.statusText));result.checks.push('event statuses use current registration rules');
 await m.switchTab('/pages/home/home');
 result.passed=true;fs.writeFileSync(base+'/logs/mini-runtime.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{m.disconnect()}})().catch(e=>{console.error(e);process.exit(1)});
