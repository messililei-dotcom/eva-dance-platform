import { syncOfflinePaymentBalance } from '@/lib/server/offline-training';
import { cleanText, getMemberId, jsonError, linkedMemberIds, shanghaiDateKey, sqlIn, toPositiveInt, withDb } from '../../_helpers';
import { reconcileOfflineCheckin } from '@/lib/server/student-growth';
import { createConsumeMessage } from '@/lib/server/inbox';

function tableExists(db: any, table: string) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table));
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      const paymentId = toPositiveInt(body.paymentId ?? body.payment_id);
      if (!memberId) return jsonError('未登录', 401);
      if (!paymentId) return jsonError('请选择要签到核销的学习', 400);

      const member = db.prepare('SELECT * FROM Member WHERE id=?').get<any>(memberId);
      if (!member) return jsonError('学员不存在', 404);
      const linked = sqlIn(linkedMemberIds(db, memberId));

      const payment = db.prepare(`SELECT * FROM Payment WHERE id=? AND memberId IN (${linked.clause})`).get<any>(paymentId, ...linked.values);
      if (!payment) return jsonError('学习记录不存在', 404);
      if (!['paid','completed'].includes(String(payment.paymentStatus))) return jsonError('请完成课程期次付款后再核销',400);
      if ((Number(payment.remainingSessions) || 0) < 1) return jsonError('剩余课时不足，无法签到核销', 400);

      const course = payment.courseId ? db.prepare('SELECT * FROM Course WHERE id=?').get<any>(payment.courseId) : null;
      if (!course) return jsonError('缴费记录未关联有效课程期次，请先核对期次',400);
      const today = shanghaiDateKey();
      const expireDate = String(payment.expireDate || course?.endDate || '').slice(0, 10);
      if (expireDate && expireDate < today) return jsonError('学习已到期，无法自助签到核销', 400);

      const courseName = course?.name || payment.courseName || '未知学习';
      const newRemaining = (Number(payment.remainingSessions) || 0) - 1;
      const remark = cleanText(body.remark, '学习中心自助签到核销');

      const tx = db.transaction(() => {
        const consume = db.prepare(`
          INSERT INTO ConsumeRecord (
            memberId, memberName, memberPhone, paymentId, courseId, courseName,
            count, consumeDate, remainingAfter, operator, remark
          )
          VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, '学员自助签到', ?)
        `).run(member.id, member.name || '', member.phone || '', payment.id, payment.courseId || 0, courseName, today, newRemaining, remark);
        db.prepare('UPDATE Payment SET remainingSessions=? WHERE id=?').run(newRemaining, payment.id);
        syncOfflinePaymentBalance(db,payment.id);
        reconcileOfflineCheckin(db, Number(consume.lastInsertRowid));
        createConsumeMessage(db, {
          memberId,
          consumeId: consume.lastInsertRowid,
          courseName,
          count: 1,
          remainingAfter: newRemaining,
        });
        if (tableExists(db, 'OperationLog')) {
          db.prepare('INSERT INTO OperationLog (time, operator, type, module, detail) VALUES (?, ?, ?, ?, ?)').run(
            new Date().toLocaleString('zh-CN'),
            member.name || member.phone || '学员',
            '签到核销',
            '学习中心',
            `${member.name || member.phone} 自助签到核销 ${courseName} 1课时，剩余 ${newRemaining} 课时`,
          );
        }
      });
      tx();

      return Response.json({
        success: true,
        message: '签到核销成功',
        data: { remainingSessions: newRemaining, remaining_sessions: newRemaining },
      });
    });
  } catch (err: any) {
    return jsonError(err.message || '签到核销失败');
  }
}
