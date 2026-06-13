import { jsonError, toPositiveInt, withDb } from '../../../../_materials';
import { hasAuth, unauthorized } from '../../../../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const requestedIds: number[] = Array.isArray(body.ids)
    ? Array.from(new Set(body.ids.map((id: unknown) => toPositiveInt(id)).filter((id: number) => id > 0)))
    : [];

  const seriesId = toPositiveInt(routeParams.id);
  if (!seriesId) return jsonError('必须指定课程', 400);
  if (!requestedIds.length) return jsonError('请选择课节', 400);

  try {
    return withDb((db) => {
      const currentRows = db.prepare(
        `SELECT id
         FROM OnlineCourse
         WHERE series_id=?
         ORDER BY sort_order ASC, id ASC`
      ).all<{ id: number }>(seriesId);

      if (!currentRows.length) return jsonError('课程下暂无课节', 404);

      const currentIds = currentRows.map(row => Number(row.id));
      const currentIdSet = new Set(currentIds);
      const invalidIds = requestedIds.filter(id => !currentIdSet.has(id));
      if (invalidIds.length) return jsonError('存在不属于当前课程的课节', 400);

      const requestedIdSet = new Set(requestedIds);
      const orderedIds = [
        ...requestedIds,
        ...currentIds.filter(id => !requestedIdSet.has(id)),
      ];

      const updateSort = db.prepare(
        `UPDATE OnlineCourse
         SET sort_order=?, updated_at=datetime('now','localtime')
         WHERE id=? AND series_id=?`
      );
      const reorder = db.transaction((ids: number[]) => {
        ids.forEach((id, index) => {
          updateSort.run(index + 1, id, seriesId);
        });
      });

      reorder(orderedIds);

      const data = db.prepare(
        `SELECT *
         FROM OnlineCourse
         WHERE series_id=?
         ORDER BY sort_order ASC, id ASC`
      ).all(seriesId);

      return Response.json({ success: true, updated: orderedIds.length, data });
    });
  } catch (err: any) {
    return jsonError(err?.message || '课节排序保存失败');
  }
}
