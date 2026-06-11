import { canManageMini, cleanText, jsonError, withDb } from '../_helpers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return withDb((db) => {
      if (!canManageMini(db, request)) return jsonError('无权限操作小程序课程', 403);
      const name = cleanText(body.name);
      if (!name) return jsonError('课程名称不能为空', 400);
      const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order),0) as ms FROM CourseSeries').get();
      const result = db.prepare(
        `INSERT INTO CourseSeries (name, subtitle, description, rich_description, cover_image, teacher, price, promo_price, is_free, category, trial_count, sort_order, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(name, body.subtitle || '', body.description || '', body.rich_description || '', body.cover_image || '', body.teacher || '', Number(body.price || 0), Number(body.promo_price || 0), body.is_free ? 1 : 0, body.category || '', Number(body.trial_count || 0), Number(maxSort?.ms || 0) + 1, body.status || 'draft');
      return Response.json({ success: true, data: { id: result.lastInsertRowid } });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
