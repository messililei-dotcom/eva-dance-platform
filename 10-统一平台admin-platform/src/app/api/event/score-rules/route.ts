import { cleanText, hasAuth, jsonError, mapScoreRule, nowIso, toNumber, unauthorized, withEventDb } from '../_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const url = new URL(request.url);
  const competitionId = toNumber(url.searchParams.get('competitionId') ?? url.searchParams.get('competition_id'));
  return withEventDb((db) => {
    const rows = db.prepare(`
      SELECT *
      FROM event_score_rules
      WHERE (? = 0 OR competition_id = ? OR competition_id IS NULL)
      ORDER BY competition_id DESC, id DESC
    `).all(competitionId, competitionId);
    return Response.json({ success: true, data: rows.map(mapScoreRule) });
  });
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const name = cleanText(body.name);
  if (!name) return jsonError('评分规则名称不能为空');

  return withEventDb((db) => {
    const criteria = Array.isArray(body.criteria) ? JSON.stringify(body.criteria) : cleanText(body.criteriaJson ?? body.criteria_json, '[]');
    const result = db.prepare(`
      INSERT INTO event_score_rules (
        competition_id, name, total_score, criteria_json, drop_high_low,
        abnormal_threshold, decimal_places, publish_mode, status, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      toNumber(body.competitionId ?? body.competition_id) || null,
      name,
      toNumber(body.totalScore ?? body.total_score, 100),
      criteria,
      body.dropHighLow ?? body.drop_high_low ? 1 : 0,
      toNumber(body.abnormalThreshold ?? body.abnormal_threshold, 15),
      toNumber(body.decimalPlaces ?? body.decimal_places, 2),
      cleanText(body.publishMode ?? body.publish_mode, 'review_then_publish'),
      cleanText(body.status, 'active'),
      nowIso(),
    );
    return Response.json({ success: true, data: { id: result.lastInsertRowid } });
  });
}
