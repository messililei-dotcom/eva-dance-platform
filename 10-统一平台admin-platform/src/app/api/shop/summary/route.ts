import { openAdminDb } from '@/lib/server/admin-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = openAdminDb({ readonly: true });
  try {
    const products = db.prepare(`
      SELECT
        id,
        name,
        category,
        spec,
        size,
        color,
        image,
        cost_price AS costPrice,
        sale_price AS salePrice,
        stock,
        warning_stock AS warningStock,
        CASE WHEN stock <= warning_stock THEN 1 ELSE 0 END AS lowStockSkuCount,
        status,
        updated_at AS updatedAt
      FROM shop_products
      WHERE status != 'deleted'
      ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC
    `).all();

    const summary = products.reduce((acc: any, item: any) => {
      const stock = Number(item.stock || 0);
      acc.totalStock += stock;
      acc.lowStockCount += Number(item.lowStockSkuCount || 0);
      acc.stockValue += stock * Number(item.costPrice || 0);
      return acc;
    }, {
      productCount: products.length,
      skuCount: products.length,
      totalStock: 0,
      lowStockCount: 0,
      stockValue: 0,
    });

    return Response.json({ summary, products });
  } finally {
    db.close();
  }
}
