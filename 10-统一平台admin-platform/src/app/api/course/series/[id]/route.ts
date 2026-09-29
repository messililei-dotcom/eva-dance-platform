import { jsonError, toPositiveInt, withDb } from '../../_materials';
import { normalizeCourseCategory } from '@/lib/course-category';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SERIES_SELECT = `
  SELECT cs.*,
    (SELECT COUNT(*) FROM OnlineCourse WHERE series_id=cs.id) as course_count,
    (SELECT COUNT(DISTINCT member_id) FROM CourseAuthorization WHERE series_id=cs.id) as total_students
  FROM CourseSeries cs WHERE cs.id=?
`;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    return withDb((db) => {
      const id = toPositiveInt(routeParams.id);
      const data = db.prepare(SERIES_SELECT).get(id);
      if (!data) return jsonError('课程不存在', 404);
      return Response.json({ success: true, data });
    });
  } catch (err: any) {
    return jsonError(err?.message || '获取课程失败');
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  const body = await request.json().catch(() => ({}));
  try {
    return withDb((db) => {
      if (body.name !== undefined && !String(body.name || '').trim()) {
        return jsonError('课程名称不能为空', 400);
      }
      const fields = ['name', 'subtitle', 'description', 'rich_description', 'cover_image', 'share_image', 'teacher', 'price', 'promo_price', 'is_free', 'category', 'trial_count', 'status', 'sort_order', 'share_text'];
      const updates: string[] = [];
      const values: any[] = [];
      fields.forEach(f => {
        if (body[f] !== undefined) {
          updates.push(`${f}=?`);
          values.push(
            f === 'name'
              ? String(body[f]).trim()
              : f === 'category'
                ? normalizeCourseCategory(body[f], `${body.name || ''} ${body.subtitle || ''} ${body.source_type || ''}`)
                : body[f]
          );
        }
      });
      const id = toPositiveInt(routeParams.id);
      if (!updates.length) {
        const data = db.prepare(SERIES_SELECT).get(id);
        return Response.json({ success: true, data });
      }
      updates.push("updated_at=datetime('now','localtime')");
      values.push(id);
      const result = db.prepare(`UPDATE CourseSeries SET ${updates.join(', ')} WHERE id=?`).run(...values);
      if (!result.changes) return jsonError('课程不存在', 404);
      const data = db.prepare(SERIES_SELECT).get(id);
      return Response.json({ success: true, data });
    });
  } catch (err: any) {
    return jsonError(err?.message || '更新课程失败');
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    return withDb((db) => {
      const id = toPositiveInt(routeParams.id);
      db.transaction(() => {
        db.prepare('DELETE FROM CourseVideo WHERE course_id IN (SELECT id FROM OnlineCourse WHERE series_id=?)').run(id);
        db.prepare('DELETE FROM OnlineCourse WHERE series_id=?').run(id);
        db.prepare('DELETE FROM CourseAuthorization WHERE series_id=?').run(id);
        db.prepare('DELETE FROM CourseSeries WHERE id=?').run(id);
      })();
      return Response.json({ success: true });
    });
  } catch (err: any) {
    return jsonError(err?.message || '删除课程失败');
  }
}
