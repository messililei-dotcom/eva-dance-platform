import { openTrainingDb, requirePermission } from '../../../training-db';
import { offlineErrorResponse, updateOfflineSession } from '@/lib/server/offline-training';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requirePermission(request, 'permCourseEdit');
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const db = openTrainingDb();
  try {
    return Response.json({ success: true, data: updateOfflineSession(db, id, body) });
  } catch (error) {
    return offlineErrorResponse(error);
  } finally {
    db.close();
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requirePermission(request, 'permCourseDelete');
  if (denied) return denied;
  const { id } = await params;
  const db = openTrainingDb();
  try {
    const linked = Number(db.prepare("SELECT COUNT(*) AS count FROM OfflineBooking WHERE session_id=? AND status<>'cancelled'")
      .get<{ count: number }>(id)?.count || 0);
    if (linked) return Response.json({ success: false, error: '该课次已有预约，不能删除' }, { status: 409 });
    db.prepare('DELETE FROM OfflineCheckinToken WHERE session_id=?').run(id);
    const result = db.prepare('DELETE FROM OfflineSession WHERE id=?').run(id);
    if (!result.changes) return Response.json({ success: false, error: '课次不存在' }, { status: 404 });
    return Response.json({ success: true });
  } catch (error) {
    return offlineErrorResponse(error);
  } finally {
    db.close();
  }
}
