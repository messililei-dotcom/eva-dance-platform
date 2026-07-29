import { getMemberId, jsonError, withDb } from '../../_helpers';
import { checkinOfflineBooking, offlineErrorResponse } from '@/lib/server/offline-training';

export async function POST(request: Request) {
  const memberId = getMemberId(new URL(request.url).searchParams, request);
  if (!memberId) return jsonError('未登录', 401);
  const body = await request.json().catch(() => ({}));
  try {
    return withDb(db => Response.json({
      success: true,
      data: checkinOfflineBooking(db, {
        bookingId: body.bookingId ?? body.booking_id,
        checkinCode: body.checkinCode ?? body.checkin_code,
        memberId,
      }),
    }));
  } catch (error) {
    return offlineErrorResponse(error);
  }
}
