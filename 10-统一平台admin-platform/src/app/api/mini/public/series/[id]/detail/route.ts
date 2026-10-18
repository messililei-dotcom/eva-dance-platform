import { getCoursePromotion, applyCoursePromotion } from '@/lib/server/course-promotion';
import { studentDisplayBases } from '@/lib/server/student-display';
import { getMemberId, jsonError, recordSeriesVisit, toPositiveInt, withDb } from '../../../../_helpers';
import { noStoreJson } from '@/lib/http-cache';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    return withDb((db) => {
      const displayBases = studentDisplayBases(db);
      const promotionEnabled = getCoursePromotion(db).enabled;
      const seriesId = toPositiveInt(routeParams.id);
      const data = db.prepare(
        `SELECT cs.id, cs.name, cs.subtitle, cs.category, cs.teacher, cs.price, cs.promo_price,
                cs.is_free, cs.cover_image, cs.share_image, cs.share_text, cs.description,
                cs.rich_description, cs.trial_count, cs.sort_order, cs.status,
                (SELECT COUNT(*) FROM OnlineCourse WHERE series_id=cs.id AND status='published') as total_courses,
                (SELECT COUNT(DISTINCT member_id) FROM CourseAuthorization WHERE series_id=cs.id) as total_students
         FROM CourseSeries cs WHERE cs.id=? AND cs.status='published'`
      ).get(seriesId);
      if (!data) return jsonError('课程不存在', 404);
      Object.assign(data, { student_display_base: displayBases.get(seriesId) });
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      recordSeriesVisit(db, seriesId, memberId, 'detail', request);
      const body = { success: true, data: applyCoursePromotion(data, promotionEnabled) };
      return noStoreJson(body);
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
