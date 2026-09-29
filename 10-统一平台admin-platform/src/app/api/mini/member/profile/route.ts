import { cleanText, getMemberId, jsonError, linkedMemberIds, sqlIn, withDb } from '../../_helpers';
import { listAuthorizedSeriesForMember } from '../../../course/series/[id]/_authorization';
import { getGrowthSummary, listGrowthLedger } from '@/lib/server/student-growth';

function tableExists(db: any, table: string) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table));
}

function profilePayload(db: any, memberId: number, member: Record<string, any>) {
  const ids = linkedMemberIds(db, memberId);
  const linked = sqlIn(ids);
  const paymentStats = db.prepare(`
    SELECT
      COUNT(*) AS payment_count,
      COUNT(DISTINCT NULLIF(courseId, 0)) AS course_count,
      COALESCE(SUM(COALESCE(amount, 0)), 0) AS paid_amount,
      COALESCE(SUM(COALESCE(remainingSessions, 0)), 0) AS remaining_sessions
    FROM Payment
    WHERE memberId IN (${linked.clause})
  `).get(...linked.values) as Record<string, any>;
  const consumeStats = db.prepare(`
    SELECT COALESCE(SUM(COALESCE(count, 0)), 0) AS consumed_sessions
    FROM ConsumeRecord
    WHERE memberId IN (${linked.clause})
  `).get(...linked.values) as Record<string, any>;
  const authorizedSeries = tableExists(db, 'CourseAuthorization')
    ? linkedMemberIds(db, memberId).flatMap(id => listAuthorizedSeriesForMember(db, id))
    : [];
  const authorizedCount = new Set(
    authorizedSeries
      .map((row: any) => Number(row.series_id || row.seriesId || row.id || 0))
      .filter(Boolean),
  ).size;
  const progressStats = tableExists(db, 'VideoProgress')
    ? db.prepare(`
        SELECT COUNT(DISTINCT video_id) AS learning_count,
               COALESCE(SUM(CASE WHEN COALESCE(completed, 0)=1 THEN 1 ELSE 0 END), 0) AS completed_count
        FROM VideoProgress
        WHERE member_id IN (${linked.clause})
      `).get(...linked.values) as Record<string, any>
    : { learning_count: 0, completed_count: 0 };
  const recentProgress = tableExists(db, 'VideoProgress')
    ? db.prepare(`
        SELECT c.id as course_id, c.name as course_name, cs.name as series_name, cs.id as series_id,
               cs.cover_image, vp.progress, vp.duration, vp.completed, vp.last_play_at,
               cv.id as video_id, cv.name as video_name
        FROM VideoProgress vp
        JOIN CourseVideo cv ON vp.video_id=cv.id
        JOIN OnlineCourse c ON cv.course_id=c.id
        LEFT JOIN CourseSeries cs ON c.series_id=cs.id
        WHERE vp.member_id IN (${linked.clause})
        ORDER BY vp.last_play_at DESC LIMIT 20
      `).all(...linked.values)
    : [];
  const learningCount = Number(progressStats.learning_count || 0);
  const completedCount = Number(progressStats.completed_count || 0);
  const remainingSessions = Number(paymentStats.remaining_sessions || 0);
  const consumedSessions = Number(consumeStats.consumed_sessions || 0);
  const offlinePaymentCount = Number(paymentStats.payment_count || 0);
  const offlineCourseCount = Number(paymentStats.course_count || 0) || offlinePaymentCount;
  const paidAmount = Number(paymentStats.paid_amount || 0);
  const stats = {
    authorized_count: authorizedCount,
    learning_count: learningCount,
    completed_count: completedCount,
    completion_rate: learningCount ? Math.round((completedCount / learningCount) * 100) : 0,
    order_count: offlinePaymentCount,
    paid_amount: paidAmount,
    offline_course_count: offlineCourseCount,
    offline_payment_count: offlinePaymentCount,
    offline_paid_amount: paidAmount,
    offline_remaining_sessions: remainingSessions,
    offline_consumed_sessions: consumedSessions,
    offline_total_sessions: remainingSessions + consumedSessions,
    linked_member_ids: ids,
  };
  const growth = getGrowthSummary(db, memberId);
  return {
    ...member,
    member,
    stats,
    growth,
    experience_ledger: listGrowthLedger(db, memberId, 20),
    commission_summary: { available_amount: 0 },
    recent_progress: recentProgress,
  };
}

export async function GET(request: Request) {
  try {
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);
      const member = db.prepare(
        `SELECT id, name, phone, gender, birthday, country, province, city, address, remark,
                register_date, created_at, COALESCE(wx_avatar_url, '') as avatar_url,
                wx_avatar_url, wx_nickname, wx_name, wx_account, wx_openid, wx_unionid, wx_profile_synced_at, level
         FROM Member WHERE id=?`
      ).get<Record<string, any>>(memberId);
      if (!member) return jsonError('学员不存在', 404);
      return Response.json({ success: true, data: profilePayload(db, memberId, member) });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);
      const name = cleanText(body.name);
      if (!name) return jsonError('姓名不能为空', 400);

      db.prepare(`
        UPDATE Member
        SET name=?, gender=?, birthday=?, country=?, province=?, city=?, address=?, remark=?,
            wx_name=COALESCE(?,wx_name), wx_nickname=COALESCE(?,wx_nickname), wx_account=COALESCE(?,wx_account)
        WHERE id=?
      `).run(
        name,
        cleanText(body.gender, '女'),
        cleanText(body.birthday),
        cleanText(body.country, '中国'),
        cleanText(body.province),
        cleanText(body.city),
        cleanText(body.address),
        cleanText(body.remark),
        body.wxName !== undefined || body.wx_name !== undefined ? cleanText(body.wxName ?? body.wx_name) : null,
        body.wxNickname !== undefined || body.wx_nickname !== undefined ? cleanText(body.wxNickname ?? body.wx_nickname) : null,
        body.wxAccount !== undefined || body.wx_account !== undefined ? cleanText(body.wxAccount ?? body.wx_account) : null,
        memberId,
      );

      const member = db.prepare(
        `SELECT id, name, phone, gender, birthday, country, province, city, address, remark,
                register_date, created_at, COALESCE(wx_avatar_url, '') as avatar_url,
                wx_avatar_url, wx_nickname, wx_name, wx_account, wx_openid, wx_unionid, wx_profile_synced_at, level
         FROM Member WHERE id=?`
      ).get<Record<string, any>>(memberId);
      return Response.json({ success: true, data: member ? profilePayload(db, memberId, member) : member });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
