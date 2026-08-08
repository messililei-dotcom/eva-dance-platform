import { openAdminDb } from '@/lib/server/admin-db';
import { hasAuth, unauthorized } from '../../training-db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const db = openAdminDb({ readonly: true });
  try {
    const members = db.prepare(`
      SELECT
        member.id,
        member.name,
        COALESCE(member.phone, '') AS phone,
        COALESCE(
          NULLIF(growth.level_name, '') || ' Lv.' || COALESCE(growth.level_no, 1),
          '初舞学员 Lv.1'
        ) AS level,
        COALESCE(member.status, 'active') AS status,
        COALESCE(member.country, '中国') AS country,
        COALESCE(member.city, '') AS city,
        COALESCE(member.avatar, '') AS avatar,
        COALESCE(member.wx_openid, '') AS wx_openid,
        COALESCE(member.wx_unionid, '') AS wx_unionid,
        COALESCE(member.wx_name, '') AS wx_name,
        COALESCE(member.wx_nickname, '') AS wx_nickname,
        COALESCE(member.wx_account, '') AS wx_account,
        COALESCE(member.wx_avatar_url, '') AS wx_avatar_url,
        COALESCE(member.register_date, '') AS register_date,
        member.created_at,
        COALESCE(payment.totalSpent, 0) AS totalSpent,
        COALESCE(payment.courseCount, 0) AS courseCount,
        COALESCE(payment.lastActiveAt, member.created_at) AS lastActiveAt
      FROM Member member
      LEFT JOIN (
        SELECT
          memberId,
          SUM(amount) AS totalSpent,
          COUNT(DISTINCT courseId) AS courseCount,
          MAX(COALESCE(NULLIF(date, ''), created_at)) AS lastActiveAt
        FROM Payment
        GROUP BY memberId
      ) payment ON payment.memberId = member.id
      LEFT JOIN StudentGrowthSummary growth ON growth.user_id = member.id
      WHERE COALESCE(member.status, 'active') != 'deleted'
      ORDER BY member.created_at DESC, member.id DESC
    `).all();
    const orderRevenue = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS value
      FROM orders
      WHERE status IN ('paid', 'completed')
        AND date(COALESCE(NULLIF(paid_at, ''), created_at)) <= date('now', 'localtime')
    `).get<{ value: number }>()?.value || 0;

    return Response.json({
      members,
      summary: {
        orderRevenue: Number(orderRevenue || 0),
      },
    });
  } finally {
    db.close();
  }
}
