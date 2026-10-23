import { getMemberId, jsonError, toPositiveInt, withDb } from '../../_helpers';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const routeParams = await params;
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);
      const result = db.prepare('DELETE FROM VideoBookmark WHERE id=? AND member_id=?').run(toPositiveInt(routeParams.id), memberId);
      if (!result.changes) return jsonError('收藏不存在或无权限', 404);
      return Response.json({ success: true });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
