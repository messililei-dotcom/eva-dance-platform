import { DEFAULT_SCORE_CRITERIA } from '@/lib/event-score-rules';
import { cleanText, readEventBody, hasAuth, jsonError, mapScoreRule, nowIso, toNumber, unauthorized, withRequestEventDb } from '../_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const url = new URL(request.url);
  const competitionId = toNumber(url.searchParams.get('competitionId') ?? url.searchParams.get('competition_id'));
  return withRequestEventDb(request, (db) => {
    const rows = competitionId
      ? db.prepare("SELECT * FROM event_score_rules WHERE competition_id = ? AND status != 'archived' ORDER BY id ASC").all(competitionId)
      : db.prepare("SELECT * FROM event_score_rules WHERE competition_id IS NULL AND status != 'archived' ORDER BY id ASC").all();
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
  const requestedTotal = body.totalScore ?? body.total_score;
  if (requestedTotal != null && Number(requestedTotal) !== 10) return jsonError('赛事总分固定为10分，不可修改');

  let criteria: string | undefined;
  const rawCriteria = body.criteria ?? body.criteriaJson ?? body.criteria_json;
  if (rawCriteria !== undefined) {
    try {
      const items = typeof rawCriteria === 'string' ? JSON.parse(rawCriteria) : rawCriteria;
      if (!Array.isArray(items)) return jsonError('评分分项格式无效');
      const keys = new Set<string>();
      let maximumInCents = 0;
      for (const [index, item] of items.entries()) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return jsonError('评分分项格式无效');
        const key = String(item.id ?? item.key ?? `rule-${index}`);
        const raw = item.maxScore ?? item.score;
        const value = Number(raw);
        const cents = Math.round(value * 100);
        if (!key.trim() || keys.has(key) || ['__proto__', 'constructor', 'prototype'].includes(key)) return jsonError('评分分项标识无效或重复');
        if (!cleanText(item.name)) return jsonError('评分项目名称不能为空');
        if ((typeof raw !== 'number' && typeof raw !== 'string') || !Number.isFinite(value) || cents < 1 || cents > 1000 || Math.abs(value * 100 - cents) > 1e-7) return jsonError('分项满分必须在0.01至10分之间，最多两位小数');
        keys.add(key);
        maximumInCents += cents;
      }
      // Older clients can explicitly configure a single total-score field.
      if (items.length && maximumInCents !== 1000) return jsonError('评分分项满分合计必须为10分');
      criteria = JSON.stringify(items);
    } catch {
      return jsonError('评分分项格式无效');
    }
  }

  return withRequestEventDb(request, (db) => {
    const save = db.transaction(() => {
      const existing = db.prepare("SELECT * FROM event_score_rules WHERE competition_id = ? AND status != 'archived' ORDER BY id ASC").all(competitionId);
      const current = existing[0];
      const now = nowIso();
      const nextCriteria = criteria ?? current?.criteria_json ?? JSON.stringify(DEFAULT_SCORE_CRITERIA);
      const settings = [
        name, 10, nextCriteria,
        (body.dropHighLow ?? body.drop_high_low ?? current?.drop_high_low) ? 1 : 0,
        (body.judgeAnonymous ?? body.judge_anonymous ?? current?.judge_anonymous) ? 1 : 0,
        toNumber(body.abnormalThreshold ?? body.abnormal_threshold, current?.abnormal_threshold ?? 15),
        toNumber(body.decimalPlaces ?? body.decimal_places, current?.decimal_places ?? 2),
        cleanText(body.publishMode ?? body.publish_mode, current?.publish_mode ?? 'review_then_publish'),
        'active', now,
      ];
      let ruleId = Number(current?.id || 0);
      const revision = current && (current.criteria_json !== nextCriteria || Number(current.drop_high_low) !== settings[3] ||
        Number(current.judge_anonymous) !== settings[4] || current.abnormal_threshold !== settings[5] ||
        current.decimal_places !== settings[6] || current.publish_mode !== settings[7]);
      const hasScoreHistory = revision && db.prepare(
        "SELECT 1 FROM event_scores WHERE competition_id = ? LIMIT 1",
      ).get(competitionId);
      const retired = existing.slice(hasScoreHistory ? 0 : 1);
      if (retired.length) {
        const ids = retired.map((item: { id: number }) => item.id);
        db.prepare(`UPDATE event_score_rules SET status = 'archived' WHERE competition_id = ? AND id IN (${ids.map(() => '?').join(', ')})`).run(competitionId, ...ids);
      }
      if (ruleId && !hasScoreHistory) {
        db.prepare(`
          UPDATE event_score_rules SET name = ?, total_score = ?, criteria_json = ?, drop_high_low = ?,
            judge_anonymous = ?, abnormal_threshold = ?, decimal_places = ?, publish_mode = ?, status = ?, updated_at = ?
          WHERE id = ? AND competition_id = ?
        `).run(...settings, ruleId, competitionId);
      } else {
        const result = db.prepare(`
          INSERT INTO event_score_rules (competition_id, name, total_score, criteria_json, drop_high_low,
            judge_anonymous, abnormal_threshold, decimal_places, publish_mode, status, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(competitionId, ...settings);
        ruleId = Number(result.lastInsertRowid);
      }
      db.prepare(`
        UPDATE event_groups SET score_rule_id = ?, updated_at = ?
        WHERE competition_id = ? AND NOT (
          COALESCE(scoring_status, '') = 'locked' AND score_rule_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM event_scores s WHERE s.group_id = event_groups.id AND s.score_status != 'voided'
          )
        )
      `).run(ruleId, now, competitionId);
      return { id: ruleId, consolidated: Math.max(0, existing.length - 1) };
    });
    return Response.json({ success: true, data: save() });
  });
}
