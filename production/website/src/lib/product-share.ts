import { createHash } from 'node:crypto';
import { getAdminDbPath, getBetterSqlite3 } from '@/lib/server/admin-db';
export function findPublicProduct(id: string) {
  const Database = getBetterSqlite3();
  const db = new Database(getAdminDbPath(), { readonly: true, fileMustExist: true });
  try {
    const row = db.prepare("SELECT id,name,category,spec,size,color,sale_price,updated_at,CASE WHEN image<>'' THEN 1 ELSE 0 END has_image FROM shop_products WHERE id=? AND status='在售' AND COALESCE(is_hidden,0)=0").get<any>(id);
    if (!row || !(Number(row.sale_price) > 0)) return null;
    return { ...row, image: row.has_image ? `/api/shop/images/${encodeURIComponent(row.id)}/${createHash('sha256').update(String(row.updated_at)).digest('hex').slice(0, 12)}` : undefined };
  } finally { db.close(); }
}
