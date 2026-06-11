import { jsonError, toPositiveInt, withDb } from '../../../../_materials';
import { hasAuth, unauthorized } from '../../../../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; assocId: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  try {
    return withDb((db) => {
      const courseId = toPositiveInt(routeParams.id);
      const assocId = toPositiveInt(routeParams.assocId);
      if (!courseId || !assocId) return jsonError('素材关联不存在', 404);

      const row = db.prepare('SELECT id, material_id FROM CourseVideo WHERE id=? AND course_id=?').get(assocId, courseId) as any;
      if (!row) return jsonError('素材关联不存在', 404);

      db.prepare('DELETE FROM CourseVideo WHERE id=? AND course_id=?').run(assocId, courseId);
      const refs = (db.prepare('SELECT COUNT(*) as count FROM CourseVideo WHERE material_id=?').get(row.material_id) as any)?.count || 0;
      db.prepare('UPDATE Material SET is_referenced=?, updated_at=datetime(\'now\',\'localtime\') WHERE id=?').run(refs > 0 ? 1 : 0, row.material_id);
      return Response.json({ success: true, deleted: 1 });
    });
  } catch (err: any) {
    return jsonError(err?.message || '移除课节素材失败');
  }
}
