import { canManageMini, cleanText, jsonError, toPositiveInt, withDb } from '../../../_helpers';
import { ensureAuthorizationAuditColumns, normalizePhoneIdentity, recordAuthorizationIncome } from '../../../../course/series/[id]/_authorization';
import { reconcileMemberAuthorizations } from '@/lib/server/student-growth';
import { createAuthorizationMessage, createWelcomeMessage } from '@/lib/server/inbox';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    const body = await request.json();
    return withDb((db) => {
      if (!canManageMini(db, request)) return jsonError('无权限操作学员授权', 403);
      ensureAuthorizationAuditColumns(db);
      const seriesId = toPositiveInt(routeParams.id);
      const phone = normalizePhoneIdentity(cleanText(body.phone));
      if (!/^1\d{10}$/.test(phone)) return jsonError('请输入正确的手机号', 400);
      let member = db.prepare(
        `SELECT id, phone, name FROM Member
         WHERE phone=? OR phone_national_number=?
         ORDER BY CASE WHEN phone=? THEN 0 ELSE 1 END, id DESC
         LIMIT 1`
      ).get(phone, phone, phone);
      let created = false;
      if (!member) {
        const result = db.prepare(`INSERT INTO Member (name, phone, source, status, register_date, created_at) VALUES (?, ?, 'phone_auth', 'active', date('now','localtime'), datetime('now','localtime'))`).run(`手机学员${phone.slice(-4)}`, phone);
        member = db.prepare('SELECT id, phone, name FROM Member WHERE id=?').get(result.lastInsertRowid);
        created = true;
        createWelcomeMessage(db, Number(member.id), String(member.name || ''));
      }
      db.prepare("UPDATE CourseAuthorization SET status='revoked',revoked_at=datetime('now','localtime') WHERE series_id=? AND type='phone_grant' AND status='active' AND (phone=? OR member_id=?)").run(seriesId, phone, member.id);
      const result = db.prepare(`INSERT INTO CourseAuthorization (member_id, phone, series_id, type, granted_at, status) VALUES (?, ?, ?, 'phone_grant', datetime('now','localtime'), 'active')`).run(member.id, phone, seriesId);
      const income = recordAuthorizationIncome(db, Number(result.lastInsertRowid));
      createAuthorizationMessage(db, Number(member.id), seriesId, result.lastInsertRowid);
      reconcileMemberAuthorizations(db, Number(member.id));
      return Response.json({ success: true, data: { member, created, income } });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
