import { openTrainingDb, requirePermission } from '../../training-db';
import {
  createOfflineSession,
  listOfflineSessions,
  offlineErrorResponse,
} from '@/lib/server/offline-training';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = requirePermission(request, 'permCourseView');
  if (denied) return denied;
  const url = new URL(request.url);
  const db = openTrainingDb();
  try {
    return Response.json({
      success: true,
      data: listOfflineSessions(db, {
        courseId: url.searchParams.get('courseId'),
        dateFrom: url.searchParams.get('dateFrom') || '',
        dateTo: url.searchParams.get('dateTo') || '',
      }),
    });
  } catch (error) {
    return offlineErrorResponse(error);
  } finally {
    db.close();
  }
}

export async function POST(request: Request) {
  const denied = requirePermission(request, 'permCourseCreate');
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const db = openTrainingDb();
  try {
    return Response.json({ success: true, data: createOfflineSession(db, body) });
  } catch (error) {
    return offlineErrorResponse(error);
  } finally {
    db.close();
  }
}
