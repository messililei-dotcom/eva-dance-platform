import { getMemberId, jsonError, toPositiveInt, withDb } from '../../_helpers';
import { listInboxMessages } from '@/lib/server/inbox';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    return withDb(db => {
      const search = new URL(request.url).searchParams;
      const memberId = getMemberId(search, request);
      if (!memberId) return jsonError('未登录', 401);
      return Response.json({
        success: true,
        data: listInboxMessages(db, {
          memberId,
          type: search.get('type') || '',
          status: search.get('status') || '',
          cursor: toPositiveInt(search.get('cursor')),
          limit: toPositiveInt(search.get('limit'), 20),
        }),
      });
    });
  } catch (error: any) {
    return jsonError(error?.message || '消息加载失败');
  }
}
