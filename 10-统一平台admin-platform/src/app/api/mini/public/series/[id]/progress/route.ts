import { getMemberId, jsonError, toPositiveInt, withDb } from '../../../../_helpers';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const routeParams = await params;
    return withDb((db) => {
      const seriesId = toPositiveInt(routeParams.id);
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      if (!memberId) return Response.json({ success: true, data: [] });

      const rows = db.prepare(
        `SELECT cv.id as video_id, cv.course_id, vp.progress, vp.duration, vp.completed, vp.last_play_at
         FROM CourseVideo cv
         JOIN OnlineCourse oc ON cv.course_id=oc.id
         LEFT JOIN VideoProgress vp ON vp.video_id=cv.id AND vp.member_id=?
         WHERE oc.series_id=?
         ORDER BY oc.sort_order, oc.id, cv.sort_order, cv.id`
      ).all(memberId, seriesId);

      return Response.json({ success: true, data: rows });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
