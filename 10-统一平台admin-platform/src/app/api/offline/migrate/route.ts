import { openTrainingDb, requirePermission } from '../../training-db';
import { backfillOfflineEntitlements, ensureOfflineTrainingTables, offlineErrorResponse } from '@/lib/server/offline-training';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = requirePermission(request, 'permPaymentView');
  if (denied) return denied;
  const db = openTrainingDb();
  try {
    ensureOfflineTrainingTables(db);
    return Response.json({
      success: true,
      data: {
        enrollments: db.prepare('SELECT COUNT(*) AS count FROM OfflineEnrollment').get(),
        entitlements: db.prepare(`
          SELECT COUNT(*) AS count,
                 COALESCE(SUM(available_sessions),0) AS availableSessions,
                 COALESCE(SUM(frozen_sessions),0) AS frozenSessions,
                 COALESCE(SUM(used_sessions),0) AS usedSessions
          FROM OfflineEntitlement
        `).get(),
        sessions: db.prepare('SELECT COUNT(*) AS count FROM OfflineSession').get(),
        bookings: db.prepare('SELECT COUNT(*) AS count FROM OfflineBooking').get(),
      },
    });
  } catch (error) {
    return offlineErrorResponse(error);
  } finally {
    db.close();
  }
}

export async function POST(request: Request) {
  const denied = requirePermission(request, 'permPaymentEdit');
  if (denied) return denied;
  const db = openTrainingDb();
  try {
    return Response.json({ success: true, data: backfillOfflineEntitlements(db) });
  } catch (error) {
    return offlineErrorResponse(error);
  } finally {
    db.close();
  }
}
