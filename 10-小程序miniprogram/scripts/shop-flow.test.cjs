const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function shopSetup({request,payment}={}){
 const storage={};let params;const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../shared/shop.js','utf8'),{module,exports:module.exports,require:n=>n.includes('/api')?{request:request||(async()=>({}))}:{officialWebsiteUrl:'https://www.swod.com.cn'},wx:{getStorageSync:k=>storage[k],setStorageSync:(k,v)=>storage[k]=v,removeStorageSync:k=>delete storage[k],requestPayment:p=>{params=p;(payment||(()=>p.success({})))(p);}},console});
 return{shop:module.exports,storage,params:()=>params};
}
test('guest shopping bag migrates once after login and accounts keep separate bags',()=>{
 const{shop,storage}=shopSetup();shop.add({id:'sku',stock:4},2);storage.memberId=1;assert.equal(shop.readCart().sku,2);assert.equal(storage['eva-shop-cart-guest'],undefined);assert.equal(shop.readCart().sku,2);storage.memberId=2;assert.equal(Object.keys(shop.readCart()).length,0);storage.memberId=1;assert.equal(shop.readCart().sku,2);assert.throws(()=>shop.add({id:'sku',stock:2},1),/数量/);
});
test('product assets use website catalogue and preserve price in cents',()=>{
 const{shop}=shopSetup();const p=shop.product({id:'p',priceFen:1999,image:'/api/shop/images/p',size:'M',color:'黑'});assert.equal(p.priceText,'19.99');assert.equal(p.image,'https://www.swod.com.cn/api/shop/images/p');
});
test('native payment only trusts backend reconciliation and passes signed fields',async()=>{
 const calls=[];const{shop,params}=shopSetup({request:async(path)=>{calls.push(path);return path.endsWith('/pay')?{kind:'miniprogram',params:{timeStamp:'123',nonceStr:'nonce',package:'prepay_id=test',signType:'RSA',paySign:'signed'}}:{order:{status:'pending'}};}});
 await assert.rejects(()=>shop.pay('EVtest'),/支付结果待确认/);assert.equal(params().package,'prepay_id=test');assert.equal(calls.length,2);assert.ok(calls[1].endsWith('/refresh'));
});
test('cancelled payment still reconciles and never marks paid locally',async()=>{
 let refresh=0;const{shop}=shopSetup({request:async(path)=>path.endsWith('/pay')?{kind:'miniprogram',params:{timeStamp:'123',nonceStr:'nonce',package:'prepay_id=test',signType:'RSA',paySign:'signed'}}:(refresh++,{order:{status:'pending'}}),payment:p=>p.fail({errMsg:'requestPayment:fail cancel'})});await assert.rejects(()=>shop.pay('EVtest'),/取消支付/);assert.equal(refresh,1);
});
test('invalid payment response never invokes native payment',async()=>{
 const{shop,params}=shopSetup({request:async()=>({kind:'qr',url:'irrelevant'})});await assert.rejects(()=>shop.pay('EVtest'),/暂不支持/);assert.equal(params(),undefined);
});
test('mall shares products while orders and checkout share no private data',()=>{
 const share=require('../shared/share');const card=share.resolveShare({data:{id:'sku',product:{name:'舞服',image:'https://www.swod.com.cn/a.jpg',specText:'M'}}},'shop-product');assert.equal(card.path,'/pages/shop-product/shop-product?id=sku');assert.equal(card.imageUrl,'https://www.swod.com.cn/a.jpg');for(const route of ['shop-orders','shop-checkout'])assert.equal(share.resolveShare({data:{phone:'13800000000',address:'私密地址'}},route).path,'/pages/mall/mall');
});

test('clearing an order bag after login also clears its anonymous copy',()=>{const{shop,storage}=shopSetup();shop.add({id:'sku',stock:5},1);storage.memberId=1;shop.writeCart({});assert.equal(Object.keys(shop.readCart()).length,0);assert.equal(storage['eva-shop-cart-guest'],undefined);});
test('catalogue image normalization retains the official shop image endpoint',async()=>{
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../utils/api.js','utf8'),{module,exports:module.exports,require:n=>n.endsWith('/event-sort')?require('../shared/event-sort'):{apiBase:'https://admin.swod.com.cn/api/mini',officialWebsiteUrl:'https://www.swod.com.cn'},getApp:()=>({globalData:{}}),wx:{getStorageSync:()=>null,request:p=>p.success({statusCode:200,data:{products:[{id:'sku',image:'/api/shop/images/sku/hash'}]}})}});
 const data=await module.exports.request('/shop/products',{auth:false});assert.equal(data.products[0].image,'https://www.swod.com.cn/api/shop/images/sku/hash');
});

test('native payment success requires server paid status',async()=>{
 const {shop}=shopSetup({request:async path=>path.endsWith('/pay')?{kind:'miniprogram',params:{timeStamp:'123',nonceStr:'nonce',package:'prepay_id=test',signType:'RSA',paySign:'signed'}}:{order:{status:'paid'}}});
 assert.equal((await shop.pay('EVtest')).order.status,'paid');
});
test('payment reconciliation network failure remains pending',async()=>{
 const {shop}=shopSetup({request:async path=>{if(path.endsWith('/pay'))return {kind:'miniprogram',params:{timeStamp:'123',nonceStr:'nonce',package:'prepay_id=test',signType:'RSA',paySign:'signed'}};throw Error('network');}});
 await assert.rejects(()=>shop.pay('EVtest'),/支付结果待确认/);
});
