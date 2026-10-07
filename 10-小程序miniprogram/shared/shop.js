const api = require('../utils/api');
const config = require('./runtime-config');
function money(fen) { return (Number(fen || 0) / 100).toFixed(2); }
function cartKey() { return `eva-shop-cart-${wx.getStorageSync('memberId') || 'guest'}`; }
function readCart() {
  const key=cartKey();
  let value = wx.getStorageSync(key);
  if(key!=='eva-shop-cart-guest') {
    const guest=wx.getStorageSync('eva-shop-cart-guest');
    if(guest && typeof guest==='object' && !Array.isArray(guest)) {
      value={...(value || {})};
      for(const [id,q] of Object.entries(guest))if(Number.isInteger(q)&&q>0&&q<=99&&id.length<=100&&Object.keys(value).length<30)value[id]=Math.min(99,Number(value[id] || 0)+q);
      wx.setStorageSync(key,value);wx.removeStorageSync('eva-shop-cart-guest');
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id,q]) => id.length<=100 && Number.isInteger(q) && q>0 && q<=99));
}
function writeCart(cart) { wx.setStorageSync(cartKey(),cart); if(wx.getStorageSync('memberId'))wx.removeStorageSync('eva-shop-cart-guest'); }
function add(product, quantity=1) {
  const cart=readCart(), next=Number(cart[product.id] || 0)+quantity;
  if(next>Math.min(99,product.stock)) throw new Error('已达到可购买数量');
  if(!cart[product.id] && Object.keys(cart).length>=30) throw new Error('一次最多购买30种商品');
  cart[product.id]=next;writeCart(cart);
}
function product(item) {
  return {...item,priceText:money(item.priceFen),image:item.image ? (/^https:\/\//.test(item.image) ? item.image : config.officialWebsiteUrl + item.image) : '',specText:[item.spec,item.size,item.color].filter(Boolean).join(' · ')};
}
const labels={pending:'待付款',paid:'待发货',shipped:'待收货',completed:'已完成',cancelled:'已取消',refund_requested:'退款审核中',refunding:'退款处理中',refunded:'已退款'};
function order(item) { return {...item,totalText:money(item.totalFen),statusText:labels[item.status] || item.status,createdText:new Date(item.createdAt).toLocaleDateString(),items:(item.items || []).map(row=>({...row,priceText:money(row.unit_fen)}))}; }
function requestKey() { return `mini-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`; }
async function pay(id) {
  const data=await api.request(`/shop/orders/${encodeURIComponent(id)}/pay`,{method:'POST',data:{},timeout:30000});
  if(data.kind!=='miniprogram') throw new Error('当前订单暂不支持小程序付款');
  const p=data.params || {};
  if(!p.timeStamp || !p.nonceStr || !/^prepay_id=/.test(p.package || '') || p.signType!=='RSA' || !p.paySign) throw new Error('支付参数无效，请稍后重试');
  let failure;
  try { await new Promise((resolve,reject)=>wx.requestPayment({timeStamp:p.timeStamp,nonceStr:p.nonceStr,package:p.package,signType:p.signType,paySign:p.paySign,success:resolve,fail:reject})); }
  catch(err) {failure=err;}
  // Only the backend payment query or signed callback can mark an order paid.
  const fresh=await api.request(`/shop/orders/${encodeURIComponent(id)}/refresh`,{method:'POST',data:{},timeout:30000}).catch(()=>null);
  if(failure && !['paid','shipped','completed'].includes(fresh?.order?.status)) {
    const error=new Error(/cancel/i.test(failure.errMsg || '')?'已取消支付，可在订单中继续付款':'支付结果待确认，请刷新订单，勿重复付款');
    error.paymentCancelled=/cancel/i.test(failure.errMsg || '');throw error;
  }
  if (!['paid','shipped','completed'].includes(fresh?.order?.status)) throw new Error('支付结果待确认，请在订单中刷新，勿重复付款');
  return fresh;
}
module.exports={money,readCart,writeCart,add,product,order,requestKey,pay};
