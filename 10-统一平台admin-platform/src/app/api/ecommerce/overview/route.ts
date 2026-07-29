import { openAdminDb } from '@/lib/server/admin-db';
import { hasAuth, unauthorized } from '../_db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const db = openAdminDb({ readonly: true });
  try {
    const products = db.prepare(`
      SELECT *
      FROM shop_products
      WHERE status != 'deleted'
      ORDER BY updated_at DESC, created_at DESC
    `).all();
    const sales = db.prepare(`
      SELECT *
      FROM shop_sales
      ORDER BY COALESCE(NULLIF(sale_date, ''), created_at) DESC, id DESC
      LIMIT 2000
    `).all();
    const stockLogs = db.prepare(`
      SELECT *
      FROM shop_stock_logs
      ORDER BY created_at DESC, id DESC
      LIMIT 2000
    `).all();

    return Response.json({ products, sales, stockLogs });
  } finally {
    db.close();
  }
}
