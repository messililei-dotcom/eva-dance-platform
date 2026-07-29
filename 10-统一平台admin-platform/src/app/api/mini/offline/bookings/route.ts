import { getMemberId, jsonError, withDb } from '../../_helpers';
import { createOfflineBooking, offlineErrorResponse } from '@/lib/server/offline-training';

export async function POST(request: Request) {
  const memberId = getMemberId(new URL(request.url).searchParams, request);
  if (!memberId) return jsonError('未登录', 401);
  const body = await request.json().catch(() => ({}));
  try {
    return withDb(db => Response.json({
      success: true,
      data: createOfflineBooking(db, { ...body, memberId, source: 'mini' }),
    }));
  } catch (error) {
    return offlineErrorResponse(error);
  }
}
