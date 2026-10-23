import { serializeMember, upsertPhoneMember } from '../_auth';
import {
  attachMemberSessionCookies,
  cleanText,
  createMemberDeviceSession,
  getAuthenticatedMemberId,
  jsonError,
  normalizeInternationalPhone,
  withDb,
} from '../_helpers';
import { createLocalWelcomeMessage } from '@/lib/server/inbox-events';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const currentMemberId = getAuthenticatedMemberId(request);
    return withDb((db) => {
      let normalized;
      try {
        normalized = normalizeInternationalPhone(body.phone, body.countryCode);
      } catch (err) {
        return jsonError(err instanceof Error ? err.message : '请输入正确的手机号', 400);
      }
      const phone = normalized.phone;
      const code = cleanText(body.code);
      if (!code) return jsonError('请输入验证码', 400);
      const record = db.prepare(
        `SELECT id FROM MiniSmsCode
         WHERE phone=? AND code=? AND used=0 AND expires_at > datetime('now','localtime')
         ORDER BY id DESC LIMIT 1`
      ).get(phone, code);
      const devBypass = process.env.NODE_ENV !== 'production' && process.env.MINI_LOGIN_DEV_CODE && code === process.env.MINI_LOGIN_DEV_CODE;
      if (!record && !devBypass) return jsonError('验证码错误或已过期', 400);
      if (record) db.prepare('UPDATE MiniSmsCode SET used=1 WHERE id=?').run(record.id);

      const member = upsertPhoneMember(db, phone, {
        sourceMemberId: currentMemberId,
        source: 'website_phone',
      });
      createLocalWelcomeMessage(db, Number(member.id), String(member.name || ''));
      db.prepare(
        `UPDATE Member
         SET phone_country_code=?, phone_national_number=?
         WHERE id=?`
      ).run(normalized.countryCode, normalized.nationalNumber, member.id);
      if (currentMemberId && Number(currentMemberId) !== Number(member.id)) {
        db.prepare(
          `UPDATE MemberDeviceSession
           SET revoked_at_ms=?, revoke_reason='merged_into_phone_account'
           WHERE member_id=? AND revoked_at_ms=0`
        ).run(Date.now(), currentMemberId);
      }
      const updatedMember = db.prepare('SELECT * FROM Member WHERE id=?').get<any>(member.id) || member;
      const session = createMemberDeviceSession(db, updatedMember, request, 'phone');
      return attachMemberSessionCookies(Response.json({
        success: true,
        data: {
          token: session.token,
          member: serializeMember(updatedMember),
        },
      }), session);
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
