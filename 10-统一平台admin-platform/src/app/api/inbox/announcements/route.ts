import { openAdminDb } from '@/lib/server/admin-db';
import { createSystemAnnouncement, ensureInboxSchema } from '@/lib/server/inbox';
import { hasAuth, jsonError, unauthorized } from '../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const db = openAdminDb();
  try {
    ensureInboxSchema(db);
    const rows = db.prepare(`
      SELECT m.*, COUNT(r.id) AS recipient_count,
             SUM(CASE WHEN r.status='unread' THEN 1 ELSE 0 END) AS unread_count
      FROM InboxMessage m
      LEFT JOIN InboxRecipient r ON r.message_id=m.id
      WHERE m.type='system'
      GROUP BY m.id
      ORDER BY m.id DESC
      LIMIT 100
    `).all();
    return Response.json({ success: true, data: rows });
  } finally {
    db.close();
  }
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const title = String(body.title || '').trim();
  const content = String(body.content || '').trim();
  if (!title || !content) return jsonError('请填写公告标题和内容', 400);
  const db = openAdminDb();
  try {
    return Response.json({
      success: true,
      data: createSystemAnnouncement(db, {
        title,
        content,
        actionUrl: String(body.actionUrl || body.action_url || ''),
        priority: body.priority === 'urgent' ? 'urgent' : body.priority === 'normal' ? 'normal' : 'important',
        expiresAt: String(body.expiresAt || body.expires_at || ''),
        memberIds: Array.isArray(body.memberIds) ? body.memberIds.map(Number).filter(Boolean) : undefined,
      }),
    });
  } catch (error: any) {
    return jsonError(error?.message || '公告发送失败');
  } finally {
    db.close();
  }
}
