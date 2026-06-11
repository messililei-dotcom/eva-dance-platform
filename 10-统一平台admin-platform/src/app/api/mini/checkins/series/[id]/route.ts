import { jsonError, toPositiveInt, withDb } from '../../../_helpers';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    return withDb((db) => {
      const url = new URL(request.url);
      const page = toPositiveInt(url.searchParams.get('page'), 1);
      const pageSize = toPositiveInt(url.searchParams.get('pageSize'), 20);
      const seriesId = toPositiveInt(routeParams.id);
      const total = db.prepare('SELECT COUNT(*) as total FROM PracticeCheckin WHERE series_id=? OR member_id IN (SELECT member_id FROM CourseAuthorization WHERE series_id=?)').get(seriesId, seriesId)?.total || 0;
      const data = db.prepare(
        `SELECT pc.*, m.name as member_name, m.phone as member_phone
         FROM PracticeCheckin pc JOIN Member m ON pc.member_id=m.id
         WHERE pc.series_id=? OR pc.member_id IN (SELECT member_id FROM CourseAuthorization WHERE series_id=?)
         ORDER BY pc.created_at DESC LIMIT ? OFFSET ?`
      ).all(seriesId, seriesId, pageSize, (page - 1) * pageSize);
      return Response.json({ success: true, data, total, page, pageSize });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
