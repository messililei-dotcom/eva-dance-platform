import { getMemberId, jsonError, withDb } from '../../../_helpers';
import { markAllInboxRead } from '@/lib/server/inbox';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    return withDb(db => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);
      return Response.json({ success: true, data: { changed: markAllInboxRead(db, memberId) } });
    });
  } catch (error: any) {
    return jsonError(error?.message || '消息状态更新失败');
  }
}
