#!/usr/bin/env node

const fs = require('fs');
const Database = require('better-sqlite3');

function arg(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing ${name}`);
  return process.argv[index + 1];
}

const db = new Database(arg('--db'), { readonly: true, fileMustExist: true });
const scorePlan = JSON.parse(fs.readFileSync(arg('--score-plan'), 'utf8'));
const finalPlan = JSON.parse(fs.readFileSync(arg('--final-plan'), 'utf8'));
const allowlist = scorePlan.safety.competitionAllowlist.map(Number);
const placeholders = allowlist.map(() => '?').join(',');

const players = new Map(db.prepare('SELECT id, remark FROM event_players').all().map((row) => [Number(row.id), row]));
const recoveredPlayers = new Map();
for (const row of players.values()) {
  try {
    const key = JSON.parse(row.remark || '{}')?.score_recovery?.key;
    if (key) recoveredPlayers.set(key, Number(row.id));
  } catch {}
}
const scores = db.prepare(`
  SELECT group_id, player_id, judge_id, published_score
  FROM event_scores WHERE competition_id IN (${placeholders})
`).all(...allowlist);
const scoreIndex = new Map(scores.map((row) => [`${row.group_id}:${row.player_id}:${row.judge_id}`, Number(row.published_score)]));
let scoreMismatches = 0;
for (const row of scorePlan.scores) {
  const playerId = Number(row.existingPlayerId || recoveredPlayers.get(row.playerKey));
  const judgeId = Number(row.existingJudgeId || 0);
  const actual = scoreIndex.get(`${row.groupId}:${playerId}:${judgeId}`);
  if (!Number.isFinite(actual) || Math.abs(actual - Number(row.score)) > 1e-7) scoreMismatches += 1;
}

const getRanking = db.prepare('SELECT rank_no, published_total, manual_total FROM event_rankings WHERE group_id = ? AND player_id = ?');
let finalMismatches = 0;
for (const row of finalPlan.rows) {
  const playerId = recoveredPlayers.get(row.recoveryKey) || Number(row.existingPlayerId || 0);
  const actual = getRanking.get(row.groupId, playerId);
  if (!actual || Number(actual.rank_no) !== Number(row.rankNo) || Math.abs(Number(actual.published_total) - Number(row.score)) > 1e-7 || Math.abs(Number(actual.manual_total) - Number(row.score)) > 1e-7) finalMismatches += 1;
}

const report = {
  integrity: db.pragma('integrity_check')[0].integrity_check,
  foreignKeyErrors: db.pragma('foreign_key_check').length,
  competitionsPresent: Number(db.prepare(`SELECT COUNT(*) AS count FROM event_competitions WHERE id IN (${placeholders})`).get(...allowlist).count),
  blockedCompetitionsPresent: scorePlan.safety.deletedCompetitionBlocklist.filter((id) => db.prepare('SELECT 1 FROM event_competitions WHERE id = ?').get(id)),
  apiScoreRows: scores.length,
  expectedApiScoreRows: scorePlan.scores.length,
  scoreMismatches,
  excelFinalRows: finalPlan.rows.length,
  excelFinalMismatches: finalMismatches,
  placeholderPlayersWithScores: Number(db.prepare(`
    SELECT COUNT(DISTINCT p.id) AS count
    FROM event_players p JOIN event_scores s ON s.player_id = p.id
    WHERE p.competition_id IN (${placeholders}) AND p.name = '历史选手 undefined'
  `).get(...allowlist).count),
};
console.log(JSON.stringify(report, null, 2));
if (report.integrity !== 'ok' || report.foreignKeyErrors || report.competitionsPresent !== allowlist.length || report.blockedCompetitionsPresent.length || report.apiScoreRows !== report.expectedApiScoreRows || report.scoreMismatches || report.excelFinalMismatches || report.placeholderPlayersWithScores) process.exitCode = 1;
db.close();
