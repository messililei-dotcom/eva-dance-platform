import { studentDisplayBases } from '@/lib/server/student-display';
import { getMemberId, jsonError, recordSeriesVisit, toPositiveInt, withDb } from '../../../_helpers';
import { noStoreJson } from '@/lib/http-cache';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    return withDb((db) => {
      const displayBases = studentDisplayBases(db);
      const id = toPositiveInt(routeParams.id);
      const series = db.prepare(
        `SELECT cs.id, cs.name, cs.subtitle, cs.category, cs.teacher, cs.price, cs.promo_price, cs.is_free, cs.cover_image,
                cs.status, cs.description, cs.created_at,
                (SELECT COUNT(*) FROM OnlineCourse WHERE series_id=cs.id AND status='published') as total_courses,
                (SELECT COUNT(DISTINCT member_id) FROM CourseAuthorization WHERE series_id=cs.id) as total_students
         FROM CourseSeries cs WHERE cs.id=? AND cs.status='published'`
      ).get(id);
      if (!series) return jsonError('课程不存在', 404);
      const courses = db.prepare(
        `SELECT id, name, course_type as type, duration, sort_order
         FROM OnlineCourse
         WHERE series_id=? AND status='published'
         ORDER BY sort_order, id`
      ).all(id);
      const memberId = getMemberId(new URL(request.url).searchParams, request);
      recordSeriesVisit(db, id, memberId, 'series', request);
      const body = { success: true, data: { ...series, student_display_base: displayBases.get(id), courses } };
      return memberId ? Response.json(body) : noStoreJson(body);
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
