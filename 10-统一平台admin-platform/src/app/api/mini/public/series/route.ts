import { getCoursePromotion, applyCoursePromotion } from '@/lib/server/course-promotion';
import { studentDisplayBases } from '@/lib/server/student-display';
import { jsonError, withDb } from '../../_helpers';
import { noStoreJson } from '@/lib/http-cache';

export async function GET() {
  try {
    return withDb((db) => {
      const displayBases = studentDisplayBases(db);
      const promotionEnabled = getCoursePromotion(db).enabled;
      const data = db.prepare(
        `SELECT cs.id, cs.name, cs.subtitle, cs.category, cs.teacher, cs.price, cs.promo_price, cs.is_free,
                cs.cover_image, cs.share_image, cs.share_text, cs.description, cs.rich_description,
                cs.trial_count, cs.sort_order, cs.status, cs.source_type, cs.source_id, cs.source_name,
                cs.created_at, cs.updated_at,
                (SELECT COUNT(*) FROM OnlineCourse WHERE series_id=cs.id AND status='published') as total_courses,
                (SELECT COUNT(DISTINCT member_id) FROM CourseAuthorization WHERE series_id=cs.id) as total_students
         FROM CourseSeries cs
         WHERE cs.status='published'
         ORDER BY cs.sort_order, cs.created_at DESC`
      ).all();
      return noStoreJson({ success: true, data: data.map((row: any) => ({ ...applyCoursePromotion(row, promotionEnabled), student_display_base: displayBases.get(Number(row.id)) })) });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
