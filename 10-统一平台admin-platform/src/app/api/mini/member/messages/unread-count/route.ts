import { getMemberId, jsonError, withDb } from '../../../_helpers';
import { unreadInboxCount } from '@/lib/server/inbox';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    return withDb(db => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);
      return Response.json({ success: true, data: { count: unreadInboxCount(db, memberId) } });
    });
  } catch (error: any) {
    return jsonError(error?.message || '未读消息加载失败');
  }
}
