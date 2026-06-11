import { loginData, upsertPhoneMember } from '../_auth';
import { cleanText, getMemberId, jsonError, withDb } from '../_helpers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const currentMemberId = getMemberId(new URL(request.url).searchParams, request);
    return withDb((db) => {
      const phone = cleanText(body.phone);
      const code = cleanText(body.code);
      if (!/^1\d{10}$/.test(phone)) return jsonError('请输入正确的手机号', 400);
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
      return Response.json({
        success: true,
        data: loginData(member),
      });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
