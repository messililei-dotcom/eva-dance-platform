import { openAdminDb } from '@/lib/server/admin-db';
import { verifyLocalToken } from '../_local-auth';

export function openCommerceDb() {
  const db = openAdminDb();
  ensureCommerceTables(db);
  return db;
}

export function ensureCommerceTables(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS shop_products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      spec TEXT DEFAULT '',
      size TEXT DEFAULT '',
      color TEXT DEFAULT '',
      image TEXT DEFAULT '',
      cost_price REAL NOT NULL DEFAULT 0,
      sale_price REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      warning_stock INTEGER NOT NULL DEFAULT 3,
      status TEXT NOT NULL DEFAULT '在售',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS shop_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      total_amount REAL NOT NULL,
      member_id INTEGER DEFAULT 0,
      member_name TEXT DEFAULT '',
      sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      remark TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS shop_stock_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      change_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      before_stock INTEGER NOT NULL,
      after_stock INTEGER NOT NULL,
      operator TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  ensureColumn(db, 'shop_sales', 'sale_type', "TEXT DEFAULT '线下'");
  ensureColumn(db, 'shop_sales', 'channel', "TEXT DEFAULT '线下'");
  ensureColumn(db, 'shop_sales', 'customer_phone', "TEXT DEFAULT ''");
  ensureColumn(db, 'shop_sales', 'operator', "TEXT DEFAULT ''");
  ensureColumn(db, 'shop_stock_logs', 'channel', "TEXT DEFAULT ''");
  ensureColumn(db, 'shop_stock_logs', 'cost_price', 'REAL DEFAULT 0');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_shop_products_status_updated ON shop_products(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_shop_sales_date ON shop_sales(sale_date DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_shop_stock_logs_date ON shop_stock_logs(created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_shop_stock_logs_product ON shop_stock_logs(product_id, created_at DESC);
  `);
  const columns = db.prepare('PRAGMA table_info(shop_products)').all();
  if (!columns.some((column: any) => column.name === 'is_hidden')) db.exec('ALTER TABLE shop_products ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0');

}

function ensureColumn(db: any, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((row: any) => row.name);
  if (!columns.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

export function unauthorized() {
  return Response.json({ success: false, error: '未登录' }, { status: 401 });
}

function cookieValue(cookieHeader: string | null, names: string[]) {
  if (!cookieHeader) return '';
  const cookies = cookieHeader.split(';').map(cookie => cookie.trim());
  for (const name of names) {
    const prefix = `${name}=`;
    const raw = cookies.find(cookie => cookie.startsWith(prefix))?.slice(prefix.length);
    if (!raw) continue;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return '';
}

export function hasAuth(request: Request) {
  if (process.env.NODE_ENV !== 'production') {
    try {
      const hostname = new URL(request.url).hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1') return true;
    } catch {}
  }

  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
    || cookieValue(request.headers.get('cookie'), ['token', 'admin_media_token']);
  if (!token) return false;

  try {
    return Boolean(verifyLocalToken(token));
  } catch {
    return false;
  }
}
