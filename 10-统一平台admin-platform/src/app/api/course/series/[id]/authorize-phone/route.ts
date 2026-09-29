import { authorizationFinancials } from '@/lib/server/authorization-commission';
import { cleanText, jsonError, toPositiveInt, withDb } from '../../../_materials';
import { authPayloadFromRequest, requirePermission } from '../../../../training-db';
import { ensureAuthorizationAuditColumns, normalizePhoneIdentity, normalizedPhoneSql, recordAuthorizationIncome } from '../_authorization';
import { reconcileMemberAuthorizations } from '@/lib/server/student-growth';
import { createAuthorizationMessage, createWelcomeMessage } from '@/lib/server/inbox';
import { normalizeAuthorizationVouchers } from '@/lib/server/authorization-vouchers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  const permissionError = requirePermission(request, 'permOnlineAuthPhone');
  if (permissionError) return permissionError;

  const body = await request.json().catch(() => ({}));
  const grantedBy = toPositiveInt(authPayloadFromRequest(request)?.id) || 1;
  try {
    return withDb((db) => db.transaction(() => {
      ensureAuthorizationAuditColumns(db);
      const seriesId = toPositiveInt(routeParams.id);
      const phone = cleanText(body.phone);
      if (!seriesId) return jsonError('课程不存在', 404);
      const normalizedPhone = normalizePhoneIdentity(phone);
      if (!/^\d{5,20}$/.test(normalizedPhone)) return jsonError('请输入正确的手机号', 400);
      const orderVouchers = normalizeAuthorizationVouchers(body.order_vouchers);
      if (!orderVouchers.length) return jsonError('请上传订单凭证', 400);

      const series = db.prepare('SELECT id FROM CourseSeries WHERE id=?').get(seriesId);
      if (!series) return jsonError('课程不存在', 404);

      const financial = authorizationFinancials(db, seriesId, body);

      let member = db.prepare(
        `SELECT id, phone, name, wx_openid, wx_unionid FROM Member
         WHERE phone=? OR phone_national_number=?
         ORDER BY CASE WHEN phone=? THEN 0 ELSE 1 END, id DESC
         LIMIT 1`
      ).get(normalizedPhone, normalizedPhone, normalizedPhone) as any;
      let created = false;
      if (!member) {
        const result = db.prepare(
          `INSERT INTO Member (name, phone, source, status, register_date, created_at)
           VALUES (?, ?, 'phone_auth', 'active', date('now','localtime'), datetime('now','localtime'))`
        ).run(`手机学员${normalizedPhone.slice(-4)}`, normalizedPhone);
        member = db.prepare('SELECT id, phone, name, wx_openid, wx_unionid FROM Member WHERE id=?').get(result.lastInsertRowid);
        created = true;
        createWelcomeMessage(db, Number(member.id), String(member.name || ''));
      }

      const wxOpenid = cleanText(member.wx_openid);
      const wxUnionid = cleanText(member.wx_unionid);
      db.prepare(
        `UPDATE CourseAuthorization
         SET status='revoked', revoked_at=datetime('now','localtime'), revoked_by=?
         WHERE series_id=? AND status='active'
           AND (
             member_id=?
             OR ${normalizedPhoneSql('phone')}=?
             OR (COALESCE(wx_openid, '')<>'' AND wx_openid=?)
             OR (COALESCE(wx_unionid, '')<>'' AND wx_unionid=?)
           )`
      )
        .run(grantedBy, seriesId, member.id, normalizedPhone, wxOpenid, wxUnionid);
      const result = db.prepare(
        `INSERT INTO CourseAuthorization (member_id, phone, wx_openid, wx_unionid, series_id, type, granted_by, granted_at, status, remark, order_vouchers)
         VALUES (?, ?, ?, ?, ?, 'admin_grant', ?, datetime('now','localtime'), 'active', ?, ?)`
      ).run(member.id, normalizedPhone, wxOpenid, wxUnionid, seriesId, grantedBy, cleanText(body.remark), JSON.stringify(orderVouchers));
      db.prepare('UPDATE CourseAuthorization SET actual_amount=?, sales=?, commission_rate=?, commission_amount=? WHERE id=?')
        .run(financial.amount, financial.sales, financial.rate, financial.commission, result.lastInsertRowid);
      const income = recordAuthorizationIncome(db, Number(result.lastInsertRowid));
      createAuthorizationMessage(db, Number(member.id), seriesId, result.lastInsertRowid);
      reconcileMemberAuthorizations(db, Number(member.id));
      return Response.json({ success: true, data: { member, created, income } });
    })());
  } catch (err: any) {
    return jsonError(err?.message || '手机号授权失败');
  }
}
