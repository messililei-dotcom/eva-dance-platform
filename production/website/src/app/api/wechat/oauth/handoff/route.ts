import { attachMemberSessionCookies, withDb } from '@/app/api/mini/_helpers';
import { consumeWechatLoginHandoff } from '@/lib/server/wechat-login-handoff';

function cleanText(value: unknown) {
  return String(value ?? '').trim();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = cleanText(url.searchParams.get('id'));
  const token = cleanText(url.searchParams.get('token'));
  if (!id || !token) {
    return Response.json({ success: false, status: 'invalid', message: '微信登录接力参数无效' }, {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const result = withDb((db) => consumeWechatLoginHandoff(db, id, token));
  if (result.status === 'pending') {
    return Response.json({ success: true, status: 'pending' }, {
      status: 202,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  if (result.status !== 'completed') {
    const message = result.status === 'failed'
      ? result.message
      : result.status === 'expired'
      ? '微信授权已超时，请重新登录'
      : result.status === 'consumed'
        ? '本次微信授权已完成，请刷新页面查看登录状态'
        : '微信登录接力验证失败，请重新登录';
    return Response.json({ success: false, status: result.status, message }, {
      status: result.status === 'invalid' ? 403 : 410,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  return attachMemberSessionCookies(Response.json({
    success: true,
    status: 'completed',
    token: result.session.token,
    member: result.member,
  }), result.session);
}
