import { cleanText, hasAuth, jsonError, mapGroup, nowIso, toNumber, unauthorized, withEventDb } from '../_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const url = new URL(request.url);
  const competitionId = toNumber(url.searchParams.get('competitionId') ?? url.searchParams.get('competition_id'));
  if (!competitionId) return jsonError('缺少赛事ID');

  return withEventDb((db) => {
    const rows = db.prepare(`
      SELECT
        g.*,
        sr.name AS score_rule_name,
        COUNT(DISTINCT p.id) AS player_count,
        COUNT(DISTINCT gj.judge_id) AS judge_count
      FROM event_groups g
      LEFT JOIN event_score_rules sr ON sr.id = g.score_rule_id
      LEFT JOIN event_players p ON p.group_id = g.id
      LEFT JOIN event_group_judges gj ON gj.group_id = g.id
      WHERE g.competition_id = ?
      GROUP BY g.id
      ORDER BY g.sort_order ASC, g.id ASC
    `).all(competitionId);

    return Response.json({ success: true, data: rows.map(mapGroup) });
  });
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const competitionId = toNumber(body.competitionId ?? body.competition_id);
  const name = cleanText(body.name);
  if (!competitionId) return jsonError('缺少赛事ID');
  if (!name) return jsonError('组别名称不能为空');

  return withEventDb((db) => {
    const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS value FROM event_groups WHERE competition_id = ?').get(competitionId)?.value || 0;
    const result = db.prepare(`
      INSERT INTO event_groups (
        competition_id, name, code, category, age_range, dance_type, entry_type,
        sort_order, max_players, registration_fee, score_rule_id, scoring_status, status, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      competitionId,
      name,
      cleanText(body.code),
      cleanText(body.category),
      cleanText(body.ageRange ?? body.age_range),
      cleanText(body.danceType ?? body.dance_type),
      cleanText(body.entryType ?? body.entry_type, 'solo'),
      toNumber(body.sortOrder ?? body.sort_order, maxSort + 1),
      toNumber(body.maxPlayers ?? body.max_players),
      toNumber(body.registrationFee ?? body.registration_fee),
      toNumber(body.scoreRuleId ?? body.score_rule_id) || null,
      cleanText(body.scoringStatus ?? body.scoring_status, 'unlocked'),
      cleanText(body.status, 'active'),
      nowIso(),
    );

    return Response.json({ success: true, data: { id: result.lastInsertRowid } });
  });
}
