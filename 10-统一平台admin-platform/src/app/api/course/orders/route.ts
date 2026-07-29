import { openAdminDb } from '@/lib/server/admin-db';
import { hasAuth, unauthorized } from '../../training-db';

export const dynamic = 'force-dynamic';

function positiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const url = new URL(request.url);
  const page = positiveInt(url.searchParams.get('page'), 1, 100000);
  const pageSize = positiveInt(url.searchParams.get('pageSize'), 20, 200);
  const db = openAdminDb({ readonly: true });
  try {
    const combinedOrders = `
      WITH combined_orders AS (
        SELECT
          'course-' || o.id AS id,
          o.order_no,
          o.member_id,
          m.name AS member_name,
          m.phone AS member_phone,
          o.series_id,
          s.name AS series_name,
          o.amount,
          o.status,
          o.pay_method,
          o.paid_at,
          o.remark,
          o.created_at,
          o.updated_at,
          1 AS source_priority
        FROM CourseOrder o
        LEFT JOIN Member m ON m.id = o.member_id
        LEFT JOIN CourseSeries s ON s.id = o.series_id

        UNION ALL

        SELECT
          'unified-' || o.id AS id,
          o.order_no,
          o.member_id,
          o.member_name,
          o.member_phone,
          NULL AS series_id,
          o.title AS series_name,
          o.amount,
          o.status,
          o.pay_method,
          o.paid_at,
          o.remark,
          o.created_at,
          o.updated_at,
          2 AS source_priority
        FROM orders o
        WHERE o.order_type = 'online_course'
          AND o.order_no <> '订单号'
      ),
      ranked_orders AS (
        SELECT *,
          ROW_NUMBER() OVER (
            PARTITION BY order_no
            ORDER BY source_priority, datetime(COALESCE(NULLIF(paid_at, ''), created_at)) DESC
          ) AS row_number
        FROM combined_orders
      )
    `;
    const total = Number(db.prepare(`
      ${combinedOrders}
      SELECT COUNT(*) AS total
      FROM ranked_orders
      WHERE row_number = 1
    `).get<{ total: number }>()?.total || 0);
    const rows = db.prepare(`
      ${combinedOrders}
      SELECT
        id, order_no, member_id, member_name, member_phone, series_id, series_name,
        amount, status, pay_method, paid_at, remark, created_at, updated_at
      FROM ranked_orders
      WHERE row_number = 1
      ORDER BY datetime(COALESCE(NULLIF(paid_at, ''), created_at)) DESC, id DESC
      LIMIT ? OFFSET ?
    `).all(pageSize, (page - 1) * pageSize);
    return Response.json({ data: rows, total, page, pageSize });
  } finally {
    db.close();
  }
}
