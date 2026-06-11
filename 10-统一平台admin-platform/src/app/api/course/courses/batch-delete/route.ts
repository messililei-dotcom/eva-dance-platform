import { jsonError, toPositiveInt, withDb } from '../../_materials';
import { deleteCoursesByIds } from '../_delete';
import { hasAuth, unauthorized } from '../../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.map((id: unknown) => toPositiveInt(id)).filter(Boolean) : [];
  if (!ids.length) return jsonError('请选择课节', 400);

  try {
    return withDb((db) => {
      const result = deleteCoursesByIds(db, ids);
      return Response.json({ success: true, ...result });
    });
  } catch (err: any) {
    return jsonError(err?.message || '批量删除课节失败');
  }
}
