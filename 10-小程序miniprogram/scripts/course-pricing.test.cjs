const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const {createRequire}=require('module');
const {coursePrice}=require('../shared/course-price');
test('course prices match server promotional precedence without inventing a discount',()=>{
 assert.deepEqual(coursePrice({price:2980,promo_price:499,is_free:0}),{canPurchase:true,hasDiscount:true,priceText:'¥499',priceLabel:'优惠价',originalPriceText:'¥2980'});
 for(const promo_price of [0,null,-1,'invalid']){const p=coursePrice({price:299.50,promo_price});assert.equal(p.priceText,'¥299.5');assert.equal(p.hasDiscount,false);}
 assert.equal(coursePrice({price:99,promo_price:199}).hasDiscount,false);
 assert.equal(coursePrice({price:99,promo_price:199}).priceText,'¥199');
 assert.equal(coursePrice({price:99,promo_price:99}).originalPriceText,'');
});
test('free, unpriced and string flags do not become incorrect purchase offers',()=>{
 const free=coursePrice({price:2980,promo_price:499,is_free:'1'});assert.equal(free.canPurchase,false);assert.equal(free.priceText,'免费');assert.equal(free.hasDiscount,false);
 assert.equal(coursePrice({price:10,is_free:'0'}).canPurchase,true);
 for(const price of [0,null,-1,'invalid']){const p=coursePrice({price});assert.equal(p.canPurchase,false);assert.equal(p.priceText,'咨询价格');}
});
function player(auth){let p;const calls=[];const file=path.join(__dirname,'../pages/player/player.js');const api={getSeriesMeta:async()=>({price:2980,promo_price:499}),getSeriesCourses:async()=>[{id:1,name:'第一节',videos:[{id:11}]}],getSeriesProgress:async()=>[],checkAuthorization:async()=>({authorized:auth})};vm.runInNewContext(fs.readFileSync(file,'utf8'),{require:n=>n.includes('utils/api')?api:n.endsWith('/share')?{withShare:(_,v)=>v}:n.includes('video-feature')?{withVideoFeature:v=>v}:createRequire(file)(n),Page:v=>p=v,wx:{showLoading(){},hideLoading(){},showToast(){},navigateTo:v=>calls.push(v.url)},console,setTimeout,clearTimeout});p.setData=v=>Object.assign(p.data,v);p.data.seriesId=6;return{p,api,calls};}
test('unowned course offers purchase directly from player and refreshes authorization on return',async()=>{const{p,api,calls}=player(false);await p.loadCourse(6);assert.equal(p.data.course.priceText,'¥499');assert.equal(p.data.courseAuthorized,false);assert.equal(p.data.playUrl,'');p.requestAuthorization();assert.equal(calls[0],'/pages/course-checkout/course-checkout?kind=online&id=6');api.checkAuthorization=async()=>({authorized:true});await p.refreshCourseCatalog();assert.equal(p.data.courseAuthorized,true);p.buyCourse();assert.equal(calls.length,1);});
