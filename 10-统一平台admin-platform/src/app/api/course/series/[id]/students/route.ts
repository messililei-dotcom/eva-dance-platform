import { jsonError, toPositiveInt, withDb } from '../../../_materials';
import { activeAuthJoin, ensureCourseSeriesVisitTable } from '../_authorization';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    return withDb((db) => {
      ensureCourseSeriesVisitTable(db);
      const seriesId = toPositiveInt(routeParams.id);
      const url = new URL(request.url);
      const tab = String(url.searchParams.get('tab') || 'all');
      const keyword = String(url.searchParams.get('keyword') || '').trim();
      const values: unknown[] = [seriesId, seriesId, seriesId];
      const where: string[] = [];

      if (keyword) {
        where.push('(m.name LIKE ? OR m.phone LIKE ?)');
        values.push(`%${keyword}%`, `%${keyword}%`);
      }
      if (tab === 'authorized') where.push('ca.id IS NOT NULL');
      if (tab === 'unauthorized') where.push('ca.id IS NULL AND fv.first_visited_at IS NOT NULL');
      if (tab !== 'authorized') where.push('(ca.id IS NOT NULL OR fv.first_visited_at IS NOT NULL)');

      const rows = db.prepare(
        `SELECT m.id, m.id as member_id, m.name, m.phone, m.level,
                m.source as member_source,
                ca.id as authorization_id,
                ca.type as authorization_type,
                ca.granted_at,
                ca.granted_by,
                u.name as granted_by_name,
                fv.first_visited_at,
                fv.first_visited_at as visited_at,
                fv.last_visited_at,
                fv.visit_count,
                fv.visit_source,
                CASE WHEN ca.id IS NULL THEN 0 ELSE 1 END as authorized
         FROM Member m
         LEFT JOIN CourseAuthorization ca
           ON ${activeAuthJoin('m')}
         LEFT JOIN (
           SELECT member_id,
                  MIN(first_visited_at) as first_visited_at,
                  MAX(last_visited_at) as last_visited_at,
                  SUM(visit_count) as visit_count,
                  MIN(source) as visit_source
           FROM (
             SELECT csv.member_id,
                    csv.first_visited_at,
                    csv.last_visited_at,
                    csv.visit_count,
                    csv.source
             FROM CourseSeriesVisit csv
             WHERE csv.series_id=?
             UNION ALL
             SELECT vp.member_id,
                    MIN(COALESCE(vp.created_at, vp.last_play_at)) as first_visited_at,
                    MAX(vp.last_play_at) as last_visited_at,
                    COUNT(*) as visit_count,
                    'video' as source
             FROM VideoProgress vp
             JOIN CourseVideo cv ON cv.id=vp.video_id
             JOIN OnlineCourse oc ON oc.id=cv.course_id
             WHERE oc.series_id=?
             GROUP BY vp.member_id
           )
           GROUP BY member_id
         ) fv ON fv.member_id=m.id
         LEFT JOIN User u ON u.id=ca.granted_by
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY ca.id IS NULL, m.id
         LIMIT 500`
      ).all(...values);

      return Response.json({ success: true, data: rows });
    });
  } catch (err: any) {
    return jsonError(err?.message || '获取学员授权失败');
  }
}
