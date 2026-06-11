import { jsonError, toPositiveInt, withDb } from '../../../../_materials';
import { hasAuth, unauthorized } from '../../../../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; referenceId: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  try {
    return withDb((db) => {
      const materialId = toPositiveInt(routeParams.id);
      const referenceId = toPositiveInt(routeParams.referenceId);
      if (!materialId || !referenceId) return jsonError('参数无效', 400);

      const reference = db.prepare('SELECT id, course_id, material_id, duration FROM CourseVideo WHERE id=? AND material_id=?').get(referenceId, materialId);
      if (!reference) return jsonError('引用不存在或已取消', 404);

      db.prepare('DELETE FROM CourseVideo WHERE id=? AND material_id=?').run(referenceId, materialId);

      const summary = db.prepare('SELECT COUNT(*) as video_count, COALESCE(SUM(duration),0) as duration FROM CourseVideo WHERE course_id=?').get(reference.course_id);
      db.prepare('UPDATE OnlineCourse SET video_count=?, duration=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
        .run(Number(summary?.video_count || 0), Number(summary?.duration || 0), reference.course_id);

      const remaining = db.prepare('SELECT COUNT(*) as count FROM CourseVideo WHERE material_id=?').get(materialId)?.count || 0;
      db.prepare('UPDATE Material SET is_referenced=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(remaining ? 1 : 0, materialId);

      return Response.json({ success: true, removed_id: referenceId, is_referenced: remaining ? 1 : 0 });
    });
  } catch (err: any) {
    return jsonError(err?.message || '取消引用失败');
  }
}
