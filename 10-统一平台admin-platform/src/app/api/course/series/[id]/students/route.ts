import { jsonError, toPositiveInt, withDb } from '../../../_materials';
import { requirePermission } from '../../../../training-db';
import { ensureAuthorizationAuditColumns, ensureCourseSeriesVisitTable } from '../_authorization';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  const permissionError = requirePermission(request, 'permOnlineAuthView');
  if (permissionError) return permissionError;

  try {
    return withDb((db) => {
      ensureCourseSeriesVisitTable(db);
      ensureAuthorizationAuditColumns(db);
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
      if (tab === 'authorized') where.push("ca.status = 'active'");
      if (tab === 'unauthorized') where.push("(ca.id IS NULL OR ca.status <> 'active') AND (ca.id IS NOT NULL OR fv.first_visited_at IS NOT NULL)");
      if (tab !== 'authorized') where.push('(ca.id IS NOT NULL OR fv.first_visited_at IS NOT NULL)');

      const rows = db.prepare(
        `SELECT m.id, m.id as member_id, m.name, m.phone, m.level,
                m.source as member_source,
                ca.id as authorization_id,
                ca.type as authorization_type,
                ca.status as authorization_status,
                ca.granted_at,
                ca.granted_by,
                ca.revoked_at,
                ca.revoked_by,
                COALESCE(NULLIF(u.name, ''), NULLIF(u.username, ''), CASE WHEN ca.id IS NOT NULL THEN '系统记录' ELSE NULL END) as granted_by_name,
                COALESCE(NULLIF(ru.name, ''), NULLIF(ru.username, ''), '') as revoked_by_name,
                COALESCE(CASE WHEN ca.status = 'revoked' THEN ca.revoked_at END, ca.granted_at, fv.last_visited_at, fv.first_visited_at) as auth_action_at,
                CASE
                  WHEN ca.status = 'revoked' THEN COALESCE(NULLIF(ru.name, ''), NULLIF(ru.username, ''), NULLIF(u.name, ''), NULLIF(u.username, ''), '系统记录')
                  ELSE COALESCE(NULLIF(u.name, ''), NULLIF(u.username, ''), CASE WHEN ca.id IS NOT NULL THEN '系统记录' ELSE NULL END)
                END as auth_action_by_name,
                fv.first_visited_at,
                fv.first_visited_at as visited_at,
                fv.last_visited_at,
                fv.visit_count,
                fv.visit_source,
                CASE WHEN ca.status = 'active' THEN 1 ELSE 0 END as authorized
         FROM Member m
         LEFT JOIN CourseAuthorization ca
           ON ca.id = (
             SELECT ca2.id
             FROM CourseAuthorization ca2
             WHERE ca2.series_id=?
               AND (
                 ca2.member_id=m.id
                 OR (COALESCE(ca2.phone, '')<>'' AND COALESCE(m.phone, '')<>'' AND ca2.phone=m.phone)
               )
             ORDER BY ca2.id DESC
             LIMIT 1
           )
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
         LEFT JOIN User ru ON ru.id=ca.revoked_by
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY ca.id IS NULL, COALESCE(CASE WHEN ca.status = 'revoked' THEN ca.revoked_at END, ca.granted_at, fv.last_visited_at, fv.first_visited_at) DESC, ca.id DESC, m.id
         LIMIT 500`
      ).all(...values);

      const grantHistoryRows = db.prepare(
        `SELECT
           COALESCE(member_id, 0) AS member_id,
           COALESCE(phone, '') AS phone,
           COUNT(*) AS grant_count,
           SUM(CASE WHEN status='revoked' THEN 1 ELSE 0 END) AS revoke_count
         FROM CourseAuthorization
         WHERE series_id=?
         GROUP BY COALESCE(member_id, 0), COALESCE(phone, '')`
      ).all(seriesId) as any[];
      const grantHistoryByMember = new Map(
        grantHistoryRows
          .filter(row => Number(row.member_id || 0) > 0)
          .map(row => [Number(row.member_id), row]),
      );
      const grantHistoryByPhone = new Map(
        grantHistoryRows
          .filter(row => String(row.phone || ''))
          .map(row => [String(row.phone), row]),
      );
      const enrichedRows = rows.map((row: any) => {
        const grantHistory = grantHistoryByMember.get(Number(row.id))
          || grantHistoryByPhone.get(String(row.phone || ''));
        return {
          ...row,
          grant_history: {
            grant_count: Number(grantHistory?.grant_count || 0),
            revoke_count: Number(grantHistory?.revoke_count || 0),
          },
          visit_records: row.first_visited_at ? [{
            id: `summary-${row.id}`,
            source: row.visit_source || 'learn',
            visited_at: row.last_visited_at || row.first_visited_at,
            visit_object: '',
          }] : [],
        };
      });

      return Response.json({ success: true, data: enrichedRows });
    });
  } catch (err: any) {
    return jsonError(err?.message || '获取学员授权失败');
  }
}
