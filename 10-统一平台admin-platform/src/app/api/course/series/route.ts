import { jsonError, withDb } from '../_materials';
import { normalizeCourseCategory } from '@/lib/course-category';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SERIES_SELECT = `
  SELECT cs.*, (SELECT COUNT(*) FROM OnlineCourse WHERE series_id=cs.id) as course_count,
         (SELECT COUNT(DISTINCT member_id) FROM CourseAuthorization WHERE series_id=cs.id) as total_students
  FROM CourseSeries cs
`;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const status = url.searchParams.get('status') || '';
    const all = url.searchParams.get('all') === '1';
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const pageSize = Math.min(1000, Math.max(1, Number(url.searchParams.get('pageSize') || 100)));

    return withDb((db) => {
      let where = 'WHERE 1=1';
      const params: any[] = [];
      if (keyword.trim()) {
        where += ' AND (name LIKE ? OR subtitle LIKE ? OR category LIKE ? OR teacher LIKE ?)';
        const like = `%${keyword.trim()}%`;
        params.push(like, like, like, like);
      }
      if (status) { where += ' AND status=?'; params.push(status); }
      
      const total = db.prepare(`SELECT COUNT(*) as total FROM CourseSeries ${where}`).get(...params)?.total || 0;
      const data = all
        ? db.prepare(
          `${SERIES_SELECT} ${where}
           ORDER BY cs.created_at DESC, cs.id DESC`
        ).all(...params)
        : db.prepare(
          `${SERIES_SELECT} ${where}
           ORDER BY cs.created_at DESC, cs.id DESC
           LIMIT ? OFFSET ?`
        ).all(...params, pageSize, (page - 1) * pageSize);

      return Response.json({ success: true, data, total, page, pageSize });
    });
  } catch (err: any) {
    return jsonError(err?.message || '获取课程失败');
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  if (!name) return jsonError('课程名称不能为空', 400);
  
  try {
    return withDb((db) => {
      const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order),0) as ms FROM CourseSeries').get();
      const status = ['published', 'draft', 'offline'].includes(String(body.status || ''))
        ? String(body.status)
        : 'draft';
      const result = db.prepare(
        `INSERT INTO CourseSeries (name, subtitle, description, rich_description, cover_image, teacher, price, promo_price, is_free, category, trial_count, sort_order, share_text, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        name, body.subtitle || '', body.description || '', body.rich_description || '', body.cover_image || '',
        body.teacher || '', Number(body.price || 0), Number(body.promo_price || 0), body.is_free ? 1 : 0,
        normalizeCourseCategory(body.category, `${name} ${body.subtitle || ''} ${body.source_type || ''}`), Number(body.trial_count || 0), Number(maxSort?.ms || 0) + 1,
        body.share_text || '', status
      );
      const data = db.prepare(`${SERIES_SELECT} WHERE cs.id=?`).get(result.lastInsertRowid);
      return Response.json({ success: true, data });
    });
  } catch (err: any) {
    return jsonError(err?.message || '创建课程失败');
  }
}
