import { cleanText, hasAuth, jsonError, openTrainingDb, syncPaymentOrder, toNumber, today, unauthorized } from '../training-db';
import { reconcileOfflinePayment } from '@/lib/server/student-growth';
import { createPersonalMessage } from '@/lib/server/inbox';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const db = openTrainingDb();
  try {
    const rows = db.prepare(`
      SELECT *
      FROM Payment
      ORDER BY COALESCE(NULLIF(date, ''), created_at) DESC, id DESC
    `).all();
    return Response.json(rows);
  } finally {
    db.close();
  }
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const member = { id: toNumber(body.memberId), name: cleanText(body.memberName), phone: cleanText(body.memberPhone) };
  const course = { id: toNumber(body.courseId), name: cleanText(body.courseName) };
  const amount = toNumber(body.amount);
  const commissionRate = toNumber(body.commissionRate);
  const commissionAmount = Math.round((amount * commissionRate / 100) * 100) / 100;
  if (!member.id || !course.id) return Response.json({ success: false, error: '请选择学员和课程' }, { status: 400 });

  const db = openTrainingDb();
  try {
    const result = db.transaction(() => {
      const dbMember = db.prepare('SELECT id, name, phone FROM Member WHERE id = ?').get(member.id);
      const dbCourse = db.prepare('SELECT id, name, sessions, endDate FROM Course WHERE id = ?').get(course.id);
      if (!dbMember) throw new Error('学员不存在');
      if (!dbCourse) throw new Error('课程不存在');
      const remainingSessions = Math.max(0, toNumber(body.remainingSessions, toNumber(dbCourse.sessions)));
      const info = db.prepare(`
        INSERT INTO Payment (
          memberId, memberName, memberPhone, courseId, courseName, amount, date,
          payment, sales, remark, expireDate, remainingSessions, paymentStatus,
          voucherPath, voucherFilename, voucherUploadedAt, commissionRate, commissionAmount
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        dbMember.id,
        dbMember.name,
        dbMember.phone || '',
        dbCourse.id,
        dbCourse.name,
        amount,
        cleanText(body.date, today()),
        '',
        cleanText(body.sales),
        cleanText(body.remark),
        cleanText(body.expireDate, dbCourse.endDate || ''),
        remainingSessions,
        cleanText(body.paymentStatus, toNumber(body.amount) > 0 ? 'paid' : 'completed'),
        cleanText(body.voucherPath),
        cleanText(body.voucherFilename),
        cleanText(body.voucherUploadedAt),
        commissionRate,
        commissionAmount,
      );
      syncPaymentOrder(db, info.lastInsertRowid);
      reconcileOfflinePayment(db, Number(info.lastInsertRowid));
      createPersonalMessage(db, Number(dbMember.id), {
        type: 'offline',
        title: '线下课程报名成功',
        content: `《${dbCourse.name}》已经加入你的个人中心，可用课次 ${remainingSessions} 次。`,
        actionUrl: '/dashboard/profile#offline-courses',
        businessType: 'offline_purchase',
        businessId: info.lastInsertRowid,
        dedupeKey: `offline-purchase:${info.lastInsertRowid}`,
        priority: 'important',
      });
      return info;
    })();
    return Response.json({ success: true, id: result.lastInsertRowid });
  } catch (err: any) {
    return jsonError(err?.message, 400, '新建缴费失败');
  } finally {
    db.close();
  }
}
