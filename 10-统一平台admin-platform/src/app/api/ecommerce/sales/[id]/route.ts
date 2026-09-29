import { hasAuth, openCommerceDb, unauthorized } from '../../_db';

export const dynamic = 'force-dynamic';

function toNumber(value: unknown, fallback = 0) {
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
    const sale = db.prepare('SELECT * FROM shop_sales WHERE id = ?').get(routeParams.id);
    if (!sale) return Response.json({ success: false, error: '销售记录不存在' }, { status: 404 });
    if (/^官网(?:订单|退款) EV[a-f0-9]{30}$/.test(sale.remark || '')) return Response.json({ error: '官网订单流水不能手工修改，请在官网商城订单中办理退款' }, { status: 409 });

    const product = db.prepare('SELECT * FROM shop_products WHERE id = ?').get(sale.product_id);
    const oldQty = toNumber(sale.quantity);
    const newQty = Math.max(1, toNumber(body.quantity, oldQty));
    if (product) {
      const available = toNumber(product.stock) + oldQty;
      if (newQty > available) return Response.json({ success: false, error: '库存不足' }, { status: 400 });
      db.prepare('UPDATE shop_products SET stock = ?, updated_at = ? WHERE id = ?').run(available - newQty, new Date().toISOString(), product.id);
    }

    const totalAmount = toNumber(body.amount ?? body.total_amount ?? body.total_price, toNumber(sale.total_amount));
    db.prepare(`
      UPDATE shop_sales
      SET quantity = ?, total_amount = ?, sale_date = ?, remark = ?, sale_type = ?, channel = ?
      WHERE id = ?
    `).run(
      newQty,
      totalAmount,
      body.date || body.sale_date || sale.sale_date,
      body.note ?? body.remark ?? sale.remark ?? '',
      body.saleType ?? body.sale_type ?? sale.sale_type ?? '线下',
      body.channel ?? sale.channel ?? '线下',
      routeParams.id,
    );
    db.prepare(`
      UPDATE shop_stock_logs
      SET quantity = ?, remark = ?, created_at = ?, channel = ?
      WHERE id = (
        SELECT id FROM shop_stock_logs
        WHERE product_id = ?
          AND quantity = ?
          AND (change_type LIKE '%出%' OR change_type LIKE '%销%')
        ORDER BY id DESC
        LIMIT 1
      )
    `).run(
      newQty,
      body.note ?? body.remark ?? sale.remark ?? '',
      body.date || body.sale_date || sale.sale_date,
      body.channel ?? sale.channel ?? '线下',
      sale.product_id,
      oldQty,
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
    const sale = db.prepare('SELECT * FROM shop_sales WHERE id = ?').get(routeParams.id);
    if (!sale) return Response.json({ success: false, error: '销售记录不存在' }, { status: 404 });
    if (/^官网(?:订单|退款) EV[a-f0-9]{30}$/.test(sale.remark || '')) return Response.json({ error: '官网订单流水不能手工修改，请在官网商城订单中办理退款' }, { status: 409 });

    const product = db.prepare('SELECT * FROM shop_products WHERE id = ?').get(sale.product_id);
    if (product) {
      db.prepare('UPDATE shop_products SET stock = ?, updated_at = ? WHERE id = ?').run(toNumber(product.stock) + toNumber(sale.quantity), new Date().toISOString(), product.id);
    }
    db.prepare('DELETE FROM shop_sales WHERE id = ?').run(routeParams.id);
    db.prepare(`
      DELETE FROM shop_stock_logs
      WHERE product_id = ?
        AND quantity = ?
        AND (change_type LIKE '%出%' OR change_type LIKE '%销%')
      ORDER BY id DESC
      LIMIT 1
    `).run(sale.product_id, sale.quantity);
    return Response.json({ success: true });
    })();
  } finally {
    db.close();
  }
}
