import { hasAuth, openTrainingDb, unauthorized } from '../../training-db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const db = openTrainingDb();
  try {
    const month = new Date().toISOString().slice(0, 7);
    const memberStats = db.prepare(`
      SELECT COUNT(*) AS totalMembers,
             SUM(CASE WHEN EXISTS (SELECT 1 FROM orders o WHERE o.member_id = Member.id AND o.amount > 0) THEN 1 ELSE 0 END) AS activeMembers
      FROM Member WHERE COALESCE(status, 'active') != 'deleted'
    `).get<any>() || {};
    const orderStats = db.prepare(`
      SELECT COUNT(*) AS totalOrders, COALESCE(SUM(amount), 0) AS totalRevenue,
             COALESCE(SUM(CASE WHEN substr(COALESCE(NULLIF(paid_at, ''), created_at), 1, 7) = ? THEN amount ELSE 0 END), 0) AS monthRevenue
      FROM orders WHERE status IN ('paid', 'completed')
    `).get<any>(month) || {};
    const shopStats = db.prepare(`
      SELECT COUNT(*) AS productCount,
             SUM(CASE WHEN stock <= warning_stock THEN 1 ELSE 0 END) AS lowStockCount
      FROM shop_products WHERE status != 'deleted'
    `).get<any>() || {};
    const recentMembers = db.prepare(`
      SELECT id, name, phone, level, status, city, country,
             substr(COALESCE(register_date, created_at), 1, 10) AS registerDate,
             0 AS totalSpent, 0 AS courseCount, 0 AS growth,
             substr(COALESCE(register_date, created_at), 1, 16) AS lastActiveAt,
             avatar
      FROM Member WHERE COALESCE(status, 'active') != 'deleted'
      ORDER BY datetime(created_at) DESC, id DESC LIMIT 8
    `).all();
    const recentOrders = db.prepare(`
      SELECT id, order_no AS orderNo, member_id AS memberId, member_name AS memberName,
             member_phone AS memberPhone, order_type AS orderType, source_type AS sourceType,
             title, amount, status, pay_method AS payMethod,
             substr(COALESCE(NULLIF(paid_at, ''), created_at), 1, 10) AS orderDate
      FROM orders WHERE status IN ('paid', 'completed')
      ORDER BY datetime(COALESCE(NULLIF(paid_at, ''), created_at)) DESC, id DESC LIMIT 8
    `).all();
    const orderSources = db.prepare(`
      SELECT COALESCE(NULLIF(source_type, ''), 'orders') AS label,
             COALESCE(SUM(amount), 0) AS value, COUNT(*) AS count
      FROM orders WHERE status IN ('paid', 'completed')
      GROUP BY COALESCE(NULLIF(source_type, ''), 'orders') ORDER BY value DESC
    `).all();
    return Response.json({ data: { ...memberStats, ...orderStats, ...shopStats, recentMembers, recentOrders, orderSources } });
  } finally {
    db.close();
  }
}
