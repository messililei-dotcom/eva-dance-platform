import {randomBytes,createHash} from 'node:crypto';
import type {AdminDb} from './admin-db';
import {ShopError,ensureShop,courseOffer,createCourseOrder,createOrder,orderById,publicOrder,audit} from './shop-core';
type Row=Record<string,any>;
export const OFFICIAL_ORIGIN='https://www.swod.com.cn';
export function ensureExclusive(db:AdminDb){ensureShop(db);db.exec(`
 CREATE TABLE IF NOT EXISTS exclusive_orders(
 id TEXT PRIMARY KEY, number TEXT NOT NULL UNIQUE, token TEXT NOT NULL UNIQUE, kind TEXT NOT NULL,target_id TEXT NOT NULL,snapshot TEXT NOT NULL,
 customer_id INTEGER NOT NULL DEFAULT 0,customer_name TEXT NOT NULL DEFAULT '',customer_phone TEXT NOT NULL DEFAULT '',
 creator_id INTEGER NOT NULL,creator_name TEXT NOT NULL,advisor_id INTEGER NOT NULL,advisor_name TEXT NOT NULL,
 quantity INTEGER NOT NULL,original_fen INTEGER NOT NULL,unit_fen INTEGER NOT NULL,discount_fen INTEGER NOT NULL,shipping_fen INTEGER NOT NULL,total_fen INTEGER NOT NULL,
 customer_note TEXT NOT NULL DEFAULT '',internal_note TEXT NOT NULL DEFAULT '',shipping TEXT NOT NULL DEFAULT '{}',access_expires TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'draft',expires_at INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,first_opened_at INTEGER NOT NULL DEFAULT 0,share_count INTEGER NOT NULL DEFAULT 0,
 bound_member_id INTEGER NOT NULL DEFAULT 0,payment_order_id TEXT NOT NULL DEFAULT '',paid_at INTEGER NOT NULL DEFAULT 0,source TEXT NOT NULL DEFAULT 'advisor',request_key TEXT NOT NULL,request_hash TEXT NOT NULL DEFAULT '',
 UNIQUE(creator_id,request_key));
 CREATE TABLE IF NOT EXISTS exclusive_claims(exclusive_id TEXT NOT NULL,member_id INTEGER NOT NULL,payment_order_id TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(exclusive_id,member_id));
 CREATE TABLE IF NOT EXISTS exclusive_audit(id INTEGER PRIMARY KEY,exclusive_id TEXT NOT NULL,action TEXT NOT NULL,actor TEXT NOT NULL,detail TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS exclusive_refunds(id TEXT PRIMARY KEY,exclusive_id TEXT NOT NULL,order_id TEXT NOT NULL,amount_fen INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',reason TEXT NOT NULL,actor TEXT NOT NULL,created_at INTEGER NOT NULL,settled_at INTEGER NOT NULL DEFAULT 0);
 CREATE UNIQUE INDEX IF NOT EXISTS exclusive_refund_pending ON exclusive_refunds(order_id) WHERE status='pending';
 `);}
export function exclusiveAudit(db:AdminDb,id:string,action:string,actor:string,detail=''){db.prepare('INSERT INTO exclusive_audit(exclusive_id,action,actor,detail,created_at) VALUES(?,?,?,?,?)').run(id,action,actor,detail,Date.now());}
function text(v:any,max=200){return String(v??'').replace(/[<>]/g,'').trim().slice(0,max);}
export function cents(v:any,label:string){if(!Number.isSafeInteger(v)||v<0||v>100000000)throw new ShopError(label+'无效');return v as number;}
export function normalizedPhone(v:any){return String(v||'').replace(/[\s()-]/g,'').replace(/^\+86/,'');}
export function exclusiveActor(db:AdminDb,identity:{id?:number;username?:string}|null){
 if(!identity?.username)throw new ShopError('请登录管理账号',401);
 const u=db.prepare('SELECT id,username,name,role,status,permPaymentCreate,permPaymentView FROM User WHERE username=? AND id=?').get<Row>(identity.username,identity.id);
 if(!u||u.status!=='active')throw new ShopError('管理账号不可用',403);
 const privileged=u.role==='admin'||u.username==='lilei';return {...u,privileged,name:u.name||u.username,canCreate:privileged||!!u.permPaymentCreate,canView:privileged||!!u.permPaymentView};
}
export function catalogItem(db:AdminDb,kind:string,id:any){
 if(kind==='online'||kind==='offline')return courseOffer(db,kind,id);
 if(kind!=='goods')throw new ShopError('请选择订单品类');
 const p=db.prepare("SELECT id,name,spec,size,color,sale_price,stock,status,is_hidden,category FROM shop_products WHERE id=? AND status='在售' AND is_hidden=0").get<Row>(String(id));
 if(!p)throw new ShopError('商品已隐藏或下架',409);
 return {kind,id:p.id,name:p.name,priceFen:Math.round(p.sale_price*100),spec:[p.spec,p.color,p.size].filter(Boolean).join(' / '),stock:p.stock,period:'',image:`${OFFICIAL_ORIGIN}/api/shop/images/${encodeURIComponent(p.id)}`};
}
export function createExclusive(db:AdminDb,actor:Row,input:Row){
 if(!actor.canCreate)throw new ShopError('没有新建订单权限',403);
 const key=text(input.requestKey,80);if(!key)throw new ShopError('缺少提交标识');
 return db.transaction(()=>{
 db.prepare('UPDATE exclusive_orders SET share_count=share_count WHERE id=?').run('');
 const fingerprint=createHash('sha256').update(JSON.stringify({...input,requestKey:undefined})).digest('hex');
 const prior=db.prepare('SELECT * FROM exclusive_orders WHERE creator_id=? AND request_key=?').get<Row>(actor.id,key);if(prior){if(prior.request_hash!==fingerprint)throw new ShopError('开单内容已变化，请重新提交',409);return prior;}
 const p=catalogItem(db,input.kind,input.targetId);const quantity=Number(input.quantity||1);
 if(!Number.isSafeInteger(quantity)||quantity<1||quantity>99||(p.kind!=='goods'&&quantity!==1))throw new ShopError('课程按一位学员一份权益开单，商品数量为 1–99 件');
 const unit=cents(input.unitFen,'成交单价'),discount=cents(input.discountFen||0,'优惠金额'),shipping=cents(input.shippingFen||0,'运费');
 if(p.kind!=='goods'&&shipping)throw new ShopError('课程不收取运费');
 const total=unit*quantity-discount+shipping;if(discount>unit*quantity)throw new ShopError('优惠不能超过成交金额');if(!Number.isSafeInteger(total)||total<=0||total>100000000)throw new ShopError('应付金额须大于零，且优惠不可超出商品金额');
 const advisorId=Number(input.advisorId||actor.id);if(advisorId!==actor.id&&!actor.privileged)throw new ShopError('仅有管理员权限的账号可更换顾问',403);
 const advisor=db.prepare("SELECT id,name,username FROM User WHERE id=? AND status='active'").get<Row>(advisorId);if(!advisor)throw new ShopError('顾问账号不可用');
 const memberId=Number(input.customerId||0);let customer:any=null;
 if(memberId){customer=db.prepare('SELECT id,name,phone FROM Member WHERE id=?').get<Row>(memberId);if(!customer)throw new ShopError('学员不存在');}
 const phone=normalizedPhone(customer?.phone||input.customerPhone);if(phone&&!/^\+?\d{7,15}$/.test(phone))throw new ShopError('客户手机号格式错误');
 const expires=Number(input.expiresAt||0);if(!Number.isSafeInteger(expires)||expires<0||(expires>0&&expires<=Date.now()+120000))throw new ShopError('订单有效期至少应为两分钟后');
 const access=text(input.accessExpires,19);const accessTime=Date.parse(access.replace(' ','T')+(access.length===10?'T23:59:59':'')+'+08:00');if(access&&(!Number.isFinite(accessTime)||!/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/.test(access)||Date.parse(access.replace(' ','T')+(access.length===10?'T23:59:59':'')+'+08:00')<=Date.now()))throw new ShopError('课程权益有效期无效');
 const id=randomBytes(16).toString('hex'),token=randomBytes(32).toString('base64url'),now=Date.now();
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(now).replace(/-/g,'');
 const number='SW'+day+randomBytes(4).toString('hex').toUpperCase();
 const address=input.shipping||{};
 db.prepare(`INSERT INTO exclusive_orders(id,number,token,kind,target_id,snapshot,customer_id,customer_name,customer_phone,creator_id,creator_name,advisor_id,advisor_name,quantity,original_fen,unit_fen,discount_fen,shipping_fen,total_fen,customer_note,internal_note,shipping,access_expires,status,expires_at,created_at,request_key) VALUES(${Array(27).fill('?').join(',')})`).run(id,number,token,p.kind,String(p.id),JSON.stringify(p),memberId,text(customer?.name||input.customerName,80),phone,actor.id,actor.name,advisor.id,advisor.name||advisor.username,quantity,p.priceFen*quantity,unit,discount,shipping,total,text(input.customerNote,1000),text(input.internalNote,2000),JSON.stringify({recipient:text(address.recipient,40),phone:text(address.phone,25),address:text(address.address,300)}),access.length===10?access+' 23:59:59':access,input.publish?'pending':'draft',expires,now,key);
 db.prepare('UPDATE exclusive_orders SET request_hash=? WHERE id=?').run(fingerprint,id);
 exclusiveAudit(db,id,input.publish?'published':'draft_created',String(actor.id));return db.prepare('SELECT * FROM exclusive_orders WHERE id=?').get<Row>(id)!;
 })();
}
export function findExclusive(db:AdminDb,token:string){if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new ShopError('订单不存在',404);const o=db.prepare('SELECT * FROM exclusive_orders WHERE token=?').get<Row>(token);if(!o||o.status==='draft')throw new ShopError('订单不存在或尚未发布',404);return o;}
export function exclusiveStatus(db:AdminDb,o:Row){
 const payment=o.payment_order_id?db.prepare('SELECT * FROM shop_online_orders WHERE id=?').get<Row>(o.payment_order_id):null;
 const refunded=db.prepare("SELECT COALESCE(SUM(amount_fen),0) n FROM exclusive_refunds WHERE exclusive_id=? AND order_id=? AND status='success'").get<{n:number}>(o.id,o.payment_order_id || '')!.n;
 const refunding=db.prepare("SELECT id FROM exclusive_refunds WHERE exclusive_id=? AND order_id=? AND status='pending'").get(o.id,o.payment_order_id || '');
 const paid=!!payment?.transaction_id;
 let status=o.status;
 if(paid)status=refunding?'refunding':refunded>=o.total_fen||payment.status==='refunded'?'refunded':refunded>0?'partially_refunded':payment.status==='completed'?'completed':'paid';
 else if(o.status==='pending'&&o.expires_at&&o.expires_at<=Date.now())status='expired';
 return {status,payment,paid,refundedFen:refunded};
}
export function publicExclusive(db:AdminDb,o:Row){const state=exclusiveStatus(db,o),p=JSON.parse(o.snapshot);return{number:o.number,kind:o.kind,title:p.name,spec:p.spec||p.period||'',period:p.period||'',description:p.description||'',image:p.image||'',quantity:o.quantity,originalFen:o.original_fen,unitFen:o.unit_fen,discountFen:o.discount_fen,shippingFen:o.shipping_fen,totalFen:o.total_fen,advisor:o.advisor_name,customerNote:o.customer_note,expiresAt:o.expires_at,accessExpires:o.access_expires,status:state.status,refundedFen:state.refundedFen,company:'伊娃文化艺术发展（湖南）有限公司'};}
export function adminExclusive(db:AdminDb,o:Row){return {...o,token:undefined,...publicExclusive(db,o),shareUrl:`${OFFICIAL_ORIGIN}/o/${o.token}`,cardUrl:`${OFFICIAL_ORIGIN}/api/exclusive/${o.token}/card`,qrUrl:`${OFFICIAL_ORIGIN}/api/exclusive/${o.token}/qr`,shipping:JSON.parse(o.shipping)};}
export function claimExclusive(db:AdminDb,o:Row,memberId:number,input:Row){
 if(input.confirmed!==true)throw new ShopError('请先确认课程、期次或商品信息');
 return db.transaction(()=>{
 db.prepare('UPDATE exclusive_orders SET share_count=share_count WHERE id=?').run(o.id);o=db.prepare('SELECT * FROM exclusive_orders WHERE id=?').get<Row>(o.id)!;
 const claim=db.prepare('SELECT payment_order_id FROM exclusive_claims WHERE exclusive_id=? AND member_id=?').get<Row>(o.id,memberId);
 const state=exclusiveStatus(db,{...o,payment_order_id:claim?.payment_order_id || '',bound_member_id:memberId});
 if(state.paid){return publicOrder(db,state.payment as any);}
 if(state.status!=='pending')throw new ShopError('专属订单已失效或取消，请联系课程顾问',409);
 const m=db.prepare('SELECT id,name,phone FROM Member WHERE id=?').get<Row>(memberId);if(!m||!normalizedPhone(m.phone))throw new ShopError('请先验证手机号后确认订单',401);
 if((o.customer_id&&o.customer_id!==memberId)||(o.customer_phone&&normalizedPhone(m.phone)!==o.customer_phone))throw new ShopError('该专属订单不属于当前登录客户，请使用指定手机号登录',403);
 if(input.totalFen!==o.total_fen)throw new ShopError('订单金额已变化，请刷新后重新确认',409);
 if(state.payment?.status==='pending'){
  if(state.payment.expires_at<=Date.now())throw new ShopError('付款交易已到期，请先刷新订单状态后重试',409);
  if(state.payment.provider!==input.provider)throw new ShopError('已创建付款交易，请使用原支付方式或先取消付款交易',409);
  return publicOrder(db,state.payment as any);
 }
 if(o.access_expires&&Date.parse(o.access_expires.replace(' ','T')+'+08:00')<=Date.now())throw new ShopError('课程权益有效期已过，请联系顾问重新开单',409);
 const p=catalogItem(db,o.kind,o.target_id);let order;
 if(o.kind==='goods')order=createOrder(db,memberId,{...(input.shipping||JSON.parse(o.shipping)),provider:input.provider,requestKey:'exclusive-'+randomBytes(16).toString('hex'),items:[{id:o.target_id,quantity:o.quantity}]});
 else order=createCourseOrder(db,memberId,{kind:o.kind,targetId:o.target_id,provider:input.provider,expectedTotalFen:p.priceFen,requestKey:'exclusive-'+randomBytes(16).toString('hex')});
 const due=o.expires_at?Math.min(order.expires_at,o.expires_at):order.expires_at;
 if(due<=Date.now()+65000)throw new ShopError('专属订单即将到期，请联系顾问重新开单',409);
 db.prepare('UPDATE shop_online_orders SET total_fen=?,expires_at=? WHERE id=?').run(o.total_fen,due,order.id);
 db.prepare('UPDATE shop_online_items SET unit_fen=? WHERE order_id=?').run(o.unit_fen,order.id);
 db.prepare('INSERT INTO shop_order_advisors(order_id,exclusive_id,advisor_id,advisor_name,creator_id,access_expires,net_fen) VALUES(?,?,?,?,?,?,?)').run(order.id,o.id,o.advisor_id,o.advisor_name,o.creator_id,o.access_expires,o.total_fen);
 db.prepare('INSERT INTO exclusive_claims(exclusive_id,member_id,payment_order_id,created_at) VALUES(?,?,?,?) ON CONFLICT(exclusive_id,member_id) DO UPDATE SET payment_order_id=excluded.payment_order_id').run(o.id,memberId,order.id,Date.now());
 exclusiveAudit(db,o.id,'customer_confirmed',String(memberId),order.id);audit(db,order.id,'advisor_order',String(o.creator_id),o.number);
 return publicOrder(db,orderById(db,order.id));
 })();
}
