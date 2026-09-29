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
  status: string;
  total_fen: number;
  recipient: string;
  phone: string;
  address: string;
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
    CREATE TABLE IF NOT EXISTS shop_online_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, action TEXT NOT NULL,
      actor TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL
    );`);
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
  return {
    id: order.id,
    provider: order.provider,
    status: order.status,
    totalFen: order.total_fen,
    recipient: order.recipient,
    phone: order.phone,
    address: order.address,
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
  const address = field(body.address, 300, "完整收货地址");
  if (address.length < 8) throw new ShopError("请填写省、市、区及街道门牌号");
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
          "SELECT id,name,spec,size,color,sale_price,stock FROM shop_products WHERE id=? AND status='在售'",
        )
        .get(item.id);
      if (!product) throw new ShopError("商品已下架，请刷新购物车", 409);
      const unit = moneyFen(product.sale_price);
      const changed = db
        .prepare(
          "UPDATE shop_products SET stock=stock-?,updated_at=? WHERE id=? AND status='在售' AND stock>=?",
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
    type,
    Math.abs(delta),
    before,
    before + delta,
    "官网商城",
    orderId,
    "官网",
  );
}
function restoreStock(db: AdminDb, id: string) {
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
        (item.quantity * item.unit_fen) / 100,
        order.member_id,
        member?.name || order.recipient,
        new Date().toISOString(),
        `官网订单 ${id}`,
        "线上",
        "官网",
        order.phone,
        "支付回调",
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
