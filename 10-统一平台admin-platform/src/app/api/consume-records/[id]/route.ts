import { syncOfflinePaymentBalance } from '@/lib/server/offline-training';
import { cleanText, hasAuth, jsonError, openTrainingDb, toNumber, today, unauthorized } from '../../training-db';
import { recalculateMemberGrowth, reconcileOfflineCheckin, reverseDeletedSource } from '@/lib/server/student-growth';
import { createConsumeMessage, createPersonalMessage } from '@/lib/server/inbox';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const nextCount = Number(body.count ?? 1);
  if (!Number.isSafeInteger(nextCount) || nextCount < 1) return jsonError('核销课时须为正整数',400);
  const db = openTrainingDb();
  try {
    const result = db.transaction(() => {
      const current = db.prepare('SELECT * FROM ConsumeRecord WHERE id = ?').get(routeParams.id);
      if (!current) return { changes: 0 };
      const payment = db.prepare('SELECT * FROM Payment WHERE id = ?').get(current.paymentId);
      if (!payment) throw new Error('缴费记录不存在');
      if (!['paid','completed'].includes(String(payment.paymentStatus))) throw new Error('请完成课程期次付款后再核销');
      if (!db.prepare('SELECT id FROM Course WHERE id=?').get(payment.courseId)) throw new Error('缴费记录未关联有效课程期次，请先核对期次');
      const restored = toNumber(payment.remainingSessions) + toNumber(current.count);
      if (restored < nextCount) throw new Error('剩余课时不足，无法调整核销次数');
      const remainingAfter = restored - nextCount;
      const info = db.prepare(`
        UPDATE ConsumeRecord
        SET count = ?, consumeDate = ?, remainingAfter = ?, operator = ?, remark = ?
        WHERE id = ?
      `).run(
        nextCount,
        cleanText(body.consumeDate, current.consumeDate || today()),
        remainingAfter,
        cleanText(body.operator, current.operator || ''),
        cleanText(body.remark, current.remark || ''),
        routeParams.id,
      );
      db.prepare('UPDATE Payment SET remainingSessions = ? WHERE id = ?').run(remainingAfter, payment.id);
      syncOfflinePaymentBalance(db, payment.id);
      reconcileOfflineCheckin(db, Number(routeParams.id));
      createPersonalMessage(db, Number(current.memberId), {
        type: 'consume',
        title: '核销记录已调整',
        content: `《${current.courseName || '课程'}》核销调整为 ${nextCount} 课次，当前剩余 ${remainingAfter} 课次。`,
        actionUrl: '/dashboard/progress',
        businessType: 'consume_adjustment',
        businessId: routeParams.id,
        dedupeKey: `consume-adjustment:${routeParams.id}:${nextCount}:${remainingAfter}`,
        priority: 'important',
      });
      return info;
    })();
    if (!result.changes) return Response.json({ success: false, error: '核销记录不存在' }, { status: 404 });
    return Response.json({ success: true });
  } catch (err: any) {
    return jsonError(err?.message, 400, '编辑核销失败');
  } finally {
    db.close();
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const db = openTrainingDb();
  try {
    const result = db.transaction(() => {
      const current = db.prepare('SELECT * FROM ConsumeRecord WHERE id = ?').get(routeParams.id);
      if (!current) return { changes: 0 };
      const payment = db.prepare('SELECT remainingSessions FROM Payment WHERE id = ?').get(current.paymentId);
      const remainingAfter = toNumber(payment?.remainingSessions) + toNumber(current.count);
      db.prepare('UPDATE Payment SET remainingSessions = ? WHERE id = ?').run(remainingAfter, current.paymentId);
      reverseDeletedSource(db, Number(current.memberId), 'consume_record', current.id, '撤销线下核销并冲正经验');
      const deleted = db.prepare('DELETE FROM ConsumeRecord WHERE id = ?').run(routeParams.id);
      syncOfflinePaymentBalance(db,current.paymentId);
      recalculateMemberGrowth(db, Number(current.memberId), '撤销线下核销');
      createConsumeMessage(db, {
        memberId: Number(current.memberId),
        consumeId: routeParams.id,
        courseName: String(current.courseName || '课程'),
        count: toNumber(current.count),
        remainingAfter,
        reversed: true,
      });
      return deleted;
    })();
    if (!result.changes) return Response.json({ success: false, error: '核销记录不存在' }, { status: 404 });
    return Response.json({ success: true });
  } finally {
    db.close();
  }
}
