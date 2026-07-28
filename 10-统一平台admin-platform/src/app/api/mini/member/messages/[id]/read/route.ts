import { getMemberId, jsonError, toPositiveInt, withDb } from '../../../../_helpers';
import { markInboxRead } from '@/lib/server/inbox';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    return withDb(db => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);
      const recipientId = toPositiveInt(routeParams.id);
      if (!recipientId) return jsonError('消息不存在', 404);
      const changed = markInboxRead(db, memberId, recipientId);
      return Response.json({ success: true, data: { changed } });
    });
  } catch (error: any) {
    return jsonError(error?.message || '消息状态更新失败');
  }
}
