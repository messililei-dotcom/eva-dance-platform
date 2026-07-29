import { getMemberId, jsonError, withDb } from '../../_helpers';
import { memberOfflineOverview, offlineErrorResponse } from '@/lib/server/offline-training';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const memberId = getMemberId(new URL(request.url).searchParams, request);
  if (!memberId) return jsonError('未登录', 401);
  try {
    return withDb(db => Response.json({ success: true, data: memberOfflineOverview(db, memberId) }));
  } catch (error) {
    return offlineErrorResponse(error);
  }
}
