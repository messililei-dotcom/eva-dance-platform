import { jsonError, withDb } from '../../_materials';
import { authPayloadFromRequest, requirePermission } from '../../../training-db';
import { authorizeMembers, normalizePhoneIdentity } from '../../series/[id]/_authorization';
import { authorizationFinancials } from '@/lib/server/authorization-commission';
import { normalizeAuthorizationVouchers } from '@/lib/server/authorization-vouchers';
import { splitBatchReceipt } from '@/lib/batch-authorization-financials';
import { createWelcomeMessage } from '@/lib/server/inbox';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const memberId = Number(body.member_id || 0);
  const denied = requirePermission(request, memberId ? 'permOnlineAuthCreate' : 'permOnlineAuthPhone');
  if (denied) return denied;
  try {
    const ids = Array.isArray(body.series_ids) ? body.series_ids.map(Number) : [];
    if (ids.length > 500) throw new Error('一次最多授权500门课程');
    // Batch grants are complimentary; never accept receipt or commission values from clients.
    const allocations = splitBatchReceipt(ids, 0, 0);
    const sales = String(body.sales || '').trim();
    if (!sales) throw new Error('请选择或输入课程顾问');
    const vouchers = normalizeAuthorizationVouchers(body.order_vouchers);
    if (!vouchers.length) throw new Error('请上传订单凭证');
    const phone = normalizePhoneIdentity(body.phone);
    if (!memberId && !/^\d{5,20}$/.test(phone)) throw new Error('请选择学员或输入正确手机号');
    const grantedBy = Number(authPayloadFromRequest(request)?.id) || 1;
    return withDb(db => db.transaction(() => {
      // Validate every course and settlement before creating any account or grant.
      for (const row of allocations) authorizationFinancials(db, row.id, { ...row, sales });
      let member = memberId
        ? db.prepare('SELECT id,status FROM Member WHERE id=?').get<{id:number;status:string}>(memberId)
        : db.prepare('SELECT id,status FROM Member WHERE phone=? OR phone_national_number=? ORDER BY CASE WHEN phone=? THEN 0 ELSE 1 END,id DESC LIMIT 1').get<{id:number;status:string}>(phone, phone, phone);
      if (!member && memberId) throw new Error('学员不存在');
      if (member && ['deleted','merged'].includes(member.status)) throw new Error('请使用有效的学员主账号');
      if (!member) {
        const name = `手机学员${phone.slice(-4)}`;
        const result = db.prepare("INSERT INTO Member(name,phone,source,status,register_date,created_at) VALUES(?,?,'phone_auth','active',date('now','localtime'),datetime('now','localtime'))").run(name,phone);
        member = {id:Number(result.lastInsertRowid),status:'active'};
        createWelcomeMessage(db, member.id, name);
      }
      let authorized = 0;
      for (const row of allocations) {
        const result = authorizeMembers(db,row.id,[member.id],grantedBy,vouchers,String(body.remark || ''),{...row,sales});
        if (result.authorized !== 1) throw new Error('授权未完成，本次操作已撤销');
        db.prepare('UPDATE CourseAuthorization SET commission_amount=? WHERE id=(SELECT MAX(id) FROM CourseAuthorization WHERE member_id=? AND series_id=?)').run(row.commission_amount, member.id, row.id);
        authorized += result.authorized;
      }
      return Response.json({success:true,authorized});
    })());
  } catch (error: any) {
    return jsonError(error?.message || '批量授权失败', 400);
  }
}
