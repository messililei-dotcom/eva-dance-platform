// Shared verbatim by admin-platform and website. Do not change one copy alone.
function nowIso() { return new Date().toISOString(); }
function safeJsonParse<T>(value: unknown, fallback: T): T { try { return JSON.parse(String(value || '')) as T; } catch { return fallback; } }
export function getRuleForGroup(db: any, groupId: number, ruleId?: number | null) {
  const group = db.prepare('SELECT * FROM event_groups WHERE id = ?').get(groupId);
  const explicitRuleId = Number(ruleId || group?.score_rule_id || 0);
  let row = explicitRuleId ? db.prepare('SELECT * FROM event_score_rules WHERE id = ?').get(explicitRuleId) : null;
  if (!row && group?.competition_id) {
    const competitionRules = db.prepare('SELECT * FROM event_score_rules WHERE competition_id = ? ORDER BY id ASC').all(group.competition_id);
    if (competitionRules.length === 1) row = competitionRules[0];
    else if (competitionRules.length > 1) {
      row = {
        ...competitionRules[0],
        total_score: competitionRules.reduce((sum: number, item: any) => sum + Number(item.total_score || 0), 0),
        criteria_json: JSON.stringify(competitionRules.flatMap((item: any) => safeJsonParse(item.criteria_json, []))),
        drop_high_low: competitionRules.some((item: any) => Boolean(item.drop_high_low)) ? 1 : 0,
      };
    }
  }
  return row || {
    id: null,
    total_score: 100,
    criteria_json: '[]',
    drop_high_low: 0,
    abnormal_threshold: 15,
    decimal_places: 2,
  };
}

function summarizeJudgeScoreRows(rows: any[]) {
  const grouped = new Map<number, any[]>();
  rows.forEach((row) => {
    const judgeId = Number(row.judge_id);
    grouped.set(judgeId, [...(grouped.get(judgeId) || []), row]);
  });
  return [...grouped.entries()].map(([judgeId, entries]) => {
    const modern = entries
      .filter((row) => !safeJsonParse<Record<string, unknown>>(row.criteria_scores_json, {}).legacy_user_id)
      .sort((a, b) => Number(b.version || 0) - Number(a.version || 0));
    if (modern.length) {
      return {
        judge_id: judgeId,
        calculated_score: Number(modern[0].calculated_score || 0),
        weight: Number(modern[0].weight || 1),
      };
    }

    const latestByCriterion = new Map<string, { score: number; version: number }>();
    entries.forEach((row) => {
      const criteria = safeJsonParse<Record<string, unknown>>(row.criteria_scores_json, {});
      Object.entries(criteria).forEach(([criterion, value]) => {
        if (criterion === 'legacy_user_id') return;
        const score = Number(value);
        const version = Number(row.version || 0);
        if (!Number.isFinite(score)) return;
        const current = latestByCriterion.get(criterion);
        if (!current || version > current.version) latestByCriterion.set(criterion, { score, version });
      });
    });
    const latest = [...entries].sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0];
    return {
      judge_id: judgeId,
      calculated_score: [...latestByCriterion.values()].reduce((sum, item) => sum + item.score, 0),
      weight: Number(latest?.weight || 1),
    };
  });
}

export function recalculateGroupRankings(db: any, groupId: number) {
  const group = db.prepare('SELECT * FROM event_groups WHERE id = ?').get(groupId);
  if (!group) throw new Error('组别不存在');
  // Preserve historical/manual totals while removing ineligible players from
  // live rankings and publication. Reinstatement is handled by the upsert below.
  db.prepare(`UPDATE event_rankings SET rank_no=0, status=COALESCE(
    (SELECT CASE WHEN p.group_id!=event_rankings.group_id THEN 'inactive' WHEN p.audit_status='rejected' THEN 'rejected' WHEN p.status IN ('withdrawn','cancelled') THEN p.status ELSE 'inactive' END
     FROM event_players p WHERE p.id=event_rankings.player_id), 'inactive'),
    published_total=NULL, published_at='', updated_at=?
    WHERE group_id=? AND NOT EXISTS (
      SELECT 1 FROM event_players p WHERE p.id=event_rankings.player_id
        AND p.group_id=? AND p.audit_status!='rejected'
        AND p.status NOT IN ('withdrawn','cancelled'))`).run(nowIso(), groupId, groupId);
  const rule = getRuleForGroup(db, groupId, group.score_rule_id);
  const players = db.prepare(`
    SELECT p.*, COUNT(DISTINCT gj.judge_id) AS judge_count
    FROM event_players p
    LEFT JOIN event_group_judges gj ON gj.group_id = p.group_id AND gj.status = 'active'
    WHERE p.group_id = ? AND p.audit_status != 'rejected' AND p.status NOT IN ('withdrawn','cancelled')
    GROUP BY p.id
    ORDER BY p.player_no ASC, p.id ASC
  `).all(groupId);
  const now = nowIso();
  const rows = players.map((player: any) => {
    const scoreRows = db.prepare(`
      SELECT s.judge_id, s.calculated_score, s.criteria_scores_json, s.version, COALESCE(gj.weight, 1) AS weight
      FROM event_scores s
      LEFT JOIN event_group_judges gj ON gj.group_id = s.group_id AND gj.judge_id = s.judge_id
      WHERE s.group_id = ?
        AND s.player_id = ?
        AND s.score_status IN ('submitted', 'reviewed', 'published')
      ORDER BY s.judge_id ASC, s.version DESC
    `).all(groupId, player.id);
    const scores = summarizeJudgeScoreRows(scoreRows).sort((a, b) => a.calculated_score - b.calculated_score);
    const drop = Boolean(rule.drop_high_low) && scores.length >= 6;
    const usedScores = drop ? scores.slice(1, -1) : scores;
    const weightSum = usedScores.reduce((sum: number, row: any) => sum + Number(row.weight || 1), 0);
    const scoreSum = usedScores.reduce((sum: number, row: any) => sum + Number(row.calculated_score || 0) * Number(row.weight || 1), 0);
    const total = weightSum ? scoreSum / weightSum : 0;
    return { player, total: Number(total.toFixed(Math.max(0, Math.min(4, Number(rule.decimal_places ?? 2))))), scoreCount: scores.length };
  }).sort((a: any, b: any) => b.total - a.total || String(a.player.player_no || '').localeCompare(String(b.player.player_no || '')));

  rows.forEach((row: any, index: number) => {
    db.prepare(`
      INSERT INTO event_rankings (
        competition_id, group_id, player_id, raw_total, calculated_total,
        published_total, rank_no, status, recalculated_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, NULL, ?, 'draft', ?, ?)
      ON CONFLICT(group_id, player_id) DO UPDATE SET
        raw_total = excluded.raw_total,
        calculated_total = COALESCE(event_rankings.manual_total, excluded.calculated_total),
        rank_no = excluded.rank_no,
        status = CASE WHEN event_rankings.status IN ('published','withdrawn','cancelled','rejected','inactive') THEN 'draft' ELSE event_rankings.status END,
        published_total = NULL, published_at = '',
        recalculated_at = excluded.recalculated_at,
        updated_at = excluded.updated_at
    `).run(group.competition_id, groupId, row.player.id, row.total, row.total, index + 1, now, now);
  });

  rerankGroupRankings(db, groupId, now);

  return rows.length;
}

export function rerankGroupRankings(db: any, groupId: number, updatedAt = nowIso()) {
  const rankings = db.prepare(`
    SELECT r.id
    FROM event_rankings r
    LEFT JOIN event_players p ON p.id = r.player_id
    WHERE r.group_id = ? AND p.group_id=r.group_id
      AND p.audit_status!='rejected' AND p.status NOT IN ('withdrawn','cancelled')
    ORDER BY r.calculated_total DESC, CAST(NULLIF(p.player_no, '') AS INTEGER) ASC, p.player_no ASC, r.player_id ASC
  `).all(groupId);
  const update = db.prepare('UPDATE event_rankings SET rank_no = ?, updated_at = ? WHERE id = ?');
  rankings.forEach((row: any, index: number) => update.run(index + 1, updatedAt, row.id));
  return rankings.length;
}
