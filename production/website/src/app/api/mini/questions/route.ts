import { cleanText, getMemberId, jsonError, toPositiveInt, withDb } from '../_helpers';

export async function GET(request: Request) {
  try {
    return withDb((db) => {
      const url = new URL(request.url);
      const seriesId = toPositiveInt(url.searchParams.get('series_id'));
      const page = toPositiveInt(url.searchParams.get('page'), 1);
      const pageSize = toPositiveInt(url.searchParams.get('pageSize'), 20);
      if (!seriesId) return jsonError('请选择专栏', 400);
      const total = db.prepare('SELECT COUNT(*) as total FROM Question WHERE series_id=?').get(seriesId)?.total || 0;
      const data = db.prepare(
        `SELECT q.*, m.name as member_name, m.phone as member_phone,
                (SELECT COUNT(*) FROM Answer WHERE question_id=q.id) as answer_count
         FROM Question q JOIN Member m ON q.member_id=m.id
         WHERE q.series_id=?
         ORDER BY q.updated_at DESC LIMIT ? OFFSET ?`
      ).all(seriesId, pageSize, (page - 1) * pageSize);
      return Response.json({ success: true, data, total, page, pageSize });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      const seriesId = toPositiveInt(body.series_id);
      const content = cleanText(body.content);
      if (!memberId) return jsonError('未登录', 401);
      if (!seriesId) return jsonError('请选择专栏', 400);
      if (!content) return jsonError('问题内容不能为空', 400);
      const result = db.prepare('INSERT INTO Question (member_id, series_id, course_id, content) VALUES (?, ?, ?, ?)').run(memberId, seriesId, toPositiveInt(body.course_id, 0), content);
      return Response.json({ success: true, data: { id: result.lastInsertRowid } });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
