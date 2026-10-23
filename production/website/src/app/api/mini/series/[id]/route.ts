import { jsonError, toPositiveInt, withDb } from '../../_helpers';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const routeParams = await params;
    const body = await request.json();
    return withDb((db) => {
      const fields = ['name', 'subtitle', 'description', 'rich_description', 'cover_image', 'teacher', 'price', 'promo_price', 'is_free', 'category', 'trial_count', 'status', 'sort_order', 'share_text'];
      const updates: string[] = [];
      const values: any[] = [];
      fields.forEach((field) => {
        if (body[field] !== undefined) {
          updates.push(`${field}=?`);
          values.push(body[field]);
        }
      });
      if (!updates.length) return Response.json({ success: true });
      updates.push("updated_at=datetime('now','localtime')");
      db.prepare(`UPDATE CourseSeries SET ${updates.join(', ')} WHERE id=?`).run(...values, toPositiveInt(routeParams.id));
      return Response.json({ success: true });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
