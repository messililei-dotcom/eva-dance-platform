import { createHmac, randomBytes } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { getBetterSqlite3, type AdminDb } from './admin-db';
import { courseOffer, ShopError } from './shop-core';

export function sandboxConfig() {
  const appId = process.env.WECHAT_MINIAPP_APP_ID || process.env.WECHAT_MINIAPP_APPID || process.env.NEXT_PUBLIC_WECHAT_MINIAPP_ID;
  const secret = process.env.WECHAT_MINIAPP_SECRET || process.env.WX_MINIAPP_SECRET;
  const offerId = process.env.WECHAT_VIRTUAL_OFFER_ID;
  const appKey = process.env.WECHAT_VIRTUAL_SANDBOX_APP_KEY;
  const productId = process.env.WECHAT_VIRTUAL_SANDBOX_PRODUCT_ID;
  const dbPath = process.env.WECHAT_VIRTUAL_SANDBOX_DB;
  const seriesId = Number(process.env.WECHAT_VIRTUAL_SANDBOX_SERIES_ID);
  const priceFen = Number(process.env.WECHAT_VIRTUAL_SANDBOX_PRICE_FEN);
  const memberId = Number(process.env.WECHAT_VIRTUAL_SANDBOX_MEMBER_ID);
  if (
    process.env.WECHAT_VIRTUAL_SANDBOX_ENABLED !== 'true' ||
    !appId || !secret || !offerId || !appKey || !productId || !dbPath ||
    !isAbsolute(dbPath) || !dbPath.endsWith('/mini-virtual-sandbox.sqlite') ||
    ![seriesId, priceFen, memberId].every(value => Number.isSafeInteger(value) && value > 0)
  ) return null;
  return { appId, secret, offerId, appKey, productId, dbPath, seriesId, priceFen, memberId };
}

type Config = NonNullable<ReturnType<typeof sandboxConfig>>;
type SandboxOrder = { id: string; openid: string; price_fen: number; product_id: string; offer_id: string; status: 'pending' | 'verified' };
type WechatResponse = { errcode?: number; openid?: string; session_key?: string; access_token?: string; expires_in?: number; order?: { order_id?: string; wx_order_id?: string; order_fee?: number; paid_fee?: number; left_fee?: number; status?: number; order_type?: number; env_type?: number } };

function hmac(key: string, message: string) {
  return createHmac('sha256', key).update(message, 'utf8').digest('hex');
}

export function sandboxQuote(db: AdminDb, config: Config, id: number) {
  if (id !== config.seriesId) throw new ShopError('此课程未配置虚拟支付联调', 404);
  const offer = courseOffer(db, 'online', id);
  if (offer.priceFen !== config.priceFen) throw new ShopError('课程价格与沙箱道具价格不一致', 409);
  return { id: offer.id, name: offer.name, priceFen: offer.priceFen, sandbox: true };
}

type PaymentCredentials = Pick<Config, 'appId' | 'secret' | 'appKey' | 'offerId'>;
type PaymentItem = Pick<SandboxOrder, 'id' | 'offer_id' | 'product_id' | 'price_fen'>;
export type WechatVirtualOrder = NonNullable<WechatResponse['order']>;

export function signVirtualOrder(config: PaymentCredentials, order: PaymentItem, sessionKey: string, env: 0 | 1) {
  const signData = JSON.stringify({
    offerId: order.offer_id, buyQuantity: 1, env, currencyType: 'CNY',
    productId: order.product_id, goodsPrice: order.price_fen, outTradeNo: order.id,
    attach: env === 1 ? 'swod-sandbox' : 'swod-online-course',
  });
  return {
    mode: 'short_series_goods',
    signData,
    paySig: hmac(config.appKey, 'requestVirtualPayment&' + signData),
    signature: hmac(sessionKey, signData),
  };
}

export function signSandboxOrder(config: Config, order: SandboxOrder, sessionKey: string) {
  return signVirtualOrder(config, order, sessionKey, 1);
}

async function wechat(url: URL, body?: string): Promise<WechatResponse> {
  let response: Response;
  let result: WechatResponse;
  try {
    response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
      ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }),
    });
    result = await response.json();
  } catch {
    throw new ShopError('微信虚拟支付服务连接失败', 502);
  }
  if (!response.ok || !result || result.errcode) {
    const code = Number(result?.errcode);
    throw new ShopError(Number.isSafeInteger(code) && code ? '微信虚拟支付返回错误 ' + code : '微信虚拟支付响应异常', 502);
  }
  return result;
}

export async function sandboxSession(config: Pick<Config, "appId" | "secret">, code: string) {
  const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
  url.search = new URLSearchParams({
    appid: config.appId, secret: config.secret, js_code: code, grant_type: 'authorization_code',
  }).toString();
  const data = await wechat(url);
  if (!data.openid || !data.session_key) throw new ShopError('微信登录凭证无效，请重新进入小程序', 400);
  return { openid: data.openid, sessionKey: data.session_key };
}

function sandboxDb<T>(config: Config, run: (db: AdminDb) => T): T {
  const Database = getBetterSqlite3();
  const db = new Database(config.dbPath);
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS MiniVirtualSandboxOrder (
      id TEXT PRIMARY KEY, openid TEXT NOT NULL, series_id INTEGER NOT NULL,
      price_fen INTEGER NOT NULL, product_id TEXT NOT NULL, offer_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL,
      wx_order_id TEXT NOT NULL DEFAULT '',
      UNIQUE(openid, series_id, product_id, offer_id, price_fen)
    )`);
    return run(db);
  } finally {
    db.close();
  }
}

export function sandboxOrder(config: Config, openid: string) {
  return sandboxDb(config, db => db.transaction(() => {
    const filters = [openid, config.seriesId, config.productId, config.offerId, config.priceFen];
    const prior = db.prepare('SELECT * FROM MiniVirtualSandboxOrder WHERE openid=? AND series_id=? AND product_id=? AND offer_id=? AND price_fen=?').get<SandboxOrder>(...filters);
    if (prior) return prior;
    const id = 'VX' + randomBytes(15).toString('hex');
    db.prepare('INSERT INTO MiniVirtualSandboxOrder(id,openid,series_id,product_id,offer_id,price_fen,created_at) VALUES(?,?,?,?,?,?,?)').run(id, ...filters, Date.now());
    return db.prepare('SELECT * FROM MiniVirtualSandboxOrder WHERE id=?').get<SandboxOrder>(id)!;
  }).immediate());
}

let tokenCache: { appId: string; value: string; expiresAt: number } | undefined;

async function accessToken(config: Pick<Config, "appId" | "secret">) {
  const cached = tokenCache;
  if (cached && cached.appId === config.appId && cached.expiresAt > Date.now() + 60000) return cached.value;
  const data = await wechat(new URL('https://api.weixin.qq.com/cgi-bin/stable_token'), JSON.stringify({
    grant_type: 'client_credential', appid: config.appId, secret: config.secret, force_refresh: false,
  }));
  if (!data.access_token) throw new ShopError('微信虚拟支付凭证不可用', 502);
  tokenCache = { appId: config.appId, value: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 0) * 1000 };
  return tokenCache.value;
}

export async function verifySandboxOrder(config: Config, id: string, openid: string) {
  const order = sandboxDb(config, db => db.prepare('SELECT * FROM MiniVirtualSandboxOrder WHERE id=? AND openid=?').get<SandboxOrder>(id, openid));
  if (!order || order.offer_id !== config.offerId) throw new ShopError('沙箱订单不存在', 404);
  if (order.status === 'verified') return order.status;
  const result = await queryVirtualOrder(config, id, openid, 1);
  if (!result || ![2, 3, 4].includes(Number(result.status))) return 'pending';
  if (
    result.order_id !== id || result.order_fee !== order.price_fen || result.paid_fee !== order.price_fen ||
    result.env_type !== 2 || result.order_type !== 0 || !result.wx_order_id
  ) throw new ShopError('微信沙箱订单信息不匹配，需核对金额和环境', 409);
  // Sandbox confirmations are isolated from commercial orders and course entitlements.
  sandboxDb(config, db => db.prepare("UPDATE MiniVirtualSandboxOrder SET status='verified',wx_order_id=? WHERE id=? AND status='pending'").run(result.wx_order_id, id));
  return 'verified';
}

export async function queryVirtualOrder(config: PaymentCredentials, id: string, openid: string, env: 0 | 1) {
  const path = '/xpay/query_order';
  const body = JSON.stringify({ openid, env, order_id: id });
  const url = new URL(path, 'https://api.weixin.qq.com');
  url.searchParams.set('access_token', await accessToken(config));
  url.searchParams.set('pay_sig', hmac(config.appKey, path + '&' + body));
  return (await wechat(url, body)).order;
}

export async function acknowledgeVirtualDelivery(config: PaymentCredentials, id: string) {
  const url = new URL('/xpay/notify_provide_goods', 'https://api.weixin.qq.com');
  url.searchParams.set('access_token', await accessToken(config));
  await wechat(url, JSON.stringify({ order_id: id, env: 0 }));
}
