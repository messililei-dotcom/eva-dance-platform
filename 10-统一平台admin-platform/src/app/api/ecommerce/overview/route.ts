import { hasAuth, openCommerceDb, unauthorized } from '../_db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const db = openCommerceDb();
  try {
    const products = db.prepare("SELECT * FROM shop_products WHERE status != 'deleted' ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC").all();
    const sales = db.prepare('SELECT * FROM shop_sales ORDER BY datetime(created_at) DESC, id DESC').all();
    const stockLogs = db.prepare('SELECT * FROM shop_stock_logs ORDER BY datetime(created_at) DESC, id DESC').all();
    return Response.json({ products, sales, stockLogs });
  } finally {
    db.close();
  }
}
