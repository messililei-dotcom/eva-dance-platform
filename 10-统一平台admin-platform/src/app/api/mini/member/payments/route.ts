import { getMemberId, jsonError, shanghaiDateKey, withDb } from '../../_helpers';

function tableColumns(db: any, table: string) {
  return db.prepare(`PRAGMA table_info('${table.replace(/'/g, "''")}')`).all().map((row: any) => row.name);
}

export async function GET(request: Request) {
  try {
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);

      const today = shanghaiDateKey();
      const courseColumns = tableColumns(db, 'Course');
      const hasCourseType = courseColumns.includes('type');
      const rows = db.prepare(`
        SELECT
          p.*,
          COALESCE(c.name, p.courseName, '') AS resolvedCourseName,
          ${hasCourseType ? "COALESCE(c.type, '')" : "''"} AS courseType,
          COALESCE(c.sessions, 0) AS courseSessions,
          COALESCE(c.endDate, '') AS courseEndDate,
          COALESCE((
            SELECT SUM(cr.count)
            FROM ConsumeRecord cr
            WHERE cr.memberId = p.memberId
              AND cr.paymentId = p.id
              AND cr.consumeDate = ?
          ), 0) AS todayCheckinCount
        FROM Payment p
        LEFT JOIN Course c ON c.id = p.courseId
        WHERE p.memberId = ?
        ORDER BY p.id DESC
      `).all(today, memberId);

      return Response.json({
        success: true,
        data: rows.map((row: any) => ({
          id: row.id,
          memberId: row.memberId,
          member_id: row.memberId,
          courseId: row.courseId,
          course_id: row.courseId,
          courseName: row.resolvedCourseName || row.courseName || '未知学习',
          course_name: row.resolvedCourseName || row.courseName || '未知学习',
          courseType: row.courseType || '',
          course_type: row.courseType || '',
          courseSessions: Number(row.courseSessions) || 0,
          course_sessions: Number(row.courseSessions) || 0,
          amount: Number(row.amount) || 0,
          date: row.date || '',
          expireDate: row.expireDate || '',
          expire_date: row.expireDate || '',
          remainingSessions: Number(row.remainingSessions) || 0,
          remaining_sessions: Number(row.remainingSessions) || 0,
          courseEndDate: row.courseEndDate || '',
          course_end_date: row.courseEndDate || '',
          todayCheckinCount: Number(row.todayCheckinCount) || 0,
          today_checkin_count: Number(row.todayCheckinCount) || 0,
          paymentStatus: row.paymentStatus || '',
          payment_status: row.paymentStatus || '',
        })),
      });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
