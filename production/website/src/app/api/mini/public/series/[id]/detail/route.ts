import { jsonError, toPositiveInt, withDb } from '../../../../_helpers';
import { noStoreJson } from '@/lib/http-cache';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const routeParams = await params;
    return withDb((db) => {
      const data = db.prepare(
        `SELECT cs.id, cs.name, cs.subtitle, cs.cover_image, cs.teacher, cs.price, cs.promo_price,
                (SELECT COUNT(*) FROM OnlineCourse WHERE series_id=cs.id AND status='published') as total_courses,
                (SELECT COUNT(DISTINCT member_id) FROM CourseAuthorization WHERE series_id=cs.id) as total_students,
                cs.rich_description
         FROM CourseSeries cs WHERE cs.id=? AND cs.status='published'`
      ).get(toPositiveInt(routeParams.id));
      if (!data) return jsonError('专栏不存在', 404);
      return noStoreJson({ success: true, data });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
