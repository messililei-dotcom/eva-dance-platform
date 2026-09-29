import { ensureAuthorizationCommissionColumns } from '@/lib/server/authorization-commission';
import { jsonError, withDb } from '../_materials';
import { requirePermission } from '../../training-db';
import { ensureAuthorizationAuditColumns } from '../series/[id]/_authorization';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const permissionError = requirePermission(request, 'permOnlineAuthView');
  if (permissionError) return permissionError;

  try {
    return withDb((db) => {
      ensureAuthorizationAuditColumns(db);
      ensureAuthorizationCommissionColumns(db);
      // Hiding a list entry must not revoke the underlying course access.
      db.exec(`CREATE TABLE IF NOT EXISTS CourseAuthorizationListHidden (
        authorization_id INTEGER PRIMARY KEY,
        reason TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);

      const url = new URL(request.url);
      const tab = String(url.searchParams.get('tab') || 'all');
      const keyword = String(url.searchParams.get('keyword') || '').trim();
      const where: string[] = [];
      const values: unknown[] = [];

      if (tab === 'authorized') where.push("action_type = 'grant'");
      if (tab === 'unauthorized') where.push("action_type = 'revoke'");
      if (keyword) {
        where.push(`(
          CAST(member_id AS TEXT) LIKE ? OR name LIKE ? OR phone LIKE ?
          OR wx_openid LIKE ? OR wx_unionid LIKE ? OR series_name LIKE ?
        )`);
        const like = `%${keyword}%`;
        values.push(like, like, like, like, like, like);
      }

      const rows = db.prepare(`
        WITH auth_resolved AS (
          SELECT ca.*,
                 COALESCE(
                   NULLIF(ca.member_id, 0),
                   (SELECT m0.id
                    FROM Member m0
                    WHERE (COALESCE(ca.phone, '') <> '' AND ca.phone = COALESCE(m0.phone, ''))
                       OR (COALESCE(ca.wx_openid, '') <> '' AND ca.wx_openid = COALESCE(m0.wx_openid, ''))
                       OR (COALESCE(ca.wx_unionid, '') <> '' AND ca.wx_unionid = COALESCE(m0.wx_unionid, ''))
                    ORDER BY m0.id DESC LIMIT 1)
                 ) AS resolved_member_id
          FROM CourseAuthorization ca
          WHERE NOT EXISTS (
            SELECT 1 FROM CourseAuthorizationListHidden hidden
            WHERE hidden.authorization_id = ca.id
          )
        ),
        auth_events AS (
          SELECT ar.*, 'grant' AS action_type, ar.granted_at AS action_at FROM auth_resolved ar
          UNION ALL
          SELECT ar.*, 'revoke' AS action_type, ar.revoked_at AS action_at FROM auth_resolved ar
          WHERE ar.revoked_at IS NOT NULL AND trim(ar.revoked_at) <> ''
        ),
        auth_history AS (
          SELECT series_id, resolved_member_id,
                 COUNT(*) AS grant_count,
                 SUM(CASE WHEN status = 'revoked' THEN 1 ELSE 0 END) AS revoke_count
          FROM auth_resolved
          WHERE resolved_member_id IS NOT NULL
          GROUP BY series_id, resolved_member_id
        ),
        combined AS (
          SELECT
            m.id, m.id AS member_id, m.name, m.phone, m.level,
            COALESCE(NULLIF(m.wx_openid, ''), NULLIF(ar.wx_openid, ''), '') AS wx_openid,
            COALESCE(NULLIF(m.wx_unionid, ''), NULLIF(ar.wx_unionid, ''), '') AS wx_unionid,
            m.source AS member_source,
            cs.id AS series_id, cs.name AS series_name,
            ar.id AS authorization_id, ar.type AS authorization_type, ar.action_type,
            CASE WHEN ar.action_type='grant' THEN '授权' WHEN ar.remark LIKE '%系统自动撤销重复有效授权%' THEN '系统自动取消授权' ELSE '取消授权' END AS action_label,
            ar.status AS authorization_status, ar.granted_at, ar.granted_by,
            ar.revoked_at, ar.revoked_by,
            ar.actual_amount, ar.sales, CASE WHEN ar.actual_amount IS NOT NULL THEN ar.commission_amount END AS commission_amount,
            COALESCE(ar.order_vouchers, '[]') AS order_vouchers,
            COALESCE(NULLIF(u.name, ''), NULLIF(u.username, ''), '系统记录') AS granted_by_name,
            COALESCE(NULLIF(ru.name, ''), NULLIF(ru.username, ''), '') AS revoked_by_name,
            ar.action_at AS auth_action_at,
            CASE WHEN ar.action_type='revoke' AND ar.remark LIKE '%系统自动撤销重复有效授权%' THEN '系统自动'
              WHEN ar.action_type='revoke' THEN COALESCE(NULLIF(ru.name,''), NULLIF(ru.username,''), '未记录')
              ELSE COALESCE(NULLIF(u.name,''), NULLIF(u.username,''), '系统记录') END AS auth_action_by_name,
            CASE WHEN ar.action_type='grant' THEN 1 ELSE 0 END AS authorized,
            COALESCE(h.grant_count, 0) AS grant_count,
            COALESCE(h.revoke_count, 0) AS revoke_count
          FROM auth_events ar
          JOIN CourseSeries cs ON cs.id = ar.series_id
          LEFT JOIN Member m ON m.id = ar.resolved_member_id
          LEFT JOIN auth_history h ON h.series_id = ar.series_id AND h.resolved_member_id = ar.resolved_member_id
          LEFT JOIN User u ON u.id = ar.granted_by
          LEFT JOIN User ru ON ru.id = ar.revoked_by



        )
        SELECT * FROM combined
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY auth_action_at DESC, authorization_id DESC, series_id DESC, member_id DESC
        LIMIT 5000
      `).all(...values) as any[];

      return Response.json({
        success: true,
        data: rows.map(row => ({
          ...row,
          auth_row_key: `${row.authorization_id}:${row.action_type}`,
          grant_history: {
            grant_count: Number(row.grant_count || 0),
            revoke_count: Number(row.revoke_count || 0),
          },
        })),
      });
    });
  } catch (err: any) {
    return jsonError(err?.message || '获取学员授权失败');
  }
}
