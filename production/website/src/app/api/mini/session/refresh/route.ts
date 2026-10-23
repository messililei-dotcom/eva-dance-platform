import { serializeMember } from '../../_auth';
import {
  attachMemberSessionCookies,
  clearMemberSessionCookie,
  getAuthenticatedMemberId,
  getRecoverableDeviceSessionMemberId,
  renewMemberDeviceSession,
  withDb,
} from '../../_helpers';

export async function POST(request: Request) {
  return withDb((db) => {
    const memberId = getAuthenticatedMemberId(request)
      || getRecoverableDeviceSessionMemberId(db, request);
    if (!memberId) {
      return clearMemberSessionCookie(Response.json({
        success: false,
        message: '登录状态已失效',
      }, { status: 401 }));
    }
    const member = db.prepare(
      `SELECT * FROM Member WHERE id=? AND status='active' LIMIT 1`
    ).get<any>(memberId);
    if (!member) {
      return clearMemberSessionCookie(Response.json({
        success: false,
        message: '学员账号不可用',
      }, { status: 401 }));
    }
    const session = renewMemberDeviceSession(db, member, request);
    if (!session) {
      return clearMemberSessionCookie(Response.json({
        success: false,
        message: '登录状态已失效',
      }, { status: 401 }));
    }
    return attachMemberSessionCookies(Response.json({
      success: true,
      data: {
        token: session.token,
        member: serializeMember(member),
        expiresAt: session.expiresAt,
      },
    }), session);
  });
}
