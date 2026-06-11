import { jsonError, toPositiveInt, withDb } from '../../_materials';
import { hasAuth, unauthorized } from '../../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function lessonNameFromMaterial(name: string) {
  return String(name || '').replace(/\.[^.\\/]+$/, '').trim() || String(name || '').trim();
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const seriesId = toPositiveInt(body.series_id);
  const materialIds: number[] = Array.from(new Set((body.material_ids || []).map((id: any) => Number(id)).filter((id: number) => id > 0)));
  if (!seriesId) return jsonError('必须指定课程', 400);
  if (!materialIds.length) return jsonError('请选择素材', 400);

  try {
    return withDb((db) => {
      const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order),0) as ms FROM OnlineCourse WHERE series_id=?').get(seriesId);
      const placeholders = materialIds.map(() => '?').join(',');
      const materials = db.prepare(`SELECT id, name, type, duration FROM Material WHERE id IN (${placeholders})`).all(...materialIds);
      if (!materials.length) return jsonError('素材不存在', 404);
      if (materials.length !== materialIds.length) return jsonError('部分素材不存在，请刷新后重试', 400);

      const referencedRows = db.prepare(
        `SELECT DISTINCT cv.material_id
         FROM CourseVideo cv
         JOIN OnlineCourse c ON c.id = cv.course_id
         WHERE c.series_id = ? AND cv.material_id IN (${placeholders})`
      ).all(seriesId, ...materialIds);
      const referencedMaterialIds = new Set(referencedRows.map((row: any) => Number(row.material_id)));

      const materialById = new Map(materials.map((material: any) => [Number(material.id), material]));

      const results: any[] = [];
      const skipped: any[] = [];
      db.transaction(() => {
        let sortIdx = 0;
        for (const materialId of materialIds) {
          if (referencedMaterialIds.has(Number(materialId))) {
            skipped.push({ materialId, reason: 'already_referenced' });
            continue;
          }
          const mat = materialById.get(Number(materialId));
          if (!mat) continue;
          const lessonName = lessonNameFromMaterial(mat.name);
          const r1 = db.prepare(
            `INSERT INTO OnlineCourse (series_id, name, description, course_type, sort_order, status, duration, video_count)
             VALUES (?, ?, '', 'recorded', ?, 'published', ?, 1)`
          ).run(seriesId, lessonName, (maxSort?.ms || 0) + 1 + sortIdx, mat.duration || 0);
          const courseId = Number(r1.lastInsertRowid);
          db.prepare(
            `INSERT INTO CourseVideo (course_id, material_id, name, duration, sort_order, status)
             VALUES (?, ?, ?, ?, 1, 'published')`
          ).run(courseId, mat.id, mat.name, mat.duration || 0);
          results.push({ courseId, materialId: mat.id, name: lessonName });
          sortIdx++;
        }
      })();

      return Response.json({ success: true, data: results, count: results.length, skipped, skipped_count: skipped.length });
    });
  } catch (err: any) {
    return jsonError(err?.message || '批量创建失败');
  }
}
