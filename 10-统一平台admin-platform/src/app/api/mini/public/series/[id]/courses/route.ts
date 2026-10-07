import { getMemberId, jsonError, recordSeriesVisit, toPositiveInt, withDb } from '../../../../_helpers';
import { noStoreJson } from '@/lib/http-cache';

const VISIBLE_VIDEO_STATUS = "(cv.status IS NULL OR cv.status = '' OR cv.status = 'published')";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    return withDb((db) => {
      const seriesId = toPositiveInt(routeParams.id);
      const series = db.prepare("SELECT id FROM CourseSeries WHERE id=? AND status='published'").get(seriesId);
      if (!series) return jsonError('课程不存在', 404);
      recordSeriesVisit(db, seriesId, getMemberId(new URL(request.url).searchParams, request), 'catalog', request);
      const courses = db.prepare(
        `SELECT oc.id, oc.series_id, oc.name, oc.description, oc.rich_description, oc.cover_image,
                oc.share_text, oc.course_type, oc.course_type as type, oc.single_price, oc.duration,
                (SELECT COUNT(*) FROM CourseVideo cv WHERE cv.course_id=oc.id AND ${VISIBLE_VIDEO_STATUS}) as video_count,
                oc.is_free_trial, oc.sort_order, oc.status
         FROM OnlineCourse oc
         WHERE oc.series_id=? AND oc.status='published'
         ORDER BY oc.sort_order, oc.id`
      ).all(seriesId);
      const courseIds = courses.map((course: any) => Number(course.id)).filter(Boolean);
      const miniClient = request.headers.get('x-client-platform')?.trim().toLowerCase() === 'miniprogram';
      const videoRows = courseIds.length
        ? db.prepare(
          `SELECT cv.id, cv.material_id, cv.course_id, ${miniClient ? "COALESCE(NULLIF(TRIM(oc.name), ''), cv.name)" : "cv.name"} as name, COALESCE(NULLIF(cv.duration, 0), m.duration, 0) as duration
           FROM CourseVideo cv
           LEFT JOIN Material m ON cv.material_id=m.id
           LEFT JOIN OnlineCourse oc ON cv.course_id=oc.id
           WHERE cv.course_id IN (${courseIds.map(() => '?').join(',')}) AND ${VISIBLE_VIDEO_STATUS}
           ORDER BY cv.sort_order, cv.id`
        ).all(...courseIds)
        : [];
      const videosByCourse = new Map<number, any[]>();
      for (const { course_id, ...video } of videoRows as any[]) {
        const key = Number(course_id);
        const group = videosByCourse.get(key) || [];
        group.push(video);
        videosByCourse.set(key, group);
      }
      const data = courses.map((course: any) => ({
        ...course,
        duration: Number(course.duration) > 0 ? course.duration
          : (videosByCourse.get(Number(course.id)) || []).reduce((sum: number, video: any) => sum + Number(video.duration || 0), 0),
        videos: videosByCourse.get(Number(course.id)) || [],
      }));
      const isPersonalized = getMemberId(new URL(request.url).searchParams, request) > 0;
      return isPersonalized ? Response.json({ success: true, data }) : noStoreJson({ success: true, data });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
