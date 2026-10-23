import { jsonError, withDb } from '../../_helpers';
import { noStoreJson } from '@/lib/http-cache';

export async function GET() {
  try {
    return withDb((db) => {
      const data = db.prepare(
        `SELECT cs.id, cs.name, cs.subtitle, cs.category, cs.teacher, cs.price, cs.promo_price, cs.is_free, cs.cover_image,
                cs.status, cs.description, cs.created_at,
                (SELECT COUNT(*) FROM OnlineCourse WHERE series_id=cs.id AND status='published') as total_courses,
                (SELECT COUNT(DISTINCT member_id) FROM CourseAuthorization WHERE series_id=cs.id) as total_students
         FROM CourseSeries cs
         WHERE cs.status='published'
         ORDER BY cs.sort_order, cs.created_at DESC`
      ).all();
      return noStoreJson({ success: true, data });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
