import { jsonError, withDb } from '../_materials';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const status = url.searchParams.get('status') || '';
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') || 50)));

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
      const data = db.prepare(
        `SELECT cs.*, (SELECT COUNT(*) FROM OnlineCourse WHERE series_id=cs.id) as course_count,
                (SELECT COUNT(DISTINCT member_id) FROM CourseAuthorization WHERE series_id=cs.id) as total_students
         FROM CourseSeries cs ${where}
         ORDER BY cs.sort_order, cs.created_at DESC
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
      const result = db.prepare(
        `INSERT INTO CourseSeries (name, subtitle, description, rich_description, cover_image, teacher, price, promo_price, is_free, category, trial_count, sort_order, share_text, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        name, body.subtitle || '', body.description || '', body.rich_description || '', body.cover_image || '',
        body.teacher || '', Number(body.price || 0), Number(body.promo_price || 0), body.is_free ? 1 : 0,
        body.category || '', Number(body.trial_count || 0), Number(maxSort?.ms || 0) + 1,
        body.share_text || '', body.status || 'draft'
      );
      return Response.json({ success: true, data: { id: result.lastInsertRowid } });
    });
  } catch (err: any) {
    return jsonError(err?.message || '创建课程失败');
  }
}
