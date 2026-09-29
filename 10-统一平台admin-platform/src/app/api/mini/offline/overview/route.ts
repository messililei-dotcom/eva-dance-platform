import { getMemberId, jsonError, withDb } from '../../_helpers';
import { memberOfflineOverview, offlineErrorResponse } from '@/lib/server/offline-training';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const memberId = getMemberId(new URL(request.url).searchParams, request);
  if (!memberId) return jsonError('未登录', 401);
  try {
    const raw = new URL(request.url).searchParams.get('course_ids') || '';
    const courseIds = raw ? raw.split(',').map(Number) : [];
    if (courseIds.length > 200 || courseIds.some(id => !Number.isSafeInteger(id) || id <= 0)) return jsonError('课程期次参数无效', 400);
    return withDb(db => Response.json({ success: true, data: memberOfflineOverview(db, memberId, { courseIds }) }, { headers: { 'Cache-Control': 'no-store' } }));
  } catch (error) {
    return offlineErrorResponse(error);
  }
}
