import { hasAuth, openTrainingDb, unauthorized } from '../../../training-db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();
  const db = openTrainingDb();
  try {
    const member = db.prepare('SELECT * FROM Member WHERE id = ?').get(routeParams.id);
    if (!member) return Response.json({ success: false, error: '学员不存在' }, { status: 404 });
    const offlinePayments = db.prepare('SELECT * FROM Payment WHERE memberId = ? ORDER BY date DESC, id DESC').all(routeParams.id);
    const consumeRecords = db.prepare('SELECT * FROM ConsumeRecord WHERE memberId = ? ORDER BY consumeDate DESC, id DESC').all(routeParams.id);
    const offlineCourseRows = db.prepare(`
      SELECT
        p.courseId AS courseId,
        COALESCE(NULLIF(MAX(p.courseName), ''), NULLIF(MAX(c.name), ''), '未命名课程') AS name,
        COALESCE(SUM(p.remainingSessions), 0) AS remainingSessions,
        COALESCE((
          SELECT SUM(cr.count)
          FROM ConsumeRecord cr
          WHERE cr.memberId = p.memberId AND cr.courseId = p.courseId
        ), 0) AS completedSessions,
        MAX(COALESCE(NULLIF(p.date, ''), p.created_at)) AS lastActiveAt
      FROM Payment p
      LEFT JOIN Course c ON c.id = p.courseId
      WHERE p.memberId = ?
      GROUP BY p.memberId, p.courseId
      ORDER BY datetime(MAX(COALESCE(NULLIF(p.date, ''), p.created_at))) DESC, p.courseId DESC
    `).all<Record<string, any>>(routeParams.id);
    const authorizations = db.prepare(`
      SELECT ca.*, cs.name AS series_name, cs.total_courses
      FROM CourseAuthorization ca
      JOIN CourseSeries cs ON cs.id = ca.series_id
      WHERE ca.member_id = ? AND ca.status = 'active'
      ORDER BY datetime(ca.granted_at) DESC, ca.id DESC
    `).all<Record<string, any>>(routeParams.id);
    const onlineCourseRows = db.prepare(`
      WITH active_authorizations AS (
        SELECT series_id, MAX(granted_at) AS granted_at
        FROM CourseAuthorization
        WHERE member_id = ? AND status = 'active'
        GROUP BY series_id
      ), member_progress AS (
        SELECT video_id, MAX(progress) AS progress, MAX(duration) AS duration,
               MAX(completed) AS completed, MAX(last_play_at) AS last_play_at
        FROM VideoProgress
        WHERE member_id = ?
        GROUP BY video_id
      )
      SELECT
        cs.id AS seriesId,
        cs.name,
        cs.total_courses AS lessonCount,
        aa.granted_at AS grantedAt,
        COUNT(DISTINCT cv.id) AS totalVideos,
        COUNT(DISTINCT CASE WHEN mp.completed = 1 THEN cv.id END) AS completedVideos,
        COUNT(DISTINCT CASE WHEN mp.completed = 1 OR mp.progress > 0 THEN cv.id END) AS watchedVideos,
        ROUND(CASE WHEN COUNT(DISTINCT cv.id) > 0 THEN
          SUM(CASE
            WHEN cv.id IS NULL THEN 0
            WHEN mp.completed = 1 THEN 100
            WHEN COALESCE(mp.duration, 0) > 0 THEN MIN(100.0, COALESCE(mp.progress, 0) * 100.0 / mp.duration)
            ELSE 0
          END) / COUNT(DISTINCT cv.id)
        ELSE 0 END) AS progressPercent,
        MAX(mp.last_play_at) AS lastActiveAt
      FROM active_authorizations aa
      JOIN CourseSeries cs ON cs.id = aa.series_id
      LEFT JOIN OnlineCourse oc ON oc.series_id = cs.id
      LEFT JOIN CourseVideo cv ON cv.course_id = oc.id
      LEFT JOIN member_progress mp ON mp.video_id = cv.id
      GROUP BY cs.id, cs.name, cs.total_courses, aa.granted_at
      ORDER BY datetime(aa.granted_at) DESC, cs.id DESC
    `).all<Record<string, any>>(routeParams.id, routeParams.id);
    const offlineCourses = offlineCourseRows.map((row) => {
      const completedSessions = Math.max(0, Number(row.completedSessions || 0));
      const remainingSessions = Math.max(0, Number(row.remainingSessions || 0));
      const totalSessions = completedSessions + remainingSessions;
      const completed = completedSessions > 0 && remainingSessions <= 0;
      return {
        id: `offline-${row.courseId}`,
        type: 'offline',
        name: row.name,
        progressPercent: completed ? 100 : totalSessions > 0 ? Math.round(completedSessions * 100 / totalSessions) : 0,
        completedSessions,
        remainingSessions,
        totalSessions,
        status: completed ? 'completed' : completedSessions > 0 ? 'learning' : 'not_started',
        statusText: completed ? '已结业' : completedSessions > 0 ? '学习中' : '未开始',
        lastActiveAt: row.lastActiveAt || '',
      };
    });
    const onlineCourses = onlineCourseRows.map((row) => {
      const totalVideos = Math.max(0, Number(row.totalVideos || 0));
      const completedVideos = Math.max(0, Number(row.completedVideos || 0));
      const watchedVideos = Math.max(0, Number(row.watchedVideos || 0));
      const completed = totalVideos > 0 && completedVideos >= totalVideos;
      const measuredProgress = Math.max(0, Math.min(100, Number(row.progressPercent || 0)));
      return {
        id: `online-${row.seriesId}`,
        type: 'online',
        name: row.name,
        progressPercent: watchedVideos > 0 && measuredProgress < 1 ? 1 : measuredProgress,
        completedVideos,
        watchedVideos,
        totalVideos,
        lessonCount: Math.max(0, Number(row.lessonCount || 0)),
        status: completed ? 'completed' : watchedVideos > 0 ? 'learning' : 'not_started',
        statusText: completed ? '已完成' : watchedVideos > 0 ? '学习中' : '未开始',
        lastActiveAt: row.lastActiveAt || row.grantedAt || '',
      };
    });
    const courses = [...onlineCourses, ...offlineCourses];
    const summary = {
      offlineIncome: offlinePayments.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0),
      onlineIncome: 0,
      totalIncome: offlinePayments.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0),
      consumeCount: consumeRecords.reduce((sum: number, row: any) => sum + Number(row.count || 0), 0),
      authorizationCount: onlineCourses.length,
      completedVideoCount: onlineCourses.reduce((sum, row) => sum + row.completedVideos, 0),
      financeIncome: 0,
      financeOrderAmount: 0,
    };
    return Response.json({
      data: {
        member,
        summary,
        courses,
        offlinePayments,
        consumeRecords,
        courseOrders: [],
        authorizations,
        progress: [],
        financeIncomes: [],
        financeOrders: [],
        operationLogs: [],
      },
    });
  } finally {
    db.close();
  }
}
