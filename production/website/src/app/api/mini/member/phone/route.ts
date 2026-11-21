import { formatMemberPhoneForDisplay } from '@/lib/member-phone-display';
import { findPhoneMembers } from '@/lib/server/event-phone-member';
import { mergeVerifiedWechatPhoneAccounts, serializeMember } from '../../_auth';
import { POST as sendCode } from '../../send-code/route';
import {
  attachMemberSessionCookies, cleanText, createMemberDeviceSession, getAuthenticatedMemberId,
  jsonError, memberAccountAvailable, normalizeInternationalPhone, withDb,
} from '../../_helpers';

type ProfileMember = Record<string, any> & { id: number };

function mergedAway(member: ProfileMember) {
  return Boolean(Number(member.merged_to_member_id) || /member_id\s*=\s*\d+|\[merged_into:\d+\]/i.test(cleanText(member.remark)));
}

export async function POST(request: Request) {
  try {
    const memberId = getAuthenticatedMemberId(request);
    if (!memberId) return jsonError('未登录', 401);
    const body = await request.json().catch(() => ({}));
    if (body.action === 'send-code') {
      return sendCode(new Request(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify({ phone: body.phone, countryCode: body.countryCode, purpose: 'profile-phone' }),
      }));
    }
    let number;
    try {
      number = normalizeInternationalPhone(body.phone, body.countryCode);
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : '手机号格式错误', 400);
    }
    const { phone, internationalPhone, countryCode, nationalNumber } = number;
    const code = cleanText(body.code);
    if (!/^\d{6}$/.test(code)) return jsonError('请输入六位短信验证码', 400);

    return withDb(db => db.transaction(() => {
      const member = db.prepare('SELECT * FROM Member WHERE id=?').get<ProfileMember>(memberId);
      if (!member || mergedAway(member) || !memberAccountAvailable(db, memberId)) {
        return jsonError('账号资料已更新，请重新登录后重试', 409);
      }
      const challenge = db.prepare(`SELECT code, attempts FROM MiniProfilePhoneCode
        WHERE member_id=? AND phone=? AND expires_at > datetime('now','localtime')`)
        .get<{ code: string; attempts: number }>(memberId, phone);
      if (!challenge) return jsonError('验证码已过期或号码已更改，请重新获取', 400);
      if (challenge.attempts >= 5) return jsonError('验证码尝试次数过多，请重新获取', 429);
      if (challenge.code !== code) {
        db.prepare('UPDATE MiniProfilePhoneCode SET attempts=attempts+1 WHERE member_id=?').run(memberId);
        return jsonError('验证码错误', 400);
      }
      const owners = findPhoneMembers(db, phone) as ProfileMember[];
      const otherOwners = owners.filter(row => row.id !== memberId);
      const hasWechat = (row: ProfileMember) => Boolean(cleanText(row.wx_openid) || cleanText(row.wx_unionid)
        || db.prepare('SELECT 1 FROM WechatIdentity WHERE member_id=? LIMIT 1').get(row.id));
      let canonical = member;
      if (otherOwners.length) {
        const target = otherOwners[0];
        if (owners.length !== 1 || cleanText(member.phone) || cleanText(member.phone_national_number)
          || !hasWechat(member) || hasWechat(target) || mergedAway(target) || !memberAccountAvailable(db, target.id)) {
          return jsonError('该手机号已绑定其他账号，请使用其他号码或联系客服', 409);
        }
        mergeVerifiedWechatPhoneAccounts(db, target.id, memberId);
        canonical = target;
      }

      db.prepare('UPDATE Member SET phone=?, phone_country_code=?, phone_national_number=? WHERE id=?')
        .run(internationalPhone, countryCode, nationalNumber, canonical.id);
      const oldPhone = String(canonical.phone || '').replace(/\D/g, '').replace(/^86(?=1\d{10}$)/, '');
      const grantPhone = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(phone,''),'+',''),' ',''),'-',''),'(',''),')','')";
      const grantIdentity = `CASE WHEN length(${grantPhone}) = 13 AND substr(${grantPhone},1,2) = '86' THEN substr(${grantPhone},3) ELSE ${grantPhone} END`;
      if (oldPhone && db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='CourseAuthorization'").get()) {
        db.prepare(`UPDATE CourseAuthorization SET phone=? WHERE member_id=? AND ${grantIdentity}=?`)
          .run(phone, canonical.id, oldPhone);
      }
      const data = { phone: formatMemberPhoneForDisplay(phone, countryCode), countryCode };
      db.prepare('DELETE FROM MiniProfilePhoneCode WHERE member_id=?').run(memberId);
      const headers = { 'Cache-Control': 'private, no-store' };
      if (canonical.id === memberId) return Response.json({ success: true, data }, { headers });

      const merged = db.prepare('SELECT * FROM Member WHERE id=?').get<ProfileMember>(canonical.id)!;
      const session = createMemberDeviceSession(db, merged, request, 'wechat');
      const response = attachMemberSessionCookies(Response.json({
        success: true,
        data: { ...data, token: session.token, member: serializeMember(merged) },
      }), session);
      response.headers.set('Cache-Control', headers['Cache-Control']);
      return response;
    }).immediate());
  } catch (error) {
    if ((error as { code?: string } | null)?.code?.startsWith('SQLITE_CONSTRAINT_UNIQUE')) {
      return jsonError('账号记录存在冲突，请联系客服核对后合并', 409);
    }
    return jsonError('手机号保存失败，请稍后重试');
  }
}
