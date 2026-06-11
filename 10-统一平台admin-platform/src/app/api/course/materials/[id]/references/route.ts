import { jsonError, toPositiveInt, withDb } from '../../../_materials';
import { hasAuth, unauthorized } from '../../../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  try {
    return withDb((db) => {
      const materialId = toPositiveInt(routeParams.id);
      const rows = db.prepare(`
        SELECT cv.id as id, cv.id as cv_id, cv.course_id, cv.name as cv_name, cv.created_at,
               oc.name as course_name, oc.status as course_status,
               cs.id as series_id, cs.name as series_name, cs.status as series_status
        FROM CourseVideo cv
        LEFT JOIN OnlineCourse oc ON cv.course_id = oc.id
        LEFT JOIN CourseSeries cs ON oc.series_id = cs.id
        WHERE cv.material_id=?
        ORDER BY cs.sort_order, oc.sort_order, cv.sort_order
      `).all(materialId);
      db.prepare('UPDATE Material SET is_referenced=? WHERE id=?').run(rows.length ? 1 : 0, materialId);
      return Response.json({ success: true, data: rows, total: rows.length, is_referenced: rows.length ? 1 : 0 });
    });
  } catch (err: any) {
    return jsonError(err?.message || '获取引用失败');
  }
}
