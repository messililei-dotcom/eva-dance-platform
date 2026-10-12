import { cleanText, readEventBody, hasAuth, jsonError, nowIso, toNumber, unauthorized, withRequestEventDb } from '../../_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();

  const body = await readEventBody(request);
  const name = cleanText(body.name);
  if (!name) return jsonError('组别名称不能为空');

  return withRequestEventDb(request, (db) => {
    const existing = db.prepare('SELECT id,competition_id,name FROM event_groups WHERE id = ?').get(routeParams.id);
    if (!existing) return jsonError('组别不存在', 404);

    if (name !== String(existing.name).trim() && db.prepare('SELECT id FROM event_groups WHERE competition_id=? AND trim(name)=? AND id!=?').get(existing.competition_id, name, existing.id)) return jsonError('当前赛事已存在同名组别，请使用不同的组别名称');
    db.prepare(`
      UPDATE event_groups
      SET name = ?, code = ?, age_range = ?, dance_type = ?,
          entry_type = ?, sort_order = ?, max_players = ?, registration_fee = ?, score_rule_id = ?,
          scoring_status = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(
      name,
      cleanText(body.code),
      cleanText(body.ageRange ?? body.age_range),
      cleanText(body.danceType ?? body.dance_type),
      cleanText(body.entryType ?? body.entry_type, 'solo'),
      toNumber(body.sortOrder ?? body.sort_order),
      toNumber(body.maxPlayers ?? body.max_players),
      toNumber(body.registrationFee ?? body.registration_fee),
      toNumber(body.scoreRuleId ?? body.score_rule_id) || null,
      cleanText(body.scoringStatus ?? body.scoring_status, 'unlocked'),
      cleanText(body.status, 'active'),
      nowIso(),
      routeParams.id,
    );

    return Response.json({ success: true });
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();

  const body = await readEventBody(request);
  const action = cleanText(body.action);
  if (!['lockScoring', 'unlockScoring'].includes(action)) return jsonError('不支持的组别操作');

  return withRequestEventDb(request, (db) => {
    db.prepare('UPDATE event_groups SET scoring_status = ?, updated_at = ? WHERE id = ?')
      .run(action === 'lockScoring' ? 'locked' : 'unlocked', nowIso(), routeParams.id);
    return Response.json({ success: true });
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();

  return withRequestEventDb(request, (db) => {
    const group = db.prepare('SELECT id, name FROM event_groups WHERE id = ?').get(routeParams.id) as { id: number; name: string } | undefined;
    if (!group) return jsonError('组别不存在', 404);

    const usage = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM event_players WHERE group_id = ?) AS player_count,
        (SELECT COUNT(*) FROM event_scores WHERE group_id = ?) AS score_count,
        (SELECT COUNT(*) FROM event_rankings WHERE group_id = ?) AS ranking_count
    `).get(routeParams.id, routeParams.id, routeParams.id) as { player_count: number; score_count: number; ranking_count: number };

    if (Number(usage.player_count) || Number(usage.score_count) || Number(usage.ranking_count)) {
      return jsonError('该组别已有选手、评分或成绩，不能删除；请先处理关联数据');
    }

    const judgeCount = Number(db.prepare('SELECT COUNT(*) AS count FROM event_group_judges WHERE group_id = ?').get(routeParams.id)?.count || 0);
    db.prepare('DELETE FROM event_groups WHERE id = ?').run(routeParams.id);
    return Response.json({ success: true, data: { id: group.id, name: group.name, removedJudgeAssignments: judgeCount } });
  });
}
