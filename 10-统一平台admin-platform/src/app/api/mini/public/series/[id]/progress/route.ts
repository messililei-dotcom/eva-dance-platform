import { getMemberId, jsonError, linkedMemberIds, sqlIn, toPositiveInt, withDb } from '../../../../_helpers';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const routeParams = await params;
    return withDb((db) => {
      const seriesId = toPositiveInt(routeParams.id);
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return Response.json({ success: true, data: [] });
      const linked = sqlIn(linkedMemberIds(db, memberId));

      const rows = db.prepare(
        `SELECT cv.id as video_id, cv.course_id, vp.progress, vp.duration, vp.completed, vp.last_play_at
         FROM CourseVideo cv
         JOIN OnlineCourse oc ON cv.course_id=oc.id
         LEFT JOIN (
           SELECT video_id, MAX(progress) AS progress, MAX(duration) AS duration,
                  MAX(completed) AS completed, MAX(last_play_at) AS last_play_at
           FROM VideoProgress
           WHERE member_id IN (${linked.clause})
           GROUP BY video_id
         ) vp ON vp.video_id=cv.id
         WHERE oc.series_id=?
         ORDER BY oc.sort_order, oc.id, cv.sort_order, cv.id`
      ).all(...linked.values, seriesId);

      return Response.json({ success: true, data: rows });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
