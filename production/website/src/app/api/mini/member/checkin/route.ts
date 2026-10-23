import { cleanText, getMemberForDataSync, getMemberId, jsonError, shanghaiDateKey, toPositiveInt, withDb } from '../../_helpers';
import { createLocalConsumeMessage, recordLocalGrowth } from '@/lib/server/inbox-events';

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
      if (!paymentId) return jsonError('请选择要签到核销的课程', 400);

      const member = getMemberForDataSync(db, memberId);
      if (!member) return jsonError('学员不存在', 404);

      const payment = db.prepare(`
        SELECT * FROM Payment
        WHERE id=?
          AND (memberId=? OR (? <> '' AND memberPhone=?))
      `).get<any>(paymentId, memberId, member.phone || '', member.phone || '');
      if (!payment) return jsonError('课程记录不存在', 404);
      if ((Number(payment.remainingSessions) || 0) < 1) return jsonError('剩余课次不足，无法签到核销', 400);

      const course = payment.courseId ? db.prepare('SELECT * FROM Course WHERE id=?').get<any>(payment.courseId) : null;
      const today = shanghaiDateKey();
      const expireDate = String(payment.expireDate || course?.endDate || '').slice(0, 10);
      if (expireDate && expireDate < today) return jsonError('课程已到期，无法自助签到核销', 400);

      const courseName = course?.name || payment.courseName || '未知课程';
      const newRemaining = (Number(payment.remainingSessions) || 0) - 1;
      const remark = cleanText(body.remark, '个人中心自助签到核销');
      const syncMemberId = toPositiveInt(payment.memberId, member.id);
      const syncMemberName = cleanText(payment.memberName, member.name || member.phone || '');
      const syncMemberPhone = cleanText(payment.memberPhone, member.phone || '');

      const tx = db.transaction(() => {
        const consume = db.prepare(`
          INSERT INTO ConsumeRecord (
            memberId, memberName, memberPhone, paymentId, courseId, courseName,
            count, consumeDate, remainingAfter, operator, remark
          )
          VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, '学员自助签到', ?)
        `).run(syncMemberId, syncMemberName, syncMemberPhone, payment.id, payment.courseId || 0, courseName, today, newRemaining, remark);
        db.prepare('UPDATE Payment SET remainingSessions=? WHERE id=?').run(newRemaining, payment.id);
        createLocalConsumeMessage(db, {
          memberId: syncMemberId,
          consumeId: consume.lastInsertRowid,
          courseName,
          remainingAfter: newRemaining,
        });
        recordLocalGrowth(db, {
          memberId: syncMemberId,
          eventType: 'offline_checkin',
          points: 10,
          sourceType: 'consume_record',
          sourceId: consume.lastInsertRowid,
          description: `完成《${courseName}》线下核销，经验值 +10。`,
          actionUrl: '/dashboard/progress',
        });
        if (tableExists(db, 'OperationLog')) {
          db.prepare('INSERT INTO OperationLog (time, operator, type, module, detail) VALUES (?, ?, ?, ?, ?)').run(
            new Date().toLocaleString('zh-CN'),
            member.name || member.phone || '学员',
            '签到核销',
            '个人中心',
            `${member.name || member.phone} 自助签到核销 ${courseName} 1课次，剩余 ${newRemaining} 课次`,
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
