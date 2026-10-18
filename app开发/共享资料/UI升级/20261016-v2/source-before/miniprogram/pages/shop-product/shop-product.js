const api=require('../../utils/api');const shop=require('../../shared/shop');const share=require('../../shared/share');
Page(share.withShare('shop-product',{
 data:{id:'',product:{},loading:true,error:'',quantity:1},
 onLoad(options){this.setData({id:options.id || ''});},onShow(){return this.reload();},
 async reload(){this.setData({loading:true,error:''});try{const data=await api.request('/shop/products',{auth:false,timeout:30000});const item=(data.products || []).find(p=>String(p.id)===String(this.data.id));if(!item)throw new Error('商品已下架或不存在');this.setData({product:shop.product(item),quantity:Math.min(this.data.quantity,Math.max(1,item.stock))});}catch(e){this.setData({product:{},error:e.message});}finally{this.setData({loading:false});}},
 quantity(e){this.setData({quantity:Math.max(1,Math.min(99,this.data.product.stock,this.data.quantity+Number(e.currentTarget.dataset.delta)))});},
 add(){try{shop.add(this.data.product,this.data.quantity);wx.showToast({title:'已加入购物袋',icon:'success'});}catch(e){wx.showToast({title:e.message,icon:'none'});}},
 buy(){try{shop.add(this.data.product,this.data.quantity);wx.navigateTo({url:'/pages/shop-checkout/shop-checkout'});}catch(e){wx.showToast({title:e.message,icon:'none'});}},
 checkout(){wx.navigateTo({url:'/pages/shop-checkout/shop-checkout'});},
 preview(){if(this.data.product.image)wx.previewImage({urls:[this.data.product.image]});}
}));
