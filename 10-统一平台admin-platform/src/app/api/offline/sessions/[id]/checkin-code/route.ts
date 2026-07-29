import { authPayloadFromRequest, openTrainingDb, requirePermission } from '../../../../training-db';
import { offlineErrorResponse, openOfflineCheckin } from '@/lib/server/offline-training';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requirePermission(request, 'permConsumeCreate');
  if (denied) return denied;
  const { id } = await params;
  const operator = authPayloadFromRequest(request)?.username || '管理员';
  const db = openTrainingDb();
  try {
    return Response.json({ success: true, data: openOfflineCheckin(db, id, operator) });
  } catch (error) {
    return offlineErrorResponse(error);
  } finally {
    db.close();
  }
}
