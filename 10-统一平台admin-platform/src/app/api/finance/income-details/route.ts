import { AUTHORIZATION_INCOME_SQL, MANUAL_INCOME_PREDICATE } from '@/lib/server/authorization-revenue';
import { hasAuth, openTrainingDb, unauthorized } from '../../training-db';

export const dynamic = 'force-dynamic';

const INCOME_LEDGER_SQL = `
  SELECT
    'order-' || id AS id,
    substr(COALESCE(NULLIF(paid_at, ''), created_at), 1, 10) AS date,
    COALESCE(NULLIF(order_type, ''), '其他') AS source,
    CASE
      WHEN lower(replace(COALESCE(order_type, ''), '-', '_')) IN
        ('online_course', 'online_courses', 'course', 'online', 'course_online')
      THEN '历史线上订单'
      ELSE '线下缴费'
    END AS evidence,
    order_no AS referenceNo,
    COALESCE(NULLIF(title, ''), order_no) AS title,
    COALESCE(remark, '') AS itemMeta,
    COALESCE(member_name, '') AS subject,
    COALESCE(member_phone, '') AS subjectMeta,
    COALESCE(pay_method, '') AS payMethod,
    amount,
    status,
    COALESCE(remark, '') AS remark,
    'order' AS sourceKind
  FROM orders
  WHERE status IN ('paid', 'completed')
    AND date(COALESCE(NULLIF(paid_at, ''), created_at)) <= date('now', 'localtime')

  UNION ALL

  SELECT
    'legacy-income-' || id AS id,
    substr(COALESCE(NULLIF(income_date, ''), NULLIF(incomeDate, ''), created_at), 1, 10) AS date,
    COALESCE(NULLIF(category, ''), '财务收入') AS source,
    CASE WHEN category LIKE '%线上课程%' THEN '学员授权' ELSE '财务录入' END AS evidence,
    COALESCE(NULLIF(incomeNo, ''), '收入-' || id) AS referenceNo,
    COALESCE(NULLIF(title, ''), NULLIF(remark, ''), '收入流水') AS title,
    CASE
      WHEN incomeNo LIKE 'AUTH-%' THEN '授权ID ' || substr(incomeNo, 6)
      ELSE ''
    END AS itemMeta,
    COALESCE(NULLIF(memberName, ''), NULLIF(payer, ''), '') AS subject,
    CASE WHEN COALESCE(memberId, 0) > 0 THEN 'member_id ' || memberId ELSE '' END AS subjectMeta,
    COALESCE(NULLIF(payment_method, ''), NULLIF(account, ''), '') AS payMethod,
    amount,
    'paid' AS status,
    COALESCE(remark, '') AS remark,
    'finance-income' AS sourceKind
  FROM FinanceIncome
  WHERE ${MANUAL_INCOME_PREDICATE} AND date(COALESCE(NULLIF(income_date, ''), NULLIF(incomeDate, ''), created_at)) <= date('now', 'localtime')

  UNION ALL

  SELECT 'authorization-income-' || id AS id, income_date AS date, category AS source,
    '学员授权' AS evidence, incomeNo AS referenceNo, title,
    '授权ID ' || id AS itemMeta, memberName AS subject,
    'member_id ' || memberId AS subjectMeta, '' AS payMethod, amount,
    'paid' AS status, remark, 'finance-income' AS sourceKind
  FROM (${AUTHORIZATION_INCOME_SQL})
  WHERE date(income_date) <= date('now', 'localtime')

  UNION ALL

  SELECT
    'sale-' || id AS id,
    substr(COALESCE(NULLIF(sale_date, ''), created_at), 1, 10) AS date,
    '电商销售' AS source,
    '电商销售' AS evidence,
    '电商-' || id AS referenceNo,
    COALESCE(NULLIF(product_name, ''), '商品销售') AS title,
    quantity || ' 件 / 单价 ¥' || printf('%.2f', unit_price) AS itemMeta,
    COALESCE(member_name, '') AS subject,
    COALESCE(customer_phone, '') AS subjectMeta,
    COALESCE(channel, '') AS payMethod,
    total_amount AS amount,
    'paid' AS status,
    COALESCE(remark, '') AS remark,
    'ecommerce-sale' AS sourceKind
  FROM shop_sales
  WHERE date(COALESCE(NULLIF(sale_date, ''), created_at)) <= date('now', 'localtime')
`;

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const url = new URL(request.url);
  const page = positiveInteger(url.searchParams.get('page'), 1);
  const pageSize = Math.min(100, positiveInteger(url.searchParams.get('pageSize'), 25));
  const keyword = String(url.searchParams.get('keyword') || '').trim();
  const sourceKind = String(url.searchParams.get('sourceKind') || '').trim();
  const db = openTrainingDb();

  try {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (keyword) {
      conditions.push(`(date LIKE ? OR source LIKE ? OR evidence LIKE ? OR referenceNo LIKE ?
        OR title LIKE ? OR itemMeta LIKE ? OR subject LIKE ? OR subjectMeta LIKE ?
        OR '' LIKE ? OR status LIKE ? OR remark LIKE ?)`);
      values.push(...Array(11).fill(`%${keyword}%`));
    }
    if (['order', 'finance-income', 'ecommerce-sale'].includes(sourceKind)) {
      conditions.push('sourceKind = ?');
      values.push(sourceKind);
    }
    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const totalRow = db.prepare(`
      WITH income_ledger AS (${INCOME_LEDGER_SQL})
      SELECT COUNT(*) AS total FROM income_ledger ${whereSql}
    `).get<any>(...values) || {};
    // The expensive global aggregates are only needed on first load. Pagination and
    // searches can skip them, keeping navigation responsive as the ledger grows.
    const includeSummary = url.searchParams.get('includeSummary') !== '0';
    const summary = includeSummary ? db.prepare(`
        WITH income_ledger AS (${INCOME_LEDGER_SQL})
        SELECT
          COUNT(*) AS totalCount,
          COALESCE(SUM(amount), 0) AS totalAmount,
          SUM(CASE WHEN substr(date, 1, 4) = strftime('%Y', 'now', 'localtime') THEN 1 ELSE 0 END) AS yearCount,
          COALESCE(SUM(CASE WHEN substr(date, 1, 4) = strftime('%Y', 'now', 'localtime') THEN amount ELSE 0 END), 0) AS yearAmount,
          SUM(CASE WHEN substr(date, 1, 7) = strftime('%Y-%m', 'now', 'localtime') THEN 1 ELSE 0 END) AS monthCount,
          COALESCE(SUM(CASE WHEN substr(date, 1, 7) = strftime('%Y-%m', 'now', 'localtime') THEN amount ELSE 0 END), 0) AS monthAmount,
          strftime('%Y', 'now', 'localtime') AS currentYear,
          strftime('%Y-%m', 'now', 'localtime') AS currentMonth
        FROM income_ledger
      `).get<any>() || {} : {};
    const bySource = includeSummary ? db.prepare(`
        WITH income_ledger AS (${INCOME_LEDGER_SQL})
        SELECT source AS label, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS value
        FROM income_ledger
        GROUP BY source
        ORDER BY value DESC
      `).all() : [];
    const rows = db.prepare(`
      WITH income_ledger AS (${INCOME_LEDGER_SQL})
      SELECT * FROM income_ledger
      ${whereSql}
      ORDER BY date DESC, id DESC
      LIMIT ? OFFSET ?
    `).all(...values, pageSize, (page - 1) * pageSize);

    return Response.json({
      data: rows,
      total: Number(totalRow.total || 0),
      page,
      pageSize,
      summary: includeSummary ? {
        totalCount: Number(summary.totalCount || 0),
        totalAmount: Number(summary.totalAmount || 0),
        yearCount: Number(summary.yearCount || 0),
        yearAmount: Number(summary.yearAmount || 0),
        monthCount: Number(summary.monthCount || 0),
        monthAmount: Number(summary.monthAmount || 0),
        currentYear: String(summary.currentYear || ''),
        currentMonth: String(summary.currentMonth || ''),
      } : null,
      bySource,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } finally {
    db.close();
  }
}
