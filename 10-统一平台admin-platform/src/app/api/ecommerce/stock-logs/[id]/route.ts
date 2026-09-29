import { hasAuth, openCommerceDb, unauthorized } from '../../_db';

export const dynamic = 'force-dynamic';

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isOutLog(log: any) {
  const text = String(log?.change_type || '');
  return text.includes('出') || text.includes('销') || text.toLowerCase().includes('out');
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const db = openCommerceDb();
  try {
    return db.transaction(() => {
      db.prepare('UPDATE shop_products SET stock=stock WHERE id=?').run('');
    const log = db.prepare('SELECT * FROM shop_stock_logs WHERE id = ?').get(routeParams.id);
    if (!log) return Response.json({ success: false, error: '流水记录不存在' }, { status: 404 });
    if (log.operator === '官网商城' && /^EV[a-f0-9]{30}$/.test(log.remark || '')) return Response.json({ error: '官网库存流水不能手工修改，请通过订单操作' }, { status: 409 });

    const product = db.prepare('SELECT * FROM shop_products WHERE id = ?').get(log.product_id);
    const oldQty = toNumber(log.quantity);
    const newQty = Math.max(1, toNumber(body.quantity, oldQty));
    const delta = newQty - oldQty;
    if (product && delta !== 0) {
      const nextStock = isOutLog(log) ? toNumber(product.stock) - delta : toNumber(product.stock) + delta;
      if (nextStock < 0) return Response.json({ success: false, error: '库存不足' }, { status: 400 });
      db.prepare('UPDATE shop_products SET stock = ?, updated_at = ? WHERE id = ?').run(nextStock, new Date().toISOString(), product.id);
    }

    db.prepare(`
      UPDATE shop_stock_logs
      SET quantity = ?, remark = ?, created_at = ?, channel = ?
      WHERE id = ?
    `).run(
      newQty,
      body.note ?? body.remark ?? log.remark ?? '',
      body.date || log.created_at,
      body.channel ?? log.channel ?? '',
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
    const log = db.prepare('SELECT * FROM shop_stock_logs WHERE id = ?').get(routeParams.id);
    if (!log) return Response.json({ success: false, error: '流水记录不存在' }, { status: 404 });
    if (log.operator === '官网商城' && /^EV[a-f0-9]{30}$/.test(log.remark || '')) return Response.json({ error: '官网库存流水不能手工修改，请通过订单操作' }, { status: 409 });

    const product = db.prepare('SELECT * FROM shop_products WHERE id = ?').get(log.product_id);
    if (product) {
      const qty = toNumber(log.quantity);
      const nextStock = isOutLog(log) ? toNumber(product.stock) + qty : Math.max(0, toNumber(product.stock) - qty);
      db.prepare('UPDATE shop_products SET stock = ?, updated_at = ? WHERE id = ?').run(nextStock, new Date().toISOString(), product.id);
    }
    db.prepare('DELETE FROM shop_stock_logs WHERE id = ?').run(routeParams.id);
    return Response.json({ success: true });
    })();
  } finally {
    db.close();
  }
}
