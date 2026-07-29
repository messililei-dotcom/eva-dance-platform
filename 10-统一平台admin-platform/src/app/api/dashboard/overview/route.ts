import { openAdminDb } from '@/lib/server/admin-db';
import { hasAuth, unauthorized } from '../../training-db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const db = openAdminDb({ readonly: true });
  try {
    const effectiveDate = "COALESCE(NULLIF(paid_at, ''), created_at)";
    const memberStats = db.prepare(`
      SELECT
        COUNT(*) AS totalMembers,
        SUM(CASE WHEN EXISTS (
          SELECT 1 FROM Payment payment
          WHERE payment.memberId = Member.id AND COALESCE(payment.amount, 0) > 0
        ) THEN 1 ELSE 0 END) AS activeMembers
      FROM Member
      WHERE COALESCE(status, 'active') != 'deleted'
    `).get<any>() || {};
    const orderStats = db.prepare(`
      SELECT
        COUNT(*) AS totalOrders,
        COALESCE(SUM(amount), 0) AS totalRevenue,
        COALESCE(SUM(CASE
          WHEN substr(${effectiveDate}, 1, 7) = strftime('%Y-%m', 'now', 'localtime') THEN amount
          ELSE 0
        END), 0) AS monthRevenue
      FROM orders
      WHERE date(${effectiveDate}) <= date('now', 'localtime')
    `).get<any>() || {};
    const productStats = db.prepare(`
      SELECT
        COUNT(*) AS productCount,
        SUM(CASE WHEN stock <= warning_stock THEN 1 ELSE 0 END) AS lowStockCount
      FROM shop_products
      WHERE status != 'deleted'
    `).get<any>() || {};
    const recentMembers = db.prepare(`
      SELECT
        id,
        name,
        COALESCE(phone, '') AS phone,
        COALESCE(level, '普通学员') AS level,
        COALESCE(status, 'active') AS status,
        COALESCE(city, province, '') AS city,
        COALESCE(country, '中国') AS country,
        COALESCE(register_date, substr(created_at, 1, 10)) AS registerDate,
        0 AS totalSpent,
        0 AS courseCount,
        COALESCE(created_at, '') AS lastActiveAt
      FROM Member
      WHERE COALESCE(status, 'active') != 'deleted'
      ORDER BY created_at DESC, id DESC
      LIMIT 8
    `).all();
    const recentOrders = db.prepare(`
      SELECT
        id,
        order_no AS orderNo,
        substr(${effectiveDate}, 1, 10) AS orderDate,
        member_name AS memberName,
        member_phone AS memberPhone,
        order_type AS orderType,
        title,
        amount,
        status,
        source_type AS sourceType,
        pay_method AS payMethod
      FROM orders
      WHERE date(${effectiveDate}) <= date('now', 'localtime')
      ORDER BY ${effectiveDate} DESC, id DESC
      LIMIT 8
    `).all();
    const orderSources = db.prepare(`
      SELECT
        COALESCE(NULLIF(source_type, ''), '未知来源') AS label,
        COALESCE(SUM(amount), 0) AS value,
        COUNT(*) AS count
      FROM orders
      WHERE date(${effectiveDate}) <= date('now', 'localtime')
      GROUP BY COALESCE(NULLIF(source_type, ''), '未知来源')
      ORDER BY value DESC
    `).all();

    return Response.json({
      totalMembers: Number(memberStats.totalMembers || 0),
      activeMembers: Number(memberStats.activeMembers || 0),
      totalOrders: Number(orderStats.totalOrders || 0),
      totalRevenue: Number(orderStats.totalRevenue || 0),
      monthRevenue: Number(orderStats.monthRevenue || 0),
      productCount: Number(productStats.productCount || 0),
      lowStockCount: Number(productStats.lowStockCount || 0),
      recentMembers,
      recentOrders,
      orderSources,
    });
  } finally {
    db.close();
  }
}
