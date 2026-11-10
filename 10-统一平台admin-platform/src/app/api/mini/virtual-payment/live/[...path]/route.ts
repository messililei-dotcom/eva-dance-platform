import { getMemberId, withDb } from '../../../_helpers';
import { getActiveAuthorization } from '../../../../course/series/[id]/_authorization';
import { ShopError } from '@/lib/server/shop-core';
import { acknowledgeVirtualDelivery, queryVirtualOrder, sandboxSession, signVirtualOrder } from '@/lib/server/mini-virtual-payment';
import {
  createLiveOrder, findLiveCoursePending, findLiveCourseUnacknowledged, findLiveOrder, liveVirtualConfig, liveVirtualQuote, settleLiveOrder, type LiveOrder,
} from '@/lib/server/mini-virtual-live';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Context = { params: Promise<{ path: string[] }> };
type Config = NonNullable<ReturnType<typeof liveVirtualConfig>>;
const headers = { 'Cache-Control': 'private, no-store' };
const fail = (message: string, status: number) => Response.json({ success: false, message }, { status, headers });
const ok = (data: unknown) => Response.json({ success: true, data }, { headers });

async function reconcile(config: Config, order: LiveOrder) {
  let status = order.status;
  if (status === 'pending') {
    const result = await queryVirtualOrder(config, order.id, order.openid, 0);
    if (!result) return status;
    status = withDb(db => settleLiveOrder(db, order, result));
    if (status !== 'verified') return status;
  }
  if (status === 'verified' && !order.delivery_ack) {
    try {
      await acknowledgeVirtualDelivery(config, order.id);
      withDb(db => db.prepare("UPDATE MiniVirtualLiveOrder SET delivery_ack=1 WHERE id=? AND status='verified'").run(order.id));
    } catch {
      // The paid course remains unlocked. A later reconciliation retries the acknowledgement.
    }
  }
  return status;
}

async function handle(request: Request, { params }: Context) {
  const config = liveVirtualConfig();
  if (!config) return fail('线上课程虚拟支付暂未开放', 503);
  const memberId = getMemberId(new URL(request.url).searchParams, request);
  if (!memberId) return fail('请先登录', 401);
  const [action, id, ...extra] = (await params).path;
  if (extra.length || !id) return fail('接口不存在', 404);
  const seriesId = Number(id);
  const validSeries = /^\d+$/.test(id) && Number.isSafeInteger(seriesId) && seriesId > 0;
  try {
    const openid = withDb(db => db.prepare('SELECT openid FROM WechatIdentity WHERE app_id=? AND member_id=?').get<{openid:string}>(config.appId, memberId)?.openid);
    if (!openid) return fail('请先使用微信登录并绑定当前账户', 403);
    if (action === 'quote' && validSeries && request.method === 'GET') {
      return ok({ offer: withDb(db => liveVirtualQuote(db, config, seriesId)) });
    }
    if (action === 'prepare' && validSeries && request.method === 'POST') {
      const raw = await request.text();
      if (raw.length > 2048) return fail('请求过大', 413);
      let input;
      try { input = JSON.parse(raw); } catch { return fail('请求格式错误', 400); }
      if (typeof input?.code !== 'string' || !/^[\w-]{1,128}$/.test(input.code)) return fail('微信登录凭证无效', 400);
      const session = await sandboxSession(config, input.code);
      if (session.openid !== openid) return fail('当前微信账号与下单账号不一致', 403);
      const order = withDb(db => createLiveOrder(db, config, memberId, seriesId, openid, input.expectedPriceFen,
        () => Boolean(getActiveAuthorization(db, seriesId, memberId))));
      return ok({ id: order.id, status: order.status, payment: signVirtualOrder(config, order, session.sessionKey, 0) });
    }
    if (action === 'recover' && validSeries && request.method === 'POST') {
      const order = withDb(db => findLiveCoursePending(db, memberId, seriesId)
        || findLiveCourseUnacknowledged(db, memberId, seriesId));
      if (!order) return ok({ status: 'none' });
      if (order.openid !== openid || order.offer_id !== config.offerId) return fail('订单账号不匹配', 403);
      return ok({ status: await reconcile(config, order) });
    }
    if (action === 'orders' && request.method === 'POST' && /^VL[0-9a-f]{30}$/.test(id)) {
      const order = withDb(db => findLiveOrder(db, memberId, id));
      if (!order || order.openid !== openid || order.offer_id !== config.offerId) return fail('订单不存在', 404);
      return ok({ status: await reconcile(config, order) });
    }
    return fail('接口不存在', 404);
  } catch (error) {
    return error instanceof ShopError ? fail(error.message, error.status) : fail('虚拟支付暂不可用，请稍后重试', 503);
  }
}

export const GET = handle;
export const POST = handle;
