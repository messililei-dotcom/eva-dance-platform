import { hasAuth, openCommerceDb, unauthorized } from '../_db';

export const dynamic = 'force-dynamic';

function cleanText(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function productId() {
  return `product-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const db = openCommerceDb();
  try {
    const products = db.prepare(`
      SELECT *
      FROM shop_products
      WHERE status != 'deleted'
      ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC
    `).all();
    return Response.json(products);
  } finally {
    db.close();
  }
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const name = cleanText(body.name);
  if (!name) return Response.json({ success: false, error: '请填写商品名称' }, { status: 400 });

  const now = new Date().toISOString();
  const id = cleanText(body.id, productId());
  const db = openCommerceDb();
  try {
    db.prepare(`
      INSERT INTO shop_products (
        id, name, category, spec, size, color, image, cost_price, sale_price,
        stock, warning_stock, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      cleanText(body.category, '未分类'),
      cleanText(body.spec ?? body.description, '基础款'),
      cleanText(body.size, '均码'),
      cleanText(body.color, '默认'),
      cleanText(body.image),
      toNumber(body.cost_price ?? body.costPrice),
      toNumber(body.sale_price ?? body.salePrice ?? body.price),
      Math.max(0, toNumber(body.stock)),
      Math.max(0, toNumber(body.warning_stock ?? body.warningStock, 3)),
      cleanText(body.status, '在售'),
      now,
      now,
    );
    return Response.json({ success: true, id });
  } finally {
    db.close();
  }
}
