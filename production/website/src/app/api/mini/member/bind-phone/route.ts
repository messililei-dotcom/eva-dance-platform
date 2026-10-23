import { serializeMember, upsertPhoneMember } from '../../_auth';
import {
  attachMemberSessionCookies,
  cleanText,
  createMemberDeviceSession,
  getAuthenticatedMemberId,
  jsonError,
  normalizeInternationalPhone,
  withDb,
} from '../../_helpers';

export async function POST(request: Request) {
  try {
    const currentMemberId = getAuthenticatedMemberId(request);
    if (!currentMemberId) return jsonError('登录状态已失效，请重新登录', 401);
    const body = await request.json().catch(() => ({}));
    let normalized;
    try {
      normalized = normalizeInternationalPhone(body.phone, body.countryCode);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : '请输入正确的手机号', 400);
    }
    const code = cleanText(body.code);
    if (!code) return jsonError('请输入短信验证码', 400);

    return withDb((db) => {
      const record = db.prepare(
        `SELECT id FROM MiniSmsCode
         WHERE phone=? AND code=? AND used=0 AND expires_at > datetime('now','localtime')
         ORDER BY id DESC LIMIT 1`
      ).get<{ id: number }>(normalized.phone, code);
      const devBypass = process.env.NODE_ENV !== 'production'
        && process.env.MINI_LOGIN_DEV_CODE
        && code === process.env.MINI_LOGIN_DEV_CODE;
      if (!record && !devBypass) return jsonError('验证码错误或已过期', 400);
      if (record) db.prepare('UPDATE MiniSmsCode SET used=1 WHERE id=?').run(record.id);

      const current = db.prepare(
        `SELECT * FROM Member WHERE id=? AND status='active' LIMIT 1`
      ).get<any>(currentMemberId);
      if (!current) return jsonError('学员账号不可用', 401);

      const canonical = upsertPhoneMember(db, normalized.phone, {
        sourceMemberId: currentMemberId,
        source: 'website_phone_bind',
      });
      db.prepare(
        `UPDATE Member
         SET phone_country_code=?, phone_national_number=?, status='active'
         WHERE id=?`
      ).run(normalized.countryCode, normalized.nationalNumber, canonical.id);
      const member = db.prepare('SELECT * FROM Member WHERE id=?').get<any>(canonical.id) || canonical;
      const session = createMemberDeviceSession(db, member, request, 'phone');

      return attachMemberSessionCookies(Response.json({
        success: true,
        data: {
          token: session.token,
          member: serializeMember(member),
        },
      }), session);
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '手机号绑定失败');
  }
}
