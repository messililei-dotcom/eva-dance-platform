import crypto from 'crypto';
import { cleanText, jsonError, withDb } from '@/app/api/mini/_helpers';
import {
  bindWechatIdentity,
  resolveWechatMember,
  type WechatIdentityChannel,
} from '@/lib/server/wechat-identity';

export const dynamic = 'force-dynamic';

const ALLOWED_CHANNELS = new Set<WechatIdentityChannel>([
  'mini_program',
  'official_account',
  'website',
  'store',
]);

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function authorized(request: Request) {
  const expected = cleanText(process.env.WECHAT_IDENTITY_SYNC_SECRET);
  const supplied = cleanText(
    request.headers.get('x-wechat-identity-secret')
      || request.headers.get('authorization')?.replace(/^Bearer\s+/i, ''),
  );
  return Boolean(expected && supplied && safeEqual(supplied, expected));
}

export async function POST(request: Request) {
  if (!authorized(request)) return jsonError('微信身份同步接口未授权', 401);

  try {
    const body = await request.json().catch(() => ({}));
    const channel = cleanText(body.channel) as WechatIdentityChannel;
    const appId = cleanText(body.appId);
    const openid = cleanText(body.openid);
    const unionid = cleanText(body.unionid);
    if (!ALLOWED_CHANNELS.has(channel)) return jsonError('微信来源类型无效', 400);
    if (!appId || !openid) return jsonError('缺少微信应用或用户标识', 400);

    return withDb((db) => {
      const identity = {
        channel,
        appId,
        openid,
        unionid,
        nickname: cleanText(body.nickname),
        avatarUrl: cleanText(body.avatarUrl),
        metadata: {
          externalRef: cleanText(body.externalRef),
          eventType: cleanText(body.eventType),
        },
      };
      const resolved = resolveWechatMember(db, identity);
      let member = resolved.member;

      if (!member) {
        const result = db.prepare(
          `INSERT INTO Member (
             name, phone, source, status, register_date, created_at
           ) VALUES (?, NULL, ?, 'active', date('now','localtime'), datetime('now','localtime'))`
        ).run(
          identity.nickname || `微信客户${openid.slice(-6).toUpperCase()}`,
          `wechat_${channel}`,
        );
        member = db.prepare('SELECT * FROM Member WHERE id=?').get<any>(result.lastInsertRowid);
      }

      member = bindWechatIdentity(db, member.id, identity);
      return Response.json({
        success: true,
        data: {
          memberId: Number(member?.id || 0),
          matchedBy: resolved.matchedBy,
          duplicateCandidates: Math.max(0, resolved.candidateIds.length - 1),
        },
      });
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '微信身份同步失败', 409);
  }
}

