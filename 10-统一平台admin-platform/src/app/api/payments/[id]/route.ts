import { cleanText, deletePaymentOrder, hasAuth, jsonError, openTrainingDb, syncPaymentOrder, toNumber, today, unauthorized } from '../../training-db';
import { deletePaymentVoucherFile } from '../_voucher-files';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
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

      const info = db.prepare(`
        UPDATE Payment
        SET memberId = ?, memberName = ?, memberPhone = ?, courseId = ?, courseName = ?,
            amount = ?, date = ?, payment = ?, sales = ?, remark = ?,
            expireDate = ?, remainingSessions = ?, paymentStatus = ?,
            voucherPath = ?, voucherFilename = ?, voucherUploadedAt = ?
        WHERE id = ?
      `).run(
        member.id,
        member.name,
        member.phone || '',
        course.id,
        course.name,
        toNumber(body.amount, current.amount),
        cleanText(body.date, current.date || today()),
        cleanText(body.payment, current.payment || ''),
        cleanText(body.sales, current.sales || ''),
        cleanText(body.remark, current.remark || ''),
        cleanText(body.expireDate, current.expireDate || course.endDate || ''),
        Math.max(0, toNumber(body.remainingSessions, current.remainingSessions)),
        cleanText(body.paymentStatus, current.paymentStatus || 'paid'),
        cleanText(body.voucherPath, current.voucherPath || ''),
        cleanText(body.voucherFilename, current.voucherFilename || ''),
        cleanText(body.voucherUploadedAt, current.voucherUploadedAt || ''),
        routeParams.id,
      );
      db.prepare(`
        UPDATE ConsumeRecord
        SET memberId = ?, memberName = ?, memberPhone = ?, courseId = ?, courseName = ?
        WHERE paymentId = ?
      `).run(member.id, member.name, member.phone || '', course.id, course.name, routeParams.id);
      syncPaymentOrder(db, routeParams.id);
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
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const db = openTrainingDb();
  let deletedVoucherPath = '';
  try {
    db.transaction(() => {
      const current = db.prepare('SELECT voucherPath FROM Payment WHERE id = ?').get(routeParams.id);
      deletedVoucherPath = current?.voucherPath || '';
      db.prepare('DELETE FROM ConsumeRecord WHERE paymentId = ?').run(routeParams.id);
      db.prepare('DELETE FROM Payment WHERE id = ?').run(routeParams.id);
      deletePaymentOrder(db, routeParams.id);
    })();
    if (deletedVoucherPath) await deletePaymentVoucherFile(deletedVoucherPath);
    return Response.json({ success: true });
  } finally {
    db.close();
  }
}
