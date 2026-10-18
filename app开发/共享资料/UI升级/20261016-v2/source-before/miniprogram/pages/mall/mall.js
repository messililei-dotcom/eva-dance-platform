const api=require('../../utils/api');
const shop=require('../../shared/shop');
const share=require('../../shared/share');
Page(share.withShare('mall',{
 data:{loading:true,error:'',products:[],visibleProducts:[],categories:['全部'],category:'全部',keyword:'',productCount:0,cartCount:0},
 onShow(){return this.reload();},
 onPullDownRefresh(){return this.reload().finally(()=>wx.stopPullDownRefresh());},
 async reload(){this.setData({loading:true,error:''});try{const data=await api.request('/shop/products',{auth:false,timeout:30000});const products=(data.products || []).map(shop.product);this.setData({products,categories:['全部',...new Set(products.map(p=>p.category).filter(Boolean))],cartCount:Object.values(shop.readCart()).reduce((a,b)=>a+b,0)});this.filter();}catch(e){this.setData({error:e.message});}finally{this.setData({loading:false});}},
 search(e){this.setData({keyword:e.detail.value});this.filter();},
 category(e){this.setData({category:e.currentTarget.dataset.value});this.filter();},
 filter(){const q=this.data.keyword.trim().toLowerCase();const visibleProducts=this.data.products.filter(p=>(this.data.category==='全部'||p.category===this.data.category)&&`${p.name} ${p.specText}`.toLowerCase().includes(q));this.setData({visibleProducts,productCount:visibleProducts.length});},
 openProduct(e){wx.navigateTo({url:'/pages/shop-product/shop-product?id='+encodeURIComponent(e.currentTarget.dataset.id)});},
 checkout(){wx.navigateTo({url:'/pages/shop-checkout/shop-checkout'});},
 orders(){wx.navigateTo({url:'/pages/shop-orders/shop-orders'});}
}));
