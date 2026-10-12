const api=require('../../utils/api');const shop=require('../../shared/shop');const share=require('../../shared/share');
Page(share.withShare('course-checkout',{
 data:{kind:'',id:'',offer:null,loading:true,busy:false,error:'',paymentEnabled:false},
 onLoad(o){this.setData({kind:o.kind,id:o.id});},
 onShow(){return this.reload();},
 async reload(){this.setData({loading:true,error:''});try{const d=await api.request(`/shop/courses/${encodeURIComponent(this.data.kind)}/${encodeURIComponent(this.data.id)}`,{auth:this.data.kind==='event'});this.setData({offer:{...d.offer,priceText:shop.money(d.offer.priceFen)},paymentEnabled:!!d.payment.miniprogram});}catch(e){this.setData({offer:null,error:e.message});}finally{this.setData({loading:false});}},
 async submit(){if(this.data.busy||!this.data.offer||!this.data.paymentEnabled)return;this.setData({busy:true,error:''});try{const input={kind:this.data.kind,targetId:this.data.id,provider:'wechat',expectedTotalFen:this.data.offer.priceFen};const key='eva-course-checkout-'+(wx.getStorageSync('memberId')||'guest'),fingerprint=JSON.stringify(input);let saved=wx.getStorageSync(key);if(!saved||saved.fingerprint!==fingerprint){saved={fingerprint,requestKey:shop.requestKey()};wx.setStorageSync(key,saved);}const d=await api.request('/shop/orders',{method:'POST',data:{...input,requestKey:saved.requestKey},timeout:30000});wx.removeStorageSync(key);try{await shop.pay(d.order.id);}catch(e){wx.showToast({title:e.message,icon:'none'});}wx.redirectTo({url:'/pages/shop-orders/shop-orders'});}catch(e){this.setData({error:e.message});if(e.statusCode===401)wx.navigateTo({url:'/pages/login/login'});}finally{this.setData({busy:false});}},
 orders(){wx.navigateTo({url:'/pages/shop-orders/shop-orders'});}
}));
