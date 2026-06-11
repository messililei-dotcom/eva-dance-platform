import { getMemberId, jsonError, recordSeriesVisit, toPositiveInt, withDb } from '../../../../_helpers';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    return withDb((db) => {
      const seriesId = toPositiveInt(routeParams.id);
      const data = db.prepare(
        `SELECT cs.id, cs.name, cs.subtitle, cs.cover_image, cs.teacher, cs.price, cs.promo_price,
                (SELECT COUNT(*) FROM OnlineCourse WHERE series_id=cs.id) as total_courses,
                cs.rich_description
         FROM CourseSeries cs WHERE cs.id=? AND cs.status='published'`
      ).get(seriesId);
      if (!data) return jsonError('课程不存在', 404);
      recordSeriesVisit(db, seriesId, getMemberId(new URL(request.url).searchParams, request), 'detail');
      return Response.json({ success: true, data });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
