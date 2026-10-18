import { getCoursePromotion, courseSalePrice } from './course-promotion';
import {ensureEventOnline,eventPaymentOffer,settleEventPayment} from "./event-online";
import { randomBytes, createHash } from "node:crypto";
import type { AdminDb } from "./admin-db";

export class ShopError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export type ShopOrder = {
  id: string;
  member_id: number;
  request_key: string;
  request_hash: string;
  provider: "wechat" | "alipay";
  payment_app_id?: string;
  status: string;
  total_fen: number;
  recipient: string;
  phone: string;
  address: string;
  delivery_method?: "express" | "pickup";
  created_at: number;
  expires_at: number;
  payment_attempted: number;
  pay_lock_until: number;
  transaction_id: string;
  carrier: string;
  tracking_no: string;
  refund_reason: string;
  shipped_at: number;
  refund_restock: number;
  updated_at: number;
};
export type ShopItem = {
  product_id: string;
  name: string;
  spec: string;
  quantity: number;
  unit_fen: number;
};
export function ensureShop(db: AdminDb) {
  ensureEventOnline(db);
  db.exec(`PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS shop_online_orders (
      id TEXT PRIMARY KEY, member_id INTEGER NOT NULL, request_key TEXT NOT NULL,
      request_hash TEXT NOT NULL, provider TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      total_fen INTEGER NOT NULL CHECK(total_fen>0), recipient TEXT NOT NULL,
      phone TEXT NOT NULL, address TEXT NOT NULL, created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      payment_attempted INTEGER NOT NULL DEFAULT 0, pay_lock_until INTEGER NOT NULL DEFAULT 0,
      transaction_id TEXT NOT NULL DEFAULT '', carrier TEXT NOT NULL DEFAULT '',
      tracking_no TEXT NOT NULL DEFAULT '', refund_reason TEXT NOT NULL DEFAULT '',
      shipped_at INTEGER NOT NULL DEFAULT 0, refund_restock INTEGER NOT NULL DEFAULT 0,
      UNIQUE(member_id, request_key)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_online_transaction ON shop_online_orders(provider,transaction_id) WHERE transaction_id<>'';
    CREATE INDEX IF NOT EXISTS idx_shop_online_member ON shop_online_orders(member_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_shop_online_pending ON shop_online_orders(status,expires_at);
    CREATE TABLE IF NOT EXISTS shop_online_items (
      order_id TEXT NOT NULL, product_id TEXT NOT NULL, name TEXT NOT NULL,
      spec TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity>0), unit_fen INTEGER NOT NULL,
      PRIMARY KEY(order_id,product_id)
    );
    CREATE TABLE IF NOT EXISTS shop_course_orders (order_id TEXT PRIMARY KEY,kind TEXT NOT NULL,target_id INTEGER NOT NULL,snapshot TEXT NOT NULL,reserved INTEGER NOT NULL DEFAULT 0,receipt_id INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS shop_order_advisors (order_id TEXT PRIMARY KEY, exclusive_id TEXT NOT NULL,advisor_id INTEGER NOT NULL,advisor_name TEXT NOT NULL,creator_id INTEGER NOT NULL,access_expires TEXT NOT NULL DEFAULT '',net_fen INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS shop_online_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, action TEXT NOT NULL,
      actor TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL
    );`);
  const productColumns = db.prepare('PRAGMA table_info(shop_products)').all<{name:string}>();
  if (productColumns.length && !productColumns.some(column => column.name === 'is_hidden')) db.exec('ALTER TABLE shop_products ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0');
  const columns = db.prepare('PRAGMA table_info(shop_online_orders)').all<{name:string}>();
  if (!columns.some(column=>column.name==='payment_app_id')) db.exec("ALTER TABLE shop_online_orders ADD COLUMN payment_app_id TEXT NOT NULL DEFAULT ''");

  if (!columns.some(column=>column.name==='delivery_method')) db.exec("ALTER TABLE shop_online_orders ADD COLUMN delivery_method TEXT NOT NULL DEFAULT 'express'");
}
export function audit(
  db: AdminDb,
  id: string,
  action: string,
  actor: string,
  detail = "",
) {
  db.prepare(
    "INSERT INTO shop_online_audit(order_id,action,actor,detail,created_at) VALUES(?,?,?,?,?)",
  ).run(id, action, actor, detail, Date.now());
}
export function moneyFen(value: unknown) {
  const n = Number(value);
  const fen = Math.round(n * 100);
  if (
    !Number.isFinite(n) ||
    !Number.isSafeInteger(fen) ||
    fen <= 0 ||
    fen > 100000000
  )
    throw new ShopError("商品价格无效，请联系客服");
  return fen;
}
export function orderById(db: AdminDb, id: string, memberId?: number) {
  const order = db
    .prepare("SELECT * FROM shop_online_orders WHERE id=?")
    .get<ShopOrder>(id);
  if (!order || (memberId !== undefined && order.member_id !== memberId))
    throw new ShopError("订单不存在", 404);
  return order;
}
export function orderItems(db: AdminDb, id: string) {
  return db
    .prepare(
      "SELECT product_id,name,spec,quantity,unit_fen FROM shop_online_items WHERE order_id=?",
    )
    .all<ShopItem>(id);
}
export function publicOrder(db: AdminDb, order: ShopOrder) {
  const link=db.prepare('SELECT exclusive_id FROM shop_order_advisors WHERE order_id=?').get<{exclusive_id:string}>(order.id);
  const offer=link?db.prepare('SELECT number,discount_fen,shipping_fen FROM exclusive_orders WHERE id=?').get<{number:string;discount_fen:number;shipping_fen:number}>(link.exclusive_id):null;
  const refunded=link?db.prepare("SELECT COALESCE(SUM(amount_fen),0) n FROM exclusive_refunds WHERE order_id=? AND status='success'").get<{n:number}>(order.id)!.n:0;
  return {
    exclusive:offer?{number:offer.number,discountFen:offer.discount_fen,shippingFen:offer.shipping_fen,refundedFen:refunded}:null,
    kind: courseOrder(db,order.id)?.kind || "goods",
    targetId: courseOrder(db,order.id)?.target_id || null,
    id: order.id,
    provider: order.provider,
    status: order.status,
    totalFen: order.total_fen,
    recipient: order.recipient,
    phone: order.phone,
    address: order.address,
    deliveryMethod: order.delivery_method || "express",
    createdAt: order.created_at,
    expiresAt: order.expires_at,
    carrier: order.carrier,
    trackingNo: order.tracking_no,
    refundReason: order.refund_reason,
    items: orderItems(db, order.id),
  };
}
function field(value: unknown, max: number, label: string) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new ShopError(`请填写正确的${label}`);
  return value.trim();
}
export function createOrder(db: AdminDb, memberId: number, body: any) {
  const recipient = field(body.recipient, 40, "收件人");
  const phone = field(body.phone, 25, "手机号");
  if (!/^\+?[\d -]{7,25}$/.test(phone))
    throw new ShopError("请填写正确的手机号");
  const deliveryMethod = body.deliveryMethod ?? "express";
  if (!["express", "pickup"].includes(deliveryMethod)) throw new ShopError("请选择配送方式");
  const address = deliveryMethod === "pickup" ? "" : field(body.address, 300, "完整收货地址");
  if (deliveryMethod === "express" && address.length < 8) throw new ShopError("请填写省、市、区及街道门牌号");
  const key = field(body.requestKey, 80, "下单标识");
  if (!["wechat", "alipay"].includes(body.provider))
    throw new ShopError("请选择支付方式");
  if (
    !Array.isArray(body.items) ||
    !body.items.length ||
    body.items.length > 30
  )
    throw new ShopError("请选择 1 至 30 种商品");
  const items = body.items
    .map((item: any) => {
      const id = field(item?.id, 100, "商品编号");
      if (
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 99
      )
        throw new ShopError("购买数量应为 1 至 99 件");
      return { id, quantity: item.quantity as number };
    })
    .sort((a: any, b: any) => a.id.localeCompare(b.id));
  if (new Set(items.map((item: any) => item.id)).size !== items.length)
    throw new ShopError("商品重复");
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        recipient,
        phone,
        address,
        ...(deliveryMethod === "pickup" ? {deliveryMethod} : {}),
        items,
        provider: body.provider,
      }),
    )
    .digest("hex");
  return db.transaction(() => {
    // Acquire the write lock before reading price/stock (also serializes retries).
    db.prepare(
      "UPDATE shop_online_orders SET updated_at=updated_at WHERE id=?",
    ).run("");
    const existing = db
      .prepare(
        "SELECT * FROM shop_online_orders WHERE member_id=? AND request_key=?",
      )
      .get<ShopOrder>(memberId, key);
    if (existing) {
      if (existing.request_hash !== hash)
        throw new ShopError("下单内容已变化，请重新提交", 409);
      return existing;
    }
    if (!db.prepare("SELECT id FROM Member WHERE id=?").get(memberId))
      throw new ShopError("请重新登录", 401);
    const count =
      db
        .prepare(
          "SELECT count(*) n FROM shop_online_orders WHERE member_id=? AND status='pending'",
        )
        .get<{ n: number }>(memberId)?.n || 0;
    if (count >= 5) throw new ShopError("请先支付或取消未付款订单", 429);
    const recent =
      db
        .prepare(
          "SELECT count(*) n FROM shop_online_orders WHERE member_id=? AND created_at>?",
        )
        .get<{ n: number }>(memberId, Date.now() - 3600000)?.n || 0;
    if (recent >= 20) throw new ShopError("下单过于频繁，请稍后再试", 429);
    const id = `EV${randomBytes(15).toString("hex")}`;
    let total = 0;
    const now = Date.now();
    for (const item of items) {
      const product = db
        .prepare(
          "SELECT id,name,spec,size,color,sale_price,stock FROM shop_products WHERE id=? AND status='在售' AND is_hidden=0",
        )
        .get(item.id);
      if (!product) throw new ShopError("商品已下架，请刷新购物车", 409);
      const unit = moneyFen(product.sale_price);
      const changed = db
        .prepare(
          "UPDATE shop_products SET stock=stock-?,updated_at=? WHERE id=? AND status='在售' AND is_hidden=0 AND stock>=?",
        )
        .run(
          item.quantity,
          new Date(now).toISOString(),
          item.id,
          item.quantity,
        );
      if (changed.changes !== 1)
        throw new ShopError(`${product.name}库存不足`, 409);
      total += unit * item.quantity;
      db.prepare("INSERT INTO shop_online_items VALUES(?,?,?,?,?,?)").run(
        id,
        item.id,
        product.name,
        [product.spec, product.size, product.color].filter(Boolean).join(" / "),
        item.quantity,
        unit,
      );
      stockLog(
        db,
        item.id,
        product.name,
        "官网锁库出库",
        -item.quantity,
        Number(product.stock),
        id,
      );
    }
    if (body.expectedTotalFen !== undefined && body.expectedTotalFen !== total)
      throw new ShopError("商品价格已更新，请刷新购物袋后重新确认金额", 409);
    if (!Number.isSafeInteger(total) || total > 100000000)
      throw new ShopError("订单金额过大，请分单购买");
    db.prepare(
      `INSERT INTO shop_online_orders(id,member_id,request_key,request_hash,provider,total_fen,recipient,phone,address,created_at,expires_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      memberId,
      key,
      hash,
      body.provider,
      total,
      recipient,
      phone,
      address,
      now,
      now + 15 * 60000,
      now,
    );
    db.prepare("UPDATE shop_online_orders SET delivery_method=? WHERE id=?").run(deliveryMethod,id);
    audit(db, id, "created", `member:${memberId}`);
    return orderById(db, id);
  })();
}
function stockLog(
  db: AdminDb,
  productId: string,
  name: string,
  type: string,
  delta: number,
  before: number,
  orderId: string,
) {
  db.prepare(
    `INSERT INTO shop_stock_logs(product_id,product_name,change_type,quantity,before_stock,after_stock,operator,remark,channel) VALUES(?,?,?,?,?,?,?,?,?)`,
  ).run(
    productId,
    name,
    delta < 0 ? "出库" : "入库",
    Math.abs(delta),
    before,
    before + delta,
    "官网商城",
    `${type} · ${orderId}`,
    "官网",
  );
}
function restoreStock(db: AdminDb, id: string) {
  if(courseOrder(db,id)){releaseCourseSeat(db,id);return;}
  for (const item of orderItems(db, id)) {
    const product = db
      .prepare("SELECT stock FROM shop_products WHERE id=?")
      .get<{ stock: number }>(item.product_id);
    if (!product) throw new ShopError("商品库存记录缺失，需要人工处理", 409);
    db.prepare(
      "UPDATE shop_products SET stock=stock+?,updated_at=? WHERE id=?",
    ).run(item.quantity, new Date().toISOString(), item.product_id);
    stockLog(
      db,
      item.product_id,
      item.name,
      "官网释放入库",
      item.quantity,
      Number(product.stock),
      id,
    );
  }
}
// Only call after the gateway confirms CLOSED, or an order was never sent to a gateway.
export function cancelConfirmed(db: AdminDb, id: string) {
  db.transaction(() => {
    const changed = db
      .prepare(
        "UPDATE shop_online_orders SET status='cancelled',updated_at=? WHERE id=? AND status='pending'",
      )
      .run(Date.now(), id);
    if (!changed.changes) return;
    restoreStock(db, id);
    audit(db, id, "cancelled", "gateway");
  })();
}
export function settlePaid(
  db: AdminDb,
  id: string,
  provider: string,
  transactionId: string,
  amountFen: number,
) {
  db.transaction(() => {
    db.prepare(
      "UPDATE shop_online_orders SET updated_at=updated_at WHERE id=?",
    ).run(id);
    const order = orderById(db, id);
    if (
      provider !== order.provider ||
      amountFen !== order.total_fen ||
      !transactionId
    )
      throw new ShopError("支付金额或渠道不匹配", 409);
    if (order.transaction_id) {
      if (order.transaction_id !== transactionId)
        throw new ShopError("支付流水不匹配", 409);
      return;
    }
    if (order.status !== "pending")
      throw new ShopError("订单状态异常，需要对账", 409);
    db.prepare(
      "UPDATE shop_online_orders SET status='paid',transaction_id=?,updated_at=?,pay_lock_until=0 WHERE id=?",
    ).run(transactionId, Date.now(), id);
    const course = courseOrder(db,id);
    if(course){fulfillCourse(db,order,course);audit(db,id,"paid",provider,transactionId);return;}
    const member = db
      .prepare("SELECT name FROM Member WHERE id=?")
      .get<{ name: string }>(order.member_id);
    for (const item of orderItems(db, id)) {
      db.prepare(
        `INSERT INTO shop_sales(product_id,product_name,quantity,unit_price,total_amount,member_id,member_name,sale_date,remark,sale_type,channel,customer_phone,operator) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        item.product_id,
        item.name,
        item.quantity,
        item.unit_fen / 100,
        (db.prepare('SELECT net_fen FROM shop_order_advisors WHERE order_id=?').get<{net_fen:number}>(id)?.net_fen ?? (item.quantity * item.unit_fen)) / 100,
        order.member_id,
        member?.name || order.recipient,
        new Date().toISOString(),
        `官网订单 ${id}`,
        "线上",
        "官网",
        order.phone,
        db.prepare('SELECT advisor_name FROM shop_order_advisors WHERE order_id=?').get<{advisor_name:string}>(id)?.advisor_name || "支付回调",
      );
    }
    audit(db, id, "paid", provider, transactionId);
  })();
}
export function settleRefund(db: AdminDb, id: string) {
  db.transaction(() => {
    const changed = db
      .prepare(
        "UPDATE shop_online_orders SET status='refunded',updated_at=? WHERE id=? AND status='refunding'",
      )
      .run(Date.now(), id);
    if (!changed.changes) return;
    const order = orderById(db, id);
    const course=courseOrder(db,id);
    if(course){refundCourse(db,id,course);audit(db,id,"refunded","gateway");return;}
    if (order.refund_restock) restoreStock(db, id);
    // Retain original sale and append an offset, preserving the audit trail.
    for (const item of orderItems(db, id)) {
      db.prepare(
        `INSERT INTO shop_sales(product_id,product_name,quantity,unit_price,total_amount,member_id,member_name,remark,sale_type,channel,customer_phone,operator) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        item.product_id,
        item.name,
        -item.quantity,
        item.unit_fen / 100,
        (-item.quantity * item.unit_fen) / 100,
        order.member_id,
        order.recipient,
        `官网退款 ${id}`,
        "退款",
        "官网",
        order.phone,
        "退款确认",
      );
    }
    audit(db, id, "refunded", "gateway");
  })();
}

// Courses use the same signed gateway callbacks and order ownership checks as goods.
export function courseOffer(db: AdminDb, kind: string, target: unknown, actor = 0) {
  if(kind==='event') {try{return eventPaymentOffer(db,Number(target),actor)}catch(e:any){throw new ShopError(e.message,409)}}
  const id = Number(target);
  if (!['online','offline'].includes(kind) || !Number.isSafeInteger(id) || id <= 0) throw new ShopError('课程参数错误');
  const row = kind === 'online'
    ? db.prepare("SELECT * FROM CourseSeries WHERE id=? AND status='published'").get<any>(id)
    : db.prepare("SELECT c.* FROM Course c LEFT JOIN CourseTemplate t ON t.id=c.templateId WHERE c.id=? AND c.status IN ('active','planned') AND COALESCE(t.websiteVisible,1)=1 AND COALESCE(c.category,'') NOT LIKE '%演示%' AND c.name NOT LIKE '%测试%'").get<any>(id);
  if (!row) throw new ShopError('课程已隐藏、下架或停止招生',404);
  if (kind === 'offline' && row.endDate && String(row.endDate).slice(0,10) < new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'})) throw new ShopError('本期课程已经结束',409);
  const price = kind === 'online' ? courseSalePrice(row, getCoursePromotion(db).enabled) : row.price;
  if (kind === 'online' && row.is_free) throw new ShopError('免费课程无需付款，请直接进入学习',409);
  if (!(Number(price)>0)) throw new ShopError('本课程暂未设置在线售价，请联系课程顾问',409);
  return {kind,id,name:row.name,priceFen:moneyFen(price),image:row.cover_image || row.coverImage || row.image || '',description:row.description || row.content || row.subtitle || '',period:[row.subType || row.dateRange,row.startDate && row.endDate ? `${row.startDate} — ${row.endDate}` : row.startDate,row.location].filter(Boolean).join(' · '),sessions:Math.max(0,Math.floor(Number(row.sessions || 0))),expires:row.endDate || '',capacity:Number(row.capacity || 0),remaining:Number(row.remaining || 0)};
}
export function createCourseOrder(db: AdminDb, memberId: number, body: any) {
  const key=field(body.requestKey,80,'下单标识');
  if(!['wechat','alipay'].includes(body.provider))throw new ShopError('请选择支付方式');
  const hash=createHash('sha256').update(JSON.stringify({kind:body.kind,id:String(body.targetId),provider:body.provider,expectedTotalFen:body.expectedTotalFen})).digest('hex');
  return db.transaction(()=>{
    db.prepare('UPDATE shop_online_orders SET updated_at=updated_at WHERE id=?').run('');
    const previous=db.prepare('SELECT * FROM shop_online_orders WHERE member_id=? AND request_key=?').get<ShopOrder>(memberId,key);
    if(previous){if(previous.request_hash!==hash)throw new ShopError('下单内容已变化，请重新确认',409);return previous;}
    const member=db.prepare('SELECT id,name,phone FROM Member WHERE id=?').get<any>(memberId);
    if(!member)throw new ShopError('请先登录',401);
    const offer=courseOffer(db,body.kind,body.targetId,memberId);
    if(body.expectedTotalFen!==offer.priceFen)throw new ShopError('课程价格已更新，请刷新后确认',409);
    if(offer.kind==='online' && db.prepare("SELECT id FROM CourseAuthorization WHERE (member_id=? OR (phone=? AND ?<>'')) AND series_id=? AND status='active' AND (expire_at IS NULL OR expire_at='' OR datetime(expire_at)>datetime('now','localtime'))").get(memberId,member.phone || '',member.phone || '',offer.id))throw new ShopError('你已拥有该课程，请直接学习',409);
    if(offer.kind==='offline' && db.prepare("SELECT id FROM Payment WHERE memberId=? AND courseId=? AND paymentStatus IN ('paid','completed')").get(memberId,offer.id))throw new ShopError('你已购买本期课程，请查看课时余额',409);
    const pending=db.prepare("SELECT o.id FROM shop_online_orders o JOIN shop_course_orders c ON c.order_id=o.id WHERE o.member_id=? AND c.kind=? AND c.target_id=? AND o.status IN ('pending','refund_requested','refunding')").get(memberId,offer.kind,offer.id);
    if(pending && offer.kind==='event')return orderById(db,pending.id,memberId);
    if(pending)throw new ShopError('该课程已有待处理订单，请到我的订单继续付款或取消',409);
    if(offer.kind==='event' && db.prepare("SELECT o.id FROM shop_online_orders o JOIN shop_course_orders c ON c.order_id=o.id WHERE c.kind='event' AND c.target_id=? AND o.status IN ('pending','refund_requested','refunding')").get(offer.id))throw new ShopError('该报名已有待处理订单',409);
    const count=db.prepare("SELECT COUNT(*) n FROM shop_online_orders WHERE member_id=? AND status='pending'").get<{n:number}>(memberId)!.n;
    if(count>=5)throw new ShopError('请先处理未付款订单',429);
    const reserved=offer.kind==='offline' && offer.capacity>0;
    if(reserved && !db.prepare('UPDATE Course SET remaining=remaining-1 WHERE id=? AND remaining>0').run(offer.id).changes)throw new ShopError('本期名额已满',409);
    const id=`EV${randomBytes(15).toString('hex')}`,now=Date.now();
    db.prepare('INSERT INTO shop_online_orders(id,member_id,request_key,request_hash,provider,total_fen,recipient,phone,address,created_at,expires_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,memberId,key,hash,body.provider,offer.priceFen,member.name,member.phone || '', '',now,now+15*60000,now);
    db.prepare('INSERT INTO shop_online_items VALUES(?,?,?,?,?,?)').run(id,`${offer.kind}:${offer.id}`,offer.name,offer.period || (offer.kind==='online'?'线上课程':'线下课程'),1,offer.priceFen);
    db.prepare('INSERT INTO shop_course_orders(order_id,kind,target_id,snapshot,reserved) VALUES(?,?,?,?,?)').run(id,offer.kind,offer.id,JSON.stringify(offer),reserved?1:0);
    audit(db,id,'created',`member:${memberId}`,offer.kind);
    return orderById(db,id);
  })();
}
function courseOrder(db: AdminDb,id:string){return db.prepare('SELECT * FROM shop_course_orders WHERE order_id=?').get<any>(id);}
function releaseCourseSeat(db: AdminDb,id:string){
 const c=courseOrder(db,id);if(c?.reserved){db.prepare('UPDATE Course SET remaining=remaining+1 WHERE id=?').run(c.target_id);db.prepare('UPDATE shop_course_orders SET reserved=0 WHERE order_id=?').run(id);}
}
function fulfillCourse(db: AdminDb,order:ShopOrder,c:any){
 if(c.kind==='event'){settleEventPayment(db,c.target_id,order);db.prepare("UPDATE shop_online_orders SET status='completed' WHERE id=?").run(order.id);return;}
 const offer=JSON.parse(c.snapshot),method=order.provider==='wechat'?'微信':'支付宝',now=new Date().toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'});
 if(c.kind==='online'){
  const receipt=db.prepare("INSERT INTO CourseOrder(order_no,member_id,series_id,amount,status,pay_method,paid_at,remark) VALUES(?,?,?,?,'paid',?,?,?)").run(order.id,order.member_id,c.target_id,order.total_fen/100,method,now,'统一在线支付');
  db.prepare("INSERT INTO CourseAuthorization(member_id,phone,series_id,type,order_id,granted_at,status,remark) VALUES(?,?,?,'purchase',?,?,'active',?)").run(order.member_id,order.phone,c.target_id,receipt.lastInsertRowid,now,order.id);
  db.prepare('UPDATE shop_course_orders SET receipt_id=? WHERE order_id=?').run(receipt.lastInsertRowid,order.id);
 }else{
  const receipt=db.prepare("INSERT INTO Payment(memberId,memberName,memberPhone,courseId,courseName,amount,date,payment,remark,expireDate,remainingSessions,paymentStatus,channel) VALUES(?,?,?,?,?,?,?,?,?,?,?,'paid','online')").run(order.member_id,order.recipient,order.phone,c.target_id,offer.name,order.total_fen/100,now.slice(0,10),method,order.id,offer.expires,offer.sessions);
  const enrollment=db.prepare("INSERT INTO OfflineEnrollment(enrollment_no,member_id,course_id,payment_id,status,channel,amount,activated_at,remark) VALUES(?,?,?,?,'active','online',?,?,?)").run(order.id,order.member_id,c.target_id,receipt.lastInsertRowid,order.total_fen/100,now,order.id);
  db.prepare("INSERT INTO OfflineEntitlement(member_id,course_id,enrollment_id,payment_id,total_sessions,available_sessions,valid_from,valid_until,status) VALUES(?,?,?,?,?,?,?,?,'active')").run(order.member_id,c.target_id,enrollment.lastInsertRowid,receipt.lastInsertRowid,offer.sessions,offer.sessions,now.slice(0,10),offer.expires);
  db.prepare('UPDATE shop_course_orders SET receipt_id=? WHERE order_id=?').run(receipt.lastInsertRowid,order.id);
 }
 const receipt=courseOrder(db,order.id).receipt_id;
 const attribution=db.prepare('SELECT * FROM shop_order_advisors WHERE order_id=?').get<any>(order.id);
 if(attribution){
  if(c.kind==='online')db.prepare("UPDATE CourseAuthorization SET sales=?,expire_at=NULLIF(?,'') WHERE order_id=? AND type='purchase'").run(attribution.advisor_name,attribution.access_expires,receipt);
  else db.prepare('UPDATE Payment SET sales=? WHERE id=?').run(attribution.advisor_name,receipt);
 }

 db.prepare("INSERT INTO orders(order_no,member_id,member_name,member_phone,order_type,source_type,source_id,title,amount,status,pay_method,paid_at,remark) VALUES(?,?,?,?,?,?,?,?,?,'paid',?,?,?)").run(order.id,order.member_id,order.recipient,order.phone,c.kind==='online'?'online_course':'training',c.kind==='online'?'online_course_order':'offline-training',String(receipt),offer.name,order.total_fen/100,method,now,'统一在线支付');
 db.prepare("UPDATE shop_online_orders SET status='completed' WHERE id=?").run(order.id);
}
export function validateCourseRefund(db:AdminDb,id:string){
 const c=courseOrder(db,id);if(!c || c.kind!=='offline')return;
 const e=db.prepare('SELECT * FROM OfflineEntitlement WHERE payment_id=?').get<any>(c.receipt_id);
 const consumeTable=db.prepare("SELECT 1 FROM sqlite_master WHERE name='ConsumeRecord'").get();
 const consumeHasStatus=consumeTable && db.prepare('PRAGMA table_info(ConsumeRecord)').all<any>().some(col=>col.name==='status');
 const used=consumeTable ? Number(db.prepare(`SELECT COALESCE(SUM(count),0) n FROM ConsumeRecord WHERE paymentId=?${consumeHasStatus?" AND COALESCE(status,'active')='active'":""}`).get<any>(c.receipt_id)?.n||0) : 0;
 if(used>0 || (e && (e.used_sessions>0 || e.frozen_sessions>0)))throw new ShopError('该期次存在已核销课时，请先处理核销记录再退款',409);
 // Freeze rights while the gateway refund is in progress; prevents booking/refund races.
 db.prepare("UPDATE OfflineEntitlement SET status='refunding',available_sessions=0 WHERE payment_id=?").run(c.receipt_id);
 db.prepare("UPDATE Payment SET paymentStatus='refunding' WHERE id=?").run(c.receipt_id);
}
function refundCourse(db:AdminDb,id:string,c:any){
 if(c.kind==='event'){settleEventPayment(db,c.target_id,orderById(db,id),true);return;}
 if(c.kind==='online'){
  db.prepare("UPDATE CourseOrder SET status='refunded',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(c.receipt_id);
  db.prepare("UPDATE CourseAuthorization SET status='revoked',revoked_at=CURRENT_TIMESTAMP WHERE order_id=? AND type='purchase'").run(c.receipt_id);
 }else{
  db.prepare("UPDATE Payment SET paymentStatus='refunded',remainingSessions=0 WHERE id=?").run(c.receipt_id);
  db.prepare("UPDATE OfflineEnrollment SET status='refunded' WHERE payment_id=?").run(c.receipt_id);
  db.prepare("UPDATE OfflineEntitlement SET status='refunded',available_sessions=0 WHERE payment_id=?").run(c.receipt_id);
  releaseCourseSeat(db,id);
 }
 db.prepare("UPDATE orders SET status='refunded',updated_at=CURRENT_TIMESTAMP WHERE order_no=?").run(id);
}
