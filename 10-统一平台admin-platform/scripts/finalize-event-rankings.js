#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { loadEnvConfig } = require('@next/env');
const Database = require('better-sqlite3');

loadEnvConfig(process.cwd());

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const dbArgIndex = args.indexOf('--db');
const configuredPath = dbArgIndex >= 0
  ? args[dbArgIndex + 1]
  : (process.env.ADMIN_DB_PATH || process.env.UNIFIED_DB_PATH || 'admin.db');
const dbPath = path.isAbsolute(configuredPath) ? configuredPath : path.resolve(process.cwd(), configuredPath);

if (!fs.existsSync(dbPath)) throw new Error(`数据库不存在：${dbPath}`);

const db = new Database(dbPath, apply ? {} : { readonly: true });
db.pragma('foreign_keys = ON');

function parseCriteria(value) {
  try {
    return value ? JSON.parse(String(value)) : {};
  } catch {
    return {};
  }
}

function summarizeJudgeRows(rows) {
  const byJudge = new Map();
  for (const row of rows) {
    const judgeId = Number(row.judge_id);
    if (!byJudge.has(judgeId)) byJudge.set(judgeId, []);
    byJudge.get(judgeId).push(row);
  }

  return [...byJudge.entries()].map(([judgeId, judgeRows]) => {
    const modern = judgeRows
      .filter((row) => !parseCriteria(row.criteria_scores_json).legacy_user_id)
      .sort((a, b) => Number(b.version || 0) - Number(a.version || 0));
    if (modern.length) {
      return {
        judgeId,
        score: Number(modern[0].calculated_score || 0),
        weight: Number(modern[0].weight || 1),
      };
    }

    const latestByCriterion = new Map();
    for (const row of judgeRows) {
      const criteria = parseCriteria(row.criteria_scores_json);
      for (const [criterion, rawValue] of Object.entries(criteria)) {
        if (criterion === 'legacy_user_id') continue;
        const score = Number(rawValue);
        const version = Number(row.version || 0);
        if (!Number.isFinite(score)) continue;
        const current = latestByCriterion.get(criterion);
        if (!current || version > current.version) latestByCriterion.set(criterion, { score, version });
      }
    }
    const latest = [...judgeRows].sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0];
    return {
      judgeId,
      score: [...latestByCriterion.values()].reduce((sum, item) => sum + item.score, 0),
      weight: Number(latest?.weight || 1),
    };
  });
}

function ruleForGroup(group) {
  let rule = group.score_rule_id
    ? db.prepare('SELECT * FROM event_score_rules WHERE id = ?').get(group.score_rule_id)
    : null;
  if (!rule) {
    const rules = db.prepare('SELECT * FROM event_score_rules WHERE competition_id = ? ORDER BY id').all(group.competition_id);
    if (rules.length) {
      rule = {
        ...rules[0],
        drop_high_low: rules.some((item) => Number(item.drop_high_low)) ? 1 : 0,
        decimal_places: Number(rules[0].decimal_places ?? 2),
      };
    }
  }
  return rule || { drop_high_low: 0, decimal_places: 2 };
}

const groups = db.prepare(`
  SELECT g.*
  FROM event_groups g
  WHERE EXISTS (
      SELECT 1 FROM event_scores s
      WHERE s.group_id = g.id
        AND s.score_status IN ('submitted', 'reviewed', 'published')
    )
    OR EXISTS (
      SELECT 1 FROM event_players p
      WHERE p.group_id = g.id
        AND CAST(json_extract(p.remark, '$.legacy_payload.score') AS REAL) > 0
    )
  ORDER BY g.competition_id, g.id
`).all();

const selectScores = db.prepare(`
  SELECT s.player_id, s.judge_id, s.calculated_score, s.criteria_scores_json, s.version,
         COALESCE(gj.weight, 1) AS weight
  FROM event_scores s
  LEFT JOIN event_group_judges gj ON gj.group_id = s.group_id AND gj.judge_id = s.judge_id
  WHERE s.group_id = ?
    AND s.score_status IN ('submitted', 'reviewed', 'published')
  ORDER BY s.player_id, s.judge_id, s.version DESC
`);
const selectPlayers = db.prepare(`
  SELECT p.*
  FROM event_players p
  WHERE p.group_id = ?
  ORDER BY p.player_no, p.id
`);
const deleteRankings = db.prepare('DELETE FROM event_rankings WHERE group_id = ?');
const insertRanking = db.prepare(`
  INSERT INTO event_rankings (
    competition_id, group_id, player_id, raw_total, calculated_total,
    published_total, rank_no, status, recalculated_at, published_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)
`);
const lockGroup = db.prepare("UPDATE event_groups SET scoring_status = 'locked', updated_at = ? WHERE id = ?");
const markPlayersScored = db.prepare(`
  UPDATE event_players
  SET score_status = 'scored', updated_at = ?
  WHERE group_id = ?
    AND (
      EXISTS (
        SELECT 1 FROM event_scores s
        WHERE s.group_id = event_players.group_id AND s.player_id = event_players.id
          AND s.score_status IN ('submitted', 'reviewed', 'published')
      )
      OR CAST(json_extract(remark, '$.legacy_payload.score') AS REAL) > 0
    )
`);

const summary = {
  mode: apply ? 'apply' : 'dry-run',
  database: dbPath,
  scoredGroups: groups.length,
  finalizedGroups: 0,
  rankingRows: 0,
  legacyFinalScoresUsed: 0,
  calculatedScoresUsed: 0,
  skippedGroups: [],
};

const finalizeAll = db.transaction(() => {
  const now = new Date().toISOString();
  for (const group of groups) {
    const players = selectPlayers.all(group.id);
    const scoreRows = selectScores.all(group.id);
    const byPlayer = new Map();
    for (const row of scoreRows) {
      const playerId = Number(row.player_id);
      if (!byPlayer.has(playerId)) byPlayer.set(playerId, []);
      byPlayer.get(playerId).push(row);
    }
    const rule = ruleForGroup(group);
    const decimals = Math.max(0, Math.min(4, Number(rule.decimal_places ?? 2)));
    const rankings = players.map((player) => {
      const legacyPayload = parseCriteria(player.remark).legacy_payload || {};
      const legacyFinalScore = Number(legacyPayload.score || 0);
      const judgeScores = summarizeJudgeRows(byPlayer.get(Number(player.id)) || []).sort((a, b) => a.score - b.score);
      const used = Number(rule.drop_high_low) && judgeScores.length >= 3 ? judgeScores.slice(1, -1) : judgeScores;
      const weightSum = used.reduce((sum, item) => sum + item.weight, 0);
      const calculated = used.length
        ? used.reduce((sum, item) => sum + item.score * item.weight, 0) / (weightSum || used.length)
        : 0;
      const hasLegacyFinal = Number.isFinite(legacyFinalScore) && legacyFinalScore > 0;
      return {
        player,
        total: Number((hasLegacyFinal ? legacyFinalScore : calculated).toFixed(decimals)),
        hasScore: hasLegacyFinal || judgeScores.length > 0,
        source: hasLegacyFinal ? 'legacy_final' : 'calculated',
      };
    }).filter((item) => item.hasScore)
      .sort((a, b) => b.total - a.total || String(a.player.player_no || '').localeCompare(String(b.player.player_no || '')) || Number(a.player.id) - Number(b.player.id));

    if (!rankings.length) {
      summary.skippedGroups.push({ groupId: group.id, name: group.name, reason: '无可汇总的有效评分' });
      continue;
    }

    summary.finalizedGroups += 1;
    summary.rankingRows += rankings.length;
    summary.legacyFinalScoresUsed += rankings.filter((item) => item.source === 'legacy_final').length;
    summary.calculatedScoresUsed += rankings.filter((item) => item.source === 'calculated').length;
    if (!apply) continue;

    deleteRankings.run(group.id);
    rankings.forEach((item, index) => {
      insertRanking.run(
        group.competition_id,
        group.id,
        item.player.id,
        item.total,
        item.total,
        item.total,
        index + 1,
        now,
        now,
        now,
      );
    });
    lockGroup.run(now, group.id);
    markPlayersScored.run(now, group.id);
  }
});

if (apply) finalizeAll();
else {
  // Run the same calculation without writes.
  for (const group of groups) {
    const players = selectPlayers.all(group.id);
    const scoreRows = selectScores.all(group.id);
    const byPlayer = new Map();
    scoreRows.forEach((row) => {
      const playerId = Number(row.player_id);
      if (!byPlayer.has(playerId)) byPlayer.set(playerId, []);
      byPlayer.get(playerId).push(row);
    });
    const validPlayers = players.filter((player) => {
      const legacyFinalScore = Number(parseCriteria(player.remark).legacy_payload?.score || 0);
      return legacyFinalScore > 0 || summarizeJudgeRows(byPlayer.get(Number(player.id)) || []).length > 0;
    });
    if (validPlayers.length) {
      summary.finalizedGroups += 1;
      summary.rankingRows += validPlayers.length;
      summary.legacyFinalScoresUsed += validPlayers.filter((player) => Number(parseCriteria(player.remark).legacy_payload?.score || 0) > 0).length;
      summary.calculatedScoresUsed += validPlayers.filter((player) => Number(parseCriteria(player.remark).legacy_payload?.score || 0) <= 0).length;
    } else {
      summary.skippedGroups.push({ groupId: group.id, name: group.name, reason: '无可汇总的有效评分' });
    }
  }
}

summary.skippedGroupCount = summary.skippedGroups.length;
summary.skippedGroups = summary.skippedGroups.slice(0, 50);
console.log(JSON.stringify(summary, null, 2));
db.close();
