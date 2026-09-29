import { memberSpending } from '@/lib/server/member-spending';
import { openAdminDb } from '@/lib/server/admin-db';
import { hasAuth, openTrainingDb, unauthorized } from '../../training-db';
import { normalizeMemberPhone, normalizedMemberPhoneSql } from '@/lib/member-phone-search';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const search = new URL(request.url).searchParams.get('q')?.trim().slice(0, 80) || '';
  const searchLike = `%${search}%`;
  const phoneSearch = normalizeMemberPhone(search);
  const memberPhoneSql = normalizedMemberPhoneSql('member.phone');
  const memberNationalPhoneSql = normalizedMemberPhoneSql('member.phone_national_number');
  const searchWhere = search ? `
        AND (
          member.name LIKE ?
          OR COALESCE(member.phone, '') LIKE ?
          OR COALESCE(member.phone_national_number, '') LIKE ?
          ${phoneSearch ? `OR ${memberPhoneSql} LIKE ? OR ${memberNationalPhoneSql} LIKE ?` : ''}
        )
  ` : '';
  const searchParams = search
    ? [searchLike, searchLike, searchLike, ...(phoneSearch ? [`%${phoneSearch}%`, `%${phoneSearch}%`] : [])]
    : [];

  const lookup = new URL(request.url).searchParams.get('mode') === 'lookup';
  const db = lookup ? openAdminDb() : openTrainingDb();
  try {
    if (lookup) {
      const members = db.prepare(`
        SELECT member.id, member.name,
          COALESCE(NULLIF(member.phone, ''), member.phone_national_number, '') AS phone,
          member.status, member.source
        FROM Member member
        WHERE COALESCE(member.status, 'active') NOT IN ('deleted', 'merged')
        ${searchWhere}
        ORDER BY member.created_at DESC, member.id DESC
      `).all(...searchParams);
      return Response.json({ members, summary: { orderRevenue: 0 } }, {
        headers: { 'Cache-Control': 'private, no-store, max-age=0' },
      });
    }
    const spending = memberSpending(db);
    const members = db.prepare(`
      SELECT
        member.id,
        member.name,
        member.source,
        member.remark,
        CASE WHEN member.status='merged' THEN CAST(substr(member.remark, instr(member.remark, '[merged_into:') + 13) AS INTEGER) END AS mergedInto,
        COALESCE(NULLIF(member.phone, ''), member.phone_national_number, '') AS phone,
        COALESCE(member.level, '普通学员') AS level,
        COALESCE(member.status, 'active') AS status,
        COALESCE(member.country, '中国') AS country,
        COALESCE(member.city, '') AS city,
        COALESCE(member.avatar, '') AS avatar,
        COALESCE(NULLIF(member.wx_openid, ''), identity.openid, '') AS wx_openid,
        COALESCE(NULLIF(member.wx_unionid, ''), identity.unionid, '') AS wx_unionid,
        COALESCE(member.wx_name, '') AS wx_name,
        COALESCE(member.wx_nickname, '') AS wx_nickname,
        COALESCE(member.wx_account, '') AS wx_account,
        COALESCE(member.wx_avatar_url, '') AS wx_avatar_url,
        COALESCE(member.register_date, '') AS register_date,
        member.created_at,
        0 AS totalSpent,
        COALESCE(payment.courseCount, 0) AS offlineCourseCount,
        COALESCE(online.courseCount, 0) AS onlineCourseCount,
        COALESCE(payment.courseCount, 0) + COALESCE(online.courseCount, 0) AS courseCount,
        COALESCE(payment.lastActiveAt, member.created_at) AS lastActiveAt
      FROM Member member
      LEFT JOIN (
        SELECT member_id, MAX(NULLIF(openid, '')) AS openid, MAX(NULLIF(unionid, '')) AS unionid
        FROM WechatIdentity GROUP BY member_id
      ) identity ON identity.member_id=member.id
      LEFT JOIN (
        SELECT member_id, COUNT(DISTINCT series_id) AS courseCount
        FROM CourseAuthorization
        WHERE status='active' AND (expire_at IS NULL OR expire_at='' OR expire_at > datetime('now','localtime'))
        GROUP BY member_id
      ) online ON online.member_id=member.id
      LEFT JOIN (
        SELECT
          memberId,
          COUNT(DISTINCT courseId) AS courseCount,
          MAX(COALESCE(NULLIF(date, ''), created_at)) AS lastActiveAt
        FROM Payment
        GROUP BY memberId
      ) payment ON payment.memberId = member.id
      WHERE COALESCE(member.status, 'active') != 'deleted'
      ${searchWhere}
      ORDER BY member.created_at DESC, member.id DESC
    `).all<any>(...searchParams).map(member => ({ ...member, totalSpent: spending.get(Number(member.id)) || 0 }));
    const orderRevenue = Math.round(members
      .filter(member => member.status !== 'merged' && !(member.source === 'certificate-import' && !member.phone))
      .reduce((sum, member) => sum + Math.round(member.totalSpent * 100), 0)) / 100;

    return Response.json({
      members,
      summary: {
        orderRevenue: Number(orderRevenue || 0),
      },
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } finally {
    db.close();
  }
}
