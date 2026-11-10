import { duplicateJudge } from '@/lib/server/event-judge-duplicates';
import { cleanText, readEventBody, hasAuth, jsonError, mapJudge, nowIso, toNumber, unauthorized, withRequestEventDb } from '../../_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();

  return withRequestEventDb(request, (db) => {
    const row = db.prepare(`
      SELECT
        j.*,
        COUNT(DISTINCT gj.group_id) AS assigned_group_count,
        COUNT(DISTINCT s.id) AS score_count
      FROM event_judges j
      LEFT JOIN event_group_judges gj ON gj.judge_id = j.id
      LEFT JOIN event_scores s ON s.judge_id = j.id
      WHERE j.id = ?
      GROUP BY j.id
    `).get(routeParams.id);
    if (!row) return jsonError('评委不存在', 404);

    const assignments = db.prepare(`
      SELECT gj.*, c.name AS competition_name, g.name AS group_name
      FROM event_group_judges gj
      LEFT JOIN event_competitions c ON c.id = gj.competition_id
      LEFT JOIN event_groups g ON g.id = gj.group_id
      WHERE gj.judge_id = ?
      ORDER BY datetime(gj.created_at) DESC, gj.id DESC
    `).all(routeParams.id);

    return Response.json({ success: true, data: { ...mapJudge(row), assignments } });
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();

  const body = await readEventBody(request);
  const name = cleanText(body.name);
  if (!name) return jsonError('评委姓名不能为空');

  return withRequestEventDb(request, (db) => db.transaction(() => {
    if (duplicateJudge(db, body, Number(routeParams.id))) return jsonError('该手机号或学员已有其他评委资料，请核对后修改', 409);
    db.prepare(`
      UPDATE event_judges
      SET name = ?, phone = ?, title = ?, organization = ?, bio = ?,
          account_user_id = ?, status = ?, auth_enabled = ?, updated_at = ?
      WHERE id = ?
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
      routeParams.id,
    );
    return Response.json({ success: true });
  }).immediate());
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();

  const body = await readEventBody(request);
  const action = cleanText(body.action);
  if (!['enableAuth', 'disableAuth'].includes(action)) return jsonError('不支持的评委操作');

  return withRequestEventDb(request, (db) => {
    db.prepare('UPDATE event_judges SET auth_enabled = ?, updated_at = ? WHERE id = ?')
      .run(action === 'enableAuth' ? 1 : 0, nowIso(), routeParams.id);
    return Response.json({ success: true });
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasAuth(request)) return unauthorized();
  const { id } = await params;
  return withRequestEventDb(request, db => db.transaction(() => {
    const judge = db.prepare('SELECT * FROM event_judges WHERE id=?').get(id);
    if (!judge) return jsonError('评委不存在或无权操作', 404);
    if (db.eventOwnerId) {
      const outside = db.prepare('SELECT id FROM main.event_group_judges WHERE judge_id=? AND competition_id NOT IN (SELECT id FROM event_owned_competitions) LIMIT 1').get(id);
      if (outside) return jsonError('该评委同时分配给其他赛事，请移除本组分配或联系平台管理员处理', 409);
    }
    const now = nowIso();
    db.prepare("UPDATE event_group_judges SET status='inactive',auth_enabled=0,updated_at=? WHERE judge_id=?").run(now, id);
    db.prepare("UPDATE event_judges SET status='deleted',auth_enabled=0,updated_at=? WHERE id=?").run(now, id);
    return Response.json({ success: true, message: '评委已删除，历史评分保留' });
  }).immediate());
}
