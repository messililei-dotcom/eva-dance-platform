import { cleanText, jsonError, toPositiveInt, withDb } from '../../../_materials';
import { hasAuth, unauthorized } from '../../../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  try {
    return withDb((db) => {
      const courseId = toPositiveInt(routeParams.id);
      if (!courseId) return jsonError('课节不存在', 404);
      const data = db.prepare(
        `SELECT cv.id as assoc_id, cv.id, cv.course_id, cv.material_id, cv.name,
                cv.duration, cv.is_free, cv.sort_order, cv.status, cv.created_at,
                m.type, m.file_path, m.file_url, m.thumbnail, m.file_size
         FROM CourseVideo cv
         LEFT JOIN Material m ON m.id=cv.material_id
         WHERE cv.course_id=?
         ORDER BY cv.sort_order ASC, cv.id ASC`
      ).all(courseId);
      return Response.json({ success: true, data });
    });
  } catch (err: any) {
    return jsonError(err?.message || '获取课节素材失败');
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  try {
    return withDb((db) => {
      const courseId = toPositiveInt(routeParams.id);
      const materialId = toPositiveInt(body.material_id);
      if (!courseId || !materialId) return jsonError('请选择课节和素材', 400);

      const course = db.prepare('SELECT id FROM OnlineCourse WHERE id=?').get(courseId);
      if (!course) return jsonError('课节不存在', 404);
      const material = db.prepare('SELECT id, name, duration FROM Material WHERE id=?').get(materialId) as any;
      if (!material) return jsonError('素材不存在', 404);

      const nextSort = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 as value FROM CourseVideo WHERE course_id=?').get(courseId) as any)?.value || 1;
      const result = db.prepare(
        `INSERT INTO CourseVideo (course_id, material_id, name, duration, is_free, sort_order, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        courseId,
        materialId,
        cleanText(body.name, material.name || '课程素材'),
        toPositiveInt(body.duration, Number(material.duration || 0)),
        body.is_free ? 1 : 0,
        toPositiveInt(body.sort_order, Number(nextSort)),
        cleanText(body.status, 'published')
      );
      db.prepare('UPDATE Material SET is_referenced=1, updated_at=datetime(\'now\',\'localtime\') WHERE id=?').run(materialId);
      return Response.json({ success: true, data: { id: result.lastInsertRowid, assoc_id: result.lastInsertRowid } });
    });
  } catch (err: any) {
    return jsonError(err?.message || '绑定课节素材失败');
  }
}
