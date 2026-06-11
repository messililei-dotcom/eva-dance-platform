import { hasAuth, openCommerceDb, unauthorized } from '../_db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const db = openCommerceDb();
  try {
    const logs = db.prepare('SELECT * FROM shop_stock_logs ORDER BY datetime(created_at) DESC, id DESC').all();
    return Response.json(logs);
  } finally {
    db.close();
  }
}
