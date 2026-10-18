import { saleCommissionFields } from '@/lib/sale-commission';
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

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const db = openCommerceDb();
  try {
    return db.transaction(() => {
      db.prepare('UPDATE shop_products SET stock=stock WHERE id=?').run('');
    const sales = db.prepare('SELECT * FROM shop_sales ORDER BY datetime(created_at) DESC, id DESC').all();
    return Response.json(sales);
    })();
  } finally {
    db.close();
  }
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const productId = cleanText(body.product_id ?? body.productId);
  const quantity = Math.trunc(toNumber(body.quantity));
  if (!productId) return Response.json({ success: false, error: '请选择商品' }, { status: 400 });
  if (quantity <= 0) return Response.json({ success: false, error: '销售数量必须大于 0' }, { status: 400 });

  const db = openCommerceDb();
  try {
    return db.transaction(() => {
      db.prepare('UPDATE shop_products SET stock=stock WHERE id=?').run('');
    const product = db.prepare('SELECT * FROM shop_products WHERE id = ? AND status != ?').get(productId, 'deleted');
    if (!product) return Response.json({ success: false, error: '商品不存在' }, { status: 404 });
    const beforeStock = toNumber(product.stock);
    if (quantity > beforeStock) return Response.json({ success: false, error: '库存不足' }, { status: 400 });

    const now = new Date().toISOString();
    const unitPrice = toNumber(body.unit_price ?? body.unitPrice, product.sale_price);
    const total = toNumber(body.total_amount ?? body.total_price ?? body.totalPrice ?? body.amount, unitPrice * quantity);
    let commission;
    try { commission = saleCommissionFields(body, total); }
    catch (error) { return Response.json({ success: false, error: (error as Error).message }, { status: 400 }); }
    const saleDate = cleanText(body.date ?? body.sale_date, now);
    const remark = cleanText(body.note ?? body.remark);
    const afterStock = beforeStock - quantity;

    const tx = db.transaction(() => {
      db.prepare('UPDATE shop_products SET stock = ?, updated_at = ? WHERE id = ?').run(afterStock, now, productId);
      const result = db.prepare(`
        INSERT INTO shop_sales (
          product_id, product_name, quantity, unit_price, total_amount,
          member_name, sale_date, remark, created_at, sale_type, channel,
          customer_phone, operator, sales_advisor, commission_rate, commission_amount
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        productId,
        product.name,
        quantity,
        unitPrice,
        total,
        cleanText(body.customer_name ?? body.customerName ?? body.member_name),
        saleDate,
        remark,
        now,
        cleanText(body.saleType ?? body.sale_type, '线下'),
        cleanText(body.channel, '线下'),
        cleanText(body.customer_phone ?? body.customerPhone),
        cleanText(body.operator, 'admin'),
        commission.salesAdvisor, commission.commissionRate, commission.commissionAmount,
      );
      db.prepare(`
        INSERT INTO shop_stock_logs (
          product_id, product_name, change_type, quantity, before_stock, after_stock,
          operator, remark, created_at, channel, cost_price
        )
        VALUES (?, ?, '销售', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        productId,
        product.name,
        quantity,
        beforeStock,
        afterStock,
        cleanText(body.operator, 'admin'),
        remark,
        saleDate,
        cleanText(body.channel, '线下'),
        toNumber(product.cost_price),
      );
      return result.lastInsertRowid;
    });

    return Response.json({ success: true, id: tx() });
    })();
  } finally {
    db.close();
  }
}
