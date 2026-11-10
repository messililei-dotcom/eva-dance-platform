const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(request,pay=async()=>{},videoPlaybackEnabled=true,kind="event",virtual={}){let definition;const storage={memberId:1},redirects=[];const wx={getStorageSync:k=>storage[k],setStorageSync:(k,v)=>storage[k]=v,removeStorageSync:k=>delete storage[k],showToast(){},showModal:o=>redirects.push(o.title),redirectTo:o=>redirects.push(o.url),navigateTo:o=>redirects.push(o.url)};
const videoModule={exports:{}};
vm.runInNewContext(fs.readFileSync(__dirname+'/../shared/video-feature.js','utf8'),{module:videoModule,wx,require:()=>({getFeatures:async()=>({videoPlaybackEnabled})})});
vm.runInNewContext(fs.readFileSync(__dirname+'/../pages/course-checkout/course-checkout.js','utf8'),{Page:p=>definition=p,wx,require:n=>n.includes('utils/api')?{request}:n.endsWith('/video-feature')?videoModule.exports:n.endsWith('/virtual-payment')?virtual:n.endsWith('/shop')?{money:n=>(n/100).toFixed(2),requestKey:()=>String(Math.random()),pay}:{withShare:(_,p)=>p}});
const page={...definition,data:{...definition.data},setData(d){Object.assign(this.data,d)}};page.onLoad({kind,id:'6'});return{page,storage,redirects};}
test('course checkout sends server quote without shipping and keeps idempotency after network failure',async()=>{const bodies=[];let fail=true;const{page,redirects}=setup(async(path,o)=>{if(path.includes('/courses/'))return{offer:{priceFen:8800,name:'课程'},payment:{miniprogram:true}};bodies.push(o.data);if(fail)throw Error('网络中断');return{order:{id:'order'}};});await page.reload();await page.submit();fail=false;await page.submit();assert.equal(bodies[0].requestKey,bodies[1].requestKey);assert.equal(bodies[1].expectedTotalFen,8800);assert.equal(bodies[1].kind,'event');assert.equal(bodies[1].address,undefined);assert.equal(redirects[0],'/pages/shop-orders/shop-orders');});
test('cancelled payment preserves the created order and opens orders instead of creating again',async()=>{let creates=0;const{page,redirects}=setup(async(path)=>{if(path.includes('/courses/'))return{offer:{priceFen:8800},payment:{miniprogram:true}};creates++;return{order:{id:'order'}};},async()=>{throw Error('已取消支付')});await page.reload();await page.submit();assert.equal(creates,1);assert.equal(redirects[0],'/pages/shop-orders/shop-orders');});
test('course checkout share points to course/period without checkout or payment details',()=>{const{resolveShare}=require('../shared/share');assert.equal(resolveShare({data:{kind:'online',id:'6',offer:{name:'课'}}},'course-checkout').path,'/pages/detail/detail?id=6');assert.equal(resolveShare({data:{kind:'offline',id:'8',offer:{name:'期次'}}},'course-checkout').path,'/pages/offline-detail/offline-detail?id=900008');});
test('online checkout only uses virtual payment and never redirects on sandbox confirmation',async()=>{
 const paid=[];
 const noStandard=async()=>{throw new Error('ordinary payment must never be called');};
 const {page,redirects}=setup(noStandard,noStandard,true,'online',{
  quote:async()=>({offer:{priceFen:500,name:'联调',sandbox:true}}),
  supportsPayment:()=>true,
  pay:async(...args)=>paid.push(args),
 });
 await page.reload();
 await page.submit();
 assert.deepEqual(paid,[['6',500]]);
 assert.deepEqual(redirects,['沙箱订单已核验']);
});
test('unavailable virtual quote fails closed without ordinary checkout',async()=>{
 let standardCalls=0;
 const {page}=setup(async()=>{standardCalls++;},undefined,true,'online',{
  quote:async()=>{throw Error('线上课程虚拟支付暂不可用');},
 });
 await page.reload();
 await page.submit();
 assert.equal(standardCalls,0);
 assert.equal(page.data.paymentEnabled,false);
 assert.match(page.data.error,/虚拟支付/);
});
test('an unlocked checkout opens course details while video is paused',async()=>{
 const {page,redirects}=setup(async()=>{},undefined,false,'online');
 page.setData({unlocked:true});
 await page.submit();
 assert.deepEqual(redirects,['/pages/detail/detail?id=6']);
});

test('a newly published sandbox item reports synchronization without querying a nonexistent order', async () => {
 const id = 'VX' + '1'.repeat(30);
 const calls = [];
 const paymentModule = { exports: {} };
 vm.runInNewContext(fs.readFileSync(__dirname + '/../shared/virtual-payment.js', 'utf8'), {
  module: paymentModule,
  require: () => ({ request: async (path) => {
   calls.push(path);
   return { id, status: 'pending', payment: {
    mode: 'short_series_goods',
    signData: JSON.stringify({ env: 1, outTradeNo: id, goodsPrice: 29900 }),
    paySig: 'a'.repeat(64),
    signature: 'b'.repeat(64),
   } };
  } }),
  wx: {
   login: options => options.success({ code: 'fixture-code' }),
   requestVirtualPayment: options => options.fail({ errCode: -15014 }),
  },
 });
 await assert.rejects(paymentModule.exports.pay(21, 29900), /沙箱道具正在同步/);
 assert.deepEqual(calls, ['/virtual-payment/prepare/21']);
});

test('live checkout unlocks only after server confirmation without showing sandbox text', async () => {
  const paid = [];
  const { page, redirects } = setup(async () => { throw Error('ordinary payment must never be called'); }, undefined, true, 'online', {
    quote: async () => ({ offer: { priceFen: 500, name: '课程', sandbox: false } }),
    supportsPayment: () => true,
    pay: async (...args) => paid.push(args),
  });
  await page.reload();
  await page.submit();
  assert.deepEqual(paid, [['6', 500, true]]);
  assert.equal(page.data.unlocked, true);
  assert.deepEqual(redirects, []);
});

test('stale event quote blocks payment until the updated groups and prices are reloaded', async () => {
  let requests = 0;
  const { page } = setup(async path => {
    if (path.includes('/courses/')) {
      return { offer: { priceFen: 8800, eventItems: [{ id: 5, priceFen: 8800 }] }, payment: { miniprogram: true } };
    }
    requests++;
    const error = Error('报名费用或缴费组别已更新，请刷新后确认');
    error.statusCode = 409;
    throw error;
  });
  await page.reload();
  await page.submit();
  await page.submit();
  assert.equal(requests, 1);
  assert.equal(page.data.paymentEnabled, false);
  assert.equal(page.data.offer, null);
  await page.reload();
  assert.equal(page.data.paymentEnabled, true);
});
