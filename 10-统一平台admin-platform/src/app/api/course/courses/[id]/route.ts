import { cleanText, jsonError, toPositiveInt, withDb } from '../../_materials';
import { deleteCoursesByIds } from '../_delete';
import { hasAuth, unauthorized } from '../../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  try {
    return withDb((db) => {
      const data = db.prepare('SELECT * FROM OnlineCourse WHERE id=?').get(toPositiveInt(routeParams.id));
      if (!data) return jsonError('课节不存在', 404);
      return Response.json({ success: true, data });
    });
  } catch (err: any) {
    return jsonError(err?.message || '获取课节失败');
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  if (body.local_status !== undefined && body.status === undefined) {
    body.status = body.local_status;
  }
  try {
    return withDb((db) => {
      const fields = ['name', 'description', 'rich_description', 'cover_image', 'share_text', 'course_type', 'single_price', 'sort_order', 'status', 'is_free_trial', 'duration', 'video_count'];
      const updates: string[] = [];
      const values: any[] = [];
      fields.forEach(f => {
        if (body[f] !== undefined) { updates.push(`${f}=?`); values.push(body[f]); }
      });
      if (!updates.length) return Response.json({ success: true });
      updates.push("updated_at=datetime('now','localtime')");
      values.push(toPositiveInt(routeParams.id));
      const result = db.prepare(`UPDATE OnlineCourse SET ${updates.join(', ')} WHERE id=?`).run(...values);
      if (!result.changes) return jsonError('课节不存在', 404);
      return Response.json({ success: true });
    });
  } catch (err: any) {
    return jsonError(err?.message || '更新课节失败');
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  try {
    return withDb((db) => {
      const id = toPositiveInt(routeParams.id);
      const result = deleteCoursesByIds(db, [id]);
      if (!result.deleted) return jsonError('课节不存在', 404);
      return Response.json({ success: true });
    });
  } catch (err: any) {
    return jsonError(err?.message || '删除课节失败');
  }
}
