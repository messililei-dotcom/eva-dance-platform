import { getMemberId, withDb } from '../../_helpers';
import { getActiveAuthorization } from '../../../course/series/[id]/_authorization';
import { ShopError } from '@/lib/server/shop-core';
import { sandboxConfig, sandboxOrder, sandboxQuote, sandboxSession, signSandboxOrder, verifySandboxOrder } from '@/lib/server/mini-virtual-payment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Context = { params: Promise<{ path: string[] }> };
const headers = { 'Cache-Control': 'private, no-store' };
const fail = (message: string, status: number) => Response.json({ success: false, message }, { status, headers });
const ok = (data: unknown) => Response.json({ success: true, data }, { headers });

async function handle(request: Request, { params }: Context) {
  const config = sandboxConfig();
  if (!config) return fail('线上课程虚拟支付暂不可用', 503);
  const memberId = getMemberId(new URL(request.url).searchParams, request);
  if (memberId !== config.memberId) return fail('当前账号未开通沙箱联调', memberId ? 403 : 401);
  const [action, id, ...extra] = (await params).path;
  if (extra.length || !id) return fail('接口不存在', 404);
  try {
    const openid = withDb(db => db.prepare('SELECT openid FROM WechatIdentity WHERE app_id=? AND member_id=?').get<{openid:string}>(config.appId, memberId)?.openid);
    if (!openid) return fail('请先使用当前微信账号登录小程序', 403);
    if (action === 'quote' && request.method === 'GET') {
      return ok({ offer: withDb(db => sandboxQuote(db, config, Number(id))) });
    }
    if (action === 'prepare' && request.method === 'POST') {
      const raw = await request.text();
      if (raw.length > 2048) return fail('请求过大', 413);
      let input;
      try { input = JSON.parse(raw); } catch { return fail('请求格式错误', 400); }
      if (typeof input?.code !== 'string' || !/^[\w-]{1,128}$/.test(input.code)) return fail('微信登录凭证无效', 400);
      const offer = withDb(db => {
        const offer = sandboxQuote(db, config, Number(id));
        if (getActiveAuthorization(db, offer.id, memberId)) throw new ShopError('当前账号已拥有课程，请使用未购课的联调账号', 409);
        return offer;
      });
      if (input.expectedPriceFen !== offer.priceFen) return fail('课程价格已变化，请刷新', 409);
      const session = await sandboxSession(config, input.code);
      if (session.openid !== openid) return fail('当前微信账号与下单账号不一致', 403);
      const order = sandboxOrder(config, openid);
      return ok({ id: order.id, status: order.status,
        ...(order.status === 'pending' ? { payment: signSandboxOrder(config, order, session.sessionKey) } : {}),
      });
    }
    if (action === 'orders' && request.method === 'GET' && /^VX[0-9a-f]{30}$/.test(id)) {
      return ok({ status: await verifySandboxOrder(config, id, openid) });
    }
    return fail('接口不存在', 404);
  } catch (error) {
    return error instanceof ShopError ? fail(error.message, error.status) : fail('虚拟支付联调暂不可用', 503);
  }
}

export const GET = handle;
export const POST = handle;
