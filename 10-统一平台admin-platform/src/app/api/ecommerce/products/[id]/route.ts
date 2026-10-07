import { hasAuth, openCommerceDb, unauthorized } from '../../_db';

export const dynamic = 'force-dynamic';

function cleanText(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function toNumber(value: unknown, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const db = openCommerceDb();
  try {
    return db.transaction(() => {
      db.prepare('UPDATE shop_products SET stock=stock WHERE id=?').run('');
    const product = db.prepare('SELECT * FROM shop_products WHERE id = ? AND status != ?').get(routeParams.id, 'deleted');
    if (!product) return Response.json({ success: false, error: '商品不存在' }, { status: 404 });

    if (body.expectedUpdatedAt !== undefined && body.expectedUpdatedAt !== product.updated_at) return Response.json({ error: '商品或库存已发生变化，请刷新后再编辑' }, { status: 409 });

    // A visibility-only update must never rewrite stock, price or sales status.
    if (Object.prototype.hasOwnProperty.call(body, 'hidden')) {
      if (typeof body.hidden !== 'boolean') return Response.json({ error: '隐藏状态无效' }, { status: 400 });
      db.prepare('UPDATE shop_products SET is_hidden=?,updated_at=? WHERE id=?').run(body.hidden ? 1 : 0, new Date().toISOString(), routeParams.id);
      return Response.json({success:true,hidden:body.hidden});
    }

    const name = cleanText(body.name, product.name);
    if (!name) return Response.json({ success: false, error: '请填写商品名称' }, { status: 400 });

    db.prepare(`
      UPDATE shop_products
      SET name = ?, category = ?, spec = ?, size = ?, color = ?, image = ?,
          cost_price = ?, sale_price = ?, stock = ?, warning_stock = ?,
          status = ?, updated_at = ?
      WHERE id = ?
    `).run(
      name,
      cleanText(body.category, product.category),
      cleanText(body.spec ?? body.description, product.spec),
      cleanText(body.size, product.size),
      cleanText(body.color, product.color),
      body.image === undefined ? product.image : cleanText(body.image),
      toNumber(body.cost_price ?? body.costPrice, product.cost_price),
      toNumber(body.sale_price ?? body.salePrice ?? body.price, product.sale_price),
      Math.max(0, toNumber(body.stock, product.stock)),
      Math.max(0, toNumber(body.warning_stock ?? body.warningStock, product.warning_stock)),
      cleanText(body.status, product.status || '在售'),
      new Date().toISOString(),
      routeParams.id,
    );
    return Response.json({ success: true });
    })();
  } finally {
    db.close();
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const db = openCommerceDb();
  try {
    return db.transaction(() => {
      db.prepare('UPDATE shop_products SET stock=stock WHERE id=?').run('');
    const product = db.prepare('SELECT * FROM shop_products WHERE id = ? AND status != ?').get(routeParams.id, 'deleted');
    if (!product) return Response.json({ success: false, error: '商品不存在' }, { status: 404 });
    if (toNumber(product.stock) > 0) {
      return Response.json({ success: false, error: '该商品仍有库存，不能删除。请先完成销售出库或库存调整。' }, { status: 400 });
    }

    db.prepare('UPDATE shop_products SET status = ?, updated_at = ? WHERE id = ?').run('deleted', new Date().toISOString(), routeParams.id);
    return Response.json({ success: true });
    })();
  } finally {
    db.close();
  }
}
