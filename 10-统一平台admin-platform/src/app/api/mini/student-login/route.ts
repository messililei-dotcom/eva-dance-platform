import { normalizeEventPhone } from '@/lib/event-phone';
import { loginData, upsertPhoneMember } from '../_auth';
import { cleanText, getMemberId, jsonError, withDb } from '../_helpers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const currentMemberId = getMemberId(new URL(request.url).searchParams, request);
    return withDb((db) => {
      const normalized = normalizeEventPhone(body.phone, body.countryCode);
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
        source: 'mini_program',
      });
      db.prepare('UPDATE Member SET phone_country_code=?,phone_national_number=? WHERE id=?').run(normalized.countryCode, normalized.nationalNumber, member.id);
      return Response.json({
        success: true,
        data: loginData(member),
      });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
