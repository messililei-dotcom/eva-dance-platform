#!/usr/bin/env node

const fs = require('fs');
const Database = require('better-sqlite3');

function arg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function parseJson(value) {
  try { return value ? JSON.parse(String(value)) : {}; } catch { return {}; }
}

const dbPath = arg('--db', 'admin.db');
const planPath = arg('--plan');
const apply = process.argv.includes('--apply');
if (!planPath) throw new Error('Missing --plan');

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
if (plan.kind !== 'api_vmp_score_recovery' || plan.version !== 1) throw new Error('Unsupported recovery plan');
if (!plan.safety?.replaceScoresOnlyInAllowlist || !plan.safety?.preserveNonApiScores || !plan.safety?.preserveExistingPlayers) {
  throw new Error('Recovery plan safety declaration is missing');
}

const db = new Database(dbPath, { readonly: !apply, fileMustExist: true });
db.pragma('foreign_keys = ON');
const allowlist = plan.safety.competitionAllowlist.map(Number);
const blocklist = plan.safety.deletedCompetitionBlocklist.map(Number);
const placeholders = allowlist.map(() => '?').join(',');
const beforeTotal = Number(db.prepare('SELECT COUNT(*) AS count FROM event_scores').get().count);
const beforeApi = Number(db.prepare(`SELECT COUNT(*) AS count FROM event_scores WHERE competition_id IN (${placeholders})`).get(...allowlist).count);
const beforeNonApi = beforeTotal - beforeApi;

for (const competitionId of allowlist) {
  if (!db.prepare('SELECT 1 FROM event_competitions WHERE id = ?').get(competitionId)) throw new Error(`Allowlisted competition is missing: ${competitionId}`);
}
for (const competitionId of blocklist) {
  if (db.prepare('SELECT 1 FROM event_competitions WHERE id = ?').get(competitionId)) throw new Error(`Blocked/deleted competition exists: ${competitionId}`);
}

const getPlayer = db.prepare('SELECT * FROM event_players WHERE id = ?');
const getRecoveredPlayer = db.prepare("SELECT * FROM event_players WHERE json_extract(remark, '$.score_recovery.key') = ?");
const getJudge = db.prepare('SELECT * FROM event_judges WHERE id = ?');
const getRecoveredJudge = db.prepare("SELECT * FROM event_judges WHERE json_extract(bio, '$.score_recovery.key') = ?");
const getGroup = db.prepare('SELECT id, competition_id FROM event_groups WHERE id = ?');

const playerIds = new Map();
const judgeIds = new Map();
const invalid = [];
const report = {
  mode: apply ? 'apply' : 'preview',
  competitions: allowlist.length,
  blockedCompetitions: blocklist.length,
  scoreRowsBefore: beforeTotal,
  apiScoreRowsBefore: beforeApi,
  nonApiScoreRowsBefore: beforeNonApi,
  planScoreRows: plan.scores.length,
  playersToCreate: 0,
  playersCreated: 0,
  judgesToCreate: 0,
  judgesCreated: 0,
  playerFinalUpdates: plan.playerFinalUpdates.length,
  groupJudgeLinksAdded: 0,
  invalid,
};

function resolveExistingReferences() {
  for (const source of plan.playersToCreate) {
    const current = getRecoveredPlayer.get(source.key);
    if (current) playerIds.set(source.key, Number(current.id));
    else report.playersToCreate += 1;
  }
  for (const source of plan.judgesToCreate || []) {
    const current = getRecoveredJudge.get(source.key);
    if (current) judgeIds.set(source.key, Number(current.id));
    else report.judgesToCreate += 1;
  }
  for (const score of plan.scores) {
    const group = getGroup.get(score.groupId);
    if (!group || Number(group.competition_id) !== Number(score.competitionId)) invalid.push({ type: 'group', score });
    if (score.existingPlayerId) {
      const player = getPlayer.get(score.existingPlayerId);
      if (!player || Number(player.competition_id) !== Number(score.competitionId) || Number(player.group_id) !== Number(score.groupId)) invalid.push({ type: 'player', score });
      else playerIds.set(score.playerKey, Number(player.id));
    }
    if (score.existingJudgeId) {
      const judge = getJudge.get(score.existingJudgeId);
      if (!judge) invalid.push({ type: 'judge', score });
      else judgeIds.set(score.judgeKey, Number(judge.id));
    }
  }
  if (invalid.length) throw new Error(`Recovery plan has ${invalid.length} invalid references`);
}

resolveExistingReferences();

if (apply) {
  const insertPlayer = db.prepare(`
    INSERT INTO event_players (
      competition_id, group_id, player_no, name, phone, organization, teacher,
      status, audit_status, paid_status, score_status, remark,
      registered_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 'approved', 'paid', 'scored', ?, ?, ?, ?)
  `);
  const insertJudge = db.prepare(`
    INSERT INTO event_judges (name, phone, status, bio, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const updatePlayerFinal = db.prepare('UPDATE event_players SET remark = ?, updated_at = ? WHERE id = ?');
  const deleteScores = db.prepare(`DELETE FROM event_scores WHERE competition_id IN (${placeholders})`);
  const insertScore = db.prepare(`
    INSERT INTO event_scores (
      competition_id, group_id, player_id, judge_id,
      raw_score, criteria_scores_json, calculated_score, published_score,
      score_status, submitted_at, reviewed_at, published_at, version,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, 1, ?, ?)
  `);
  const insertGroupJudge = db.prepare(`
    INSERT OR IGNORE INTO event_group_judges (
      competition_id, group_id, judge_id, role, weight, auth_enabled, status, created_at, updated_at
    ) VALUES (?, ?, ?, 'judge', 1, 1, 'active', ?, ?)
  `);
  const markPlayerScored = db.prepare("UPDATE event_players SET score_status = 'scored', updated_at = ? WHERE id = ?");

  db.transaction(() => {
    const now = new Date().toISOString();
    for (const source of plan.playersToCreate) {
      if (playerIds.has(source.key)) continue;
      const remark = {
        source: 'api_vmp_score_recovery',
        legacy_id: source.legacyPlayerId,
        score_recovery: { key: source.key, restoredAt: now },
        legacy_payload: {
          legacy_source: 'api_vmp_20240121',
          legacy_id: source.legacySignupId,
          name: source.name,
          show_name: source.showName,
          mobile: source.phone,
          score: source.finalScore,
          complete: source.complete,
          raw: source.raw,
        },
      };
      const createdAt = source.registeredAt || now;
      const result = insertPlayer.run(source.competitionId, source.groupId, source.playerNo, source.name, source.phone, source.organization, source.teacher, JSON.stringify(remark), createdAt, now, now);
      playerIds.set(source.key, Number(result.lastInsertRowid));
      report.playersCreated += 1;
    }
    for (const source of plan.judgesToCreate || []) {
      if (judgeIds.has(source.key)) continue;
      const bio = { source: 'api_vmp_score_recovery', score_recovery: { key: source.key, restoredAt: now }, legacy_payload: source.raw };
      const result = insertJudge.run(source.name, source.phone, source.status, JSON.stringify(bio), now, now);
      judgeIds.set(source.key, Number(result.lastInsertRowid));
      report.judgesCreated += 1;
    }
    for (const update of plan.playerFinalUpdates) {
      const current = getPlayer.get(update.playerId);
      if (!current) throw new Error(`Final-score player is missing: ${update.playerId}`);
      const remark = parseJson(current.remark);
      remark.legacy_payload = { ...(remark.legacy_payload || {}), score: update.finalScore, complete: update.complete };
      remark.score_source = { kind: 'api_vmp_latest_snapshot', legacyPlayerId: update.legacyPlayerId, restoredAt: now };
      updatePlayerFinal.run(JSON.stringify(remark), now, current.id);
    }
    deleteScores.run(...allowlist);
    for (const score of plan.scores) {
      const playerId = playerIds.get(score.playerKey);
      const judgeId = judgeIds.get(score.judgeKey);
      if (!playerId || !judgeId) throw new Error(`Unresolved score reference: ${score.playerKey} / ${score.judgeKey}`);
      const timestamp = score.submittedAt || now;
      const criteria = {
        technique: score.details[0],
        musicality: score.details[1],
        choreography: score.details[2],
        presentation: score.details[3],
        overall: score.details[4],
        legacy: {
          source: 'api_vmp_20240121_144607.sql',
          scoreId: score.legacyScoreId,
          playerId: score.legacyPlayerId,
          judgeId: score.legacyJudgeId,
          details: score.details,
        },
      };
      insertScore.run(score.competitionId, score.groupId, playerId, judgeId, score.score, JSON.stringify(criteria), score.score, score.score, timestamp, timestamp, timestamp, timestamp, now);
      const linked = insertGroupJudge.run(score.competitionId, score.groupId, judgeId, now, now);
      report.groupJudgeLinksAdded += Number(linked.changes || 0);
      markPlayerScored.run(now, playerId);
    }
  })();
}

const afterTotal = Number(db.prepare('SELECT COUNT(*) AS count FROM event_scores').get().count);
const afterApi = Number(db.prepare(`SELECT COUNT(*) AS count FROM event_scores WHERE competition_id IN (${placeholders})`).get(...allowlist).count);
const afterNonApi = afterTotal - afterApi;
report.scoreRowsAfter = afterTotal;
report.apiScoreRowsAfter = afterApi;
report.nonApiScoreRowsAfter = afterNonApi;
report.foreignKeyErrors = db.prepare('PRAGMA foreign_key_check').all().length;
report.integrity = db.prepare('PRAGMA integrity_check').get().integrity_check;
if (apply && afterApi !== plan.scores.length) throw new Error(`API score count mismatch: ${afterApi}`);
if (afterNonApi !== beforeNonApi) throw new Error('Non-API scores changed unexpectedly');
if (report.foreignKeyErrors) throw new Error(`Foreign key errors: ${report.foreignKeyErrors}`);
if (report.integrity !== 'ok') throw new Error(`Integrity check failed: ${report.integrity}`);
console.log(JSON.stringify(report, null, 2));
db.close();
