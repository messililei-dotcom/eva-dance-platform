import { openAdminDb } from '@/lib/server/admin-db';
import { hasAuth, unauthorized } from '../../training-db';

export const dynamic = 'force-dynamic';

const ORDER_COLUMNS = `
  id,
  order_no AS orderNo,
  member_id AS memberId,
  member_name AS memberName,
  member_phone AS memberPhone,
  order_type AS orderType,
  source_type AS sourceType,
  source_id AS sourceId,
  title,
  amount,
  status,
  pay_method AS payMethod,
  COALESCE(NULLIF(paid_at, ''), created_at) AS orderDate,
  remark
`;

function positiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const url = new URL(request.url);
  const db = openAdminDb({ readonly: true });
  try {
    const effectiveDate = "COALESCE(NULLIF(paid_at, ''), created_at)";
    const asOfToday = `date(${effectiveDate}) <= date('now', 'localtime')`;

    if (url.searchParams.get('financeSummary') === '1') {
      const nowMonth = db.prepare(
        "SELECT strftime('%Y-%m', 'now', 'localtime') AS month",
      ).get<{ month: string }>()?.month || '';
      const stats = db.prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN status IN ('paid', 'completed') THEN amount ELSE 0 END), 0) AS income,
          COALESCE(SUM(CASE WHEN status = 'refunded' THEN amount ELSE 0 END), 0) AS refunds,
          SUM(CASE WHEN status IN ('paid', 'completed') THEN 1 ELSE 0 END) AS orderCount,
          COALESCE(SUM(CASE
            WHEN status IN ('paid', 'completed') AND substr(${effectiveDate}, 1, 7) = ? THEN amount
            ELSE 0
          END), 0) AS monthIncome
        FROM orders
        WHERE ${asOfToday}
      `).get<any>(nowMonth) || {};
      const byType = db.prepare(`
        SELECT COALESCE(NULLIF(order_type, ''), '其他') AS label,
               COALESCE(SUM(amount), 0) AS value,
               COUNT(*) AS count
        FROM orders
        WHERE status IN ('paid', 'completed') AND ${asOfToday}
        GROUP BY COALESCE(NULLIF(order_type, ''), '其他')
        ORDER BY value DESC
      `).all();
      const recentOrders = db.prepare(`
        SELECT ${ORDER_COLUMNS}
        FROM orders
        WHERE ${asOfToday}
        ORDER BY ${effectiveDate} DESC, id DESC
        LIMIT 200
      `).all();
      const income = Number(stats.income || 0);
      const refunds = Number(stats.refunds || 0);
      const orderCount = Number(stats.orderCount || 0);

      return Response.json({
        income,
        expense: refunds,
        profit: income - refunds,
        orderCount,
        averageOrderAmount: orderCount ? Math.round(income / orderCount) : 0,
        monthIncome: Number(stats.monthIncome || 0),
        refunds,
        byType,
        recentOrders,
      });
    }

    const page = positiveInt(url.searchParams.get('page'), 1, 100000);
    const pageSize = positiveInt(url.searchParams.get('pageSize') || url.searchParams.get('limit'), 20, 200);
    const keyword = String(url.searchParams.get('keyword') || '').trim();
    const orderType = String(url.searchParams.get('orderType') || '').trim();
    const status = String(url.searchParams.get('status') || '').trim();
    const dateFrom = String(url.searchParams.get('dateFrom') || '').trim();
    const dateTo = String(url.searchParams.get('dateTo') || '').trim();
    const conditions: string[] = [asOfToday];
    const params: unknown[] = [];

    if (keyword) {
      conditions.push(`(
        order_no LIKE ? OR member_name LIKE ? OR member_phone LIKE ? OR title LIKE ?
      )`);
      const pattern = `%${keyword}%`;
      params.push(pattern, pattern, pattern, pattern);
    }
    if (orderType && orderType !== 'all') {
      conditions.push('order_type = ?');
      params.push(orderType);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
      conditions.push(`date(${effectiveDate}) >= date(?)`);
      params.push(dateFrom);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      conditions.push(`date(${effectiveDate}) <= date(?)`);
      params.push(dateTo);
    }

    const statusWhere = conditions.join(' AND ');
    const statusParams = [...params];
    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }

    const where = conditions.join(' AND ');
    const totals = db.prepare(`
      SELECT COUNT(*) AS total, COALESCE(SUM(amount), 0) AS totalAmount
      FROM orders
      WHERE ${where}
    `).get<{ total: number; totalAmount: number }>(...params) || { total: 0, totalAmount: 0 };
    const statusCounts = db.prepare(`
      SELECT status, COUNT(*) AS count
      FROM orders
      WHERE ${statusWhere}
      GROUP BY status
    `).all<{ status: string; count: number }>(...statusParams);
    const items = db.prepare(`
      SELECT ${ORDER_COLUMNS}
      FROM orders
      WHERE ${where}
      ORDER BY ${effectiveDate} DESC, id DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, (page - 1) * pageSize);
    const types = db.prepare(`
      SELECT DISTINCT order_type AS value
      FROM orders
      WHERE COALESCE(order_type, '') != ''
      ORDER BY order_type
    `).all<{ value: string }>().map(row => row.value);

    return Response.json({
      items,
      total: Number(totals.total || 0),
      page,
      pageSize,
      summary: {
        totalAmount: Number(totals.totalAmount || 0),
        allCount: statusCounts.reduce((sum, row) => sum + Number(row.count || 0), 0),
        statusCounts: Object.fromEntries(statusCounts.map(row => [row.status, Number(row.count || 0)])),
      },
      types,
    });
  } finally {
    db.close();
  }
}
