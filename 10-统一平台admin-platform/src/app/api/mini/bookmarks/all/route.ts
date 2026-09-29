import { getMemberId, jsonError, linkedMemberIds, sqlIn, withDb } from '../../_helpers';

export async function GET(request: Request) {
  try {
    return withDb((db) => {
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return jsonError('未登录', 401);
      const linked = sqlIn(linkedMemberIds(db, memberId));
      const data = db.prepare(
        `SELECT vb.*, cv.name as video_name, oc.name as course_name, cs.name as series_name
         FROM VideoBookmark vb
         JOIN CourseVideo cv ON vb.video_id=cv.id
         JOIN OnlineCourse oc ON cv.course_id=oc.id
         LEFT JOIN CourseSeries cs ON oc.series_id=cs.id
         WHERE vb.member_id IN (${linked.clause}) ORDER BY vb.created_at DESC`
      ).all(...linked.values);
      return Response.json({ success: true, data });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
