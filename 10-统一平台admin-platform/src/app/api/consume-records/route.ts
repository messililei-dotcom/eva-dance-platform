import { syncOfflinePaymentBalance } from '@/lib/server/offline-training';
import { cleanText, hasAuth, jsonError, openTrainingDb, toNumber, today, unauthorized } from '../training-db';
import { reconcileOfflineCheckin } from '@/lib/server/student-growth';
import { createConsumeMessage } from '@/lib/server/inbox';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const db = openTrainingDb();
  try {
    const rows = db.prepare(`
      SELECT *
      FROM ConsumeRecord
      ORDER BY COALESCE(NULLIF(consumeDate, ''), created_at) DESC, id DESC
    `).all();
    return Response.json(rows);
  } finally {
    db.close();
  }
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const paymentId = toNumber(body.paymentId);
  const count = Number(body.count ?? 1);
  if (!Number.isSafeInteger(count) || count < 1) return jsonError('核销课时须为正整数',400);
  if (!paymentId) return Response.json({ success: false, error: '请选择缴费记录' }, { status: 400 });

  const db = openTrainingDb();
  try {
    const result = db.transaction(() => {
      const payment = db.prepare('SELECT * FROM Payment WHERE id = ?').get(paymentId);
      if (!payment) throw new Error('缴费记录不存在');
      if (!['paid','completed'].includes(String(payment.paymentStatus))) throw new Error('请完成课程期次付款后再核销');
      if (!db.prepare('SELECT id FROM Course WHERE id=?').get(payment.courseId)) throw new Error('缴费记录未关联有效课程期次，请先核对期次');
      const remaining = toNumber(payment.remainingSessions);
      if (remaining < count) throw new Error('剩余课时不足，无法核销');
      const remainingAfter = remaining - count;
      const info = db.prepare(`
        INSERT INTO ConsumeRecord (
          memberId, memberName, memberPhone, paymentId, courseId, courseName,
          count, consumeDate, remainingAfter, operator, remark
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        payment.memberId,
        payment.memberName,
        payment.memberPhone || '',
        payment.id,
        payment.courseId,
        payment.courseName,
        count,
        cleanText(body.consumeDate, today()),
        remainingAfter,
        cleanText(body.operator),
        cleanText(body.remark),
      );
      db.prepare('UPDATE Payment SET remainingSessions = ? WHERE id = ?').run(remainingAfter, payment.id);
      syncOfflinePaymentBalance(db, payment.id);
      reconcileOfflineCheckin(db, Number(info.lastInsertRowid));
      createConsumeMessage(db, {
        memberId: Number(payment.memberId),
        consumeId: info.lastInsertRowid,
        courseName: String(payment.courseName || '课程'),
        count,
        remainingAfter,
      });
      return info;
    })();
    return Response.json({ success: true, id: result.lastInsertRowid });
  } catch (err: any) {
    return jsonError(err?.message, 400, '核销失败');
  } finally {
    db.close();
  }
}
