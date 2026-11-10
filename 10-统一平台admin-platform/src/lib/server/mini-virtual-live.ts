import { randomBytes } from 'node:crypto';
import type { AdminDb } from './admin-db';
import { courseOffer, ShopError } from './shop-core';
import type { WechatVirtualOrder } from './mini-virtual-payment';

export function liveVirtualConfig() {
  const appId = process.env.WECHAT_MINIAPP_APP_ID || process.env.WECHAT_MINIAPP_APPID || process.env.NEXT_PUBLIC_WECHAT_MINIAPP_ID;
  const secret = process.env.WECHAT_MINIAPP_SECRET || process.env.WX_MINIAPP_SECRET;
  const offerId = process.env.WECHAT_VIRTUAL_OFFER_ID;
  const appKey = process.env.WECHAT_VIRTUAL_LIVE_APP_KEY;
  if (process.env.WECHAT_VIRTUAL_LIVE_ENABLED !== 'true' || !appId || !secret || !offerId || !appKey) return null;
  const products = new Map<number, { productId: string; priceFen: number }>();
  try {
    const rows = JSON.parse(process.env.WECHAT_VIRTUAL_LIVE_PRODUCTS || '{}');
    const usedProductIds = new Set<string>();
    for (const [id, value] of Object.entries(rows)) {
      const row = value as { productId: string; priceFen: number };
      const seriesId = Number(id);
      if (!Number.isSafeInteger(seriesId) || seriesId < 1 || String(seriesId) !== id || !row
        || typeof row.productId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(row.productId)
        || !Number.isSafeInteger(row.priceFen) || row.priceFen < 100 || usedProductIds.has(row.productId)) return null;
      products.set(seriesId, row);
      usedProductIds.add(row.productId);
    }
  } catch { return null; }
  return products.size ? { appId, secret, offerId, appKey, products } : null;
}

type Config = NonNullable<ReturnType<typeof liveVirtualConfig>>;
export type LiveOrder = {
  id: string; member_id: number; series_id: number; title: string; openid: string;
  offer_id: string; product_id: string; price_fen: number;
  status: 'pending' | 'verified' | 'closed'; wx_order_id: string; delivery_ack: number;
};

export function liveVirtualQuote(db: AdminDb, config: Config, id: number) {
  const item = config.products.get(id);
  if (!item) throw new ShopError('此课程暂未开放微信虚拟支付', 404);
  const offer = courseOffer(db, 'online', id);
  if (offer.priceFen !== item.priceFen) throw new ShopError('课程售价正在同步，请稍后重试', 409);
  return { id, name: offer.name, priceFen: offer.priceFen, productId: item.productId };
}

function ensureLiveOrders(db: AdminDb) {
  db.exec(`CREATE TABLE IF NOT EXISTS MiniVirtualLiveOrder (
    id TEXT PRIMARY KEY, member_id INTEGER NOT NULL, series_id INTEGER NOT NULL,
    title TEXT NOT NULL, openid TEXT NOT NULL, offer_id TEXT NOT NULL, product_id TEXT NOT NULL,
    price_fen INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
    wx_order_id TEXT NOT NULL DEFAULT '', delivery_ack INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS mini_virtual_live_pending
    ON MiniVirtualLiveOrder(member_id,series_id) WHERE status='pending';
  CREATE UNIQUE INDEX IF NOT EXISTS mini_virtual_live_transaction
    ON MiniVirtualLiveOrder(wx_order_id) WHERE wx_order_id<>'';`);
}

export function findLiveOrder(db: AdminDb, memberId: number, id: string) {
  ensureLiveOrders(db);
  return db.prepare('SELECT * FROM MiniVirtualLiveOrder WHERE member_id=? AND id=?').get<LiveOrder>(memberId, id);
}

export function findLiveCoursePending(db: AdminDb, memberId: number, seriesId: number) {
  ensureLiveOrders(db);
  return db.prepare("SELECT * FROM MiniVirtualLiveOrder WHERE member_id=? AND series_id=? AND status='pending'").get<LiveOrder>(memberId, seriesId);
}

export function findLiveCourseUnacknowledged(db: AdminDb, memberId: number, seriesId: number) {
  ensureLiveOrders(db);
  return db.prepare("SELECT * FROM MiniVirtualLiveOrder WHERE member_id=? AND series_id=? AND status='verified' AND delivery_ack=0 ORDER BY created_at DESC LIMIT 1").get<LiveOrder>(memberId, seriesId);
}

export function createLiveOrder(db: AdminDb, config: Config, memberId: number, seriesId: number, openid: string, expectedPrice: unknown, checkOwned: () => boolean) {
  ensureLiveOrders(db);
  return db.transaction(() => {
    if (checkOwned()) throw new ShopError('你已拥有该课程，请直接学习', 409);
    const offer = liveVirtualQuote(db, config, seriesId);
    if (offer.priceFen !== expectedPrice) throw new ShopError('课程价格已变化，请刷新后确认', 409);
    const prior = findLiveCoursePending(db, memberId, seriesId);
    if (prior) {
      if (prior.openid !== openid || prior.offer_id !== config.offerId || prior.product_id !== offer.productId || prior.price_fen !== offer.priceFen) {
        throw new ShopError('此课程有待确认的虚拟支付订单，请先核对原订单', 409);
      }
      return prior;
    }
    const id = 'VL' + randomBytes(15).toString('hex');
    db.prepare(`INSERT INTO MiniVirtualLiveOrder
      (id,member_id,series_id,title,openid,offer_id,product_id,price_fen,created_at)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(id, memberId, seriesId, offer.name, openid, config.offerId, offer.productId, offer.priceFen, Date.now());
    return findLiveOrder(db, memberId, id)!;
  }).immediate();
}

export function settleLiveOrder(db: AdminDb, order: LiveOrder, result: WechatVirtualOrder): LiveOrder["status"] {
  if (result.order_id !== order.id || result.env_type !== 1 || ![0, 7].includes(Number(result.order_type))) {
    throw new ShopError('微信虚拟支付订单环境或类型不匹配', 409);
  }
  const status = Number(result.status);
  if (status === 6) {
    db.prepare("UPDATE MiniVirtualLiveOrder SET status='closed' WHERE id=? AND status='pending'").run(order.id);
    return 'closed';
  }
  if (![2, 3, 4].includes(status)) return 'pending';
  if (!result.wx_order_id || result.order_fee !== order.price_fen || result.paid_fee !== order.price_fen
    || (typeof result.left_fee === 'number' && result.left_fee !== order.price_fen)) {
    throw new ShopError('微信虚拟支付实付金额不匹配，请联系顾问', 409);
  }
  return db.transaction(() => {
    const current = findLiveOrder(db, order.member_id, order.id);
    if (current?.status === 'verified' && current.wx_order_id === result.wx_order_id) return 'verified';
    if (current?.status !== 'pending') throw new ShopError('订单状态变化，请重新核对', 409);
    const member = db.prepare('SELECT name,phone FROM Member WHERE id=?').get<{name:string; phone:string}>(order.member_id);
    if (!member) throw new ShopError('付款账户无法确认，请联系顾问', 409);
    const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' });
    const method = Number(result.order_type) === 7 ? '苹果支付' : '微信';
    const remark = '小程序虚拟支付';
    const amount = order.price_fen / 100;
    const receipt = db.prepare(`INSERT INTO CourseOrder(order_no,member_id,series_id,amount,status,pay_method,paid_at,remark)
      VALUES(?,?,?,?,'paid',?,?,?)`).run(order.id, order.member_id, order.series_id, amount, method, now, remark);
    db.prepare(`INSERT INTO CourseAuthorization(member_id,phone,series_id,type,order_id,granted_at,status,remark)
      VALUES(?,?,?,'purchase',?,?,'active',?)`).run(order.member_id, member.phone || '', order.series_id, receipt.lastInsertRowid, now, order.id);
    db.prepare(`INSERT INTO orders(order_no,member_id,member_name,member_phone,order_type,source_type,source_id,title,amount,status,pay_method,paid_at,remark)
      VALUES(?,?,?,?,'online_course','online_course_order',?,?,?,'paid',?,?,?)`).run(
      order.id, order.member_id, member.name, member.phone || '', String(receipt.lastInsertRowid), order.title, amount, method, now, remark);
    db.prepare("UPDATE MiniVirtualLiveOrder SET status='verified',wx_order_id=? WHERE id=?").run(result.wx_order_id, order.id);
    return 'verified' as const;
  }).immediate();
}
