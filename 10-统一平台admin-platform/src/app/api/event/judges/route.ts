import { cleanText, hasAuth, jsonError, mapJudge, nowIso, toNumber, unauthorized, withEventDb } from '../_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const url = new URL(request.url);
  const keyword = cleanText(url.searchParams.get('keyword'));
  return withEventDb((db) => {
    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (keyword) {
      where += ' AND (j.name LIKE ? OR j.phone LIKE ? OR j.organization LIKE ? OR j.title LIKE ?)';
      const like = `%${keyword}%`;
      params.push(like, like, like, like);
    }
    const rows = db.prepare(`
      SELECT
        j.*,
        COUNT(DISTINCT gj.group_id) AS assigned_group_count,
        COUNT(DISTINCT s.id) AS score_count
      FROM event_judges j
      LEFT JOIN event_group_judges gj ON gj.judge_id = j.id
      LEFT JOIN event_scores s ON s.judge_id = j.id
      ${where}
      GROUP BY j.id
      ORDER BY datetime(j.created_at) DESC, j.id DESC
    `).all(...params);
    return Response.json({ success: true, data: rows.map(mapJudge) });
  });
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const name = cleanText(body.name);
  if (!name) return jsonError('评委姓名不能为空');

  return withEventDb((db) => {
    const result = db.prepare(`
      INSERT INTO event_judges (
        name, phone, title, organization, bio, account_user_id,
        status, auth_enabled, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      cleanText(body.phone),
      cleanText(body.title),
      cleanText(body.organization),
      cleanText(body.bio),
      toNumber(body.accountUserId ?? body.account_user_id),
      cleanText(body.status, 'active'),
      body.authEnabled ?? body.auth_enabled ? 1 : 0,
      nowIso(),
    );
    return Response.json({ success: true, data: { id: result.lastInsertRowid } });
  });
}
