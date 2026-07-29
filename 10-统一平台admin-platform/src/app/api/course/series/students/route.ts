import { openAdminDb } from '@/lib/server/admin-db';
import { requirePermission } from '../../../training-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const permissionError = requirePermission(request, 'permOnlineAuthView');
  if (permissionError) return permissionError;

  const url = new URL(request.url);
  const tab = String(url.searchParams.get('tab') || 'all');
  const keyword = String(url.searchParams.get('keyword') || '').trim();
  const values: unknown[] = [];
  const authWhere: string[] = ['ranked.row_number = 1'];
  if (tab === 'authorized') authWhere.push("ranked.status = 'active'");
  if (tab === 'unauthorized') authWhere.push("ranked.status != 'active'");
  if (keyword) {
    authWhere.push('(member.name LIKE ? OR COALESCE(member.phone, ranked.phone, \'\') LIKE ?)');
    values.push(`%${keyword}%`, `%${keyword}%`);
  }

  const db = openAdminDb({ readonly: true });
  try {
    const authorizationRows = db.prepare(`
      WITH ranked AS (
        SELECT
          authorization.*,
          ROW_NUMBER() OVER (
            PARTITION BY authorization.series_id,
              COALESCE(authorization.member_id, 0),
              COALESCE(authorization.phone, '')
            ORDER BY authorization.id DESC
          ) AS row_number,
          COUNT(*) OVER (
            PARTITION BY authorization.series_id,
              COALESCE(authorization.member_id, 0),
              COALESCE(authorization.phone, '')
          ) AS grant_count,
          SUM(CASE WHEN authorization.status = 'revoked' THEN 1 ELSE 0 END) OVER (
            PARTITION BY authorization.series_id,
              COALESCE(authorization.member_id, 0),
              COALESCE(authorization.phone, '')
          ) AS revoke_count
        FROM CourseAuthorization authorization
      )
      SELECT
        COALESCE(member.id, ranked.member_id, 0) AS id,
        COALESCE(member.id, ranked.member_id, 0) AS member_id,
        COALESCE(member.name, CASE
          WHEN COALESCE(ranked.phone, '') != '' THEN '手机号学员'
          ELSE '未关联学员' END) AS name,
        COALESCE(member.phone, ranked.phone, '') AS phone,
        COALESCE(member.level, '普通学员') AS level,
        COALESCE(member.source, '') AS member_source,
        ranked.series_id,
        series.name AS series_name,
        ranked.id AS authorization_id,
        ranked.type AS authorization_type,
        ranked.status AS authorization_status,
        ranked.granted_at,
        ranked.granted_by,
        ranked.revoked_at,
        ranked.revoked_by,
        COALESCE(NULLIF(grant_user.name, ''), NULLIF(grant_user.username, ''), '系统记录') AS granted_by_name,
        COALESCE(NULLIF(revoke_user.name, ''), NULLIF(revoke_user.username, ''), '') AS revoked_by_name,
        COALESCE(CASE WHEN ranked.status = 'revoked' THEN ranked.revoked_at END, ranked.granted_at) AS auth_action_at,
        CASE WHEN ranked.status = 'revoked'
          THEN COALESCE(NULLIF(revoke_user.name, ''), NULLIF(revoke_user.username, ''), '系统记录')
          ELSE COALESCE(NULLIF(grant_user.name, ''), NULLIF(grant_user.username, ''), '系统记录')
        END AS auth_action_by_name,
        CASE WHEN ranked.status = 'active' THEN 1 ELSE 0 END AS authorized,
        ranked.grant_count,
        ranked.revoke_count
      FROM ranked
      JOIN CourseSeries series ON series.id = ranked.series_id
      LEFT JOIN Member member
        ON member.id = ranked.member_id
        OR (
          ranked.member_id IS NULL
          AND COALESCE(ranked.phone, '') != ''
          AND member.phone = ranked.phone
        )
      LEFT JOIN User grant_user ON grant_user.id = ranked.granted_by
      LEFT JOIN User revoke_user ON revoke_user.id = ranked.revoked_by
      WHERE ${authWhere.join(' AND ')}
      ORDER BY auth_action_at DESC, ranked.id DESC
      LIMIT 5000
    `).all<any>(...values).map(row => ({
      ...row,
      grant_history: {
        grant_count: Number(row.grant_count || 0),
        revoke_count: Number(row.revoke_count || 0),
      },
      visit_records: [],
      auth_row_key: `${row.series_id}:${row.authorization_id || row.member_id || row.phone}`,
    }));

    if (tab === 'authorized') {
      return Response.json({ success: true, data: authorizationRows });
    }

    const visitValues: unknown[] = [];
    const visitWhere: string[] = [];
    if (keyword) {
      visitWhere.push('(member.name LIKE ? OR member.phone LIKE ?)');
      visitValues.push(`%${keyword}%`, `%${keyword}%`);
    }
    const visitOnlyRows = db.prepare(`
      WITH visits AS (
        SELECT series_id, member_id,
               MIN(first_visited_at) AS first_visited_at,
               MAX(last_visited_at) AS last_visited_at,
               SUM(visit_count) AS visit_count,
               MIN(source) AS visit_source
        FROM CourseSeriesVisit
        GROUP BY series_id, member_id
        UNION ALL
        SELECT course.series_id, progress.member_id,
               MIN(COALESCE(progress.created_at, progress.last_play_at)),
               MAX(COALESCE(progress.last_play_at, progress.created_at)),
               COUNT(*),
               'video'
        FROM VideoProgress progress
        JOIN CourseVideo video ON video.id = progress.video_id
        JOIN OnlineCourse course ON course.id = video.course_id
        GROUP BY course.series_id, progress.member_id
      ),
      merged_visits AS (
        SELECT series_id, member_id,
               MIN(first_visited_at) AS first_visited_at,
               MAX(last_visited_at) AS last_visited_at,
               SUM(visit_count) AS visit_count,
               MIN(visit_source) AS visit_source
        FROM visits
        GROUP BY series_id, member_id
      )
      SELECT
        member.id,
        member.id AS member_id,
        member.name,
        COALESCE(member.phone, '') AS phone,
        COALESCE(member.level, '普通学员') AS level,
        COALESCE(member.source, '') AS member_source,
        visit.series_id,
        series.name AS series_name,
        NULL AS authorization_id,
        NULL AS authorization_type,
        'visited' AS authorization_status,
        visit.first_visited_at,
        visit.first_visited_at AS visited_at,
        visit.last_visited_at,
        visit.visit_count,
        visit.visit_source,
        visit.last_visited_at AS auth_action_at,
        '' AS auth_action_by_name,
        0 AS authorized
      FROM merged_visits visit
      JOIN Member member ON member.id = visit.member_id
      JOIN CourseSeries series ON series.id = visit.series_id
      WHERE NOT EXISTS (
        SELECT 1
        FROM CourseAuthorization authorization
        WHERE authorization.series_id = visit.series_id
          AND (
            authorization.member_id = visit.member_id
            OR (
              COALESCE(authorization.phone, '') != ''
              AND COALESCE(member.phone, '') != ''
              AND authorization.phone = member.phone
            )
          )
      )
      ${visitWhere.length ? `AND ${visitWhere.join(' AND ')}` : ''}
      ORDER BY visit.last_visited_at DESC
      LIMIT 5000
    `).all<any>(...visitValues).map(row => ({
      ...row,
      grant_history: { grant_count: 0, revoke_count: 0 },
      visit_records: row.first_visited_at ? [{
        id: `summary-${row.series_id}-${row.member_id}`,
        source: row.visit_source || 'learn',
        visited_at: row.last_visited_at || row.first_visited_at,
        visit_object: '',
      }] : [],
      auth_row_key: `${row.series_id}:visit:${row.member_id}`,
    }));

    return Response.json({
      success: true,
      data: [...authorizationRows, ...visitOnlyRows]
        .sort((left, right) => String(right.auth_action_at || '').localeCompare(String(left.auth_action_at || ''))),
    });
  } finally {
    db.close();
  }
}
