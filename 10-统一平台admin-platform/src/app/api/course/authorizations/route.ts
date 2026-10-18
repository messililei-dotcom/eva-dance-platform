import { resolveAuthorizationRate } from '@/lib/authorization-record-financials';
import { DELETED_AUTHORIZATION_FINANCIAL_MARKER } from '@/lib/server/authorization-revenue';
import { ensureAuthorizationCommissionColumns } from '@/lib/server/authorization-commission';
import { jsonError, withDb } from '../_materials';
import { authPayloadFromRequest, requirePermission } from '../../training-db';
import { ensureAuthorizationAuditColumns } from '../series/[id]/_authorization';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const permissionError = requirePermission(request, 'permOnlineAuthView');
  if (permissionError) return permissionError;

  const canManageRecords = authPayloadFromRequest(request)?.username === 'lilei';
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
      const paginated = url.searchParams.has('page');
      const page = Math.min(1000000, Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1)));
      const pageSize = Math.min(100, Math.max(1, Math.floor(Number(url.searchParams.get('pageSize')) || 20)));
      const seriesId = Number(url.searchParams.get('series_id') || 0);
      const where: string[] = [];
      const values: unknown[] = [];

      if (seriesId > 0) { where.push('series_id = ?'); values.push(seriesId); }
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

      const query = `
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
            ar.remark, ar.commission_rate, ar.actual_amount, ar.sales, CASE WHEN ar.actual_amount IS NOT NULL THEN ar.commission_amount END AS commission_amount,
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
      `;
      const total = paginated ? Number(db.prepare(`SELECT COUNT(*) AS total FROM (${query})`).get(...values)?.total || 0) : undefined;
      const rows = db.prepare(`${query} LIMIT ? OFFSET ?`).all(...values, paginated ? pageSize : 5000, paginated ? (page - 1) * pageSize : 0) as any[];
      const snapshot = canManageRecords ? db.prepare('SELECT * FROM CourseAuthorization WHERE id=?') : null;


      return Response.json({
        success: true,
        total, page: paginated ? page : undefined, pageSize: paginated ? pageSize : undefined,
        data: rows.map(row => ({
          ...row,
          auth_row_key: `${row.authorization_id}:${row.action_type}`,
          record_snapshot: snapshot ? JSON.stringify(snapshot.get(row.authorization_id)) : undefined,
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

// This endpoint intentionally requires the named account, with no localhost bypass.
async function manageRecord(request: Request, action: 'edit' | 'delete') {
  const actor = authPayloadFromRequest(request);
  if (!actor || actor.username !== 'lilei') {
    return Response.json({ success: false, error: '仅 lilei 超级管理员可编辑或删除授权记录' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const id = Number(body.authorization_id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('无效授权记录');
    return withDb(db => {
      ensureAuthorizationAuditColumns(db);
      ensureAuthorizationCommissionColumns(db);
      const user = db.prepare('SELECT id FROM User WHERE username=? AND status=?').get('lilei', 'active');
      if (!user) return Response.json({ success: false, error: '账号不可用' }, { status: 403 });
      const result = db.transaction(() => {
        db.exec(`CREATE TABLE IF NOT EXISTS CourseAuthorizationListHidden (
          authorization_id INTEGER PRIMARY KEY, reason TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
          CREATE TABLE IF NOT EXISTS CourseAuthorizationRecordAudit (
          id INTEGER PRIMARY KEY AUTOINCREMENT, authorization_id INTEGER NOT NULL,
          action TEXT NOT NULL, actor_id INTEGER NOT NULL, before_json TEXT NOT NULL,
          after_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
        const before = db.prepare('SELECT * FROM CourseAuthorization WHERE id=?').get(id);
        if (!before) throw new Error('授权记录不存在');
        if (db.prepare('SELECT 1 FROM CourseAuthorizationListHidden WHERE authorization_id=?').get(id)) throw new Error('该记录已删除，请刷新列表');
        if (body.expected !== JSON.stringify(before)) throw new Error('记录已更新，请刷新后重试');
        const sales = action === 'delete' ? String(before.sales || '').trim() : String(body.sales || '').trim();
        if (db.prepare("SELECT 1 FROM sqlite_master WHERE name='CommissionSettlement'").get()) {
          const locked = db.prepare(`SELECT 1 FROM CommissionSettlement WHERE status='settled'
            AND advisor IN (?,?) AND ((periodType='month' AND period=substr(?,1,7))
            OR (periodType='year' AND period=substr(?,1,4)))`).get(before.sales || '未填写顾问', sales || '未填写顾问', before.granted_at, before.granted_at);
          if (locked) throw new Error('该记录所属期间提成已结清，请先取消结清，再修改或删除');
        }
        if (Number(before.order_id) > 0 && db.prepare("SELECT 1 FROM CourseOrder WHERE id=? AND status IN ('paid','completed')").get(before.order_id)) {
          throw new Error('该授权关联已支付订单，请从订单退款或更正入口处理，避免营业额与订单不一致');
        }
        if (action === 'delete') {
          db.prepare('INSERT INTO CourseAuthorizationListHidden(authorization_id,reason) VALUES(?,?)').run(id, 'lilei 删除记录并扣除营业额与提成（保留课程访问及审计）');
          db.prepare('UPDATE CourseAuthorization SET actual_amount=NULL, commission_amount=0, commission_rate=0, remark=? WHERE id=?')
            .run(`${before.remark || ''}\n${DELETED_AUTHORIZATION_FINANCIAL_MARKER}`, id);
          if (db.prepare("SELECT 1 FROM sqlite_master WHERE name='FinanceIncome'").get()) {
            db.prepare('UPDATE FinanceIncome SET amount=0 WHERE incomeNo=? OR remark LIKE ? OR remark LIKE ?')
              .run(`AUTH-${id}`, `%AUTO_ONLINE_AUTH_INCOME|authorization_id=${id}`, `%AUTO_ONLINE_AUTH_INCOME|authorization_id=${id}\n%`);
          }
        } else {
          const amount = Number(body.actual_amount);
          const commission = Number(body.commission_amount);
          const remark = String(body.remark || '').trim();
          if (body.actual_amount === null || body.actual_amount === '' || !Number.isFinite(amount) || amount < 0 || amount > 999999999) throw new Error('实收金额无效');
          if (body.commission_amount === null || body.commission_amount === '' || !Number.isFinite(commission) || commission < 0 || commission > amount) throw new Error('提成金额应在0至实收金额之间');
          if (!sales || sales.length > 100 || remark.length > 2000) throw new Error('请填写课程顾问，备注不超过2000字');
          if (remark.includes(DELETED_AUTHORIZATION_FINANCIAL_MARKER)) throw new Error('备注包含系统保留标记');
          const paid = Math.round(amount * 100) / 100;
          const bonus = Math.round(commission * 100) / 100;
          const rate = resolveAuthorizationRate(paid,bonus,body);
          if (before.status === 'revoked' && (paid !== 0 || bonus !== 0 || rate !== 0)) {
            throw new Error('已取消授权的实收金额、提成金额和比例须为0；重新收费请新增授权');
          }
          db.prepare('UPDATE CourseAuthorization SET actual_amount=?, sales=?, commission_amount=?, commission_rate=?, remark=? WHERE id=?')
            .run(paid, sales, bonus, rate, remark, id);
          // Align only this authorization's generated income, including zero receipts.
          if (db.prepare("SELECT 1 FROM sqlite_master WHERE name='FinanceIncome'").get()) {
            db.prepare('UPDATE FinanceIncome SET amount=? WHERE incomeNo=? OR remark LIKE ? OR remark LIKE ?')
              .run(paid, `AUTH-${id}`, `%AUTO_ONLINE_AUTH_INCOME|authorization_id=${id}`, `%AUTO_ONLINE_AUTH_INCOME|authorization_id=${id}\n%`);
          }
        }
        const after = db.prepare('SELECT * FROM CourseAuthorization WHERE id=?').get(id);
        db.prepare('INSERT INTO CourseAuthorizationRecordAudit(authorization_id,action,actor_id,before_json,after_json) VALUES(?,?,?,?,?)')
          .run(id, action, user.id, JSON.stringify(before), JSON.stringify(action === 'delete' ? { hidden: true, authorization: after } : after));
        return { success: true };
      })();
      return Response.json(result);
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err?.message || '操作失败' }, { status: 400 });
  }
}
export function PATCH(request: Request) { return manageRecord(request, 'edit'); }
export function DELETE(request: Request) { return manageRecord(request, 'delete'); }
