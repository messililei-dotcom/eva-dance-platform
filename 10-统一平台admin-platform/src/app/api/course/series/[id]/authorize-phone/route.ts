import { cleanText, jsonError, toPositiveInt, withDb } from '../../../_materials';
import { authPayloadFromRequest, requirePermission } from '../../../../training-db';
import { ensureAuthorizationAuditColumns } from '../_authorization';
import { createAuthorizationMessage, createWelcomeMessage } from '@/lib/server/inbox';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  const permissionError = requirePermission(request, 'permOnlineAuthPhone');
  if (permissionError) return permissionError;

  const body = await request.json().catch(() => ({}));
  const grantedBy = toPositiveInt(authPayloadFromRequest(request)?.id) || 1;
  try {
    return withDb((db) => {
      ensureAuthorizationAuditColumns(db);
      const seriesId = toPositiveInt(routeParams.id);
      const phone = cleanText(body.phone);
      if (!seriesId) return jsonError('课程不存在', 404);
      if (!/^\+?\d{5,20}$/.test(phone.replace(/[\s-]/g, ''))) return jsonError('请输入正确的手机号', 400);
      const normalizedPhone = phone.replace(/[\s-]/g, '');

      const series = db.prepare('SELECT id FROM CourseSeries WHERE id=?').get(seriesId);
      if (!series) return jsonError('课程不存在', 404);

      let member = db.prepare('SELECT id, phone, name FROM Member WHERE phone=?').get(normalizedPhone) as any;
      let created = false;
      if (!member) {
        const result = db.prepare(
          `INSERT INTO Member (name, phone, source, status, register_date, created_at)
           VALUES (?, ?, 'phone_auth', 'active', date('now','localtime'), datetime('now','localtime'))`
        ).run(`手机学员${normalizedPhone.slice(-4)}`, normalizedPhone);
        member = db.prepare('SELECT id, phone, name FROM Member WHERE id=?').get(result.lastInsertRowid);
        created = true;
        createWelcomeMessage(db, Number(member.id), String(member.name || ''));
      }

      db.prepare("UPDATE CourseAuthorization SET status='revoked', revoked_at=datetime('now','localtime'), revoked_by=? WHERE series_id=? AND status='active' AND (phone=? OR member_id=?)")
        .run(grantedBy, seriesId, normalizedPhone, member.id);
      const authorization = db.prepare(
        `INSERT INTO CourseAuthorization (member_id, phone, series_id, type, granted_by, granted_at, status, remark)
         VALUES (?, ?, ?, 'admin_grant', ?, datetime('now','localtime'), 'active', ?)`
      ).run(member.id, normalizedPhone, seriesId, grantedBy, cleanText(body.remark));
      createAuthorizationMessage(db, Number(member.id), seriesId, authorization.lastInsertRowid);
      return Response.json({ success: true, data: { member, created } });
    });
  } catch (err: any) {
    return jsonError(err?.message || '手机号授权失败');
  }
}
