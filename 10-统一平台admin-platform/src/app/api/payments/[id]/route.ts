import { cleanText, deletePaymentOrder, isCommissionSettlementLocked, isSuperAdminRequest, jsonError, openTrainingDb, syncPaymentOrder, toNumber, today } from '../../training-db';
import { authPayloadFromRequest, requirePermission } from '../../training-db';
import { writeAdminAudit } from '@/lib/server/admin-audit';
import { deletePaymentVoucherFile } from '../_voucher-files';
import { recalculateMemberGrowth, reconcileOfflinePayment, reverseDeletedSource } from '@/lib/server/student-growth';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  const denied = requirePermission(request, 'permPaymentEdit', '无权限编辑缴费记录');
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const db = openTrainingDb();
  let replacedVoucherPath = '';
  try {
    const result = db.transaction(() => {
      const current = db.prepare('SELECT * FROM Payment WHERE id = ?').get(routeParams.id);
      if (!current) return { changes: 0 };
      const memberId = toNumber(body.memberId, current.memberId);
      const courseId = toNumber(body.courseId, current.courseId);
      const member = db.prepare('SELECT id, name, phone FROM Member WHERE id = ?').get(memberId);
      const course = db.prepare('SELECT id, name, sessions, endDate FROM Course WHERE id = ?').get(courseId);
      if (!member) throw new Error('学员不存在');
      if (!course) throw new Error('课程不存在');
      if (Number(current.memberId) !== Number(member.id)) {
        reverseDeletedSource(db, Number(current.memberId), 'offline_payment', current.id, '缴费记录转移学员并冲正原学员购买经验');
      }
      const amount = toNumber(body.amount, current.amount);
      const commissionRate = toNumber(body.commissionRate, current.commissionRate);
      const commissionAmount = Math.round((amount * commissionRate / 100) * 100) / 100;
      const nextDate = cleanText(body.date, current.date || today());
      const nextSales = cleanText(body.sales, current.sales || '');
      const currentLocked = isCommissionSettlementLocked(db, current.sales || '', current.date || current.created_at || '');
      const nextLocked = isCommissionSettlementLocked(db, nextSales, nextDate);
      if ((currentLocked || nextLocked) && !isSuperAdminRequest(request)) {
        throw new Error('该月份提成已结清，仅超级管理员可修改相关缴费记录');
      }

      const info = db.prepare(`
        UPDATE Payment
        SET memberId = ?, memberName = ?, memberPhone = ?, courseId = ?, courseName = ?,
            amount = ?, date = ?, payment = ?, sales = ?, remark = ?,
            expireDate = ?, remainingSessions = ?, paymentStatus = ?,
            voucherPath = ?, voucherFilename = ?, voucherUploadedAt = ?,
            commissionRate = ?, commissionAmount = ?
        WHERE id = ?
      `).run(
        member.id,
        member.name,
        member.phone || '',
        course.id,
        course.name,
        amount,
        nextDate,
        current.payment || '',
        nextSales,
        cleanText(body.remark, current.remark || ''),
        cleanText(body.expireDate, current.expireDate || course.endDate || ''),
        Math.max(0, toNumber(body.remainingSessions, current.remainingSessions)),
        cleanText(body.paymentStatus, current.paymentStatus || 'paid'),
        cleanText(body.voucherPath, current.voucherPath || ''),
        cleanText(body.voucherFilename, current.voucherFilename || ''),
        cleanText(body.voucherUploadedAt, current.voucherUploadedAt || ''),
        commissionRate,
        commissionAmount,
        routeParams.id,
      );
      db.prepare(`
        UPDATE ConsumeRecord
        SET memberId = ?, memberName = ?, memberPhone = ?, courseId = ?, courseName = ?
        WHERE paymentId = ?
      `).run(member.id, member.name, member.phone || '', course.id, course.name, routeParams.id);
      syncPaymentOrder(db, routeParams.id);
      reconcileOfflinePayment(db, Number(routeParams.id));
      if (cleanText(body.previousVoucherPath) && cleanText(body.previousVoucherPath) !== cleanText(body.voucherPath)) replacedVoucherPath = cleanText(body.previousVoucherPath);
      return info;
    })();
    if (!result.changes) return Response.json({ success: false, error: '缴费记录不存在' }, { status: 404 });
    if (replacedVoucherPath) await deletePaymentVoucherFile(replacedVoucherPath);
    return Response.json({ success: true });
  } catch (err: any) {
    return jsonError(err?.message, 400, '编辑缴费失败');
  } finally {
    db.close();
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requirePermission(request, 'permPaymentDelete', '无权限删除缴费记录');
  if (denied) return denied;
  const { id } = await params;
  const actor = authPayloadFromRequest(request)?.username || '本地开发';
  const db = openTrainingDb();
  let deletedVoucherPath = '';
  try {
    const result = db.transaction(() => {
      const current = db.prepare('SELECT * FROM Payment WHERE id = ?').get(id);
      if (!current) return 'missing';
      if (isCommissionSettlementLocked(db, current.sales || '', current.date || current.created_at || '')
          && !isSuperAdminRequest(request)) return 'locked';
      deletedVoucherPath = current.voucherPath || '';
      reverseDeletedSource(db, Number(current.memberId), 'offline_payment', current.id, '删除线下缴费记录并冲正购买经验');
      db.prepare('DELETE FROM ConsumeRecord WHERE paymentId = ?').run(id);
      db.prepare('DELETE FROM Payment WHERE id = ?').run(id);
      deletePaymentOrder(db, id);
      recalculateMemberGrowth(db, Number(current.memberId), '删除线下缴费记录');
      writeAdminAudit(db, { actor, kind: 'operation', method: 'DELETE', path: `/api/payments/${id}`, status: 200, label: '删除缴费记录', request });
      return 'deleted';
    })();
    if (result === 'missing') return jsonError('缴费记录不存在', 404);
    if (result === 'locked') return jsonError('该月份提成已结清，仅超级管理员可删除相关缴费记录', 403);
    if (deletedVoucherPath) await deletePaymentVoucherFile(deletedVoucherPath);
    return Response.json({ success: true });
  } finally {
    db.close();
  }
}
