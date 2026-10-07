import {createHash} from 'node:crypto';
import {ShopError,orderById,validateCourseRefund} from './shop-core';
import type {AdminDb} from './admin-db';
import {ensureExclusive,exclusiveAudit,cents} from './exclusive-orders';
import {shopDb} from './shop-service';
import {refundPayment,queryRefund,shopConfig} from './shop-payments';
type Row=Record<string,any>;
export function prepareExclusiveRefund(db:AdminDb,orderId:string,amountFen:number,reason:string,actor:string,requestKey:string,returned=false){
 if(!requestKey||requestKey.length>80)throw new ShopError('缺少退款提交标识');
 cents(amountFen,'退款金额');if(!amountFen||!reason.trim())throw new ShopError('请填写退款金额及原因');
 return db.transaction(()=>{
 db.prepare('UPDATE shop_online_orders SET updated_at=updated_at WHERE id=?').run(orderId);
 const o=orderById(db,orderId),link=db.prepare('SELECT * FROM shop_order_advisors WHERE order_id=?').get<Row>(orderId);if(!link)throw new ShopError('专属客户订单不存在',404);
 const id='RX'+createHash('sha256').update(orderId+':'+requestKey).digest('hex').slice(0,28);
 const existing=db.prepare('SELECT * FROM exclusive_refunds WHERE id=?').get<Row>(id);if(existing){if(existing.amount_fen!==amountFen)throw new ShopError('退款内容已变化',409);return existing;}
 if(!o.transaction_id||!['paid','shipped','completed','refund_requested'].includes(o.status))throw new ShopError('当前客户订单不可退款',409);
 const pending=db.prepare("SELECT id FROM exclusive_refunds WHERE order_id=? AND status='pending'").get(orderId);if(pending)throw new ShopError('该客户订单已有退款处理中，请稍后刷新',409);
 const refunded=db.prepare("SELECT COALESCE(SUM(amount_fen),0) n FROM exclusive_refunds WHERE order_id=? AND status='success'").get<{n:number}>(orderId)!.n;
 if(amountFen>o.total_fen-refunded)throw new ShopError('退款金额超过剩余可退金额',409);
 if(amountFen===o.total_fen-refunded){if(o.shipped_at&&!returned)throw new ShopError('全额退款前请确认商品已退回');validateCourseRefund(db,orderId);db.prepare("UPDATE shop_online_orders SET status='refund_requested',refund_reason=?,updated_at=? WHERE id=?").run(reason.slice(0,300),Date.now(),orderId);}
 db.prepare("INSERT INTO exclusive_refunds(id,exclusive_id,order_id,amount_fen,reason,actor,created_at) VALUES(?,?,?,?,?,?,?)").run(id,link.exclusive_id,orderId,amountFen,reason.slice(0,1000),actor,Date.now());
 exclusiveAudit(db,link.exclusive_id,'refund_requested',actor,JSON.stringify({orderId,amountFen,id}));return db.prepare('SELECT * FROM exclusive_refunds WHERE id=?').get<Row>(id)!;
 })();
}
export function settleExclusiveRefund(db:AdminDb,id:string){db.transaction(()=>{
 const r=db.prepare('SELECT * FROM exclusive_refunds WHERE id=?').get<Row>(id);if(!r||r.status!=='pending')return;
 db.prepare("UPDATE exclusive_refunds SET status='success',settled_at=? WHERE id=?").run(Date.now(),id);
 const o=orderById(db,r.order_id),link=db.prepare('SELECT * FROM shop_order_advisors WHERE order_id=?').get<Row>(o.id)!;
 const total=db.prepare("SELECT SUM(amount_fen) n FROM exclusive_refunds WHERE order_id=? AND status='success'").get<{n:number}>(o.id)!.n;
 const remaining=o.total_fen-total,full=remaining===0,c=db.prepare('SELECT * FROM shop_course_orders WHERE order_id=?').get<Row>(o.id);
 if(c){
  if(c.kind==='online'){
   db.prepare('UPDATE CourseOrder SET amount=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(remaining/100,full?'refunded':'paid',c.receipt_id);
   if(full)db.prepare("UPDATE CourseAuthorization SET status='revoked',revoked_at=CURRENT_TIMESTAMP WHERE order_id=? AND type='purchase'").run(c.receipt_id);
  }else{
   db.prepare('UPDATE Payment SET amount=?,paymentStatus=? WHERE id=?').run(remaining/100,full?'refunded':'paid',c.receipt_id);
   if(full){db.prepare('UPDATE Payment SET remainingSessions=0 WHERE id=?').run(c.receipt_id);db.prepare("UPDATE OfflineEnrollment SET status='refunded' WHERE payment_id=?").run(c.receipt_id);db.prepare("UPDATE OfflineEntitlement SET available_sessions=0,status='refunded' WHERE payment_id=?").run(c.receipt_id);
    if(c.reserved){db.prepare('UPDATE Course SET remaining=remaining+1 WHERE id=?').run(c.target_id);db.prepare('UPDATE shop_course_orders SET reserved=0 WHERE order_id=?').run(o.id);}
   }
  }
  db.prepare('UPDATE orders SET amount=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE order_no=?').run(remaining/100,full?'refunded':'paid',o.id);
 }else{
  const item=db.prepare('SELECT * FROM shop_online_items WHERE order_id=?').get<Row>(o.id)!;
  db.prepare("INSERT INTO shop_sales(product_id,product_name,quantity,unit_price,total_amount,member_id,member_name,remark,sale_type,channel,customer_phone,operator) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(item.product_id,item.name,0,0,-r.amount_fen/100,o.member_id,o.recipient,`专属订单退款 ${o.id} ${id}`,'退款','官网',o.phone,link.advisor_name);
  if(full){const p=db.prepare('SELECT stock FROM shop_products WHERE id=?').get<Row>(item.product_id);if(!p)throw new ShopError('商品记录缺失，请人工核对退款入库',409);
   db.prepare('UPDATE shop_products SET stock=stock+? WHERE id=?').run(item.quantity,item.product_id);
   db.prepare("INSERT INTO shop_stock_logs(product_id,product_name,change_type,quantity,before_stock,after_stock,operator,remark,channel) VALUES(?,?,'入库',?,?,?,?,?,?)").run(item.product_id,item.name,item.quantity,p.stock,p.stock+item.quantity,r.actor,`专属订单退款 ${o.id}`,'官网');
  }
 }
 if(full)db.prepare("UPDATE shop_online_orders SET status='refunded',updated_at=? WHERE id=?").run(Date.now(),o.id);
 else if(o.status==='refund_requested')db.prepare('UPDATE shop_online_orders SET status=?,updated_at=? WHERE id=?').run(c?'completed':o.shipped_at?'shipped':'paid',Date.now(),o.id);
 exclusiveAudit(db,r.exclusive_id,full?'refunded':'partially_refunded',r.actor,JSON.stringify({orderId:o.id,amountFen:r.amount_fen}));
 })();}
export async function reconcileExclusiveRefund(id:string){
 const r=shopDb(db=>{ensureExclusive(db);return db.prepare('SELECT * FROM exclusive_refunds WHERE id=?').get<Row>(id)});if(!r||r.status!=='pending')return;
 const order=shopDb(db=>orderById(db,r.order_id)),refund={id:r.id,amountFen:r.amount_fen};let done=false;
 try{done=await queryRefund(order,shopConfig(),refund)}catch{done=await refundPayment(order,shopConfig(),refund)}
 if(done)shopDb(db=>settleExclusiveRefund(db,id));
}
