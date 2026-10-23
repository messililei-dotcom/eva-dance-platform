import { serializeMember } from '@/app/api/mini/_auth';
import {
  createMemberDeviceSession,
  getAuthenticatedMemberId,
  jsonError,
  withDb,
} from '@/app/api/mini/_helpers';
import { completeWechatLoginHandoff } from '@/lib/server/wechat-login-handoff';

export const dynamic = 'force-dynamic';

function validHandoffId(value: unknown) {
  const id = String(value ?? '').trim();
  return /^[0-9a-f-]{36}$/i.test(id) ? id : '';
}

export async function POST(request: Request) {
  try {
    const memberId = getAuthenticatedMemberId(request);
    if (!memberId) return jsonError('小程序登录状态已失效', 401);
    const body = await request.json().catch(() => ({}));
    const handoffId = validHandoffId(body.handoffId);
    if (!handoffId) return jsonError('登录接力参数无效', 400);

    return withDb((db) => {
      const member = db.prepare("SELECT * FROM Member WHERE id=? AND status='active'").get<any>(memberId);
      if (!member) return jsonError('会员账号不存在或已停用', 403);
      const session = createMemberDeviceSession(db, member, request, 'mini_handoff');
      const completed = completeWechatLoginHandoff(db, handoffId, session, serializeMember(member));
      if (!completed) return jsonError('本次登录已超时，请返回 PWA 重新操作', 410);
      return Response.json({ success: true, message: '微信登录已确认' }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '微信登录确认失败', 500);
  }
}
