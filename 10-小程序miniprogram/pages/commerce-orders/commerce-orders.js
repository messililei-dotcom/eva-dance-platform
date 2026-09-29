const share = require("../../shared/share");
const api = require('../../utils/api');
const labels = {pending:'待收款',paid:'已收款',partial_refunded:'部分退款',refunded:'已退款',cancelled:'已取消'};
const fulfillment = {not_started:'未开始',pending:'待开通/交付',completed:'已处理',review_required:'退款后权益处理中'};
const delivery = {awaiting_payment:'待付款',pending:'正在开通',authorized:'课程已授权，无需发货',booked:'当前期次已预约，无需发货',awaiting_shipment:'实物商品待发货',shipped:'实物商品已发货',needs_support:'请联系客服处理',refund_review:'退款权益处理中'};
Page(share.withShare("commerce-orders", {
  data:{collectionCodeUrl:'https://admin.swod.com.cn/payments/yiwa-unified-collection-v1.jpg',orders:[],loading:true,error:'',sending:false},
  onShow(){this.reload();},
  previewCollectionCode(){
    wx.previewImage({urls:[this.data.collectionCodeUrl],fail:()=>wx.showToast({title:'无法打开原图，请联系客服',icon:'none'})});
  },
  copyPaymentDetails(event){
    const order=this.data.orders.find(item=>item.id===event.currentTarget.dataset.id);
    if(!order || order.status!=='pending')return;
    wx.setClipboardData({data:`订单号：${order.id}\n应付：¥${order.amount}\n付款备注：${order.contact_name} + ${order.title}\n请将付款截图和订单号发给客服 yiwa2028 / yiwa2025 核实。已付款请勿重复支付。`});
  },
  onPullDownRefresh(){this.reload().finally(()=>wx.stopPullDownRefresh());},
  async reload(){
    this.setData({loading:true,error:''});
    try {
      const data=await api.request('/commerce');
      this.setData({orders:(data.orders || []).map(order=>({...order,amount:(order.amount_cent/100).toFixed(2),refund:(order.refunded_cent/100).toFixed(2),statusLabel:labels[order.status] || order.status,fulfillmentLabel:order.delivery_state==='refund_review' && order.fulfillment==='completed'?'退款权益已处理':delivery[order.delivery_state] || fulfillment[order.fulfillment] || order.fulfillment}))});
    } catch(error){this.setData({error:error.message || '订单加载失败'});}
    finally {this.setData({loading:false});}
  },
  async requestReschedule(event){
    if(this.data.sending)return;
    const orderId=event.currentTarget.dataset.id;
    const result=await new Promise(resolve=>wx.showModal({title:'联系客服改期',editable:true,placeholderText:'请输入希望调整的时间',success:resolve,fail:()=>resolve(null)}));
    if(!result || !result.confirm)return;
    const note=(result.content || '').trim();
    if(!note){wx.showToast({title:'请填写希望调整的时间',icon:'none'});return;}
    this.setData({sending:true});
    try {
      await api.request('/commerce',{method:'POST',data:{action:'request_reschedule',orderId,message:note}});
      wx.showToast({title:'已提交改期申请',icon:'success'});
      await this.reload();
    } catch(error){wx.showToast({title:error.message || '提交失败',icon:'none'});}
    finally{this.setData({sending:false});}
  }
}));
