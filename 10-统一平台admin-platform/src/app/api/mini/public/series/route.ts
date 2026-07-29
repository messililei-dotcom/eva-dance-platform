import { jsonError, withDb } from '../../_helpers';
import { publicShortCacheJson } from '@/lib/http-cache';

export async function GET() {
  try {
    return withDb((db) => {
      const data = db.prepare(
        `SELECT cs.id, cs.name, cs.subtitle, cs.category, cs.teacher, cs.price, cs.promo_price, cs.is_free,
                cs.cover_image, cs.share_image, cs.share_text, cs.description, cs.rich_description,
                cs.trial_count, cs.sort_order, cs.status, cs.source_type, cs.source_id, cs.source_name,
                cs.created_at, cs.updated_at,
                (SELECT COUNT(*) FROM OnlineCourse WHERE series_id=cs.id) as total_courses,
                (SELECT COUNT(DISTINCT member_id) FROM CourseAuthorization WHERE series_id=cs.id) as total_students
         FROM CourseSeries cs
         WHERE cs.status='published'
         ORDER BY cs.sort_order, cs.created_at DESC`
      ).all();
      return publicShortCacheJson({ success: true, data });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
