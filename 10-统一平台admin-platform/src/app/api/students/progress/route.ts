import { hasAuth, jsonError, openTrainingDb, unauthorized } from '../../training-db';

export const dynamic = 'force-dynamic';

function tableExists(db: any, tableName: string) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName));
}

function hasColumn(db: any, tableName: string, columnName: string) {
  if (!tableExists(db, tableName)) return false;
  return db.prepare(`PRAGMA table_info('${String(tableName).replace(/'/g, "''")}')`).all().some((row: any) => row.name === columnName);
}

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const db = openTrainingDb();
  try {
    const hasVideoProgress = tableExists(db, 'VideoProgress');
    const memberOpenidSelect = hasColumn(db, 'Member', 'wx_openid') ? "COALESCE(m.wx_openid, '')" : "''";
    const memberUnionidSelect = hasColumn(db, 'Member', 'wx_unionid') ? "COALESCE(m.wx_unionid, '')" : "''";
    const videoProgressJoin = hasVideoProgress
      ? `LEFT JOIN (
           SELECT member_id, COUNT(DISTINCT video_id) AS completedVideos
           FROM VideoProgress
           WHERE completed = 1
           GROUP BY member_id
         ) vp ON vp.member_id = m.id`
      : 'LEFT JOIN (SELECT NULL AS member_id, 0 AS completedVideos WHERE 0) vp ON vp.member_id = m.id';

    const rows = db.prepare(`
      SELECT
        m.id,
        m.id AS member_id,
        m.name,
        COALESCE(m.phone, '') AS phone,
        ${memberOpenidSelect} AS wx_openid,
        ${memberUnionidSelect} AS wx_unionid,
        COALESCE(m.level, '普通学员') AS level,
        COALESCE(m.status, 'active') AS status,
        COALESCE(SUM(p.remainingSessions), 0) AS remaining_hours,
        COALESCE(NULLIF(m.register_date, ''), substr(m.created_at, 1, 10), '') AS register_date,
        0 AS growth,
        COUNT(DISTINCT p.id) AS totalPayments,
        COALESCE(SUM(p.amount), 0) AS totalAmount,
        COALESCE(MAX(vp.completedVideos), 0) AS completedVideos
      FROM Member m
      LEFT JOIN Payment p ON p.memberId = m.id
      ${videoProgressJoin}
      WHERE COALESCE(m.status, 'active') != 'deleted'
      GROUP BY m.id
      HAVING totalPayments > 0 OR completedVideos > 0
      ORDER BY datetime(m.created_at) DESC, m.id DESC
    `).all();

    return Response.json(rows);
  } catch (err: any) {
    return jsonError(err?.message || '学习进度加载失败');
  } finally {
    db.close();
  }
}
