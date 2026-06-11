import { cleanText, jsonError, toPositiveInt, withDb } from '../_materials';
import { hasAuth, unauthorized } from '../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const name = cleanText(body.name);
  if (!name) return jsonError('课节名称不能为空', 400);
  const seriesId = toPositiveInt(body.series_id);
  if (!seriesId) return jsonError('必须指定课程', 400);

  try {
    return withDb((db) => {
      const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order),0) as ms FROM OnlineCourse WHERE series_id=?').get(seriesId);
      const status = body.local_status || body.status || 'published';
      const result = db.prepare(
        `INSERT INTO OnlineCourse (series_id, name, description, rich_description, cover_image, share_text, course_type, single_price, sort_order, status, is_free_trial, duration, video_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        seriesId, name, body.description || '', body.rich_description || '', body.cover_image || '',
        body.share_text || '', body.course_type || 'recorded', Number(body.single_price || body.price || 0),
        body.sort_order || ((maxSort?.ms || 0) + 1), status,
        body.is_free_trial ? 1 : 0, Number(body.duration || 0), Number(body.video_count || 0)
      );
      return Response.json({ success: true, data: { id: result.lastInsertRowid } });
    });
  } catch (err: any) {
    return jsonError(err?.message || '创建课节失败');
  }
}
