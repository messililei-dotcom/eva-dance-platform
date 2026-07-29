import { getMemberId, jsonError, withDb } from '../../../_helpers';
import { cancelOfflineBooking, offlineErrorResponse } from '@/lib/server/offline-training';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const memberId = getMemberId(new URL(request.url).searchParams, request);
  if (!memberId) return jsonError('未登录', 401);
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    return withDb(db => Response.json({
      success: true,
      data: cancelOfflineBooking(db, id, memberId, body.reason),
    }));
  } catch (error) {
    return offlineErrorResponse(error);
  }
}
