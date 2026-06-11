import { hasAuth, openTrainingDb, unauthorized } from '../../training-db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const db = openTrainingDb();
  try {
    const rows = db.prepare(`
      SELECT
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
        remark,
        created_at,
        updated_at
      FROM orders
      ORDER BY datetime(COALESCE(NULLIF(paid_at, ''), created_at)) DESC, id DESC
    `).all();
    return Response.json(rows);
  } finally {
    db.close();
  }
}
