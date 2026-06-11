import { getMemberId, jsonError, withDb } from '../../_helpers';

export async function GET(request: Request) {
  try {
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);

      const rows = db.prepare(`
        SELECT
          cr.*,
          COALESCE(c.name, cr.courseName, '') AS resolvedCourseName
        FROM ConsumeRecord cr
        LEFT JOIN Course c ON c.id = cr.courseId
        WHERE cr.memberId = ?
        ORDER BY cr.id DESC
      `).all(memberId);

      return Response.json({
        success: true,
        data: rows.map((row: any) => ({
          id: row.id,
          memberId: row.memberId,
          member_id: row.memberId,
          memberName: row.memberName || '',
          member_name: row.memberName || '',
          courseId: row.courseId,
          course_id: row.courseId,
          courseName: row.resolvedCourseName || row.courseName || '未知学习',
          course_name: row.resolvedCourseName || row.courseName || '未知学习',
          paymentId: row.paymentId,
          payment_id: row.paymentId,
          count: Number(row.count) || 0,
          consumeDate: row.consumeDate || '',
          consume_date: row.consumeDate || '',
          remainingAfter: Number(row.remainingAfter) || 0,
          remaining_after: Number(row.remainingAfter) || 0,
          operator: row.operator || '',
          remark: row.remark || '',
          created_at: row.created_at || '',
        })),
      });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
