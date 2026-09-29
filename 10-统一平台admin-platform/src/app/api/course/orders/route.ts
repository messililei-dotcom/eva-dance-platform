import { openAdminDb } from '@/lib/server/admin-db';
import { hasAuth, unauthorized } from '../../training-db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const db = openAdminDb({ readonly: true });
  try {
    const rows = db.prepare(`
      SELECT
        o.id,
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
        o.updated_at
      FROM CourseOrder o
      LEFT JOIN Member m ON m.id = o.member_id
      LEFT JOIN CourseSeries s ON s.id = o.series_id
      ORDER BY datetime(o.created_at) DESC
    `).all();
    return Response.json({ data: rows, total: rows.length });
  } finally {
    db.close();
  }
}
