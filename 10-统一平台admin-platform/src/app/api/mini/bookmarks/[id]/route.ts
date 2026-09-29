import { getMemberId, jsonError, linkedMemberIds, sqlIn, toPositiveInt, withDb } from '../../_helpers';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);
      const linked = sqlIn(linkedMemberIds(db, memberId));
      const result = db.prepare(`DELETE FROM VideoBookmark WHERE id=? AND member_id IN (${linked.clause})`).run(toPositiveInt(routeParams.id), ...linked.values);
      if (!result.changes) return jsonError('收藏不存在或无权限', 404);
      return Response.json({ success: true });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
