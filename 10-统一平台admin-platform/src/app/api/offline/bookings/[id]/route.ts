import { authPayloadFromRequest, openTrainingDb, requirePermission } from '../../../training-db';
import {
  cancelOfflineBooking,
  checkinOfflineBooking,
  offlineErrorResponse,
} from '@/lib/server/offline-training';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requirePermission(request, 'permConsumeCreate');
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const db = openTrainingDb();
  try {
    const action = String(body.action || '');
    if (action === 'cancel') {
      return Response.json({ success: true, data: cancelOfflineBooking(db, id, 0, body.reason) });
    }
    if (action === 'checkin') {
      return Response.json({
        success: true,
        data: checkinOfflineBooking(db, {
          bookingId: id,
          adminOverride: true,
          operatorName: authPayloadFromRequest(request)?.username || '管理员',
          remark: body.remark,
        }),
      });
    }
    return Response.json({ success: false, error: '不支持的操作' }, { status: 400 });
  } catch (error) {
    return offlineErrorResponse(error);
  } finally {
    db.close();
  }
}
