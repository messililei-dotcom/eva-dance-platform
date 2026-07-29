import { openTrainingDb, requirePermission } from '../../training-db';
import {
  createOfflineBooking,
  listOfflineBookings,
  offlineErrorResponse,
} from '@/lib/server/offline-training';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = requirePermission(request, 'permConsumeView');
  if (denied) return denied;
  const url = new URL(request.url);
  const db = openTrainingDb();
  try {
    return Response.json({
      success: true,
      data: listOfflineBookings(db, {
        memberId: url.searchParams.get('memberId'),
        sessionId: url.searchParams.get('sessionId'),
      }),
    });
  } catch (error) {
    return offlineErrorResponse(error);
  } finally {
    db.close();
  }
}

export async function POST(request: Request) {
  const denied = requirePermission(request, 'permConsumeCreate');
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const db = openTrainingDb();
  try {
    return Response.json({
      success: true,
      data: createOfflineBooking(db, { ...body, source: body.source || 'admin' }),
    });
  } catch (error) {
    return offlineErrorResponse(error);
  } finally {
    db.close();
  }
}
