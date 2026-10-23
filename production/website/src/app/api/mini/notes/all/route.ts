import { getAuthenticatedMemberId, jsonError, toPositiveInt, withDb } from '../../_helpers';

export async function GET(request: Request) {
  try {
    return withDb((db) => {
      const memberId = getAuthenticatedMemberId(request, new URL(request.url).searchParams);
      if (!memberId) return jsonError('未登录', 401);
      const videoId = toPositiveInt(new URL(request.url).searchParams.get('video_id'));
      const params: unknown[] = [memberId];
      if (videoId) params.push(videoId);
      const data = db.prepare(
        `SELECT sn.*, m.name as member_name, m.phone as member_phone,
                cv.name as video_name, oc.name as course_name, cs.name as series_name
         FROM StudyNote sn
         LEFT JOIN Member m ON sn.member_id=m.id
         JOIN CourseVideo cv ON sn.video_id=cv.id
         JOIN OnlineCourse oc ON cv.course_id=oc.id
         LEFT JOIN CourseSeries cs ON oc.series_id=cs.id
         WHERE sn.member_id=? ${videoId ? 'AND sn.video_id=?' : ''}
         ORDER BY sn.timestamp_seconds, sn.created_at DESC`
      ).all(...params);
      return Response.json({ success: true, data });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
