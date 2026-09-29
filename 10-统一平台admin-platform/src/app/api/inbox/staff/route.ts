import { openAdminDb } from '@/lib/server/admin-db';
import { listStaffInboxMessages } from '@/lib/server/staff-inbox';
import { authPayloadFromRequest, hasAuth, unauthorized } from '../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const db = openAdminDb();
  try {
    const payload = authPayloadFromRequest(request);
    const user = payload?.id
      ? db.prepare("SELECT id FROM User WHERE id=? AND status='active' LIMIT 1").get<{ id: number }>(payload.id)
      : db.prepare(`
          SELECT id FROM User
          WHERE status='active' AND role IN ('super_admin', 'admin', 'teacher', 'operator')
          ORDER BY id LIMIT 1
        `).get<{ id: number }>();
    return Response.json({
      success: true,
      data: listStaffInboxMessages(db, user?.id),
    });
  } finally {
    db.close();
  }
}
