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

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const quantity = Math.trunc(toNumber(body.quantity));
  if (quantity <= 0) return Response.json({ success: false, error: '入库数量必须大于 0' }, { status: 400 });

  const db = openCommerceDb();
  try {
    return db.transaction(() => {
      db.prepare('UPDATE shop_products SET stock=stock WHERE id=?').run('');
    const now = new Date().toISOString();
    const hasColor = body.color !== undefined && body.color !== null && String(body.color).trim() !== '';
    const hasSize = body.size !== undefined && body.size !== null && String(body.size).trim() !== '';
    let product = body.product_id || body.productId
      ? db.prepare('SELECT * FROM shop_products WHERE id = ? AND status != ?').get(body.product_id || body.productId, 'deleted')
      : null;
    const color = cleanText(body.color, product?.color || '默认');
    const size = cleanText(body.size, product?.size || '均码');

    if (product && ((hasColor && color !== product.color) || (hasSize && size !== product.size))) {
      product = db.prepare(`
        SELECT * FROM shop_products
        WHERE name = ? AND category = ? AND spec = ? AND color = ? AND size = ? AND status != 'deleted'
      `).get(product.name, product.category, product.spec, color, size);
    }

    if (!product) {
      const id = productId();
      const name = cleanText(body.name);
      if (!name) return Response.json({ success: false, error: '商品不存在' }, { status: 404 });
      db.prepare(`
        INSERT INTO shop_products (
          id, name, category, spec, size, color, image, cost_price, sale_price,
          stock, warning_stock, status, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, '在售', ?, ?)
      `).run(
        id,
        name,
        cleanText(body.category, '未分类'),
        cleanText(body.spec, '基础款'),
        size,
        color,
        cleanText(body.image),
        toNumber(body.cost_price ?? body.costPrice ?? body.unitCost),
        toNumber(body.sale_price ?? body.salePrice),
        Math.max(0, toNumber(body.warning_stock ?? body.warningStock, 3)),
        now,
        now,
      );
      product = db.prepare('SELECT * FROM shop_products WHERE id = ?').get(id);
    }

    const beforeStock = toNumber(product.stock);
    const afterStock = beforeStock + quantity;
    const costPrice = toNumber(body.cost_price ?? body.costPrice ?? body.unitCost, product.cost_price);
    const salePrice = toNumber(body.sale_price ?? body.salePrice, product.sale_price);

    db.prepare('UPDATE shop_products SET stock = ?, cost_price = ?, sale_price = ?, updated_at = ? WHERE id = ?')
      .run(afterStock, costPrice, salePrice, now, product.id);
    db.prepare(`
      INSERT INTO shop_stock_logs (
        product_id, product_name, change_type, quantity, before_stock, after_stock,
        operator, remark, created_at, channel, cost_price
      )
      VALUES (?, ?, '入库', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      product.id,
      product.name,
      quantity,
      beforeStock,
      afterStock,
      cleanText(body.operator, 'admin'),
      cleanText(body.note ?? body.remark ?? body.supplier),
      cleanText(body.date, now),
      cleanText(body.supplier, '进货入库'),
      costPrice,
    );

    return Response.json({ success: true });
    })();
  } finally {
    db.close();
  }
}
