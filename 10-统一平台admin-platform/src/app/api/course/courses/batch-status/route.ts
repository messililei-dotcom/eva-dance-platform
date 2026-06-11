import { cleanText, jsonError, toPositiveInt, withDb } from '../../_materials';
import { hasAuth, unauthorized } from '../../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.map((id: unknown) => toPositiveInt(id)).filter(Boolean) : [];
  const status = cleanText(body.status);
  if (!ids.length) return jsonError('请选择课节', 400);
  if (!['draft', 'published', 'offline'].includes(status)) return jsonError('课节状态无效', 400);

  try {
    return withDb((db) => {
      const placeholders = ids.map(() => '?').join(',');
      const result = db.prepare(
        `UPDATE OnlineCourse
         SET status=?, updated_at=datetime('now','localtime')
         WHERE id IN (${placeholders})`
      ).run(status, ...ids);
      return Response.json({ success: true, updated: Number(result.changes || 0) });
    });
  } catch (err: any) {
    return jsonError(err?.message || '批量更新课节状态失败');
  }
}
