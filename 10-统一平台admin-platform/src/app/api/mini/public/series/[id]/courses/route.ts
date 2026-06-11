import { getMemberId, jsonError, recordSeriesVisit, toPositiveInt, withDb } from '../../../../_helpers';

const VISIBLE_VIDEO_STATUS = "(cv.status IS NULL OR cv.status = '' OR cv.status = 'published')";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    return withDb((db) => {
      const seriesId = toPositiveInt(routeParams.id);
      const series = db.prepare("SELECT id FROM CourseSeries WHERE id=? AND status='published'").get(seriesId);
      if (!series) return jsonError('课程不存在', 404);
      recordSeriesVisit(db, seriesId, getMemberId(new URL(request.url).searchParams, request), 'catalog');
      const courses = db.prepare(
        `SELECT oc.id, oc.name, oc.description, oc.course_type as type, oc.duration,
                (SELECT COUNT(*) FROM CourseVideo cv WHERE cv.course_id=oc.id AND ${VISIBLE_VIDEO_STATUS}) as video_count,
                oc.is_free_trial, oc.sort_order
         FROM OnlineCourse oc
         WHERE oc.series_id=? AND oc.status='published'
         ORDER BY oc.sort_order, oc.id`
      ).all(seriesId);
      const data = courses.map((course: any) => ({
        ...course,
        videos: db.prepare(
          `SELECT cv.id, cv.material_id, cv.name, COALESCE(cv.duration, m.duration, 0) as duration
           FROM CourseVideo cv
           LEFT JOIN Material m ON cv.material_id=m.id
           WHERE cv.course_id=? AND ${VISIBLE_VIDEO_STATUS}
           ORDER BY cv.sort_order, cv.id`
        ).all(course.id),
      }));
      return Response.json({ success: true, data });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
