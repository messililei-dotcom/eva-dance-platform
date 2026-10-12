import { cleanText, readEventBody, hasAuth, jsonError, mapScoreRule, nowIso, toNumber, unauthorized, withRequestEventDb } from '../_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const url = new URL(request.url);
  const competitionId = toNumber(url.searchParams.get('competitionId') ?? url.searchParams.get('competition_id'));
  return withRequestEventDb(request, (db) => {
    const rows = competitionId
      ? db.prepare('SELECT * FROM event_score_rules WHERE competition_id = ? ORDER BY id ASC').all(competitionId)
      : db.prepare('SELECT * FROM event_score_rules WHERE competition_id IS NULL ORDER BY id ASC').all();
    return Response.json({ success: true, data: rows.map(mapScoreRule) });
  });
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const body = await readEventBody(request);
  const competitionId = toNumber(body.competitionId ?? body.competition_id);
  const name = cleanText(body.name);
  if (!competitionId) return jsonError('缺少赛事ID');
  if (!name) return jsonError('评分规则名称不能为空');

  return withRequestEventDb(request, (db) => {
    const criteria = Array.isArray(body.criteria) ? JSON.stringify(body.criteria) : cleanText(body.criteriaJson ?? body.criteria_json, '[]');
    const existing = db.prepare('SELECT id FROM event_score_rules WHERE competition_id = ? ORDER BY id ASC').all(competitionId);
    const now = nowIso();
    const save = db.transaction(() => {
      let ruleId = Number(existing[0]?.id || 0);
      if (ruleId) {
        db.prepare(`
          UPDATE event_score_rules
          SET name = ?, total_score = ?, criteria_json = ?, drop_high_low = ?,
              judge_anonymous = ?, abnormal_threshold = ?, decimal_places = ?, publish_mode = ?, status = ?, updated_at = ?
          WHERE id = ?
        `).run(
          name,
          toNumber(body.totalScore ?? body.total_score, 10),
          criteria,
          body.dropHighLow ?? body.drop_high_low ? 1 : 0,
          body.judgeAnonymous ?? body.judge_anonymous ? 1 : 0,
          toNumber(body.abnormalThreshold ?? body.abnormal_threshold, 15),
          toNumber(body.decimalPlaces ?? body.decimal_places, 2),
          cleanText(body.publishMode ?? body.publish_mode, 'review_then_publish'),
          cleanText(body.status, 'active'),
          now,
          ruleId,
        );
      } else {
        const result = db.prepare(`
          INSERT INTO event_score_rules (
            competition_id, name, total_score, criteria_json, drop_high_low,
            judge_anonymous, abnormal_threshold, decimal_places, publish_mode, status, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          competitionId,
          name,
          toNumber(body.totalScore ?? body.total_score, 10),
          criteria,
          body.dropHighLow ?? body.drop_high_low ? 1 : 0,
          body.judgeAnonymous ?? body.judge_anonymous ? 1 : 0,
          toNumber(body.abnormalThreshold ?? body.abnormal_threshold, 15),
          toNumber(body.decimalPlaces ?? body.decimal_places, 2),
          cleanText(body.publishMode ?? body.publish_mode, 'review_then_publish'),
          cleanText(body.status, 'active'),
          now,
        );
        ruleId = Number(result.lastInsertRowid);
      }

      const duplicateIds = existing.slice(1).map((item: any) => Number(item.id));
      db.prepare('UPDATE event_groups SET score_rule_id = ?, updated_at = ? WHERE competition_id = ?')
        .run(ruleId, now, competitionId);
      if (duplicateIds.length) {
        const placeholders = duplicateIds.map(() => '?').join(', ');
        db.prepare(`UPDATE event_scores SET rule_id = ? WHERE competition_id = ? AND rule_id IN (${placeholders})`)
          .run(ruleId, competitionId, ...duplicateIds);
        db.prepare(`DELETE FROM event_score_rules WHERE competition_id = ? AND id IN (${placeholders})`)
          .run(competitionId, ...duplicateIds);
      }
      return { id: ruleId, consolidated: duplicateIds.length };
    });
    return Response.json({ success: true, data: save() });
  });
}
