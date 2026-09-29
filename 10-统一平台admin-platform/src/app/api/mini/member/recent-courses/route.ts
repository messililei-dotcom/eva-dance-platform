import { getMemberId, jsonError, linkedMemberIds, sqlIn, withDb } from '../../_helpers';

export async function GET(request: Request) {
  try {
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);
      const linked = sqlIn(linkedMemberIds(db, memberId));
      const data = db.prepare(
        `SELECT c.id as course_id, c.name as course_name, cs.name as series_name, cs.id as series_id,
                cs.cover_image, vp.progress, vp.duration, vp.completed, vp.last_play_at,
                cv.id as video_id, cv.name as last_video_name
         FROM VideoProgress vp
         JOIN CourseVideo cv ON vp.video_id=cv.id
         JOIN OnlineCourse c ON cv.course_id=c.id
         LEFT JOIN CourseSeries cs ON c.series_id=cs.id
         WHERE vp.member_id IN (${linked.clause})
         ORDER BY vp.last_play_at DESC LIMIT 20`
      ).all(...linked.values);
      return Response.json({ success: true, data });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
